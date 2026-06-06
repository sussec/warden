// Package server exposes the warden-osv HTTP API: a thin, cached facade over
// the OSV.dev v1 API plus a flattened advisory shape tailored for Warden.
package server

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/sussec/warden/warden-osv/internal/cache"
	"github.com/sussec/warden/warden-osv/internal/enrich"
	"github.com/sussec/warden/warden-osv/internal/osv"
)

// OsvAPI is the part of the OSV client the server uses (swap in tests).
type OsvAPI interface {
	GetVuln(ctx context.Context, id string) (*osv.Vulnerability, error)
	QueryPackage(ctx context.Context, ecosystem, name, version string) ([]osv.Vulnerability, error)
	QueryBatch(ctx context.Context, queries []osv.Query) (*osv.BatchResponse, error)
}

// Server routes warden-osv endpoints.
type Server struct {
	osv      OsvAPI
	log      *slog.Logger
	vulns    *cache.Cache[*osv.Vulnerability]
	queries  *cache.Cache[[]osv.Vulnerability]
	enricher *enrich.Enricher
}

// Config tunes the server.
type Config struct {
	CacheTTL time.Duration
	CacheMax int
	// Enricher adds EPSS/KEV exploit intelligence to advisories; nil disables.
	Enricher *enrich.Enricher
}

// New builds a Server.
func New(client OsvAPI, log *slog.Logger, cfg Config) *Server {
	if cfg.CacheTTL <= 0 {
		cfg.CacheTTL = time.Hour
	}
	if cfg.CacheMax <= 0 {
		cfg.CacheMax = 10_000
	}
	return &Server{
		osv:      client,
		log:      log,
		vulns:    cache.New[*osv.Vulnerability](cfg.CacheTTL, cfg.CacheMax),
		queries:  cache.New[[]osv.Vulnerability](cfg.CacheTTL, cfg.CacheMax),
		enricher: cfg.Enricher,
	}
}

// Handler returns the routed http.Handler with middleware applied.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.health)
	mux.HandleFunc("GET /v1/vulns/{id}", s.getVuln)
	mux.HandleFunc("GET /v1/advisory/{id}", s.getAdvisory)
	mux.HandleFunc("GET /v1/packages/{ecosystem}/{name}/{version}", s.packageAdvisories)
	mux.HandleFunc("POST /v1/query", s.query)
	mux.HandleFunc("POST /v1/querybatch", s.queryBatch)
	return s.recoverer(s.logged(mux))
}

// ---- handlers --------------------------------------------------------------

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// getVuln proxies the raw OSV record (full schema) by id.
func (s *Server) getVuln(w http.ResponseWriter, r *http.Request) {
	v, err := s.lookup(r.Context(), r.PathValue("id"))
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, v)
}

// Advisory is the flattened shape Warden consumes for finding drill-down.
type Advisory struct {
	ID         string            `json:"id"`
	Aliases    []string          `json:"aliases,omitempty"`
	Summary    string            `json:"summary,omitempty"`
	Details    string            `json:"details,omitempty"`
	Severity   string            `json:"severity,omitempty"` // Critical/High/Medium/Low
	Cvss       string            `json:"cvss,omitempty"`     // CVSS vector
	Published  string            `json:"published,omitempty"`
	Modified   string            `json:"modified,omitempty"`
	Withdrawn  string            `json:"withdrawn,omitempty"`
	References []osv.Ref         `json:"references,omitempty"`
	Affected   []AffectedPackage `json:"affected,omitempty"`
	// Exploit intelligence (best-effort; omitted when unavailable).
	Epss *enrich.EpssInfo `json:"epss,omitempty"`
	Kev  *enrich.KevInfo  `json:"kev,omitempty"`
}

// AffectedPackage is one affected package with its first published fix.
type AffectedPackage struct {
	Ecosystem    string `json:"ecosystem"`
	Name         string `json:"name"`
	FixedVersion string `json:"fixedVersion,omitempty"`
}

// getAdvisory returns the flattened advisory for a finding identity.
func (s *Server) getAdvisory(w http.ResponseWriter, r *http.Request) {
	v, err := s.lookup(r.Context(), r.PathValue("id"))
	if err != nil {
		s.fail(w, err)
		return
	}
	a := flatten(v)
	s.enrichAll(r.Context(), []*Advisory{a})
	writeJSON(w, http.StatusOK, a)
}

// packageAdvisories lists flattened advisories for one package version.
func (s *Server) packageAdvisories(w http.ResponseWriter, r *http.Request) {
	eco, name, version := r.PathValue("ecosystem"), r.PathValue("name"), r.PathValue("version")
	key := eco + "\x00" + name + "\x00" + version
	vulns, ok := s.queries.Get(key)
	if !ok {
		var err error
		vulns, err = s.osv.QueryPackage(r.Context(), eco, name, version)
		if err != nil {
			s.fail(w, err)
			return
		}
		s.queries.Set(key, vulns)
	}
	out := make([]Advisory, 0, len(vulns))
	for i := range vulns {
		out = append(out, *flatten(&vulns[i]))
	}
	refs := make([]*Advisory, len(out))
	for i := range out {
		refs[i] = &out[i]
	}
	s.enrichAll(r.Context(), refs)
	writeJSON(w, http.StatusOK, map[string]any{"advisories": out})
}

// query proxies POST /v1/query (single package/commit lookup, full records).
func (s *Server) query(w http.ResponseWriter, r *http.Request) {
	var q osv.Query
	if err := decode(w, r, &q); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if q.Commit == "" && q.Package == nil {
		writeError(w, http.StatusBadRequest, "either commit or package is required")
		return
	}
	if q.Package != nil {
		vulns, err := s.osv.QueryPackage(r.Context(), q.Package.Ecosystem, q.Package.Name, q.Version)
		if err != nil {
			s.fail(w, err)
			return
		}
		writeJSON(w, http.StatusOK, osv.QueryResponse{Vulns: vulns})
		return
	}
	// Commit queries pass through as a single page.
	res, err := s.osv.QueryBatch(r.Context(), []osv.Query{q})
	if err != nil {
		s.fail(w, err)
		return
	}
	// Resolve ids to full records (commit queries are rare; N is small).
	var vulns []osv.Vulnerability
	if len(res.Results) > 0 {
		for _, bv := range res.Results[0].Vulns {
			v, err := s.lookup(r.Context(), bv.ID)
			if err != nil {
				s.fail(w, err)
				return
			}
			vulns = append(vulns, *v)
		}
	}
	writeJSON(w, http.StatusOK, osv.QueryResponse{Vulns: vulns})
}

// queryBatch proxies POST /v1/querybatch (id-only results, mirrors OSV).
func (s *Server) queryBatch(w http.ResponseWriter, r *http.Request) {
	var q osv.BatchQuery
	if err := decode(w, r, &q); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if len(q.Queries) == 0 || len(q.Queries) > 1000 {
		writeError(w, http.StatusBadRequest, "queries must contain 1–1000 entries")
		return
	}
	res, err := s.osv.QueryBatch(r.Context(), q.Queries)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

// ---- helpers ---------------------------------------------------------------

func (s *Server) lookup(ctx context.Context, id string) (*osv.Vulnerability, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return nil, osv.ErrNotFound
	}
	if v, ok := s.vulns.Get(id); ok {
		return v, nil
	}
	v, err := s.osv.GetVuln(ctx, id)
	if err != nil {
		return nil, err
	}
	s.vulns.Set(id, v)
	return v, nil
}

func flatten(v *osv.Vulnerability) *Advisory {
	cvss, bucket := osv.CvssScore(v)
	a := &Advisory{
		ID:         v.ID,
		Aliases:    v.Aliases,
		Summary:    v.Summary,
		Details:    v.Details,
		Severity:   bucket,
		Cvss:       cvss,
		Published:  v.Published,
		Modified:   v.Modified,
		Withdrawn:  v.Withdrawn,
		References: v.References,
	}
	for _, aff := range v.Affected {
		a.Affected = append(a.Affected, AffectedPackage{
			Ecosystem:    aff.Package.Ecosystem,
			Name:         aff.Package.Name,
			FixedVersion: firstFixedInEntry(aff),
		})
	}
	return a
}

// firstFixedInEntry scans only this Affected entry's own ranges — advisories
// often repeat one package name across ecosystems/registries, and a fix in
// one entry must not leak onto another that has none.
func firstFixedInEntry(a osv.Affected) string {
	for _, r := range a.Ranges {
		for _, e := range r.Events {
			if e.Fixed != "" {
				return e.Fixed
			}
		}
	}
	return ""
}

// enrichAll attaches EPSS/KEV intel to advisories in one batched lookup.
// Best-effort: a nil enricher or upstream failure leaves advisories bare.
func (s *Server) enrichAll(ctx context.Context, advisories []*Advisory) {
	if s.enricher == nil || len(advisories) == 0 {
		return
	}
	cves := make([]string, 0, len(advisories))
	for _, a := range advisories {
		if cve := enrich.CveOf(a.ID, a.Aliases); cve != "" {
			cves = append(cves, cve)
		}
	}
	results := s.enricher.Lookup(ctx, cves)
	for _, a := range advisories {
		cve := enrich.CveOf(a.ID, a.Aliases)
		if r, ok := results[cve]; ok {
			a.Epss, a.Kev = r.Epss, r.Kev
		}
	}
}

func (s *Server) fail(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, osv.ErrNotFound):
		writeError(w, http.StatusNotFound, "advisory not found")
	case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
		writeError(w, http.StatusGatewayTimeout, "upstream timeout")
	default:
		s.log.Error("upstream failure", "error", err)
		writeError(w, http.StatusBadGateway, "advisory backend unavailable")
	}
}

// decode limits the body and passes w so the server closes the connection
// (instead of draining) when the limit is exceeded.
func decode(w http.ResponseWriter, r *http.Request, out any) error {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	dec.DisallowUnknownFields()
	return dec.Decode(out)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// ---- middleware ------------------------------------------------------------

func (s *Server) logged(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(sw, r)
		s.log.Info("request",
			"method", r.Method, "path", r.URL.Path,
			"status", sw.status, "duration", time.Since(start).Round(time.Millisecond).String())
	})
}

func (s *Server) recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				s.log.Error("panic", "recover", rec, "path", r.URL.Path)
				writeError(w, http.StatusInternalServerError, "internal error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

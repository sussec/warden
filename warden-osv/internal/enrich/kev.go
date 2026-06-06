// Package enrich layers exploit-intelligence signals (CISA KEV, FIRST.org
// EPSS) onto OSV advisories so Warden can rank findings by real-world risk,
// not CVSS alone.
package enrich

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"sync"
	"time"
)

// DefaultKevURL is the canonical CISA Known Exploited Vulnerabilities feed.
const DefaultKevURL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"

// KevEntry is the per-CVE subset of the KEV catalog Warden consumes.
type KevEntry struct {
	CveID                      string `json:"cveID"`
	VendorProject              string `json:"vendorProject"`
	Product                    string `json:"product"`
	VulnerabilityName          string `json:"vulnerabilityName"`
	DateAdded                  string `json:"dateAdded"`
	DueDate                    string `json:"dueDate"`
	KnownRansomwareCampaignUse string `json:"knownRansomwareCampaignUse"`
}

// kevCatalog mirrors the feed's top-level envelope.
type kevCatalog struct {
	CatalogVersion  string     `json:"catalogVersion"`
	DateReleased    string     `json:"dateReleased"`
	Count           int        `json:"count"`
	Vulnerabilities []KevEntry `json:"vulnerabilities"`
}

// Kev holds an in-memory copy of the KEV catalog, refreshed in the background.
// The catalog is small (~1.6k entries / <2 MB), so a full map is cheap.
type Kev struct {
	url  string
	http *http.Client
	log  *slog.Logger

	mu      sync.RWMutex
	byCve   map[string]KevEntry
	version string
}

// NewKev builds a KEV catalog holder. Call Run to start background refresh.
func NewKev(url string, log *slog.Logger) *Kev {
	if url == "" {
		url = DefaultKevURL
	}
	return &Kev{
		url:   url,
		http:  &http.Client{Timeout: 60 * time.Second},
		log:   log,
		byCve: map[string]KevEntry{},
	}
}

// Run refreshes the catalog now and then every interval until ctx is done.
// A failed refresh keeps the previous snapshot — stale beats empty.
func (k *Kev) Run(ctx context.Context, interval time.Duration) {
	if err := k.refresh(ctx); err != nil {
		k.log.Warn("kev: initial refresh failed", "error", err)
	}
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if err := k.refresh(ctx); err != nil {
				k.log.Warn("kev: refresh failed, keeping previous catalog", "error", err)
			}
		}
	}
}

func (k *Kev) refresh(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, k.url, nil)
	if err != nil {
		return fmt.Errorf("kev: build request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "warden-osv/1.0 (+https://github.com/sussec/warden)")

	res, err := k.http.Do(req)
	if err != nil {
		return fmt.Errorf("kev: fetch: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(io.LimitReader(res.Body, 512))
		return fmt.Errorf("kev: fetch: upstream %d: %s", res.StatusCode, b)
	}

	var cat kevCatalog
	// The feed is ~2 MB today; 64 MB leaves ample headroom while still
	// bounding a misbehaving upstream.
	if err := json.NewDecoder(io.LimitReader(res.Body, 64<<20)).Decode(&cat); err != nil {
		return fmt.Errorf("kev: decode: %w", err)
	}
	if len(cat.Vulnerabilities) == 0 {
		return fmt.Errorf("kev: feed contained no vulnerabilities (version %q)", cat.CatalogVersion)
	}

	byCve := make(map[string]KevEntry, len(cat.Vulnerabilities))
	for _, v := range cat.Vulnerabilities {
		byCve[v.CveID] = v
	}

	k.mu.Lock()
	k.byCve = byCve
	k.version = cat.CatalogVersion
	k.mu.Unlock()
	k.log.Info("kev: catalog refreshed", "version", cat.CatalogVersion, "entries", len(byCve))
	return nil
}

// Lookup returns the KEV entry for a CVE id, if catalogued.
func (k *Kev) Lookup(cve string) (KevEntry, bool) {
	k.mu.RLock()
	defer k.mu.RUnlock()
	e, ok := k.byCve[cve]
	return e, ok
}

// Version reports the loaded catalog version ("" before first refresh).
func (k *Kev) Version() string {
	k.mu.RLock()
	defer k.mu.RUnlock()
	return k.version
}

package enrich

import (
	"context"
	"log/slog"
	"strings"
)

// EpssInfo is the EPSS block attached to an enriched advisory.
type EpssInfo struct {
	Score      float64 `json:"score"`
	Percentile float64 `json:"percentile"`
	Date       string  `json:"date,omitempty"`
}

// KevInfo is the KEV block attached to an enriched advisory. Presence alone
// means "CISA has observed active exploitation".
type KevInfo struct {
	DateAdded     string `json:"dateAdded,omitempty"`
	DueDate       string `json:"dueDate,omitempty"`
	RansomwareUse string `json:"ransomwareUse,omitempty"` // "Known" / "Unknown"
}

// Enricher resolves exploit-intelligence for advisories. Either source may be
// nil (disabled); enrichment is always best-effort and never fails a request.
type Enricher struct {
	epss *Epss
	kev  *Kev
	log  *slog.Logger
}

// New builds an Enricher; pass nil for sources that are disabled.
func New(epss *Epss, kev *Kev, log *slog.Logger) *Enricher {
	return &Enricher{epss: epss, kev: kev, log: log}
}

// CveOf picks the CVE id for an advisory: the id itself when it is a CVE,
// otherwise the first CVE-prefixed alias. Empty when the advisory has none.
func CveOf(id string, aliases []string) string {
	if strings.HasPrefix(id, "CVE-") {
		return id
	}
	for _, a := range aliases {
		if strings.HasPrefix(a, "CVE-") {
			return a
		}
	}
	return ""
}

// Result carries the enrichment for one CVE.
type Result struct {
	Epss *EpssInfo
	Kev  *KevInfo
}

// Lookup resolves EPSS + KEV for a set of CVE ids in one pass. EPSS failures
// degrade to KEV-only results — exploit intel must never break advisory serving.
func (e *Enricher) Lookup(ctx context.Context, cves []string) map[string]Result {
	out := make(map[string]Result, len(cves))
	if e == nil || len(cves) == 0 {
		return out
	}

	var scores map[string]EpssScore
	if e.epss != nil {
		var err error
		scores, err = e.epss.Scores(ctx, cves)
		if err != nil && e.log != nil {
			e.log.Warn("enrich: epss lookup degraded", "error", err)
		}
	}

	for _, cve := range cves {
		cve = strings.ToUpper(strings.TrimSpace(cve))
		if cve == "" {
			continue
		}
		var r Result
		if s, ok := scores[cve]; ok {
			r.Epss = &EpssInfo{Score: s.Score, Percentile: s.Percentile, Date: s.Date}
		}
		if e.kev != nil {
			if k, ok := e.kev.Lookup(cve); ok {
				r.Kev = &KevInfo{DateAdded: k.DateAdded, DueDate: k.DueDate, RansomwareUse: k.KnownRansomwareCampaignUse}
			}
		}
		if r.Epss != nil || r.Kev != nil {
			out[cve] = r
		}
	}
	return out
}

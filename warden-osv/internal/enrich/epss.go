package enrich

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/sussec/warden/warden-osv/internal/cache"
)

// DefaultEpssURL is the public FIRST.org EPSS API endpoint.
const DefaultEpssURL = "https://api.first.org/data/v1/epss"

// epssBatchSize bounds CVEs per request; the API takes comma-separated lists
// and large batches keep round trips (and URL length) reasonable.
const epssBatchSize = 100

// EpssScore is one CVE's exploit-prediction score.
type EpssScore struct {
	Score      float64 `json:"score"`      // probability of exploitation in the next 30 days, 0–1
	Percentile float64 `json:"percentile"` // rank among all scored CVEs, 0–1
	Date       string  `json:"date"`       // score date, YYYY-MM-DD
}

// epssResponse mirrors the FIRST.org envelope. epss/percentile arrive as
// strings (e.g. "0.972240000"), hence the custom row type.
type epssResponse struct {
	Status string    `json:"status"`
	Total  int       `json:"total"`
	Data   []epssRow `json:"data"`
}

type epssRow struct {
	Cve        string `json:"cve"`
	Epss       string `json:"epss"`
	Percentile string `json:"percentile"`
	Date       string `json:"date"`
}

// Epss fetches and caches EPSS scores. Scores refresh daily upstream, so a
// long TTL is appropriate. Misses (unscored CVEs) are cached as nil to avoid
// re-querying them on every advisory view.
type Epss struct {
	url   string
	http  *http.Client
	cache *cache.Cache[*EpssScore]
}

// NewEpss builds an EPSS client caching up to maxEntries scores for ttl.
func NewEpss(apiURL string, ttl time.Duration, maxEntries int) *Epss {
	if apiURL == "" {
		apiURL = DefaultEpssURL
	}
	if ttl <= 0 {
		ttl = 12 * time.Hour
	}
	if maxEntries <= 0 {
		maxEntries = 50_000
	}
	return &Epss{
		url:   apiURL,
		http:  &http.Client{Timeout: 30 * time.Second},
		cache: cache.New[*EpssScore](ttl, maxEntries),
	}
}

// Scores resolves EPSS scores for the given CVE ids, serving from cache and
// batch-fetching only the misses. CVEs unknown to EPSS are absent from the
// result. A partial upstream failure returns what was resolved plus the error.
func (e *Epss) Scores(ctx context.Context, cves []string) (map[string]EpssScore, error) {
	out := make(map[string]EpssScore, len(cves))
	var misses []string
	seen := map[string]bool{}
	for _, cve := range cves {
		cve = strings.ToUpper(strings.TrimSpace(cve))
		if cve == "" || seen[cve] {
			continue
		}
		seen[cve] = true
		if s, ok := e.cache.Get(cve); ok {
			if s != nil {
				out[cve] = *s
			}
			continue
		}
		misses = append(misses, cve)
	}

	for start := 0; start < len(misses); start += epssBatchSize {
		end := min(start+epssBatchSize, len(misses))
		batch := misses[start:end]
		rows, err := e.fetch(ctx, batch)
		if err != nil {
			return out, err
		}
		got := map[string]bool{}
		for _, r := range rows {
			score, err1 := strconv.ParseFloat(r.Epss, 64)
			pct, err2 := strconv.ParseFloat(r.Percentile, 64)
			if err1 != nil || err2 != nil {
				continue // malformed row — skip, do not poison the cache
			}
			s := EpssScore{Score: score, Percentile: pct, Date: r.Date}
			out[r.Cve] = s
			e.cache.Set(r.Cve, &s)
			got[r.Cve] = true
		}
		// Negative-cache CVEs EPSS does not score.
		for _, cve := range batch {
			if !got[cve] {
				e.cache.Set(cve, nil)
			}
		}
	}
	return out, nil
}

func (e *Epss) fetch(ctx context.Context, cves []string) ([]epssRow, error) {
	// Set limit to the batch size: the EPSS API defaults to 100 rows/page, so a
	// full batch would otherwise risk truncation without an explicit limit.
	q := url.Values{
		"cve":   {strings.Join(cves, ",")},
		"limit": {strconv.Itoa(len(cves))},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, e.url+"?"+q.Encode(), nil)
	if err != nil {
		return nil, fmt.Errorf("epss: build request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "warden-osv/1.0 (+https://github.com/sussec/warden)")

	res, err := e.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("epss: fetch: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(io.LimitReader(res.Body, 512))
		return nil, fmt.Errorf("epss: fetch: upstream %d: %s", res.StatusCode, b)
	}

	var body epssResponse
	if err := json.NewDecoder(io.LimitReader(res.Body, 16<<20)).Decode(&body); err != nil {
		return nil, fmt.Errorf("epss: decode: %w", err)
	}
	return body.Data, nil
}

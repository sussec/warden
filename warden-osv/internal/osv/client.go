package osv

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand/v2"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

// DefaultBaseURL is the public OSV.dev API endpoint. Override for mirrors/proxies.
const DefaultBaseURL = "https://api.osv.dev"

// ErrNotFound is returned when the advisory id does not exist upstream.
var ErrNotFound = errors.New("osv: vulnerability not found")

// Client is a typed OSV.dev v1 API client with bounded retries.
// It is safe for concurrent use.
type Client struct {
	baseURL    string
	http       *http.Client
	maxRetries int
	userAgent  string
}

// Option configures a Client.
type Option func(*Client)

// WithBaseURL points the client at an OSV-compatible endpoint (mirror/proxy).
func WithBaseURL(u string) Option { return func(c *Client) { c.baseURL = u } }

// WithHTTPClient swaps the underlying http.Client (e.g. for tests).
func WithHTTPClient(h *http.Client) Option { return func(c *Client) { c.http = h } }

// WithMaxRetries bounds retry attempts for transient failures (default 3).
func WithMaxRetries(n int) Option { return func(c *Client) { c.maxRetries = n } }

// NewClient builds a Client with production defaults.
func NewClient(opts ...Option) *Client {
	c := &Client{
		baseURL:    DefaultBaseURL,
		http:       &http.Client{Timeout: 30 * time.Second},
		maxRetries: 3,
		userAgent:  "warden-osv/1.0 (+https://github.com/sussec/warden)",
	}
	for _, o := range opts {
		o(c)
	}
	return c
}

// GetVuln fetches a single advisory by id (OSV/GHSA/CVE/...). Returns
// ErrNotFound for unknown ids.
func (c *Client) GetVuln(ctx context.Context, id string) (*Vulnerability, error) {
	var out Vulnerability
	path := "/v1/vulns/" + url.PathEscape(id)
	if err := c.do(ctx, http.MethodGet, path, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// QueryPackage lists advisories affecting one package version, following
// pagination until exhausted.
func (c *Client) QueryPackage(ctx context.Context, ecosystem, name, version string) ([]Vulnerability, error) {
	q := Query{Version: version, Package: &Package{Ecosystem: ecosystem, Name: name}}
	var all []Vulnerability
	for {
		var page QueryResponse
		if err := c.do(ctx, http.MethodPost, "/v1/query", q, &page); err != nil {
			return nil, err
		}
		all = append(all, page.Vulns...)
		if page.NextPageToken == "" {
			return all, nil
		}
		q.PageToken = page.NextPageToken
	}
}

// QueryBatch resolves advisory ids for many package versions in one round trip.
func (c *Client) QueryBatch(ctx context.Context, queries []Query) (*BatchResponse, error) {
	var out BatchResponse
	if err := c.do(ctx, http.MethodPost, "/v1/querybatch", BatchQuery{Queries: queries}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// do performs one API call with retry on 429/5xx and transport errors.
func (c *Client) do(ctx context.Context, method, path string, in, out any) error {
	var body []byte
	if in != nil {
		var err error
		if body, err = json.Marshal(in); err != nil {
			return fmt.Errorf("osv: encode request: %w", err)
		}
	}

	var lastErr error
	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		if attempt > 0 {
			if err := sleep(ctx, backoff(attempt)); err != nil {
				return err
			}
		}

		var rdr io.Reader
		if body != nil {
			rdr = bytes.NewReader(body)
		}
		req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, rdr)
		if err != nil {
			return fmt.Errorf("osv: build request: %w", err)
		}
		req.Header.Set("Accept", "application/json")
		req.Header.Set("User-Agent", c.userAgent)
		if body != nil {
			req.Header.Set("Content-Type", "application/json")
		}

		res, err := c.http.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("osv: %s %s: %w", method, path, err)
			continue // transport error — retry
		}

		switch {
		case res.StatusCode == http.StatusOK:
			err = json.NewDecoder(res.Body).Decode(out)
			res.Body.Close()
			if err != nil {
				return fmt.Errorf("osv: decode response: %w", err)
			}
			return nil
		case res.StatusCode == http.StatusNotFound:
			res.Body.Close()
			return ErrNotFound
		case res.StatusCode == http.StatusTooManyRequests || res.StatusCode >= 500:
			b, _ := io.ReadAll(io.LimitReader(res.Body, 512))
			res.Body.Close()
			lastErr = fmt.Errorf("osv: %s %s: upstream %d: %s", method, path, res.StatusCode, b)
			continue // retryable
		default:
			b, _ := io.ReadAll(io.LimitReader(res.Body, 512))
			res.Body.Close()
			return fmt.Errorf("osv: %s %s: upstream %d: %s", method, path, res.StatusCode, b)
		}
	}
	return fmt.Errorf("osv: retries exhausted after %d attempts: %w", c.maxRetries+1, lastErr)
}

// backoff returns an exponential delay with jitter: ~0.5s, 1s, 2s, … capped
// so the shift can never overflow into rand.Int64N(<=0) panic territory.
func backoff(attempt int) time.Duration {
	const maxExp = 10 // caps the base at ~4.3 minutes
	if attempt > maxExp {
		attempt = maxExp
	}
	base := 250 * time.Millisecond * time.Duration(1<<attempt)
	return base + time.Duration(rand.Int64N(int64(base)))
}

func sleep(ctx context.Context, d time.Duration) error {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-t.C:
		return nil
	}
}

// FirstFixedVersion extracts the first "fixed" event for the given package
// name across the advisory's affected ranges; empty when no fix is published.
func FirstFixedVersion(v *Vulnerability, pkgName string) string {
	for _, a := range v.Affected {
		if pkgName != "" && a.Package.Name != pkgName {
			continue
		}
		for _, r := range a.Ranges {
			for _, e := range r.Events {
				if e.Fixed != "" {
					return e.Fixed
				}
			}
		}
	}
	return ""
}

// CvssScore returns the highest CVSS vector found on the advisory plus a
// coarse severity bucket (Critical/High/Medium/Low/Info) derived from the
// database_specific severity when present.
func CvssScore(v *Vulnerability) (vector string, bucket string) {
	for _, s := range v.Severity {
		if s.Type == "CVSS_V4" {
			return s.Score, bucketFromDB(v)
		}
	}
	for _, s := range v.Severity {
		if s.Type == "CVSS_V3" {
			return s.Score, bucketFromDB(v)
		}
	}
	if len(v.Severity) > 0 {
		return v.Severity[0].Score, bucketFromDB(v)
	}
	return "", bucketFromDB(v)
}

func bucketFromDB(v *Vulnerability) string {
	raw, ok := v.DBSpecific["severity"]
	if !ok {
		return ""
	}
	s, _ := raw.(string)
	switch s {
	case "CRITICAL":
		return "Critical"
	case "HIGH":
		return "High"
	case "MODERATE", "MEDIUM":
		return "Medium"
	case "LOW":
		return "Low"
	case "":
		return ""
	default:
		// Some sources put a numeric CVSS here.
		if f, err := strconv.ParseFloat(s, 64); err == nil {
			switch {
			case f >= 9:
				return "Critical"
			case f >= 7:
				return "High"
			case f >= 4:
				return "Medium"
			case f > 0:
				return "Low"
			}
		}
		return ""
	}
}

package server

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/sussec/warden/warden-osv/internal/osv"
)

type fakeOSV struct {
	getCalls   atomic.Int32
	queryCalls atomic.Int32
	vulns      map[string]*osv.Vulnerability
	pkgVulns   []osv.Vulnerability
	batch      *osv.BatchResponse
}

func (f *fakeOSV) GetVuln(_ context.Context, id string) (*osv.Vulnerability, error) {
	f.getCalls.Add(1)
	if v, ok := f.vulns[id]; ok {
		return v, nil
	}
	return nil, osv.ErrNotFound
}

func (f *fakeOSV) QueryPackage(_ context.Context, _, _, _ string) ([]osv.Vulnerability, error) {
	f.queryCalls.Add(1)
	return f.pkgVulns, nil
}

func (f *fakeOSV) QueryBatch(_ context.Context, _ []osv.Query) (*osv.BatchResponse, error) {
	return f.batch, nil
}

func newTestServer(f *fakeOSV) *httptest.Server {
	s := New(f, slog.New(slog.NewTextHandler(io.Discard, nil)), Config{})
	return httptest.NewServer(s.Handler())
}

func get(t *testing.T, url string) (*http.Response, []byte) {
	t.Helper()
	res, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	body, _ := io.ReadAll(res.Body)
	res.Body.Close()
	return res, body
}

func TestHealthz(t *testing.T) {
	srv := newTestServer(&fakeOSV{})
	defer srv.Close()
	res, body := get(t, srv.URL+"/healthz")
	if res.StatusCode != 200 || !strings.Contains(string(body), "ok") {
		t.Fatalf("status=%d body=%s", res.StatusCode, body)
	}
}

func TestGetAdvisoryFlattens(t *testing.T) {
	f := &fakeOSV{vulns: map[string]*osv.Vulnerability{
		"GHSA-1": {
			ID: "GHSA-1", Summary: "bad", Aliases: []string{"CVE-2024-1"},
			Severity:   []osv.Severity{{Type: "CVSS_V3", Score: "CVSS:3.1/X"}},
			DBSpecific: map[string]any{"severity": "HIGH"},
			Affected: []osv.Affected{{
				Package: osv.Package{Ecosystem: "npm", Name: "x"},
				Ranges:  []osv.Range{{Type: "SEMVER", Events: []osv.Event{{Introduced: "0"}, {Fixed: "2.0.0"}}}},
			}},
		},
	}}
	srv := newTestServer(f)
	defer srv.Close()

	res, body := get(t, srv.URL+"/v1/advisory/GHSA-1")
	if res.StatusCode != 200 {
		t.Fatalf("status=%d body=%s", res.StatusCode, body)
	}
	var a Advisory
	if err := json.Unmarshal(body, &a); err != nil {
		t.Fatal(err)
	}
	if a.Severity != "High" || a.Cvss != "CVSS:3.1/X" || a.Affected[0].FixedVersion != "2.0.0" {
		t.Errorf("unexpected advisory %+v", a)
	}
}

func TestGetVulnCaches(t *testing.T) {
	f := &fakeOSV{vulns: map[string]*osv.Vulnerability{"OSV-1": {ID: "OSV-1"}}}
	srv := newTestServer(f)
	defer srv.Close()

	get(t, srv.URL+"/v1/vulns/OSV-1")
	get(t, srv.URL+"/v1/vulns/OSV-1")
	if f.getCalls.Load() != 1 {
		t.Errorf("want 1 upstream call, got %d", f.getCalls.Load())
	}
}

func TestGetVulnNotFound(t *testing.T) {
	srv := newTestServer(&fakeOSV{})
	defer srv.Close()
	res, _ := get(t, srv.URL+"/v1/vulns/NOPE")
	if res.StatusCode != 404 {
		t.Fatalf("want 404, got %d", res.StatusCode)
	}
}

func TestPackageAdvisoriesCached(t *testing.T) {
	f := &fakeOSV{pkgVulns: []osv.Vulnerability{{ID: "GHSA-2", Summary: "s"}}}
	srv := newTestServer(f)
	defer srv.Close()

	res, body := get(t, srv.URL+"/v1/packages/npm/lodash/4.17.20")
	if res.StatusCode != 200 || !strings.Contains(string(body), "GHSA-2") {
		t.Fatalf("status=%d body=%s", res.StatusCode, body)
	}
	get(t, srv.URL+"/v1/packages/npm/lodash/4.17.20")
	if f.queryCalls.Load() != 1 {
		t.Errorf("want 1 upstream query, got %d", f.queryCalls.Load())
	}
}

func TestQueryValidation(t *testing.T) {
	srv := newTestServer(&fakeOSV{})
	defer srv.Close()
	res, err := http.Post(srv.URL+"/v1/query", "application/json", strings.NewReader(`{}`))
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != 400 {
		t.Fatalf("want 400 for empty query, got %d", res.StatusCode)
	}
}

func TestQueryBatchLimits(t *testing.T) {
	srv := newTestServer(&fakeOSV{batch: &osv.BatchResponse{}})
	defer srv.Close()
	res, err := http.Post(srv.URL+"/v1/querybatch", "application/json", strings.NewReader(`{"queries":[]}`))
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != 400 {
		t.Fatalf("want 400 for empty batch, got %d", res.StatusCode)
	}
}

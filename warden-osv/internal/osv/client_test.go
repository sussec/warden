package osv

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
)

func testClient(t *testing.T, handler http.Handler) *Client {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	return NewClient(WithBaseURL(srv.URL), WithHTTPClient(srv.Client()), WithMaxRetries(2))
}

func TestGetVuln(t *testing.T) {
	c := testClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/vulns/GHSA-test" {
			t.Errorf("unexpected path %s", r.URL.Path)
		}
		json.NewEncoder(w).Encode(Vulnerability{ID: "GHSA-test", Summary: "boom",
			Aliases: []string{"CVE-2024-0001"}})
	}))
	v, err := c.GetVuln(context.Background(), "GHSA-test")
	if err != nil {
		t.Fatal(err)
	}
	if v.ID != "GHSA-test" || v.Aliases[0] != "CVE-2024-0001" {
		t.Errorf("unexpected vuln %+v", v)
	}
}

func TestGetVulnNotFound(t *testing.T) {
	c := testClient(t, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	_, err := c.GetVuln(context.Background(), "NOPE-1")
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("want ErrNotFound, got %v", err)
	}
}

func TestRetryOn500ThenSuccess(t *testing.T) {
	var calls atomic.Int32
	c := testClient(t, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		if calls.Add(1) == 1 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(Vulnerability{ID: "OSV-1"})
	}))
	v, err := c.GetVuln(context.Background(), "OSV-1")
	if err != nil {
		t.Fatal(err)
	}
	if v.ID != "OSV-1" || calls.Load() != 2 {
		t.Errorf("want retry then success, calls=%d", calls.Load())
	}
}

func TestRetriesExhausted(t *testing.T) {
	var calls atomic.Int32
	c := testClient(t, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		calls.Add(1)
		w.WriteHeader(http.StatusBadGateway)
	}))
	_, err := c.GetVuln(context.Background(), "OSV-1")
	if err == nil {
		t.Fatal("want error")
	}
	if calls.Load() != 3 { // maxRetries=2 → 3 attempts
		t.Errorf("want 3 attempts, got %d", calls.Load())
	}
}

func TestNonRetryable400(t *testing.T) {
	var calls atomic.Int32
	c := testClient(t, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		calls.Add(1)
		w.WriteHeader(http.StatusBadRequest)
	}))
	_, err := c.GetVuln(context.Background(), "OSV-1")
	if err == nil || calls.Load() != 1 {
		t.Fatalf("want single failing attempt, calls=%d err=%v", calls.Load(), err)
	}
}

func TestQueryPackagePagination(t *testing.T) {
	var calls atomic.Int32
	c := testClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var q Query
		json.NewDecoder(r.Body).Decode(&q)
		if calls.Add(1) == 1 {
			if q.PageToken != "" {
				t.Errorf("first page should have no token")
			}
			json.NewEncoder(w).Encode(QueryResponse{
				Vulns: []Vulnerability{{ID: "A"}}, NextPageToken: "next"})
			return
		}
		if q.PageToken != "next" {
			t.Errorf("want page token 'next', got %q", q.PageToken)
		}
		json.NewEncoder(w).Encode(QueryResponse{Vulns: []Vulnerability{{ID: "B"}}})
	}))
	vulns, err := c.QueryPackage(context.Background(), "npm", "lodash", "4.17.20")
	if err != nil {
		t.Fatal(err)
	}
	if len(vulns) != 2 || vulns[0].ID != "A" || vulns[1].ID != "B" {
		t.Errorf("unexpected vulns %+v", vulns)
	}
}

func TestQueryBatch(t *testing.T) {
	c := testClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/querybatch" {
			t.Errorf("unexpected path %s", r.URL.Path)
		}
		json.NewEncoder(w).Encode(BatchResponse{Results: []BatchResult{
			{Vulns: []BatchVuln{{ID: "GHSA-x"}}}, {},
		}})
	}))
	res, err := c.QueryBatch(context.Background(), []Query{
		{Version: "1.0.0", Package: &Package{Ecosystem: "npm", Name: "a"}},
		{Version: "2.0.0", Package: &Package{Ecosystem: "npm", Name: "b"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Results) != 2 || res.Results[0].Vulns[0].ID != "GHSA-x" {
		t.Errorf("unexpected batch %+v", res)
	}
}

func TestFirstFixedVersion(t *testing.T) {
	v := &Vulnerability{Affected: []Affected{{
		Package: Package{Ecosystem: "npm", Name: "lodash"},
		Ranges: []Range{{Type: "SEMVER", Events: []Event{
			{Introduced: "0"}, {Fixed: "4.17.21"},
		}}},
	}}}
	if got := FirstFixedVersion(v, "lodash"); got != "4.17.21" {
		t.Errorf("want 4.17.21, got %q", got)
	}
	if got := FirstFixedVersion(v, "other"); got != "" {
		t.Errorf("want empty for unknown pkg, got %q", got)
	}
}

func TestCvssScore(t *testing.T) {
	v := &Vulnerability{
		Severity:   []Severity{{Type: "CVSS_V3", Score: "CVSS:3.1/AV:N"}},
		DBSpecific: map[string]any{"severity": "HIGH"},
	}
	vector, bucket := CvssScore(v)
	if vector != "CVSS:3.1/AV:N" || bucket != "High" {
		t.Errorf("got %q %q", vector, bucket)
	}
	numeric := &Vulnerability{DBSpecific: map[string]any{"severity": "9.8"}}
	if _, b := CvssScore(numeric); b != "Critical" {
		t.Errorf("numeric severity bucket: got %q", b)
	}
}

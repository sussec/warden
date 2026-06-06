package enrich

import (
	"context"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestCveOf(t *testing.T) {
	cases := []struct {
		id      string
		aliases []string
		want    string
	}{
		{"CVE-2021-44228", nil, "CVE-2021-44228"},
		{"GHSA-jfh8-c2jp-5v3q", []string{"CVE-2021-44228"}, "CVE-2021-44228"},
		{"GHSA-jfh8-c2jp-5v3q", []string{"SNYK-1", "CVE-2021-44228"}, "CVE-2021-44228"},
		{"GHSA-jfh8-c2jp-5v3q", []string{"SNYK-1"}, ""},
		{"GHSA-jfh8-c2jp-5v3q", nil, ""},
	}
	for _, c := range cases {
		if got := CveOf(c.id, c.aliases); got != c.want {
			t.Errorf("CveOf(%q, %v) = %q, want %q", c.id, c.aliases, got, c.want)
		}
	}
}

func TestKevRefreshAndLookup(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Write([]byte(`{
			"catalogVersion": "2026.06.05",
			"count": 2,
			"vulnerabilities": [
				{"cveID": "CVE-2021-44228", "dateAdded": "2021-12-10", "dueDate": "2021-12-24", "knownRansomwareCampaignUse": "Known"},
				{"cveID": "CVE-2024-0001", "dateAdded": "2024-01-01", "dueDate": "2024-01-15", "knownRansomwareCampaignUse": "Unknown"}
			]
		}`))
	}))
	defer srv.Close()

	k := NewKev(srv.URL, slog.New(slog.NewTextHandler(nil_, nil)))
	if err := k.refresh(context.Background()); err != nil {
		t.Fatalf("refresh: %v", err)
	}
	if k.Version() != "2026.06.05" {
		t.Errorf("Version = %q, want 2026.06.05", k.Version())
	}
	e, ok := k.Lookup("CVE-2021-44228")
	if !ok || e.KnownRansomwareCampaignUse != "Known" || e.DateAdded != "2021-12-10" {
		t.Errorf("Lookup log4shell = %+v, ok=%v", e, ok)
	}
	if _, ok := k.Lookup("CVE-9999-9999"); ok {
		t.Error("Lookup unknown CVE should miss")
	}
}

func TestKevRefreshKeepsOldOnFailure(t *testing.T) {
	var fail atomic.Bool
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		if fail.Load() {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Write([]byte(`{"catalogVersion":"v1","count":1,"vulnerabilities":[{"cveID":"CVE-1-1"}]}`))
	}))
	defer srv.Close()

	k := NewKev(srv.URL, slog.New(slog.NewTextHandler(nil_, nil)))
	if err := k.refresh(context.Background()); err != nil {
		t.Fatalf("first refresh: %v", err)
	}
	fail.Store(true)
	if err := k.refresh(context.Background()); err == nil {
		t.Fatal("second refresh should fail")
	}
	if _, ok := k.Lookup("CVE-1-1"); !ok {
		t.Error("failed refresh must keep previous snapshot")
	}
}

func TestEpssScoresBatchAndCache(t *testing.T) {
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.Write([]byte(`{
			"status": "OK", "total": 1,
			"data": [{"cve": "CVE-2021-44228", "epss": "0.975990000", "percentile": "0.999990000", "date": "2026-06-06"}]
		}`))
	}))
	defer srv.Close()

	e := NewEpss(srv.URL, time.Hour, 100)
	got, err := e.Scores(context.Background(), []string{"CVE-2021-44228", "CVE-0000-0000"})
	if err != nil {
		t.Fatalf("Scores: %v", err)
	}
	s, ok := got["CVE-2021-44228"]
	if !ok || s.Score != 0.97599 || s.Percentile != 0.99999 {
		t.Errorf("score = %+v, ok=%v", s, ok)
	}
	if _, ok := got["CVE-0000-0000"]; ok {
		t.Error("unscored CVE must be absent")
	}

	// Second call must be fully served from cache (positive + negative).
	got2, err := e.Scores(context.Background(), []string{"CVE-2021-44228", "CVE-0000-0000"})
	if err != nil {
		t.Fatalf("Scores cached: %v", err)
	}
	if len(got2) != 1 {
		t.Errorf("cached result len = %d, want 1", len(got2))
	}
	if n := calls.Load(); n != 1 {
		t.Errorf("upstream calls = %d, want 1 (cache miss only once)", n)
	}
}

func TestEnricherLookupDegradesWithoutEpss(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Write([]byte(`{"catalogVersion":"v1","count":1,"vulnerabilities":[{"cveID":"CVE-2021-44228","dateAdded":"2021-12-10","dueDate":"2021-12-24","knownRansomwareCampaignUse":"Known"}]}`))
	}))
	defer srv.Close()

	k := NewKev(srv.URL, slog.New(slog.NewTextHandler(nil_, nil)))
	if err := k.refresh(context.Background()); err != nil {
		t.Fatalf("refresh: %v", err)
	}
	// EPSS pointing at a dead server: enrichment degrades to KEV-only.
	dead := NewEpss("http://127.0.0.1:1", time.Hour, 10)
	en := New(dead, k, slog.New(slog.NewTextHandler(nil_, nil)))

	res := en.Lookup(context.Background(), []string{"CVE-2021-44228"})
	r, ok := res["CVE-2021-44228"]
	if !ok || r.Kev == nil || r.Kev.RansomwareUse != "Known" {
		t.Errorf("KEV-only result = %+v, ok=%v", r, ok)
	}
	if r.Epss != nil {
		t.Error("EPSS must be nil when upstream is down")
	}
}

// nil_ is an io.Writer discarding test log output.
var nil_ = discard{}

type discard struct{}

func (discard) Write(p []byte) (int, error) { return len(p), nil }

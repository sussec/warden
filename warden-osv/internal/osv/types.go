// Package osv implements a typed client for the OSV.dev v1 API
// (https://google.github.io/osv.dev/api/).
package osv

// Vulnerability is the subset of the OSV schema (https://ossf.github.io/osv-schema/)
// Warden consumes. Unknown fields are ignored on decode.
type Vulnerability struct {
	SchemaVersion string     `json:"schema_version,omitempty"`
	ID            string     `json:"id"`
	Summary       string     `json:"summary,omitempty"`
	Details       string     `json:"details,omitempty"`
	Aliases       []string   `json:"aliases,omitempty"`
	Related       []string   `json:"related,omitempty"`
	Modified      string     `json:"modified,omitempty"`
	Published     string     `json:"published,omitempty"`
	Withdrawn     string     `json:"withdrawn,omitempty"`
	Severity      []Severity `json:"severity,omitempty"`
	Affected      []Affected `json:"affected,omitempty"`
	References    []Ref      `json:"references,omitempty"`
	DBSpecific    map[string]any `json:"database_specific,omitempty"`
}

// Severity is a typed severity score, e.g. {type: CVSS_V3, score: "CVSS:3.1/..."}.
type Severity struct {
	Type  string `json:"type"`
	Score string `json:"score"`
}

// Affected describes an affected package and its vulnerable ranges/versions.
type Affected struct {
	Package    Package        `json:"package"`
	Ranges     []Range        `json:"ranges,omitempty"`
	Versions   []string       `json:"versions,omitempty"`
	DBSpecific map[string]any `json:"database_specific,omitempty"`
}

// Package identifies a package in an ecosystem.
type Package struct {
	Ecosystem string `json:"ecosystem"`
	Name      string `json:"name"`
	Purl      string `json:"purl,omitempty"`
}

// Range is a version or commit range with introduced/fixed events.
type Range struct {
	Type   string  `json:"type"`
	Repo   string  `json:"repo,omitempty"`
	Events []Event `json:"events"`
}

// Event is a single range event; exactly one field is set.
type Event struct {
	Introduced   string `json:"introduced,omitempty"`
	Fixed        string `json:"fixed,omitempty"`
	LastAffected string `json:"last_affected,omitempty"`
	Limit        string `json:"limit,omitempty"`
}

// Ref is an external reference link.
type Ref struct {
	Type string `json:"type"`
	URL  string `json:"url"`
}

// Query is the request body for POST /v1/query.
// Either Commit, or Package (+ optional Version), must be set.
type Query struct {
	Commit    string   `json:"commit,omitempty"`
	Version   string   `json:"version,omitempty"`
	Package   *Package `json:"package,omitempty"`
	PageToken string   `json:"page_token,omitempty"`
}

// QueryResponse is the response body for POST /v1/query.
type QueryResponse struct {
	Vulns         []Vulnerability `json:"vulns"`
	NextPageToken string          `json:"next_page_token,omitempty"`
}

// BatchQuery is the request body for POST /v1/querybatch.
type BatchQuery struct {
	Queries []Query `json:"queries"`
}

// BatchResponse is the response body for POST /v1/querybatch.
// Batch results carry only vulnerability IDs + modified timestamps.
type BatchResponse struct {
	Results []BatchResult `json:"results"`
}

// BatchResult is one per-query result in a batch response.
type BatchResult struct {
	Vulns         []BatchVuln `json:"vulns,omitempty"`
	NextPageToken string      `json:"next_page_token,omitempty"`
}

// BatchVuln is the id-only vulnerability reference returned by querybatch.
type BatchVuln struct {
	ID       string `json:"id"`
	Modified string `json:"modified,omitempty"`
}

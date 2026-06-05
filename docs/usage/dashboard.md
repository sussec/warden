# Dashboard

The dashboard is the landing page after sign-in (**Dashboard** in the sidebar). It gives a single-page security posture view across every project, combining SAST and SCA data with a selectable time range.

## Time range

The range selector in the top-right filters every widget. Choose **Last 7 days**, **Last 30 days** (default), or **Last 90 days**. All queries re-run against the chosen window.

## KPI cards

Four headline counters summarise the current posture:

| Card | Meaning |
|---|---|
| **Open Issues** | SAST findings plus SCA packages still awaiting triage |
| **Critical Findings** | Highest-severity findings and vulnerable packages combined |
| **Vulnerable Packages** | Dependencies with a known risk level |
| **Fixed** | Findings and packages resolved within the selected range |

## Charts

| Widget | Type | Shows |
|---|---|---|
| **Findings Trend** | stacked area | New findings (or packages) per day by severity, with a SAST / SCA toggle |
| **SAST / SCA Severity** | donut | Severity distribution with the total in the centre; click a segment to jump to the filtered Finding list |
| **SAST vs SCA** | radar | Severity profile of the two scan types side by side |
| **SAST / SCA Status** | radial + breakdown | Remediation workflow state (Open, Fixing, Accepted Risk, Fixed) with per-status counts under the ring |
| **Daily Activity** | line | New SAST findings vs SCA packages over time |
| **Top Findings** | horizontal bar | Most frequent SAST categories (e.g. CWE classes) |
| **Top Vulnerable Packages** | stacked bar | Dependencies stacked by severity |

!!! tip "Severity colours"
    Severity uses a fixed brand ramp everywhere in the app — Critical (red), High (copper), Medium (amber), Low (teal). Legends and tooltips are ordered by severity, not alphabetically.

## Data source

The dashboard reads from three endpoints, all honouring the date range, project, and source filters:

- `POST /api/dashboard/sast` — severity, status, and top finding categories
- `POST /api/dashboard/sca` — severity, status, and top vulnerable packages
- `POST /api/dashboard/trend` — daily severity series for the area and line charts

Numbers reflect live ingested data, so a status that shows all-Open simply means nothing has been triaged yet — change a finding's status and the rings update on the next refresh.

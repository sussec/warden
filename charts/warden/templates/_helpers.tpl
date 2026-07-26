{{/*
Expand the name of the chart.
*/}}
{{- define "warden.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "warden.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "warden.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "warden.labels" -}}
helm.sh/chart: {{ include "warden.chart" . }}
{{ include "warden.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "warden.selectorLabels" -}}
app.kubernetes.io/name: {{ include "warden.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "warden.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "warden.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{- define "warden.secretName" -}}
{{- if .Values.secrets.existingSecret -}}
{{- .Values.secrets.existingSecret -}}
{{- else -}}
{{- printf "%s-secrets" (include "warden.fullname" .) -}}
{{- end -}}
{{- end -}}

{{/*
API Service DNS name used by web rewrites and scanners (compose-compatible: warden)
*/}}
{{- define "warden.apiServiceName" -}}
{{- if .Values.api.compatServiceName -}}
warden
{{- else -}}
{{- printf "%s-api" (include "warden.fullname" .) -}}
{{- end -}}
{{- end -}}

{{- define "warden.osvServiceName" -}}
osv-api
{{- end -}}

{{- define "warden.dbHost" -}}
{{- if .Values.postgresql.enabled -}}
{{- printf "%s-postgresql" (include "warden.fullname" .) -}}
{{- else -}}
{{- required "postgresql.external.host is required when postgresql.enabled=false" .Values.postgresql.external.host -}}
{{- end -}}
{{- end -}}

{{- define "warden.dbPort" -}}
{{- if .Values.postgresql.enabled -}}
{{- .Values.postgresql.service.port -}}
{{- else -}}
{{- .Values.postgresql.external.port -}}
{{- end -}}
{{- end -}}

{{- define "warden.dbUser" -}}
{{- if .Values.postgresql.enabled -}}
{{- .Values.postgresql.auth.username -}}
{{- else -}}
{{- .Values.postgresql.external.username -}}
{{- end -}}
{{- end -}}

{{- define "warden.dbName" -}}
{{- if .Values.postgresql.enabled -}}
{{- .Values.postgresql.auth.database -}}
{{- else -}}
{{- .Values.postgresql.external.database -}}
{{- end -}}
{{- end -}}

{{- define "warden.osvUrl" -}}
{{- if .Values.api.env.osvServiceUrl -}}
{{- .Values.api.env.osvServiceUrl -}}
{{- else if .Values.osv.enabled -}}
{{- printf "http://%s:%v" (include "warden.osvServiceName" .) .Values.osv.service.port -}}
{{- end -}}
{{- end -}}

{{- define "warden.scanWorkspacePvc" -}}
{{- printf "%s-scan-workspace" (include "warden.fullname" .) -}}
{{- end -}}

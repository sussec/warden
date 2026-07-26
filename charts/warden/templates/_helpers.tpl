{{- define "warden.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

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
app.kubernetes.io/part-of: warden
{{- end -}}

{{- define "warden.selectorLabels" -}}
app.kubernetes.io/name: {{ include "warden.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "warden.componentLabels" -}}
{{- include "warden.labels" . }}
app.kubernetes.io/component: {{ .component }}
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

{{/*
Build full image ref:
  {global.imageRegistry}/{global.imageProject}/{repository}:{tag}
If image.repository already contains a slash and no global.imageRegistry, use as-is.
*/}}
{{- define "warden.image" -}}
{{- $root := .root -}}
{{- $img := .image -}}
{{- $reg := $root.Values.global.imageRegistry | default "" | trimSuffix "/" -}}
{{- $proj := $root.Values.global.imageProject | default "" | trimSuffix "/" -}}
{{- $repo := $img.repository -}}
{{- $tag := $img.tag | default "latest" -}}
{{- if and $reg (not (contains "/" $repo)) -}}
{{- if $proj -}}
{{- printf "%s/%s/%s:%s" $reg $proj $repo $tag -}}
{{- else -}}
{{- printf "%s/%s:%s" $reg $repo $tag -}}
{{- end -}}
{{- else if and $reg (hasPrefix "library/" $repo) -}}
{{- printf "%s/%s:%s" $reg $repo $tag -}}
{{- else -}}
{{- printf "%s:%s" $repo $tag -}}
{{- end -}}
{{- end -}}

{{- define "warden.storageClass" -}}
{{- $sc := .storageClass | default .root.Values.global.defaultStorageClass -}}
{{- if $sc -}}
storageClassName: {{ $sc | quote }}
{{- end -}}
{{- end -}}

{{/*
Soft pod anti-affinity for a component (spreads across nodes).
Usage: include "warden.podAntiAffinity" (dict "root" . "component" "api")
*/}}
{{- define "warden.podAntiAffinity" -}}
{{- $mode := .mode | default "soft" -}}
{{- if eq $mode "hard" }}
podAntiAffinity:
  requiredDuringSchedulingIgnoredDuringExecution:
    - labelSelector:
        matchLabels:
          app.kubernetes.io/name: {{ include "warden.name" .root }}
          app.kubernetes.io/instance: {{ .root.Release.Name }}
          app.kubernetes.io/component: {{ .component }}
      topologyKey: kubernetes.io/hostname
{{- else if eq $mode "soft" }}
podAntiAffinity:
  preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      podAffinityTerm:
        labelSelector:
          matchLabels:
            app.kubernetes.io/name: {{ include "warden.name" .root }}
            app.kubernetes.io/instance: {{ .root.Release.Name }}
            app.kubernetes.io/component: {{ .component }}
        topologyKey: kubernetes.io/hostname
{{- end -}}
{{- end -}}

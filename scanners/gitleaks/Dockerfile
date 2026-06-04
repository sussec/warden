# Gitleaks secret-detection analyzer for Techanv Warden
FROM ghcr.io/gitleaks/gitleaks:latest AS gitleaks

FROM python:3.12-alpine
RUN apk add --no-cache git
COPY --from=gitleaks /usr/bin/gitleaks /usr/local/bin/gitleaks
COPY common/warden_client.py /opt/warden/warden_client.py
COPY gitleaks/run_gitleaks.py /opt/warden/run_gitleaks.py
WORKDIR /src
ENTRYPOINT ["python3", "/opt/warden/run_gitleaks.py"]

# Trivy IaC misconfiguration analyzer for Techanv Warden
FROM aquasec/trivy:latest AS trivy

FROM python:3.12-alpine
RUN apk add --no-cache git
COPY --from=trivy /usr/local/bin/trivy /usr/local/bin/trivy
COPY common/warden_client.py /opt/warden/warden_client.py
COPY trivy-iac/run_trivy_iac.py /opt/warden/run_trivy_iac.py
WORKDIR /src
ENTRYPOINT ["python3", "/opt/warden/run_trivy_iac.py"]

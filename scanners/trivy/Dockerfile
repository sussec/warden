# Trivy SCA analyzer for Techanv Warden
FROM aquasec/trivy:latest AS trivy

FROM python:3.12-alpine
RUN apk add --no-cache git
COPY --from=trivy /usr/local/bin/trivy /usr/local/bin/trivy
COPY common/warden_client.py /opt/warden/warden_client.py
COPY common/source_manager.py /opt/warden/source_manager.py
COPY trivy/run_trivy.py /opt/warden/run_trivy.py
WORKDIR /src
ENTRYPOINT ["python3", "/opt/warden/run_trivy.py"]

# Nuclei template-based DAST analyzer for Techanv Warden
FROM docker.io/projectdiscovery/nuclei:latest AS nuclei

FROM python:3.12-alpine
RUN apk add --no-cache git ca-certificates
COPY --from=nuclei /usr/local/bin/nuclei /usr/local/bin/nuclei
COPY common/warden_client.py /opt/warden/warden_client.py
COPY common/source_manager.py /opt/warden/source_manager.py
COPY nuclei/run_nuclei.py /opt/warden/run_nuclei.py
WORKDIR /src
ENTRYPOINT ["python3", "/opt/warden/run_nuclei.py"]

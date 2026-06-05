# Grype SCA (dependency) analyzer for Techanv Warden
FROM anchore/grype:latest AS grype

FROM python:3.12-alpine
RUN apk add --no-cache git
COPY --from=grype /grype /usr/local/bin/grype
COPY common/warden_client.py /opt/warden/warden_client.py
COPY common/source_manager.py /opt/warden/source_manager.py
COPY grype/run_grype.py /opt/warden/run_grype.py
WORKDIR /src
ENTRYPOINT ["python3", "/opt/warden/run_grype.py"]

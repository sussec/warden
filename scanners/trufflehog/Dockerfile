# TruffleHog git-history secret-detection analyzer for Techanv Warden
FROM ghcr.io/trufflesecurity/trufflehog:latest AS trufflehog

FROM python:3.12-alpine
RUN apk add --no-cache git
COPY --from=trufflehog /usr/bin/trufflehog /usr/local/bin/trufflehog
COPY common/warden_client.py /opt/warden/warden_client.py
COPY common/source_manager.py /opt/warden/source_manager.py
COPY trufflehog/run_trufflehog.py /opt/warden/run_trufflehog.py
WORKDIR /src
ENTRYPOINT ["python3", "/opt/warden/run_trufflehog.py"]

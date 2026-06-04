# Semgrep SAST analyzer for Techanv Warden
FROM semgrep/semgrep:latest
RUN apk add --no-cache git || (apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*) || true
COPY common/warden_client.py /opt/warden/warden_client.py
COPY semgrep/run_semgrep.py /opt/warden/run_semgrep.py
WORKDIR /src
ENTRYPOINT ["python3", "/opt/warden/run_semgrep.py"]

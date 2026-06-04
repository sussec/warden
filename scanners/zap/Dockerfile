# OWASP ZAP baseline DAST analyzer for Techanv Warden
# Single-stage: the ZAP image ships zap-baseline.py and python3.
FROM ghcr.io/zaproxy/zaproxy:stable
COPY common/warden_client.py /zap/warden_client.py
COPY zap/run_zap.py /zap/run_zap.py
ENTRYPOINT ["python3", "/zap/run_zap.py"]

# Security Integration

Your application’s repository typically includes source code, dependency configurations. 
By performing repository scanning, vulnerabilities across these components can be identified.

We utilize open-source tools to integrate security scanning like: Semgrep, Gitleaks, Trivy. 
If you need to integrate another tool, feel free to create a request [here](https://github.com/sussec/warden/issues)

Security scanning tools include:

- **Static Application Security Testing (SAST)**: Examines the source code to uncover vulnerabilities.
- **Software Composition Analysis (SCA)**: Detects vulnerabilities in application dependencies and container images.


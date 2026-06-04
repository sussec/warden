# Trivy
The [Trivy](https://github.com/aquasecurity/trivy) is a comprehensive and versatile security scanner.
Trivy has scanners that look for security issues, and targets where it can find those issues.

* Container Image
* Filesystem
* Git Repository (remote)
* Virtual Machine Image
* Kubernetes


We developed an [trivy-analyzer](https://github.com/sussec/warden-trivy) that wraps Trivy to perform detect vulnerability in repo's dependency.

### GitLab CI/CD

```yaml
trivy-dependency-scan:
  stage: test
  rules:
    - if: $CI_PIPELINE_SOURCE == "web"
    - if: $CI_MERGE_REQUEST_IID
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
    - if: $CI_COMMIT_TAG
  image: ghcr.io/sussec/warden-trivy:latest
  script:
    - /analyzer dependency
```

### GitHub Action


```yaml
name: Security Scan
on:
  pull_request:
  push:
    branches:
      - main
    tags:
      - '*'
env:
  WARDEN_URL: ${{ vars.WARDEN_URL }}
  WARDEN_TOKEN: ${{ secrets.WARDEN_TOKEN }}
  GITHUB_TOKEN: ${{ secrets.GIT_TOKEN }}
jobs:
  secret-scan:
    runs-on: ubuntu-latest
    container: ghcr.io/sussec/warden-trivy:latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Trivy Scan
        run: /analyzer dependency
  
```
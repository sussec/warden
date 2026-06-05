package com.techanv.warden.client.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** Response of {@code POST /api/ci/scan}. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record CiScanInfo(String scanId, String scanUrl, String lastCommitSha) {}

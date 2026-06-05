package com.techanv.warden.client.model;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** Response of {@code POST /api/ci/finding} — drives shift-left MR comments. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record UploadFindingResponse(
        String findingUrl,
        List<Finding> newFindings,
        List<Finding> confirmedFindings,
        List<Finding> openFindings,
        List<Finding> fixedFindings,
        boolean isBlock) {
}

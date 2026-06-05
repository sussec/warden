package com.techanv.warden.client.model;

import com.fasterxml.jackson.annotation.JsonInclude;

/** Request body for {@code POST /api/ci/scan}. Mirrors the .NET CiScanRequest. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CiScanRequest {
    public String source = "Local";
    public String repoId;
    public String repoUrl;
    public String repoName;
    public String gitAction = "CommitBranch";
    public String scanTitle;
    public String commitBranch;
    public String commitHash;
    public String targetBranch;
    public String mergeRequestId;
    public String scanner;
    public String type;
    public String jobUrl;
    public boolean isDefault = true;
    public String containerImage;
}

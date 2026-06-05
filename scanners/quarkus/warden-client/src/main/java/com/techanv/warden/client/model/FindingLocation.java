package com.techanv.warden.client.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public class FindingLocation {
    public String path;
    public String snippet;
    public Integer startLine;
    public Integer endLine;
    public Integer startColumn;
    public Integer endColumn;
}

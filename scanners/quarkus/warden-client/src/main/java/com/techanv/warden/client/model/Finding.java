package com.techanv.warden.client.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

/** A single SAST/secret finding in the CI ingest contract. */
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public class Finding {
    public String id;
    public String identity;
    public String ruleId;
    public String name;
    public String description;
    public String category;
    public String recommendation;
    public String severity;
    public FindingLocation location;
}

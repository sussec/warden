package com.techanv.warden.client.model;

import com.fasterxml.jackson.annotation.JsonInclude;

/** A resolved dependency in the SCA ingest contract ({@code POST /api/ci/dependency}). */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PackageInfo {
    public String pkgId;
    public String name;
    public String version;
    public String type;
    public String location;

    public PackageInfo() {}

    public PackageInfo(String pkgId, String name, String version, String type, String location) {
        this.pkgId = pkgId;
        this.name = name;
        this.version = version;
        this.type = type;
        this.location = location;
    }
}

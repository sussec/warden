package com.techanv.warden.scanner.zap;

import com.techanv.warden.client.model.CiScanInfo;
import com.techanv.warden.client.model.CiScanRequest;
import com.techanv.warden.client.model.Finding;
import com.techanv.warden.client.model.FindingLocation;
import com.techanv.warden.client.model.PackageInfo;
import com.techanv.warden.client.model.UploadFindingResponse;
import com.techanv.warden.client.model.VulnerabilityInfo;

import io.quarkus.runtime.annotations.RegisterForReflection;

/** Register warden-client models for native Jackson (de)serialization. */
@RegisterForReflection(targets = {
        CiScanRequest.class,
        CiScanInfo.class,
        Finding.class,
        FindingLocation.class,
        UploadFindingResponse.class,
        PackageInfo.class,
        VulnerabilityInfo.class,
})
public class ReflectionConfig {
}

package com.techanv.warden.scanner.gitleaks;

import com.techanv.warden.client.model.CiScanInfo;
import com.techanv.warden.client.model.CiScanRequest;
import com.techanv.warden.client.model.Finding;
import com.techanv.warden.client.model.FindingLocation;
import com.techanv.warden.client.model.UploadFindingResponse;

import io.quarkus.runtime.annotations.RegisterForReflection;

/** Register warden-client models so Jackson can (de)serialize them in native mode. */
@RegisterForReflection(targets = {
        CiScanRequest.class,
        CiScanInfo.class,
        Finding.class,
        FindingLocation.class,
        UploadFindingResponse.class,
})
public class ReflectionConfig {
}

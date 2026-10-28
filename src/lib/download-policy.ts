import { z } from "zod";

// Download rights (F-SEC-02): per gallery, optionally overridden per set.

export const DOWNLOAD_POLICIES = ["none", "web", "original"] as const;
export type DownloadPolicy = (typeof DOWNLOAD_POLICIES)[number];

export const downloadPolicySchema = z.enum(DOWNLOAD_POLICIES);

/** The set's own policy wins; `null` inherits the gallery's. */
export function effectivePolicy(
  galleryPolicy: DownloadPolicy,
  setPolicy: DownloadPolicy | null,
): DownloadPolicy {
  return setPolicy ?? galleryPolicy;
}

export function allows(policy: DownloadPolicy, size: "web" | "original") {
  return policy === "original" || (policy === "web" && size === "web");
}

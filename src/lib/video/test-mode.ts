import { serverEnv } from "@/lib/env";
import { getVideoProvider } from "./index";
import type { FakeVideoProvider } from "./fake";

/** The fake provider for /api/test/* routes; null when they must not exist. */
export function fakeVideoProvider() {
  const env = serverEnv();
  if (env.NODE_ENV === "production" && env.E2E_TEST_MODE !== "1") return null;
  const provider = getVideoProvider();
  // No instanceof: route bundles may each carry their own copy of the class.
  return "isFake" in provider ? (provider as FakeVideoProvider) : null;
}

// Fortress live-validation safety interlock.
// Any validator that creates synthetic records must fail closed unless the
// operator has positively selected an isolated staging data plane.

export const FORTRESS_TEST_ENVIRONMENT = "isolated-staging";

export async function requireIsolatedFortressTestEnvironment() {
  const { secrets } = await import("base44:runtime");
  const environment = secrets.get("FORTRESS_TEST_ENVIRONMENT") || "";
  const isolatedData = secrets.get("FORTRESS_TEST_DATA_ISOLATED") || "";
  const ok = environment === FORTRESS_TEST_ENVIRONMENT && isolatedData === "true";

  if (!ok) {
    return {
      ok: false,
      status: 412,
      code: "FORTRESS_ISOLATED_TEST_ENVIRONMENT_REQUIRED",
      error: "Live Fortress validators are disabled unless an isolated staging data plane is explicitly verified.",
      environment: environment || "unset",
      isolated_data_verified: isolatedData === "true",
    };
  }

  return {
    ok: true,
    status: 200,
    environment,
    isolated_data_verified: true,
  };
}

export function stagingFixtureName(label, runId) {
  const safeLabel = String(label || "FIXTURE")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  const safeRunId = String(runId || "RUN").replace(/[^A-Za-z0-9_-]+/g, "_");
  return `STG_${safeLabel || "FIXTURE"}_${safeRunId}`;
}

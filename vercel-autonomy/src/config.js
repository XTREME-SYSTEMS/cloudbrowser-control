const required = (name, value) => {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export const PROJECT = Object.freeze({
  id: 'cloudbrowser-control',
  repo: 'XTREME-SYSTEMS/cloudbrowser-control',
  stagingAppId: '6a8688c834cf23adb0937741',
  docsCommit: '8f3b25e8c4de6f74068d6bf5b72fc7d9b4f0b61e',
  baselineSha: '1da8c5bf4c20581606d2ec746b5fc892aaafe598',
  candidateBranch: process.env.AUTONOMY_CANDIDATE_BRANCH || 'autonomous/cloudbrowser-control-v1',
  stateBranch: process.env.AUTONOMY_STATE_BRANCH || 'autonomy/state-cloudbrowser-control',
  statePath: 'autonomy-state/cloudbrowser-control/state.json',
  receiptPath: 'autonomy-state/cloudbrowser-control/receipts',
  intervalMinutes: 60,
  leaseMinutes: 50,
  maxRepairAttempts: 3,
  requiredCleanPasses: 3,
});

export function env() {
  return {
    githubToken: required('GITHUB_TOKEN', process.env.GITHUB_TOKEN),
    openaiApiKey: process.env.OPENAI_API_KEY || null,
    primaryModel: process.env.OPENAI_PRIMARY_MODEL || 'gpt-5.6-terra',
    fallbackModel: process.env.OPENAI_FALLBACK_MODEL || 'gpt-5.6-luna',
    codexModel: process.env.OPENAI_CODEX_MODEL || 'gpt-5.3-codex',
    cronSecret: process.env.CRON_SECRET || null,
    mutationEnabled: process.env.AUTONOMY_MUTATION_ENABLED === 'true',
    stagingStatusUrl: process.env.BASE44_STAGING_STATUS_URL || null,
    stagingRunUrl: process.env.BASE44_STAGING_RUN_URL || null,
    stagingCertifyUrl: process.env.BASE44_STAGING_CERTIFY_URL || null,
    stagingToken: process.env.BASE44_STAGING_AUTH_TOKEN || null,
    validationContractVersion: process.env.VALIDATION_CONTRACT_VERSION || 'cloudbrowser-v1',
    scoringContractVersion: process.env.SCORING_CONTRACT_VERSION || 'cloudbrowser-v1',
  };
}

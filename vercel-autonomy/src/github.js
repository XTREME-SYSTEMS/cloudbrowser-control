import { PROJECT } from './config.js';
import { assertBranchSafe } from './policy.js';

const apiBase = 'https://api.github.com';
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const unb64 = (s) => Buffer.from(s, 'base64').toString('utf8');
const encodeRefPath = (ref) => ref.split('/').map(encodeURIComponent).join('/');

export class GitHubClient {
  constructor(token) {
    this.token = token;
    [this.owner, this.repo] = PROJECT.repo.split('/');
  }

  async request(path, init = {}) {
    const res = await fetch(`${apiBase}${path}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      const error = new Error(`GitHub ${res.status}: ${text.slice(0, 500)}`);
      error.status = res.status;
      throw error;
    }
    if (res.status === 204) return null;
    return res.json();
  }

  repoPath(path) { return `/repos/${this.owner}/${this.repo}${path}`; }

  async getBranchSha(branch) {
    const data = await this.request(this.repoPath(`/git/ref/heads/${encodeRefPath(branch)}`));
    return data.object.sha;
  }

  async ensureBranch(branch, fromSha) {
    assertBranchSafe(branch);
    try { return await this.getBranchSha(branch); }
    catch (error) {
      if (error.status !== 404) throw error;
      const data = await this.request(this.repoPath('/git/refs'), { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: fromSha }) });
      return data.object.sha;
    }
  }

  async getFile(path, ref) {
    try {
      const encodedPath = path.split('/').map(encodeURIComponent).join('/');
      const data = await this.request(this.repoPath(`/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`));
      if (Array.isArray(data)) return { directory: true, entries: data };
      return { path: data.path, sha: data.sha, content: unb64((data.content || '').replace(/\n/g, '')), encoding: data.encoding };
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  }

  async listPath(path, ref) {
    const result = await this.getFile(path, ref);
    if (!result?.directory) return result ? [{ type: 'file', path: result.path }] : [];
    return result.entries.map((x) => ({ type: x.type, path: x.path, size: x.size || 0 }));
  }

  async putFile(path, branch, content, message, sha = null) {
    assertBranchSafe(branch);
    const body = { message, branch, content: b64(content) };
    if (sha) body.sha = sha;
    return this.request(this.repoPath(`/contents/${path.split('/').map(encodeURIComponent).join('/')}`), { method: 'PUT', body: JSON.stringify(body) });
  }

  async getCheckRuns(sha) {
    const data = await this.request(this.repoPath(`/commits/${sha}/check-runs?per_page=100`));
    return data.check_runs || [];
  }

  async getCombinedStatus(sha) {
    return this.request(this.repoPath(`/commits/${sha}/status`));
  }
}

export class GitHubStateStore {
  constructor(client) { this.client = client; }

  async ensure() {
    await this.client.ensureBranch(PROJECT.stateBranch, PROJECT.docsCommit);
    const current = await this.client.getFile(PROJECT.statePath, PROJECT.stateBranch);
    if (!current) {
      const now = new Date();
      const initial = {
        project_id: PROJECT.id,
        repo: PROJECT.repo,
        staging_app_id: PROJECT.stagingAppId,
        state: 'MONITORING',
        current_phase: 'BRANCH_BUILD',
        candidate_branch: PROJECT.candidateBranch,
        base_sha: PROJECT.docsCommit,
        candidate_sha: await this.client.getBranchSha(PROJECT.candidateBranch),
        next_engineering_run_at: now.toISOString(),
        engineering_interval_minutes: PROJECT.intervalMinutes,
        lease_owner: null,
        lease_acquired_at: null,
        lease_expires_at: null,
        lease_heartbeat_at: null,
        hour_bucket: null,
        active_work_packet_id: null,
        work_packet_attempt: 0,
        latest_validation_run_id: null,
        latest_quality_score: null,
        last_release_gate_result: 'NOT_VERIFIED',
        blocking_failures: [],
        failure_signatures: {},
        repair_attempts: {},
        last_failure_signature: null,
        failure_streak: 0,
        anti_thrash_triggered: false,
        consecutive_clean_passes: 0,
        last_clean_sha: null,
        last_clean_at: null,
        critical_count: 0,
        high_count: 0,
        deployment_drift_count: null,
        approval_required: false,
        autonomous_mutation_enabled: false,
        release_ready: false,
        rollback_reference: PROJECT.docsCommit,
        receipt_chain: [],
        updated_at: now.toISOString()
      };
      await this.client.putFile(PROJECT.statePath, PROJECT.stateBranch, `${JSON.stringify(initial, null, 2)}\n`, 'autonomy: initialize durable state');
    }
  }

  async read() {
    await this.ensure();
    const file = await this.client.getFile(PROJECT.statePath, PROJECT.stateBranch);
    return { state: JSON.parse(file.content), sha: file.sha };
  }

  async mutate(mutator, message, maxRetries = 4) {
    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      const current = await this.read();
      const next = await mutator(structuredClone(current.state));
      next.updated_at = new Date().toISOString();
      try {
        const result = await this.client.putFile(PROJECT.statePath, PROJECT.stateBranch, `${JSON.stringify(next, null, 2)}\n`, message, current.sha);
        return { state: next, commit: result.commit?.sha || null };
      } catch (error) {
        if (error.status !== 409 && error.status !== 422) throw error;
      }
    }
    throw new Error('Durable state compare-and-set failed after retries');
  }
}

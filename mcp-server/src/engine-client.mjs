export class EngineError extends Error {
  constructor(message, { status = 500, body = null } = {}) {
    super(message);
    this.name = "EngineError";
    this.status = status;
    this.body = body;
  }
}

export class EngineClient {
  constructor({ baseUrl, apiKey, timeoutMs = 45000, fetchImpl = fetch }) {
    if (!baseUrl) throw new Error("BROWSER_ENGINE_URL is required");
    if (!apiKey || apiKey.length < 16) throw new Error("ENGINE_API_KEY must be at least 16 characters");
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
  }

  async request(path, { method = "GET", body, authenticated = true } = {}) {
    const headers = { Accept: "application/json" };
    if (authenticated) headers["x-api-key"] = this.apiKey;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new EngineError(`Browser engine request failed: ${error.message}`, { status: 502 });
    }

    const raw = await response.text();
    let parsed = null;
    if (raw) {
      try { parsed = JSON.parse(raw); } catch { parsed = { raw }; }
    }

    if (!response.ok) {
      const message = parsed?.error || parsed?.message || `Browser engine returned HTTP ${response.status}`;
      throw new EngineError(message, { status: response.status, body: parsed });
    }
    return parsed ?? {};
  }

  health() {
    return this.request("/health", { authenticated: false });
  }

  start(options = {}) {
    return this.request("/sessions", { method: "POST", body: options });
  }

  status(sessionId) {
    return this.request(`/sessions/${encodeURIComponent(sessionId)}`);
  }

  listSessions() {
    return this.request("/sessions");
  }

  execute(sessionId, action) {
    return this.request(`/sessions/${encodeURIComponent(sessionId)}/execute`, {
      method: "POST",
      body: action,
    });
  }

  keepalive(sessionId) {
    return this.request(`/sessions/${encodeURIComponent(sessionId)}/keepalive`, { method: "POST", body: {} });
  }

  screenshot(sessionId) {
    return this.request(`/sessions/${encodeURIComponent(sessionId)}/screenshot`);
  }

  end(sessionId) {
    return this.request(`/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
  }
}

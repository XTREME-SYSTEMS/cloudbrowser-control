export const ACTION_CAPABILITIES = Object.freeze({
  evaluate: "sessions:evaluate",
  extract_json: "sessions*evaluate",
  set_cookies: "sessions:storage",
  import_cookies: "sessions:storage",
  export_cookies: "sessions:storage",
  set_local_storage: "sessions:storage",
  set_headers: "sessions:storage",
  save_state: "sessions:storage",
  restore_state: "sessions:storage",
  upload_file: "sessions:upload",
  download: "sessions:download",
  solve_captcha: "sessions:captcha",
  mock_response: "sessions:network_mock",
  crawl: "sessions:crawl",
});

export const SESSION_OPTION_CAPABILITIES = Object.freeze({
  proxy: "sessions:proxy",
  enableCDP: "sessions:cdp",
  cookies: "sessions:storage",
  storageState: "sessions:storage",
  networkMocks: "sessions:network_mock",
  extensions: "sessions:extensions",
});

export function hasScope(scopes, required) {
  if (!required) return true;
  return Array.isArray(scopes) && (scopes.includes("*") || scopes.includes(required));
}

export function requiredCapability(actionType) {
  return ACTION_CAPABILITIES[actionType] || null;
}

export function missingActionCapabilities(steps = [], scopes = []) {
  return steps.flatMap((step) => {
    const required = requiredCapability(step?.action_type);
    return required && !hasScope(scopes, required)
      ? [{ action_type: step?.action_type, required }]
      : [];
  });
}

export function missingSessionCapabilities(config = {}, scopes = []) {
  const checks = [
    [config.proxy, SESSION_OPTION_CAPABILITIES.proxy, "proxy"],
    [config.enableCDP, SESSION_OPTION_CAPABILITIES.enableCDP, "enableCDP"],
    [config.cookies?.length, SESSION_OPTION_CAPABILITIES.cookies, "cookies"],
    [config.storageState, SESSION_OPTION_CAPABILITIES.storageState, "storageState"],
    [config.networkMocks?.length, SESSION_OPTION_CAPABILITIES.networkMocks, "networkMocks"],
    [config.extensions?.length, SESSION_OPTION_CAPABILITIES.extensions, "extensions"],
  ];
  return checks.flatMap(([enabled, required, option]) => enabled && !hasScope(scopes, required)
    ? [{ option, required }]
    : []);
}

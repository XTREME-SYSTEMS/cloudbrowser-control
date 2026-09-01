// Proxy Provider Integration Module
// Supports Bright Data, Smartproxy, Oxylabs, IPRoyal, SOAX API-based proxy rotation
// Enables residential/mobile proxy network access without owning the infrastructure

export interface ProxyProviderConfig {
  provider: string;
  endpoint: string;
  username: string;
  password: string;
  rotation: 'sticky' | 'session' | 'random';
  sessionTtlMin?: number;
}

export interface ProxyEndpoint {
  url: string;
  country?: string;
  city?: string;
  state?: string;
  asn?: string;
  zipCode?: string;
  ipType: string;
}

const PROVIDER_ENDPOINTS: Record<string, string> = {
  bright_data: 'brd-customer-{}-zone-{}:{}@brd.superproxy.io:22225',
  smartproxy: '{}:{}@gate.smartproxy.com:7000',
  oxylabs: 'customer-{}-cc-{}:{}@pr.oxylabs.io:7777',
  iproyal: '{}:{}@geo.iproyal.com:12321',
  soax: '{}:{}@p.soax.com:9000',
};

export function buildProxyUrl(config: ProxyProviderConfig, geo?: {
  country?: string;
  city?: string;
  state?: string;
  asn?: string;
  zipCode?: string;
}): ProxyEndpoint {
  const template = PROVIDER_ENDPOINTS[config.provider] || config.endpoint;

  let url: string;
  if (config.provider === 'bright_data') {
    // Bright Data format: brd-customer-{customerId}-zone-{zone}:{password}@brd.superproxy.io:22225
    // Geo params passed via username: brd-customer-xxx-zone-zone1-country-us-city-newyork:password
    let usernamePart = config.username;
    if (geo?.country) usernamePart += `-country-${geo.country.toLowerCase()}`;
    if (geo?.city) usernamePart += `-city-${geo.city.toLowerCase().replace(/\s/g, '')}`;
    if (geo?.state) usernamePart += `-state-${geo.state.toLowerCase()}`;
    if (geo?.asn) usernamePart += `-asn-${geo.asn.toLowerCase()}`;
    if (geo?.zipCode) usernamePart += `-zip-${geo.zipCode}`;
    url = `${usernamePart}:${config.password}@brd.superproxy.io:22225`;
  } else if (config.provider === 'smartproxy') {
    // Smartproxy: username-country-us-city-new_york:password@gate.smartproxy.com:7000
    let usernamePart = config.username;
    if (geo?.country) usernamePart += `-country-${geo.country.toLowerCase()}`;
    if (geo?.city) usernamePart += `-city-${geo.city.toLowerCase().replace(/\s/g, '_')}`;
    if (geo?.state) usernamePart += `-state-${geo.state.toLowerCase()}`;
    url = `${usernamePart}:${config.password}@gate.smartproxy.com:7000`;
  } else if (config.provider === 'oxylabs') {
    // Oxylabs: customer-{user}-cc-{country}-city-{city}:{pass}@pr.oxylabs.io:7777
    let usernamePart = config.username;
    if (geo?.country) usernamePart += `-cc-${geo.country.toLowerCase()}`;
    if (geo?.city) usernamePart += `-city-${geo.city.toLowerCase().replace(/\s/g, '_')}`;
    url = `${usernamePart}:${config.password}@pr.oxylabs.io:7777`;
  } else if (config.provider === 'iproyal') {
    let usernamePart = config.username;
    if (geo?.country) usernamePart += `-country-${geo.country.toLowerCase()}`;
    if (geo?.state) usernamePart += `-state-${geo.state.toLowerCase()}`;
    url = `${usernamePart}:${config.password}@geo.iproyal.com:12321`;
  } else if (config.provider === 'soax') {
    let usernamePart = config.username;
    if (geo?.country) usernamePart += `-cc-${geo.country.toLowerCase()}`;
    url = `${usernamePart}:${config.password}@p.soax.com:9000`;
  } else {
    url = `${config.username}:${config.password}@${config.endpoint}`;
  }

  return {
    url,
    country: geo?.country,
    city: geo?.city,
    state: geo?.state,
    asn: geo?.asn,
    zipCode: geo?.zipCode,
    ipType: 'residential',
  };
}

export function getSupportedProviders(): { provider: string; displayName: string; supportsGeo: boolean }[] {
  return [
    { provider: 'bright_data', displayName: 'Bright Data (195+ countries, 400M+ IPs)', supportsGeo: true },
    { provider: 'smartproxy', displayName: 'Smartproxy (195+ countries, 55M+ IPs)', supportsGeo: true },
    { provider: 'oxylabs', displayName: 'Oxylabs (195+ countries, 100M+ IPs)', supportsGeo: true },
    { provider: 'iproyal', displayName: 'IPRoyal (195+ countries, 8M+ IPs)', supportsGeo: true },
    { provider: 'soax', displayName: 'SOAX (195+ countries, 5M+ IPs)', supportsGeo: true },
    { provider: 'custom', displayName: 'Custom Proxy', supportsGeo: false },
  ];
}

export function validateProviderConfig(config: ProxyProviderConfig): { valid: boolean; error?: string } {
  if (!config.provider) return { valid: false, error: 'Provider required' };
  if (!config.username) return { valid: false, error: 'Username required' };
  if (!config.password) return { valid: false, error: 'Password required' };
  if (!PROVIDER_ENDPOINTS[config.provider] && !config.endpoint && config.provider !== 'custom') {
    return { valid: false, error: `Unknown provider: ${config.provider}` };
  }
  return { valid: true };
}
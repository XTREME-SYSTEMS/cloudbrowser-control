// PII Redaction — regex-based, no LLM needed (fast, deterministic, no credits)
// Redacts: emails, phone numbers, SSNs, credit cards, IP addresses, API keys, IBAN

const PATTERNS = [
  { name: 'email', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[REDACTED_EMAIL]' },
  { name: 'ssn', regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[REDACTED_SSN]' },
  { name: 'credit_card', regex: /\b(?:\d[ -]*?){13,16}\b/g, replacement: '[REDACTED_CC]' },
  { name: 'phone', regex: /\b(\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, replacement: '[REDACTED_PHONE]' },
  { name: 'ipv4', regex: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g, replacement: '[REDACTED_IP]' },
  { name: 'api_key', regex: /\b(?:sk|pk|pk_live|cb_live|cb_test|AKIA|ghp|gho|xoxb|xoxp)_[A-Za-z0-9]{20,}\b/g, replacement: '[REDACTED_KEY]' },
  { name: 'iban', regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g, replacement: '[REDACTED_IBAN]' },
];

export function redactString(input: string): { redacted: string; count: number; types: string[] } {
  let redacted = input;
  let count = 0;
  const types: string[] = [];

  for (const { name, regex, replacement } of PATTERNS) {
    const matches = redacted.match(regex);
    if (matches && matches.length > 0) {
      redacted = redacted.replace(regex, replacement);
      count += matches.length;
      types.push(name);
    }
  }

  return { redacted, count, types };
}

export function redactValue(value: any): any {
  if (typeof value === 'string') {
    return redactString(value).redacted;
  }
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (value && typeof value === 'object') {
    const result: any = {};
    for (const [k, v] of Object.entries(value)) {
      // Redact keys that look like sensitive field names
      const keyLower = k.toLowerCase();
      if (['password', 'passwd', 'secret', 'token', 'apikey', 'api_key', 'ssn', 'creditcard'].some(s => keyLower.includes(s))) {
        result[k] = '[REDACTED_FIELD]';
      } else {
        result[k] = redactValue(v);
      }
    }
    return result;
  }
  return value;
}

export function redactResults(results: any[]): { redacted: any[]; totalRedactions: number; typesFound: string[] } {
  let totalRedactions = 0;
  const typesSet = new Set<string>();
  const redacted = results.map(item => {
    if (typeof item === 'string') {
      const r = redactString(item);
      totalRedactions += r.count;
      r.types.forEach(t => typesSet.add(t));
      return r.redacted;
    }
    // For objects, walk and count
    const before = JSON.stringify(item);
    const redactedItem = redactValue(item);
    const after = JSON.stringify(redactedItem);
    const diff = before.length - after.length;
    if (diff !== 0 || before !== after) {
      totalRedactions += 1; // at least one redaction occurred
    }
    return redactedItem;
  });
  return { redacted, totalRedactions, typesFound: Array.from(typesSet) };
}
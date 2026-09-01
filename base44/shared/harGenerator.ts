// HAR (HTTP Archive) Generator — creates HAR 1.2 compliant JSON from network logs.
// Enables export of network traffic for debugging and analysis (Browserbase Session Inspector parity).

export interface HarEntry {
  request: {
    method: string;
    url: string;
    httpVersion: string;
    headers: Array<{ name: string; value: string }>;
    queryString: Array<{ name: string; value: string }>;
    postData?: { mimeType: string; text: string };
    headersSize: number;
    bodySize: number;
  };
  response: {
    status: number;
    statusText: string;
    httpVersion: string;
    headers: Array<{ name: string; value: string }>;
    content: { size: number; mimeType: string; text?: string };
    redirectURL: string;
    headersSize: number;
    bodySize: number;
  };
  cache: Record<string, any>;
  timings: { send: number; wait: number; receive: number };
  time: number;
  startedDateTime: string;
}

export interface NetworkLogEntry {
  method?: string;
  url: string;
  status?: number;
  statusText?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
  mimeType?: string;
  duration?: number;
  timestamp?: string;
}

export function generateHar(
  entries: NetworkLogEntry[],
  options?: { creator?: string; browser?: string }
): any {
  const harEntries: HarEntry[] = entries.map((e) => {
    const url = new URL(e.url);
    const queryString = Array.from(url.searchParams.entries()).map(([name, value]) => ({ name, value }));
    const requestHeaders = e.requestHeaders
      ? Object.entries(e.requestHeaders).map(([name, value]) => ({ name, value }))
      : [];
    const responseHeaders = e.responseHeaders
      ? Object.entries(e.responseHeaders).map(([name, value]) => ({ name, value }))
      : [];

    return {
      request: {
        method: e.method || 'GET',
        url: e.url,
        httpVersion: 'HTTP/1.1',
        headers: requestHeaders,
        queryString,
        postData: e.requestBody ? { mimeType: 'application/json', text: e.requestBody } : undefined,
        headersSize: -1,
        bodySize: e.requestBody ? e.requestBody.length : 0,
      },
      response: {
        status: e.status || 200,
        statusText: e.statusText || 'OK',
        httpVersion: 'HTTP/1.1',
        headers: responseHeaders,
        content: {
          size: e.responseBody ? e.responseBody.length : 0,
          mimeType: e.mimeType || 'application/json',
          text: e.responseBody,
        },
        redirectURL: '',
        headersSize: -1,
        bodySize: e.responseBody ? e.responseBody.length : 0,
      },
      cache: {},
      timings: { send: 0, wait: 0, receive: e.duration || 0 },
      time: e.duration || 0,
      startedDateTime: e.timestamp || new Date().toISOString(),
    };
  });

  return {
    log: {
      version: '1.2',
      creator: {
        name: options?.creator || 'CloudBrowser',
        version: '1.0',
      },
      browser: {
        name: options?.browser || 'Chromium',
        version: '132',
      },
      pages: [],
      entries: harEntries,
    },
  };
}

export function harToJsonString(har: any): string {
  return JSON.stringify(har, null, 2);
}
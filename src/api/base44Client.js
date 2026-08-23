import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// Diagnostic: log if app ID is missing so we can identify the root cause
if (!appId) {
  console.error('[Cloud Browser] App ID is null/missing. This will cause "Invalid id value: null" errors. Check that the app is properly built and no stale service worker is caching old files.');
}

//Create a client with authentication required
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});
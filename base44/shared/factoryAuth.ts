import { secrets } from 'base44:runtime';
export async function requireFactoryExecutor(base44, body = {}) {
  const expected = secrets.get('WORKER_SECRET');
  if (expected && body.worker_secret === expected) return { id: null, role: 'admin', worker: true };
  const user = await base44.auth.me();
  if (!user) throw new Error('Sign in to continue.');
  if (user.role !== 'admin') throw new Error('Only an administrator can run deployments or the shared worker.');
  return user;
}
export function canAccessBuild(user, build) {
  return user.role === 'admin' || build.created_by_id === user.id || build.owner_id === user.id;
}
export async function hashContactToken(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
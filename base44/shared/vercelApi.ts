import { secrets } from 'base44:runtime';
export function encodeWebsiteFile(value) {let binary='';for(const byte of new TextEncoder().encode(value))binary+=String.fromCharCode(byte);return btoa(binary);}
export async function vercelRequest(path,options={}) {
 const token=secrets.get('VERCEL_API_TOKEN')||secrets.get('VERCEL_ACCESS_TOKEN');
 if(!token)throw new Error('A Vercel access token is required. Your live website has not changed.');
 const response=await fetch('https://api.vercel.com'+path,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(20000)});
 const data=await response.json();
 if(!response.ok){const error=new Error(data.error?.message||`Vercel returned HTTP ${response.status}.`);error.status=response.status;throw error;}
 return data;
}
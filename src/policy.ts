import {lookup} from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import type {Employer} from './catalog.js';
export class AppError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
export type Resolver = (host:string) => Promise<string[]>;
const dns:Resolver = async host => (await lookup(host,{all:true})).map(x=>x.address);
export function publicIP(raw:string) {
  try {
    let ip = ipaddr.parse(raw);
    if (ip.kind()==='ipv6' && (ip as ipaddr.IPv6).isIPv4MappedAddress()) ip = (ip as ipaddr.IPv6).toIPv4Address();
    return ip.range()==='unicast';
  } catch { return false; }
}
export function canonicalUrl(raw:string):string {
  const u=new URL(raw); u.hash='';
  // Greenhouse's legacy job host redirects to this current host. Only exact
  // public job-detail paths qualify; safeUrl validates the target host/DNS.
  const greenhouseJob=/^\/[a-z0-9_-]+\/jobs\/(\d+)\/?$/i.exec(u.pathname);
  if(greenhouseJob&&['boards.greenhouse.io','job-boards.greenhouse.io'].includes(u.hostname)){
    u.hostname='job-boards.greenhouse.io';
    if(u.searchParams.get('gh_jid')===greenhouseJob[1])u.searchParams.delete('gh_jid');
  }
  for (const key of [...u.searchParams.keys()]) if (/^(utm_|ref$|source$|gh_src$)/i.test(key)) u.searchParams.delete(key);
  u.searchParams.sort();
  u.pathname=u.pathname.replace(/\/+$/,'')||'/';
  return u.href;
}
export async function safeUrl(raw:string, employer:Employer, resolve:Resolver=dns):Promise<string> {
  if (raw.length>2000 || /[\s\\\u0000-\u001f]/u.test(raw)) throw new AppError('unsafe_url');
  let u:URL;
  try { u=new URL(raw); } catch { throw new AppError('unsafe_url'); }
  if (u.protocol!=='https:' || u.username || u.password || (u.port && u.port!=='443')) throw new AppError('unsafe_url');
  if (!(employer.hosts as readonly string[]).includes(u.hostname)) throw new AppError('unapproved_domain');
  // Exact path prefix boundaries prevent /jobs.evil and encoded traversal bypasses.
  let path:string;
  try { path=decodeURIComponent(u.pathname); } catch { throw new AppError('unsafe_url'); }
  if (/[\\\u0000-\u001f]/u.test(path) || path.split('/').some(x=>x==='..' || x==='.') || /%[0-9a-f]{2}/i.test(path)) throw new AppError('unsafe_url');
  if (!(employer.paths as readonly string[]).some(p=>path===p || path.startsWith(p+'/'))) throw new AppError('unapproved_path');
  for (const [key,value] of u.searchParams) {
    if (/token|key|secret|password|auth|redirect|return|callback|url|host|target/i.test(key) || /https?:|localhost|127\.0\.0\.1/i.test(value)) throw new AppError('unsafe_url');
  }
  const canonical=canonicalUrl(u.href),target=new URL(canonical);
  if(!(employer.hosts as readonly string[]).includes(target.hostname))throw new AppError('unapproved_domain');
  let addresses:string[];
  let timer:ReturnType<typeof setTimeout>|undefined;
  try {
    addresses=await Promise.race([resolve(target.hostname),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new AppError('dns_failure')),4000);})]);
  } catch { throw new AppError('dns_failure'); } finally { if(timer) clearTimeout(timer); }
  if (!addresses.length || addresses.some(x=>!publicIP(x))) throw new AppError('unsafe_url');
  return canonical;
}
export function errorCode(error:unknown):string {
  if (error instanceof AppError) return error.code;
  const apiError=error as {statusCode?:number;status?:number};
  const status = apiError?.statusCode??apiError?.status;
  if(status===401) return 'credentials_invalid';
  if(status===402) return 'credits_unavailable';
  if(status===403) return 'access_blocked';
  if(status===429) return 'provider_rate_limit';
  if(status===408) return 'timeout';
  if(error instanceof Error && /timeout|abort/i.test(error.name)) return 'timeout';
  return 'provider_failure';
}

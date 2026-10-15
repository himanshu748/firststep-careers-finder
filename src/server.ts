import dotenv from 'dotenv';
import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {employers} from './catalog.js';
import {Budget,dailyRequestLimit} from './budget.js';
import {SearchService} from './service.js';
import {AGENT_DEFAULT_MAX_STEPS,AGENT_MAX_RATE_USD,AGENT_MAX_RUN_RESERVE_USD,TinyFishProvider} from './tinyfish.js';
import {TinyFishBrowserProvider} from './browser.js';
import {AppError,errorCode} from './policy.js';
import {searchSchema} from './model.js';
dotenv.config({path:resolve('.env'),quiet:true});
// Explicit opt-in reuses an existing server-side credential. Local/environment values win.
if(process.env.USE_SHARED_TINYFISH_KEY==='true') dotenv.config({path:join(homedir(),'.config/tinyfish/credentials.env'),quiet:true});
const port=Number(process.env.PORT||4317);
if(!Number.isInteger(port)||port<1024||port>65535) throw new AppError('invalid_port');
const dailyLimit=dailyRequestLimit(process.env.MAX_DAILY_REQUESTS);
const budget=new Budget(resolve('.data/budget.sqlite'),dailyLimit);
const ready=!!process.env.TINYFISH_API_KEY && process.env.FREE_CREDITS_APPROVED==='true';
const workflow=process.env.TINYFISH_WORKFLOW||'agent';
if(!['browser','agent'].includes(workflow))throw new AppError('invalid_workflow');
const service=ready?new SearchService(workflow==='browser'?new TinyFishBrowserProvider(process.env.TINYFISH_API_KEY!):new TinyFishProvider(process.env.TINYFISH_API_KEY!),budget,undefined,resolve('.data/runs.json')):null;
const token=randomBytes(24).toString('hex');
const publicDir=resolve('public');
const assets:Record<string,[string,string]>={ '/':['index.html','text/html'], '/app.js':['app.js','text/javascript'], '/shared.mjs':['shared.mjs','text/javascript'], '/style.css':['style.css','text/css'], '/fonts/manrope-latin.woff2':['fonts/manrope-latin.woff2','font/woff2'], '/fonts/space-grotesk-latin.woff2':['fonts/space-grotesk-latin.woff2','font/woff2'] };
function json(res:ServerResponse,status:number,body:unknown){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));}
async function body(req:IncomingMessage) {
  if(!req.headers['content-type']?.startsWith('application/json')) throw new AppError('json_required',415);
  let bytes=0;const chunks:Buffer[]=[];
  for await(const chunk of req) {bytes+=chunk.length;if(bytes>8192) throw new AppError('request_too_large',413);chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw new AppError('invalid_json');}
}
export const server=createServer(async(req,res)=>{
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');
  try {
    if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host||'')) throw new AppError('invalid_host',403);
    if(req.headers.origin && ![`http://127.0.0.1:${port}`,`http://localhost:${port}`].includes(req.headers.origin)) throw new AppError('invalid_origin',403);
    const url=new URL(req.url||'/','http://localhost');
    if(req.method==='GET' && url.pathname==='/api/config') return json(res,200,{ready,workflow,reason:!process.env.TINYFISH_API_KEY?'credentials_missing':process.env.FREE_CREDITS_APPROVED!=='true'?'free_credits_not_approved':null,employers:employers.map(({id,name,domain,url,permission})=>({id,name,domain,url,permission})),budget:{used:budget.used(),limit:budget.limit},limits:{employers:5,jobs:20,pagesPerEmployer:2},creditPolicy:{agentDefaultSteps:AGENT_DEFAULT_MAX_STEPS,maxAgentReservePerEmployerUSD:AGENT_DEFAULT_MAX_STEPS*AGENT_MAX_RATE_USD,maxAgentReservePerRunUSD:AGENT_MAX_RUN_RESERVE_USD},token});
    if(req.method==='POST' && url.pathname==='/api/search') {
      if(req.headers['x-firststep-token']!==token) throw new AppError('invalid_session',403);
      const parsed=searchSchema.safeParse(await body(req));
      if(!parsed.success) throw new AppError('invalid_preferences');
      if(!service) throw new AppError(ready?'provider_failure':!process.env.TINYFISH_API_KEY?'credentials_missing':'free_credits_not_approved',503);
      return json(res,202,service.start(parsed.data));
    }
    if(req.method==='GET' && /^\/api\/runs\/[0-9a-f-]{36}$/.test(url.pathname)) {
      const run=service?.runs.get(url.pathname.split('/').pop()!);
      if(!run) throw new AppError('run_not_found',404);
      return json(res,200,run);
    }
    if(req.method==='GET' && assets[url.pathname]) {
      const [file,type]=assets[url.pathname];res.writeHead(200,{'Content-Type':type+'; charset=utf-8'});return res.end(await readFile(resolve(publicDir,file)));
    }
    throw new AppError('not_found',404);
  } catch(e) {
    // No raw request, preference, URL, provider error, HTML, or credential is logged.
    const code=errorCode(e);json(res,e instanceof AppError?e.status:500,{error:code});
  }
});
server.requestTimeout=10000;
server.listen(port,'127.0.0.1',()=>console.info(`FirstStep ready at http://127.0.0.1:${port} (${ready?'live enabled':'setup required'})`));
process.on('SIGTERM',()=>server.close(()=>{budget.close();process.exit(0);}));

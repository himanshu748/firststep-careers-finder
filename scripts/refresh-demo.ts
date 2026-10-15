// Refresh an authentic retained run's public sources, never manufacture or import fixture jobs.
import dotenv from 'dotenv';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {TinyFish} from '@tiny-fish/sdk';
import {Budget,dailyRequestLimit} from '../src/budget.js';
import {employers} from '../src/catalog.js';
import {safeUrl} from '../src/policy.js';
import {parseJobPage} from '../src/browser.js';
import {corroborate,normalizedJob,type SearchRun} from '../src/model.js';
import {loadHistory,saveHistory} from '../src/history.js';
import {checkedRun,localJson} from './demo-client.js';
dotenv.config({path:'.env',quiet:true});if(process.env.USE_SHARED_TINYFISH_KEY==='true')dotenv.config({path:join(homedir(),'.config/tinyfish/credentials.env'),quiet:true});
try {
  if(process.env.FREE_CREDITS_APPROVED!=='true'||!process.env.TINYFISH_API_KEY)throw new Error('setup_required');
  const evidence=JSON.parse(await readFile('evidence/live-demo.json','utf8'));
  const served=checkedRun(await localJson('/api/runs/'+evidence.runId,Number(process.env.PORT||4317)));
  const history=loadHistory('.data/runs.json');
  const run=history.find(r=>r.id===served.id&&r.requests>=served.requests)||served;
  if(run.status==='running'||!run.jobs.length||run.jobs.length>20)throw new Error('terminal_run_required');
  if(run.requests+1+Math.ceil(run.jobs.length/10)>32)throw new Error('run_budget_reached');
  const dailyLimit=dailyRequestLimit(process.env.MAX_DAILY_REQUESTS);
  const budget=new Budget('.data/budget.sqlite',dailyLimit);
  const take=()=>{budget.take();run.requests++;};
  const client=new TinyFish({apiKey:process.env.TINYFISH_API_KEY,maxRetries:0,timeout:150000});
  try {
  take();
  const wallet=await client.wallet.get();const rates=wallet.rates?.meters.filter(m=>/fetch/i.test(m.label))||[];
  const rate=rates.length===1?rates[0]:undefined;
  if(wallet.currency!=='USD'||!Number.isFinite(Number(wallet.available_balance))||Number(wallet.available_balance)<=0||!['off','unconfigured'].includes(wallet.auto_reload?.state??'')||wallet.pending_top_up||!rate||rate.currency!=='USD'||rate.per!=='url'||Number(rate.unit_amount)!==0)throw new Error('wallet_gate_failed');
  const urls=await Promise.all(run.jobs.map(job=>safeUrl(job.sourceUrl,employers.find(e=>e.id===job.employerId)!)));
  const pages=[];
  for(let offset=0;offset<urls.length;offset+=10){take();const fetched=await client.fetch.getContents({urls:urls.slice(offset,offset+10),format:'markdown',ttl:0,per_url_timeout_ms:20000,purpose:'Recheck retained public job sources and literal fields. Read only; no applications.'});if(fetched.errors.length)throw new Error('source_refresh_incomplete');pages.push(...fetched.results);}
  for(const job of run.jobs){const employer=employers.find(e=>e.id===job.employerId)!;const page=pages.find(p=>p.url===job.sourceUrl);if(typeof page?.text!=='string'||!page.text||await safeUrl(page.final_url||page.url,employer)!==job.sourceUrl)throw new Error('source_refresh_incomplete');
    const candidate=parseJobPage({text:page.text,heading:job.title,links:[],jsonLd:[]},job.sourceUrl,run.input,job.status==='open');const checked=candidate&&corroborate(candidate,page.text);if(!checked)throw new Error('source_refresh_incomplete');
    Object.assign(job,normalizedJob(checked,job.employer,job.employerId,run.input,new Date().toISOString()));
  }
  run.stage='Finished; source text refreshed';saveHistory('.data/runs.json',[...history.filter(r=>r.id!==run.id),run]);
  const fetchRequests=Math.ceil(urls.length/10);
  const receipt={...evidence,kind:`Genuine TinyFish ${run.workflow==='agent'?'Agent':'Browser'} run with a fresh Fetch source recheck`,checkedAt:new Date().toISOString(),requests:run.requests,jobs:run.jobs,sourceRefresh:{endpoint:'TinyFish Fetch',providerRequests:fetchRequests,urlCount:urls.length,errors:0}};
  await writeFile('evidence/live-demo.json',JSON.stringify(receipt,null,2)+'\n');
  await writeFile('evidence/source-refresh-receipt.json',JSON.stringify({kind:'redacted read-only source refresh receipt',checkedAt:new Date().toISOString(),runId:run.id,urlCount:urls.length,providerRequests:1+fetchRequests,autoReload:wallet.auto_reload?.state,pendingTopUp:!!wallet.pending_top_up,fetchPriceVerifiedZero:true,noPurchaseOrTopUpEndpointsUsed:true},null,2)+'\n');
  console.log('Refreshed '+run.jobs.length+' genuine source pages; history and redacted evidence saved. No raw HTML or secrets retained.');
  } finally {budget.close();}
}catch{console.log('Source refresh stopped; no raw errors or secrets logged.');process.exitCode=2;}

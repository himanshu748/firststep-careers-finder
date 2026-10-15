import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers/promises';
import {Budget} from '../src/budget.js';
import {SearchService} from '../src/service.js';
import {searchSchema,type SearchRun} from '../src/model.js';
import {AppError} from '../src/policy.js';
import {BrowserNavigationError} from '../src/browser.js';
import type {Provider,Wallet} from '../src/tinyfish.js';
import {employers} from '../src/catalog.js';
import type {AgentRunParams} from '@tiny-fish/sdk';
// All jobs and source pages below are OFFLINE TEST FIXTURES; never imported by production.
const input=searchSchema.parse({keywords:'software',location:'',domains:['stripe.com']});
const safeWallet:Wallet={balance:35,autoReload:'off',pendingTopUp:false,currency:'USD',agentStepRate:0.016,browserMinuteRate:0.002,searchRate:0,fetchRate:0};
function fixture(url='https://stripe.com/jobs/listing/123',suffix=''){return {title:'Software Engineer Intern'+suffix,sourceUrl:url,excerpt:'Build software',workArrangement:'remote',geographicRestriction:'United States only',experienceRequirements:'No experience required',seniority:'internship',employmentType:'internship',postedDate:null,deadline:null,visaSponsorship:null,sponsorshipAvailable:null,status:'open'};}
function provider(overrides:Partial<Provider>={}):Provider{return {
  wallet:async()=>({...safeWallet}),search:async()=>[],
  read:async url=>({finalUrl:url,text:url.endsWith('/robots.txt')?'User-agent: *\nAllow: /':'Software Engineer Intern. Build software. Remote. United States only. No experience required. Internship.'}),
  extract:async()=>({status:'COMPLETED',result:{status:'complete',pagesVisited:2,jobs:[fixture()]}}),...overrides,
};}
async function finished(run:SearchRun){for(let i=0;i<300&&run.status==='running';i++)await setImmediate();assert.notEqual(run.status,'running');return run;}
test('pipeline checks sources, preserves unknown dates, and does not equate remote with India eligibility',async()=>{
  const budget=new Budget(':memory:');const service=new SearchService(provider(),budget,async()=>['93.184.215.14']);
  const run=await finished(service.start(input));assert.equal(run.status,'complete');assert.equal(run.jobs.length,1);assert.equal(run.jobs[0].geographicRestriction,'United States only');assert.equal(run.jobs[0].postedDate,null);assert.equal(run.requests,5);assert.equal(run.jobs[0].sourceVerified,true);budget.close();
});
test('OFFLINE redirect regression: bounded robots batch covers two employers and missing rules fail closed',async()=>{
  for(const omitATS of [false,true]){
    let batches=0,sourceReads=0;
    const p=provider({
      readMany:async urls=>{batches++;assert.ok(urls.length<=10);return new Map(urls.filter(url=>!omitATS||url!=='https://job-boards.greenhouse.io/robots.txt').map(url=>[url,{finalUrl:url,text:'User-agent: *\nAllow: /'}]));},
      extract:async params=>({status:'COMPLETED',steps:3,result:{status:'partial',pagesVisited:1,jobs:[fixture(params.goal.includes('for Cloudflare.')?'https://boards.greenhouse.io/cloudflare/jobs/8245197?gh_jid=8245197':'https://job-boards.greenhouse.io/affirm/jobs/8010617003')]}}),
      read:async url=>{assert.ok(!url.endsWith('/robots.txt'));assert.ok(url.startsWith('https://job-boards.greenhouse.io/'));sourceReads++;return {finalUrl:url,text:'Software Engineer Intern. Build software. Remote within the United States only. No experience required. Internship.'};},
    });
    const budget=new Budget(':memory:',7),run=await finished(new SearchService(p,budget,async()=>['93.184.215.14']).start({...input,domains:['cloudflare.com','affirm.com'],maxJobs:2}));
    assert.equal(batches,1);assert.equal(run.jobs.length,omitATS?0:2);assert.equal(sourceReads,omitATS?0:2);assert.ok(run.requests<=7);
    if(!omitATS){assert.equal(run.requests,7);assert.equal(run.jobs[0].sourceUrl,'https://job-boards.greenhouse.io/cloudflare/jobs/8245197');}
    budget.close();
  }
  let batches=0;const budget=new Budget(':memory:');
  const p=provider({readMany:async urls=>{batches++;assert.ok(urls.length<=10);return new Map(urls.map(url=>[url,{finalUrl:url,text:'User-agent: *\nAllow: /'}]));},extract:async()=>({status:'COMPLETED',steps:1,result:{status:'empty',pagesVisited:1,jobs:[]}})});
  const run=await finished(new SearchService(p,budget,async()=>['93.184.215.14']).start({...input,domains:[]}));
  assert.equal(batches,2);assert.equal(run.reports.length,5);assert.equal(run.status,'empty');budget.close();
});
test('OFFLINE live-bug regression: unsupported Agent seniority and misleading arrangement are checked against role text',async()=>{
  const url='https://job-boards.greenhouse.io/affirm/jobs/8010617003';
  const p=provider({extract:async()=>({status:'COMPLETED',steps:15,result:{status:'partial',pagesVisited:2,jobs:[{...fixture(url),title:'Software Engineer, Early Career (SF)',seniority:'early-career',workArrangement:'onsite',location:'San Francisco',geographicRestriction:null}]}}),read:async source=>({finalUrl:source,text:source.endsWith('/robots.txt')?'User-agent: *\nAllow: /':"Software Engineer, Early Career (SF)\nSan Francisco\nIn our hybrid early career program, you collaborate in-person three days a week.\nRemote-first company. Most roles are remote.\nNo experience required. Build software."})});
  const budget=new Budget(':memory:');const run=await finished(new SearchService(p,budget,async()=>['93.184.215.14']).start({...input,domains:['affirm.com']}));
  assert.equal(run.jobs.length,1);assert.equal(run.jobs[0].seniority,'entry-level');assert.equal(run.jobs[0].workArrangement,'hybrid');assert.equal(run.jobs[0].geographicRestriction,null);assert.equal(run.jobs[0].postedDate,null);assert.equal(run.jobs[0].sourceVerified,true);assert.equal(run.reports[0].agentSteps,15);budget.close();
});
test('at most five employers, twenty source jobs, two requested pages, per-employer quotas',async()=>{
  const requests:AgentRunParams[]=[];let count=0;
  const p=provider({extract:async params=>{requests.push(params);const host=new URL(params.url).hostname;const e=employers.find(e=>(e.hosts as readonly string[]).includes(host))!;const prefix=e.paths[0];return {status:'COMPLETED',result:{status:'partial',pagesVisited:2,jobs:Array.from({length:50},(_,i)=>fixture(`https://${host}${prefix}/${i}`,' '+i))}};},read:async url=>{if(url.endsWith('/robots.txt'))return {finalUrl:url,text:'User-agent: *\nAllow: /'};count++;return {finalUrl:url,text:'Build software. Internship. Remote. United States only. No experience required. '+Array.from({length:50},(_,i)=>'Software Engineer Intern '+i).join(' ')};}});
  const budget=new Budget(':memory:');const run=await finished(new SearchService(p,budget,async()=>['93.184.215.14']).start({...input,domains:[]}));
  assert.equal(requests.length,5);assert.ok(count<=20);assert.ok(run.jobs.length<=20);assert.ok(run.requests<=32);assert.ok(requests.every(r=>r.goal.includes('at most 4')&&r.goal.includes('TWO listing pages')));assert.equal(run.status,'partial');budget.close();
});
test('invalid pagination output is not silently accepted',async()=>{
  const budget=new Budget(':memory:');const run=await finished(new SearchService(provider({extract:async()=>({status:'COMPLETED',result:{status:'complete',pagesVisited:3,jobs:[fixture()]}})}),budget,async()=>['93.184.215.14']).start(input));
  assert.equal(run.jobs.length,0);assert.equal(run.reports[0].code,'invalid_provider_output');budget.close();
});
test('duplicate canonical URLs are fetched once and identity duplicates are removed',async()=>{
  let checks=0;const p=provider({extract:async()=>({status:'COMPLETED',result:{status:'complete',pagesVisited:1,jobs:[fixture(),fixture('https://stripe.com/jobs/listing/123?utm_source=x'),fixture('https://stripe.com/jobs/listing/456')]}}),read:async url=>{if(!url.endsWith('/robots.txt'))checks++;return {finalUrl:url,text:url.endsWith('/robots.txt')?'User-agent: *\nAllow: /':'Software Engineer Intern. Build software. Remote. United States only. No experience required. Internship.'};}});
  const budget=new Budget(':memory:');const run=await finished(new SearchService(p,budget,async()=>['93.184.215.14']).start(input));assert.equal(run.jobs.length,1);assert.equal(checks,2);budget.close();
});
test('blocked COMPLETED output yields blocked state and no fake listings',async()=>{
  const budget=new Budget(':memory:');const run=await finished(new SearchService(provider({extract:async()=>({status:'COMPLETED',result:{status:'blocked',pagesVisited:0,jobs:[]}})}),budget,async()=>['93.184.215.14']).start(input));assert.equal(run.status,'blocked');assert.equal(run.jobs.length,0);budget.close();
});
test('wallet safety prevents chargeable operations; unknown auto reload fails closed',async()=>{
  for(const wallet of [{balance:0,autoReload:'off',pendingTopUp:false},{balance:35,autoReload:'on',pendingTopUp:false},{balance:35,autoReload:null,pendingTopUp:false},{balance:35,autoReload:'off',pendingTopUp:true}]){
    const budget=new Budget(':memory:');let searched=false;const run=await finished(new SearchService(provider({wallet:async()=>({...safeWallet,...wallet}),search:async()=>{searched=true;return [];}}),budget).start(input));assert.equal(run.error,'wallet_not_safe');assert.equal(searched,false);assert.equal(run.requests,1);budget.close();
  }
});
test('unknown or changed rates and insufficient credit reserve stop before search',async()=>{
  for(const [change,code] of [
    [{currency:'EUR'},'provider_rates_unverified'],[{agentStepRate:NaN},'provider_rates_unverified'],[{agentStepRate:0.021},'provider_rates_unverified'],
    [{searchRate:0.001},'provider_rates_unverified'],[{fetchRate:0.001},'provider_rates_unverified'],[{balance:0.1},'free_credit_reserve_reached'],
  ] as [Partial<Wallet>,string][]) {
    let calls=0;const budget=new Budget(':memory:');const run=await finished(new SearchService(provider({wallet:async()=>({...safeWallet,...change}),search:async()=>{calls++;return [];}}),budget).start(input));
    assert.equal(run.error,code);assert.equal(calls,0);assert.equal(run.requests,1);budget.close();
  }
});
test('Agent permission refusal stops without retrying or switching workflows',async()=>{
  let calls=0;const budget=new Budget(':memory:');const run=await finished(new SearchService(provider({extract:async params=>{calls++;assert.equal(params.agent_config?.max_steps,undefined);throw new AppError('agent_access_unavailable',503);}}),budget,async()=>['93.184.215.14']).start({...input,domains:['stripe.com','cloudflare.com']}));
  assert.equal(calls,1);assert.equal(run.error,'agent_access_unavailable');assert.equal(run.jobs.length,0);assert.equal(run.reports.length,1);budget.close();
});
test('public Agent reserves all 150 default steps per employer before discovery',async()=>{
  for(const [balance,stepRate,expectedCalls] of [[0.5,0.016,0],[4.5,0.016,0],[4.82,0.016,2],[5,0.02,0],[6.02,0.02,2]]) {
    let searched=0,calls=0;const budget=new Budget(':memory:');
    const p=provider({wallet:async()=>({...safeWallet,balance,agentStepRate:stepRate}),search:async()=>{searched++;return [];},extract:async()=>{calls++;return {status:'COMPLETED',result:{status:'empty',pagesVisited:1,jobs:[]},steps:2};}});
    const run=await finished(new SearchService(p,budget,async()=>['93.184.215.14']).start({...input,domains:['stripe.com','cloudflare.com']}));
    assert.equal(calls,expectedCalls);assert.equal(searched,expectedCalls?1:0);
    if(!expectedCalls)assert.equal(run.error,'free_credit_reserve_reached');else assert.equal(run.reports[0].agentSteps,2);
    budget.close();
  }
});
test('failed Browser connection keeps confirmed cleanup and can check another employer',async()=>{
  for(const cleanup of ['confirmed','inactivity-fallback','unconfirmed'] as const){
    let calls=0;const budget=new Budget(':memory:');const p=provider({navigate:async()=>{calls++;throw new BrowserNavigationError('browser_connection_timeout',cleanup,0);}});
    const run=await finished(new SearchService(p,budget,async()=>['93.184.215.14']).start({...input,domains:['stripe.com','cloudflare.com']}));
    assert.equal(calls,cleanup==='confirmed'?2:1);assert.equal(run.reports[0].cleanup,cleanup);assert.equal(run.reports[0].pagesVisited,0);assert.equal(run.jobs.length,0);
    if(cleanup!=='confirmed')assert.equal(run.error,'browser_connection_timeout');budget.close();
  }
});
test('Browser create and cleanup reserve atomically; an unconfirmed cleanup stops further sessions',async()=>{
  for(const daily of [4,40]){
    let launched=0;const budget=new Budget(':memory:',daily);const p=provider({navigate:async()=>{launched++;return {status:'COMPLETED',result:{status:'complete',pagesVisited:1,jobs:[fixture()]},cleanup:'inactivity-fallback'};}});
    const run=await finished(new SearchService(p,budget,async()=>['93.184.215.14']).start({...input,domains:['stripe.com','cloudflare.com']}));
    assert.equal(run.workflow,'browser');assert.equal(launched,daily===4?0:1);assert.equal(run.error,daily===4?'daily_budget_reached':'browser_cleanup_unconfirmed');
    if(daily===4)assert.equal(budget.used(),3);else {assert.equal(run.jobs.length,1);assert.equal(run.status,'partial');assert.equal(run.reports[0].cleanup,'inactivity-fallback');}
    budget.close();
  }
});
test('Browser rate is separately verified before starting paid sessions',async()=>{
  let launched=false;const budget=new Budget(':memory:');const run=await finished(new SearchService(provider({wallet:async()=>({...safeWallet,browserMinuteRate:0.003}),navigate:async()=>{launched=true;throw new Error('should not launch');}}),budget).start(input));assert.equal(launched,false);assert.equal(run.error,'provider_rates_unverified');budget.close();
});
test('daily budget exhaustion preserves verified partial results and does not retry',async()=>{
  const budget=new Budget(':memory:',5);const run=await finished(new SearchService(provider(),budget,async()=>['93.184.215.14']).start({...input,domains:['stripe.com','atlassian.com']}));assert.equal(run.status,'partial');assert.equal(run.jobs.length,1);assert.equal(run.error,'daily_budget_reached');assert.equal(budget.used(),5);budget.close();
});
test('external source URLs and cross-employer redirects never become results',async()=>{
  for(const p of [provider({extract:async()=>({status:'COMPLETED',result:{status:'complete',pagesVisited:1,jobs:[fixture('https://localhost/jobs')]}})}),provider({read:async url=>({finalUrl:url.endsWith('/robots.txt')?url:'https://www.atlassian.com/company/careers/123',text:url.endsWith('/robots.txt')?'User-agent: *\nAllow: /':'Software Engineer Intern'})})]){
    const budget=new Budget(':memory:');const run=await finished(new SearchService(p,budget,async()=>['93.184.215.14']).start(input));assert.equal(run.jobs.length,0);assert.equal(run.reports[0].status,'partial');budget.close();
  }
});
test('API failure stops without exposing raw error; no automatic retry',async()=>{
  let attempts=0;const budget=new Budget(':memory:');const run=await finished(new SearchService(provider({extract:async()=>{attempts++;throw {status:401,message:'API KEY secret'};}}),budget,async()=>['93.184.215.14']).start(input));assert.equal(attempts,1);assert.equal(run.error,'credentials_invalid');assert.ok(!JSON.stringify(run).includes('secret'));budget.close();
});
test('unknown employers rejected, concurrent searches locked, no result seeds',async()=>{
  const budget=new Budget(':memory:');const service=new SearchService(provider(),budget,async()=>['93.184.215.14']);assert.throws(()=>service.start({...input,domains:['example.com']}),/unapproved_employer/);const run=service.start(input);assert.equal(run.jobs.length,0);assert.throws(()=>service.start(input),/search_already_running/);await finished(run);budget.close();
});
test('robots restriction prevents agent launch',async()=>{
  let launched=false;const budget=new Budget(':memory:');const run=await finished(new SearchService(provider({read:async url=>({finalUrl:url,text:'User-agent: *\nDisallow: /careers'}),extract:async()=>{launched=true;throw new AppError('should_not_launch');}}),budget,async()=>['93.184.215.14']).start(input));assert.equal(launched,false);assert.equal(run.status,'blocked');budget.close();
});
test('pagination exhaustion with no jobs is partial, not a fabricated successful empty search',async()=>{
  const budget=new Budget(':memory:');const run=await finished(new SearchService(provider({extract:async()=>({status:'COMPLETED',result:{status:'partial',pagesVisited:2,jobs:[]}})}),budget,async()=>['93.184.215.14']).start(input));assert.equal(run.status,'partial');assert.equal(run.jobs.length,0);budget.close();
});
test('Search-derived URL hints are validated and used, private hints are discarded',async()=>{
  let goal='';const budget=new Budget(':memory:');const run=await finished(new SearchService(provider({search:async()=>['https://stripe.com/careers/listing/software-intern/123','https://127.0.0.1/jobs'],extract:async params=>{goal=params.goal;return {status:'COMPLETED',result:{status:'empty',pagesVisited:1,jobs:[]}};}}),budget,async()=>['93.184.215.14']).start(input));assert.match(goal,/stripe.com\/careers\/listing\/software-intern\/123/);assert.equal(goal.includes('https://127.0.0.1'),false);assert.equal(run.status,'empty');budget.close();
});

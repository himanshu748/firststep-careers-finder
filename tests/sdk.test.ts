import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AGENT_DEFAULT_MAX_STEPS,TinyFishProvider,extractionRequest} from '../src/tinyfish.js';
import {employers} from '../src/catalog.js';
import {searchSchema} from '../src/model.js';
import {errorCode} from '../src/policy.js';
test('OFFLINE TRANSPORT FIXTURE: official SDK request contracts, auth and no retries',async()=>{
  const previous=globalThis.fetch;const requests:{url:URL;init?:RequestInit}[]=[];
  globalThis.fetch=async(url,init)=>{
    const u=new URL(String(url));requests.push({url:u,init});
    assert.equal(new Headers(init?.headers).get('x-api-key'),'OFFLINE_TEST_KEY');
    let data:unknown;
    if(u.pathname==='/v1/wallet')data={available_balance:'35.00',currency:'USD',as_of:'2026-10-12T12:00:00Z',auto_reload:{state:'unconfigured'},pending_top_up:null,rates:{as_of:"2026-10-14T12:00:00Z",meters:[{label:'TinyFish Agent',unit_amount:'0.016',currency:'USD',per:'step'},{label:'TinyFish Search',unit_amount:'0',currency:'USD',per:'query'},{label:'TinyFish Fetch',unit_amount:'0',currency:'USD',per:'url'}]}};
    else if(u.hostname==='api.search.tinyfish.ai')data={query:'test',results:[{position:1,site_name:'Stripe',snippet:'[TEST FIXTURE]',title:'[TEST FIXTURE] Careers',url:'https://stripe.com/careers/search'}],total_results:1,page:1};
    else if(u.hostname==='api.fetch.tinyfish.ai')data={results:[{url:'https://stripe.com/careers/search',final_url:'https://stripe.com/careers/search',title:'[TEST FIXTURE]',description:null,language:null,author:null,published_date:null,format:'markdown',text:'[OFFLINE TEST FIXTURE] source content'}],errors:[]};
    else if(u.pathname==='/v1/automation/run')data={status:'COMPLETED',run_id:'test-run',result:{status:'empty',pagesVisited:1,jobs:[]},error:null,num_of_steps:1,started_at:null,finished_at:null};
    else throw new Error('unexpected SDK endpoint in fixture');
    return Response.json(data);
  };
  try {
    const p=new TinyFishProvider('OFFLINE_TEST_KEY');assert.deepEqual(await p.wallet(),{balance:35,currency:'USD',autoReload:'unconfigured',pendingTopUp:false,agentStepRate:0.016,browserMinuteRate:NaN,searchRate:0,fetchRate:0});
    assert.deepEqual(await p.search('software careers',['stripe.com']),['https://stripe.com/careers/search']);
    assert.equal((await p.read('https://stripe.com/careers/search')).text,'[OFFLINE TEST FIXTURE] source content');
    assert.equal((await p.extract(extractionRequest(employers[1],employers[1].url,searchSchema.parse({keywords:'software'}),4),AbortSignal.timeout(1000))).steps,1);
    assert.equal(requests.length,4);assert.equal(requests[0].url.href,'https://agent.tinyfish.ai/v1/wallet');
    assert.equal(requests[1].url.hostname,'api.search.tinyfish.ai');assert.equal(requests[1].url.searchParams.get('include_domains'),'stripe.com');
    assert.equal(requests[2].url.hostname,'api.fetch.tinyfish.ai');assert.equal(JSON.parse(String(requests[2].init?.body)).ttl,0);
    const request=JSON.parse(String(requests[3].init?.body));assert.equal(request.agent_config.max_duration_seconds,60);assert.equal('max_steps' in request.agent_config,false);assert.equal(AGENT_DEFAULT_MAX_STEPS,150);assert.equal(request.use_vault,false);assert.deepEqual(request.proxy_config,{enabled:false});
    assert.equal(request.output_schema.properties.jobs.maxItems,4);assert.deepEqual(request.output_schema.properties.jobs.items.properties.seniority.enum,['internship','entry-level','experienced','unknown']);
    let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({error:{message:'OFFLINE SECRET FIXTURE'}},{status:500});};
    await assert.rejects(()=>p.search('test',['stripe.com']),e=>errorCode(e)==='provider_failure');assert.equal(calls,1);
    for(const [status,code] of [[401,'credentials_invalid'],[402,'credits_unavailable'],[429,'provider_rate_limit']] as const){
      calls=0;globalThis.fetch=async()=>{calls++;return Response.json({error:{message:'OFFLINE SECRET FIXTURE'}},{status});};
      await assert.rejects(()=>p.search('test',['stripe.com']),e=>errorCode(e)===code);assert.equal(calls,1);
    }
    calls=0;globalThis.fetch=async()=>{calls++;return Response.json({error:{message:'OFFLINE SECRET FIXTURE'}},{status:403});};
    await assert.rejects(()=>p.extract(extractionRequest(employers[1],employers[1].url,searchSchema.parse({keywords:'software'}),4),AbortSignal.timeout(1000)),e=>errorCode(e)==='agent_access_unavailable');assert.equal(calls,1);
    globalThis.fetch=async()=>Response.json({status:'COMPLETED',run_id:'test-run',num_of_steps:151,started_at:null,finished_at:null,result:{},error:null});
    await assert.rejects(()=>p.extract(extractionRequest(employers[1],employers[1].url,searchSchema.parse({keywords:'software'}),4),AbortSignal.timeout(1000)),e=>errorCode(e)==='agent_budget_contract_violation');
    globalThis.fetch=async()=>Response.json({results:[],errors:[{url:'https://stripe.com/careers/search',error:'timeout'}]});
    await assert.rejects(()=>p.read('https://stripe.com/careers/search'),/timeout/);
    let batches=0;
    globalThis.fetch=async(_,init)=>{batches++;assert.equal(JSON.parse(String(init?.body)).urls.length,2);return Response.json({results:[{url:'https://stripe.com/robots.txt',final_url:'https://stripe.com/robots.txt',format:'markdown',title:'[OFFLINE TEST FIXTURE]',description:null,language:null,author:null,published_date:null,text:'User-agent: *\nAllow: /'}],errors:[{url:'https://www.stripe.com/robots.txt',error:'timeout'}]});};
    const rules=await p.readMany(['https://stripe.com/robots.txt','https://www.stripe.com/robots.txt']);
    assert.equal(batches,1);assert.equal(rules.size,1);assert.equal(rules.has('https://www.stripe.com/robots.txt'),false);
    await assert.rejects(()=>p.readMany(Array(11).fill('https://stripe.com/robots.txt')),/invalid_fetch_batch/);assert.equal(batches,1);
  } finally {globalThis.fetch=previous;}
});

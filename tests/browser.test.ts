import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BrowserNavigationError,parseJobPage,selectDetailLinks,sourceListingLinks,TinyFishBrowserProvider,type Snapshot} from '../src/browser.js';
import {employers} from '../src/catalog.js';
import {corroborate,searchSchema} from '../src/model.js';
import type {Browser} from 'playwright-core';
const input=searchSchema.parse({keywords:'software',domains:['stripe.com']});
// OFFLINE PAGE / CDP / SDK FIXTURES. Nothing below is a live listing or provider session.
const detail:Snapshot={heading:'Software Engineer Intern',text:'Software Engineer Intern\nLocations\nRemote, United States\nWork arrangement:\nRemote\nRemote roles are eligible in the United States only\nCurrently enrolled in a computer science degree\nBuild software with our team.',jsonLd:['{"@type":"JobPosting","title":"Software Engineer Intern","datePosted":"2026-01-01"}'],links:[]};
test('Browser page parser keeps absent dates and remote restrictions explicit',()=>{
  const job=parseJobPage(detail,'https://stripe.com/careers/listing/test/123',input,true)!;
  assert.equal(job.seniority,'internship');assert.equal(job.location,'Remote, United States');assert.equal(job.workArrangement,'remote');assert.match(job.geographicRestriction!,/United States only/);assert.equal(job.postedDate,null);assert.equal(job.deadline,null);assert.equal(job.sponsorshipAvailable,null);assert.equal(job.status,'open');
  assert.equal(parseJobPage({...detail,text:'Verify you are human. CAPTCHA'},'https://stripe.com/careers/listing/test/123',input,true),null);
  assert.equal(parseJobPage({...detail,heading:'Careers',jsonLd:[]},'https://stripe.com/careers/search',input,false),null);
  const experienced=parseJobPage({...detail,heading:'Software Engineer',jsonLd:[],text:'Software Engineer\n* 4+ years of experience as an engineer shipping production systems'},'https://stripe.com/careers/listing/test/124',input,true)!;assert.equal(experienced.seniority,'experienced');
  const office={heading:'Software Engineer Intern (2027)',links:[],jsonLd:[],text:'Software Engineer Intern (2027)\nIn-Office\nAvailable Locations\n* Lisbon, PT\nCurrently pursuing a degree in Computer Science.'};
  const officeJob=parseJobPage(office,'https://job-boards.greenhouse.io/cloudflare/jobs/8245197',input,true)!;
  assert.equal(officeJob.location,'Lisbon, PT');assert.equal(corroborate(officeJob,office.text)?.workArrangement,'onsite');assert.equal(officeJob.geographicRestriction,null);
});
test('OFFLINE CDP: connection timeout retains phase and DELETE outcome without raw errors',async()=>{
  const previous=globalThis.fetch;
  try {
    for(const deleteStatus of [204,503]){
      let deletions=0;
      globalThis.fetch=async(_url,init)=>{
        if(init?.method==='DELETE'){deletions++;return new Response(null,{status:deleteStatus});}
        return Response.json({session_id:'OFFLINE_TEST_SESSION',cdp_url:'wss://test.tinyfish.io/cdp',base_url:'https://test.tinyfish.io'});
      };
      const provider=new TinyFishBrowserProvider('OFFLINE_TEST_KEY',{connect:async()=>{throw Object.assign(new Error('OFFLINE PRIVATE ERROR MUST NOT ESCAPE'),{name:'TimeoutError'});}});
      await assert.rejects(()=>provider.navigate(employers[1],employers[1].url,input,1,[],AbortSignal.timeout(5000)),error=>{
        assert.ok(error instanceof BrowserNavigationError);assert.equal(error.code,'browser_connection_timeout');assert.equal(error.cleanup,deleteStatus===204?'confirmed':'inactivity-fallback');assert.equal(error.pagesVisited,0);assert.equal(JSON.stringify(error).includes('PRIVATE'),false);return true;
      });
      assert.equal(deletions,1);
    }
  }finally{globalThis.fetch=previous;}
});
test('role-specific hybrid and qualifications outweigh generic remote company copy',()=>{
 const page:Snapshot={heading:'Software Engineer, Early Career',links:[],jsonLd:[],text:"Software Engineer, Early Career\nSan Francisco, California, United States\nIn our hybrid early career program, work in-person three days a week.\nRemote-first company: most roles are remote.\nWhat We Look For\nThis position requires equivalent practical experience or a Bachelor's degree in a related field."};
 const parsed=parseJobPage(page,'https://job-boards.greenhouse.io/affirm/jobs/1',input,true)!;assert.equal(parsed.workArrangement,'hybrid');assert.match(parsed.experienceRequirements!,/Bachelor/);assert.equal(parsed.geographicRestriction,null);assert.equal(parsed.postedDate,null);
});
test('link selection favors early career matches, caps and canonicalizes duplicates',()=>{
  const links=[{url:'https://stripe.com/careers/listing/1',text:'Senior Software Engineer',next:false},{url:'https://stripe.com/careers/listing/2',text:'Software Engineer Intern',next:false},{url:'https://stripe.com/careers/listing/2?utm_source=test',text:'Software Engineer Intern',next:false},{url:'https://stripe.com/careers/listing/3',text:'Apply now',next:false}];
  assert.equal(selectDetailLinks({...detail,links},input,[],1)[0].text,'Software Engineer Intern');assert.equal(selectDetailLinks({...detail,links},input,[],20).length,2);
});
test('OFFLINE Fetch listing links supplement delayed DOM without treating Search snippets as jobs',()=>{
  const links=sourceListingLinks({text:'[Software Engineer New Grad](https://stripe.com/careers/listing/new-grad/123)',finalUrl:'https://stripe.com/careers/search',links:['https://stripe.com/careers/listing/software-engineer/124']});
  assert.equal(selectDetailLinks({...detail,links},input,[],2).length,2);assert.equal(links[0].text,'Software Engineer New Grad');
});
test('OFFLINE CDP: exactly two listing pages, detail quota, GET guards and confirmed DELETE',async()=>{
  const previous=globalThis.fetch;const calls:{url:string;init?:RequestInit}[]=[];let routeHandler:any;const navigated:string[]=[];let current='';let closed=false;const filled:string[]=[];
  const base='https://stripe.com/careers/search';
  const links=Array.from({length:8},(_,i)=>({url:`https://stripe.com/careers/listing/test/${i}`,text:'Software Engineer Intern '+i,next:false}));
  const page={goto:async(url:string)=>{current=url;navigated.push(url);return {status:()=>200};},url:()=>current,waitForLoadState:async()=>{},waitForTimeout:async()=>{},locator:()=>({fill:async(value:string)=>{filled.push(value);}}),evaluate:async()=>current.includes('/listing/')?{...detail,heading:'Software Engineer Intern '+current.split('/').pop(),jsonLd:[]}:{...detail,heading:'Careers',searchInput:true,links:[...links,{url:base+'?page='+(current.includes('?')?3:2),text:'Next',next:true}]}};
  const context={route:async(_pattern:string,handler:any)=>{routeHandler=handler;},routeWebSocket:async()=>{},newPage:async()=>page,close:async()=>{closed=true;}};
  const browser={newContext:async()=>context,close:async()=>{}} as unknown as Browser;
  globalThis.fetch=async(url,init)=>{calls.push({url:String(url),init});if(init?.method==='DELETE')return new Response(null,{status:204});return Response.json({session_id:'OFFLINE_TEST_SESSION',cdp_url:'wss://test.tinyfish.io/cdp',base_url:'https://test.tinyfish.io'});};
  try {
    const provider=new TinyFishBrowserProvider('OFFLINE_TEST_KEY',{connect:async()=>browser,resolve:async host=>host==='private.test'?['127.0.0.1']:['93.184.215.14']});
    const result=await provider.navigate(employers[1],base,input,4,[],AbortSignal.timeout(5000));
    assert.equal(result.result.pagesVisited,2);assert.equal(result.result.jobs.length,4);assert.equal(result.result.status,'partial');assert.equal(result.cleanup,'confirmed');assert.equal(navigated.length,6);assert.equal(navigated.includes(base+'?page=3'),false);assert.equal(closed,true);
    assert.deepEqual(filled,['software']);
    assert.equal(calls.length,2);assert.match(calls[0].url,/agent\.tinyfish\.ai\/v1\/browser$/);assert.deepEqual(JSON.parse(String(calls[0].init?.body)),{timeout_seconds:30,proxy_config:{enabled:false}});assert.equal(calls[1].url,'https://api.browser.tinyfish.ai/OFFLINE_TEST_SESSION');assert.equal(calls[1].init?.method,'DELETE');
    for(const [url,method,navigation,expected] of [['https://stripe.com/careers/search','POST',true,'abort'],['https://127.0.0.1/secret','GET',true,'abort'],['https://private.test/script.js','GET',false,'abort'],['https://stripe.com/careers/search','GET',true,'continue']] as const){
      let outcome='';await routeHandler({request:()=>({url:()=>url,method:()=>method,resourceType:()=>navigation?'document':'script',isNavigationRequest:()=>navigation}),abort:async()=>{outcome='abort';},continue:async()=>{outcome='continue';}});assert.equal(outcome,expected);
    }
  }finally{globalThis.fetch=previous;}
});

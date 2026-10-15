import {chromium,type Browser,type BrowserContext,type Page as BrowserPage} from 'playwright-core';
import {TinyFishProvider,type Page as SourcePage} from './tinyfish.js';
import {AppError,canonicalUrl,errorCode,publicIP,safeUrl,type Resolver} from './policy.js';
import {lookup} from 'node:dns/promises';
import type {Employer} from './catalog.js';
import {candidateSchema,keywordMatches,type Candidate,type SearchInput} from './model.js';

export type Snapshot={text:string;heading:string;links:{url:string;text:string;next:boolean}[];jsonLd:string[];searchInput?:boolean;nextButton?:boolean};
export class BrowserNavigationError extends AppError {
  constructor(code:string,readonly cleanup:'confirmed'|'inactivity-fallback'|'unconfirmed',readonly pagesVisited:number){super(code,503);}
}
const blocked=(text:string)=>/access denied|verify you are human|captcha|sign in to (view|continue)|automated access (is )?(prohibited|not permitted)/i.test(text);
function textValue(value:unknown):string|null{return typeof value==='string'&&value.trim()?value.trim().slice(0,2000):null;}
function posting(json:string[]):Record<string,unknown>|undefined {
  const queue:unknown[]=[];for(const raw of json.slice(0,20)){try{queue.push(JSON.parse(raw.slice(0,200000)));}catch{}}
  for(let count=0;queue.length&&count<100;count++){
    const item=queue.shift();if(Array.isArray(item)){queue.push(...item.slice(0,30));continue;}
    if(!item||typeof item!=='object')continue;const object=item as Record<string,unknown>;
    if([object['@type']].flat().includes('JobPosting'))return object;
    if(object['@graph'])queue.push(object['@graph']);
  }
}
// Website content is data. Only literal page fields are copied; no site code or instructions evaluated.
export function parseJobPage(snapshot:Snapshot,url:string,input:SearchInput,listed:boolean):Candidate|null {
  if(blocked(snapshot.text))return null;
  const structured=posting(snapshot.jsonLd);
  const title=textValue(structured?.title)||snapshot.heading.trim();
  if(title.length<2||title.length>200||/^(careers|jobs|job openings|search jobs|all jobs|join (us|our team))$/i.test(title))return null;
  const lines=snapshot.text.split(/\n+/).map(x=>x.trim().replace(/^[#*>-]+\s+/,'').replace(/\*\*/g,'')).filter(Boolean);
  const labeled=(label:RegExp)=>{const index=lines.findIndex(x=>label.test(x));if(index<0)return null;const line=lines[index];const after=line.includes(':')?line.slice(line.indexOf(':')+1).trim():'';return textValue(after||lines[index+1]);};
  let location=labeled(/^(locations?|office locations?|available locations?)\s*:?$/i);
  const titleLine=lines.findIndex(line=>line===title);const adjacent=titleLine>=0?lines[titleLine+1]:undefined;
  if(!location&&adjacent&&adjacent.length<200&&!/^(apply|about|who|what|create a job alert|new$)/i.test(adjacent)&&/[,•]|^(San Francisco|Remote|New York|London|Paris|Boston|Bengaluru)$/i.test(adjacent))location=adjacent;
  const place=[structured?.jobLocation].flat()[0] as {address?:{addressLocality?:string;addressRegion?:string;addressCountry?:string}}|undefined;
  if(!location&&place?.address)location=[place.address.addressLocality,place.address.addressRegion,place.address.addressCountry].filter(x=>typeof x==='string').join(', ')||null;
  const arrangementLabel=labeled(/^(work arrangement|workplace type|remote status)\s*:?/i);
  const roleArrangement=lines.find(x=>/\b(this (role|position)|role (is|will)|our hybrid early career program).{0,100}\b(remote|hybrid|on[- ]site)\b/i.test(x)||/our hybrid early career program/i.test(x));
  const officeLabel=lines.find(x=>/^(in[- ]office|on[- ]site)$/i.test(x));
  const arrangement=arrangementLabel||roleArrangement||officeLabel||location||'';
  const workArrangement=/\bhybrid\b/i.test(arrangement)?'hybrid':/\bremote\b/i.test(arrangement)||structured?.jobLocationType==='TELECOMMUTE'?'remote':/\b(on[- ]site|in[- ]office)\b/i.test(arrangement)?'onsite':'unknown';
  const geographicRestriction=textValue(lines.find(x=>/remote.{0,80}(only|must be (located|based)|within|eligible)|must (be|reside|live).{0,50}(located|based|country|states|citizen|authorized)|worldwide|anywhere in the world/i.test(x)));
  const requirementsIndex=lines.findIndex(x=>/^(requirements|minimum requirements|qualifications|what we look for)$/i.test(x));
  const experienceRequirements=textValue(lines.find(x=>/\b\d+(?:\s*[-–]\s*\d+|\+)?\s*years? (of )?(professional |relevant )?experience|no (prior )?experience required|currently (enrolled|pursuing)|graduat(e|ing).{0,80}(degree|202\d)|bachelor.{0,100}degree/i.test(x)))||(requirementsIndex>=0?textValue(lines[requirementsIndex+1]):null);
  const visaSponsorship=textValue(lines.find(x=>/visa sponsorship|will sponsor|cannot sponsor|unable to sponsor/i.test(x)));
  const minimumYears=Number(experienceRequirements?.match(/\b(\d+)\s*(?:[-–]\s*\d+|\+)?\s*years?/i)?.[1]);
  const seniority=/\bintern(ship)?\b/i.test(title)?'internship':/\b(senior|staff|principal|lead)\b/i.test(title)||minimumYears>=3?'experienced':/\b(junior|graduate|new grad|early career|entry[- ]level)\b/i.test(title)?'entry-level':'unknown';
  const employmentLabel=labeled(/^(employment type|job type|time type)\s*:?/i)||textValue(structured?.employmentType)||'';
  const employmentType=seniority==='internship'?'internship':/full[-_ ]?time/i.test(employmentLabel)?'full-time':/part[-_ ]?time/i.test(employmentLabel)?'part-time':/contract/i.test(employmentLabel)?'contract':'unknown';
  const terms=input.keywords.toLowerCase().split(/[,\s]+/).filter(x=>x.length>=2);
  const excerpt=textValue(lines.find(x=>x!==title&&terms.some(term=>(' '+x.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ')+' ').includes(' '+term+' '))))||title;
  return candidateSchema.parse({title,sourceUrl:url,location,workArrangement,geographicRestriction,experienceRequirements,seniority,employmentType,
    postedDate:labeled(/^(date posted|posted (on|date))\s*:?/i),deadline:labeled(/^(application deadline|closing date)\s*:?/i),visaSponsorship,sponsorshipAvailable:null,excerpt,
    status:/no longer (available|accepting)|position (has been )?(closed|filled)|job (has )?expired/i.test(snapshot.text)?'expired':listed?'open':'unknown'});
}
export function selectDetailLinks(snapshot:Snapshot,input:SearchInput,hints:string[],limit:number) {
  const seen=new Set<string>();
  return snapshot.links.filter(link=>{
    if(!link.text||/^(apply|apply now|log in|sign in|next|previous|learn more|see all jobs)$/i.test(link.text.trim()))return false;
    if(!keywordMatches(input,{title:link.text,excerpt:'',experienceRequirements:null} as Candidate).length)return false;
    try{const key=canonicalUrl(link.url);if(seen.has(key))return false;seen.add(key);return true;}catch{return false;}
  }).sort((a,b)=>{
    const rank=(link:{url:string;text:string})=>(/intern|graduate|new grad|early career|junior|entry[- ]level/i.test(link.text)?4:0)+(hints.includes(link.url)?2:0)-(/\b(senior|staff|principal|lead)\b/i.test(link.text)&&input.seniority!=='any'?8:0);
    return rank(b)-rank(a);
  }).slice(0,limit);
}
export function sourceListingLinks(listing:SourcePage):Snapshot['links'] {
  const links:Snapshot['links']=[];
  for(const match of listing.text.matchAll(/\[([^\]\n]{2,300})\]\(([^\s)]+)\)/g)){
    try{links.push({url:new URL(match[2],listing.finalUrl).href,text:match[1],next:/^next(?: page)?$/i.test(match[1])});}catch{}
  }
  for(const raw of listing.links||[]){
    try{const u=new URL(raw,listing.finalUrl);if(/\/listing\/|\/jobs\/\d+|\/detail\//.test(u.pathname))links.push({url:u.href,text:decodeURIComponent(u.pathname.split('/').filter(Boolean).at(-2)||'').replace(/[-_]/g,' '),next:false});}catch{}
  }
  return links;
}
async function bounded<T>(task:Promise<T>,ms:number):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([task,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new AppError('timeout')),ms);})]);}finally{if(timer)clearTimeout(timer);}}
async function snapshot(page:BrowserPage):Promise<Snapshot>{return page.evaluate(()=>({
  text:document.body.innerText.slice(0,120000),heading:(document.querySelector('main h1, h1')?.textContent||'').trim(),
  links:[...document.querySelectorAll<HTMLAnchorElement>('a[href]')].slice(0,1000).map(a=>({url:a.href,text:(a.innerText||a.getAttribute('aria-label')||'').trim().slice(0,300),next:a.rel==='next'||/^next(?: page)?$|^[›»]$/i.test(a.innerText.trim())})),
  jsonLd:[...document.querySelectorAll('script[type="application/ld+json"]')].slice(0,20).map(s=>(s.textContent||'').slice(0,200000)),
  searchInput:document.querySelectorAll('input[type="search"], input[placeholder*="search" i]').length===1,
  nextButton:[...document.querySelectorAll<HTMLButtonElement>('button')].some(b=>/^next(?: page)?$/i.test(b.innerText.trim())&&!b.disabled&&!b.closest('form')),
}));}

export class TinyFishBrowserProvider extends TinyFishProvider {
  constructor(private key:string,private options:{connect?:typeof chromium.connectOverCDP;resolve?:Resolver}={}){super(key,60000);}
  async navigate(employer:Employer,entry:string,input:SearchInput,quota:number,hints:string[],signal:AbortSignal,listing?:SourcePage) {
    let browser:Browser|undefined,context:BrowserContext|undefined,id:string|undefined,timer:ReturnType<typeof setTimeout>|undefined;
    let pagesVisited=0,partial=false,cleanup='not-created';const jobs:Candidate[]=[];
    let phase:'startup'|'connection'|'listing'|'detail'='startup';let failure:string|undefined;let warningCode:string|undefined;
    // The SDK currently lacks a sessions.delete method; this is the documented official DELETE route.
    let termination:Promise<boolean>|undefined;
    const terminate=()=>termination??=id?fetch('https://api.browser.tinyfish.ai/'+encodeURIComponent(id),{method:'DELETE',headers:{'X-API-Key':this.key},redirect:'error',signal:AbortSignal.timeout(10000)}).then(r=>r.ok).catch(()=>false):Promise.resolve(true);
    try {
      signal.throwIfAborted();
      // Blank startup permits request guards to be installed before any employer navigation.
      const session=await this.client.browser.sessions.create({timeout_seconds:30,proxy_config:{enabled:false}});id=session.session_id;cleanup='inactivity-fallback';
      const endpoint=new URL(session.cdp_url);
      if(endpoint.protocol!=='wss:'||endpoint.username||endpoint.password||!/(^|\.)tinyfish\.(io|ai)$/.test(endpoint.hostname))throw new AppError('unsafe_provider_session');
      timer=setTimeout(()=>{void terminate();if(context)void bounded(context.close(),5000).catch(()=>{});if(browser)void bounded(browser.close(),5000).catch(()=>{});},60000);
      phase='connection';
      browser=await (this.options.connect||chromium.connectOverCDP.bind(chromium))(session.cdp_url,{timeout:25000});
      context=await bounded(browser.newContext({serviceWorkers:'block',acceptDownloads:false}),10000);
      let requests=0;const allowedResources=new Map<string,boolean>();
      await context.route('**/*',async route=>{
        try {
          const request=route.request();if(++requests>300||request.method()!=='GET'||['image','font','media'].includes(request.resourceType()))return await route.abort();
          if(request.isNavigationRequest()) {
            if(/\/(apply|login|signin|upload)(\/|\?|$)/i.test(request.url()))return await route.abort();
            await safeUrl(request.url(),employer,this.options.resolve);
          } else {
            const u=new URL(request.url());if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443'))return await route.abort();
            if(!allowedResources.has(u.hostname)){const addresses=this.options.resolve?await bounded(this.options.resolve(u.hostname),4000):(await bounded(lookup(u.hostname,{all:true}),4000)).map(x=>x.address);allowedResources.set(u.hostname,addresses.length>0&&addresses.every(publicIP));}
            if(!allowedResources.get(u.hostname))return await route.abort();
          }
          await route.continue();
        }catch{await route.abort().catch(()=>{});}
      });
      await context.routeWebSocket('**/*',ws=>ws.close());
      const page=await bounded(context.newPage(),10000);const until=Date.now()+45000;
      const read=async(url:string)=>{
        signal.throwIfAborted();if(Date.now()>until)throw new AppError('timeout');
        const safe=await safeUrl(url,employer,this.options.resolve);const response=await page.goto(safe,{waitUntil:'domcontentloaded',timeout:15000});
        if(!response||response.status()>=400)throw new AppError('access_blocked');
        await page.waitForLoadState('load',{timeout:3000}).catch(()=>{});
        const final=await safeUrl(page.url(),employer,this.options.resolve);if(final!==safe)throw new AppError('source_redirected');
        const content=await snapshot(page);if(blocked(content.text))throw new AppError('access_blocked');return content;
      };
      const links:{url:string;text:string}[]=listing?selectDetailLinks({text:listing.text,heading:'',jsonLd:[],links:sourceListingLinks(listing)},input,hints,quota*2):[];
      phase='listing';let content=await read(entry);
      if(content.searchInput){
        // Only fill the observed listing search control. Never press Enter or submit a form.
        await page.locator('input[type="search"], input[placeholder*="search" i]').fill(input.keywords,{timeout:3000});
        await page.waitForTimeout(800);content=await snapshot(page);
      }
      for(let index=0;index<2;index++){
        pagesVisited++;if(/loading roles|loading jobs/i.test(content.text))partial=true;
        links.push(...selectDetailLinks(content,input,hints,quota*2));
        const next=content.links.find(link=>link.next);
        if(index===1){if(next||content.nextButton)partial=true;break;}
        if(next){const url=await safeUrl(next.url,employer,this.options.resolve).catch(()=>null);if(!url){partial=true;break;}content=await read(url);}
        else if(content.nextButton){
          const button=page.getByRole('button',{name:/^next(?: page)?$/i});
          if(await button.count()!==1||!await button.isEnabled()||!await button.evaluate(el=>!el.closest('form'))){partial=true;break;}
          await button.click({timeout:3000});await page.waitForTimeout(800);await safeUrl(page.url(),employer,this.options.resolve);content=await snapshot(page);
        }else break;
      }
      const unique=[...new Map(links.map(link=>[canonicalUrl(link.url),link])).values()];if(unique.length>quota)partial=true;
      phase='detail';for(const link of unique.slice(0,quota)){
        try{const source=await safeUrl(link.url,employer,this.options.resolve);const detail=await read(source);const job=parseJobPage(detail,source,input,true);if(job)jobs.push(job);else partial=true;}
        catch(e){partial=true;if(errorCode(e)==='timeout'){warningCode='browser_detail_timeout';break;}}
      }
    } catch(e){const code=errorCode(e)==='timeout'?'browser_'+phase+'_timeout':errorCode(e);if(!pagesVisited)failure=code;else{partial=true;warningCode=code;}}
    finally {
      if(timer)clearTimeout(timer);
      // DELETE runs before disconnect so an explicit end is attempted even if closing CDP stalls.
      const ending=terminate();if(context)await bounded(context.close(),5000).catch(()=>{});if(browser)await bounded(browser.close(),5000).catch(()=>{});
      if(id)cleanup=await ending?'confirmed':'inactivity-fallback';
    }
    if(failure)throw new BrowserNavigationError(failure,cleanup==='confirmed'?'confirmed':id?'inactivity-fallback':'unconfirmed',pagesVisited);
    return {status:'COMPLETED',result:{status:partial?'partial':jobs.length?'complete':'empty',pagesVisited,jobs},cleanup,...(warningCode?{warningCode}:{})};
  }
}

import {randomUUID} from 'node:crypto';
import {employers,type Employer} from './catalog.js';
import {AppError,errorCode,safeUrl,type Resolver} from './policy.js';
import {candidateSchema,extractionSchema,normalizeCandidate,normalizedJob,corroborate,dedupe,matchesPreferences,type SearchInput,type SearchRun} from './model.js';
import {AGENT_DEFAULT_MAX_STEPS,AGENT_MAX_RATE_USD,AGENT_MAX_RUN_RESERVE_USD,extractionRequest,robotsAllows,type Provider} from './tinyfish.js';
import {Budget} from './budget.js';
import {BrowserNavigationError,parseJobPage} from './browser.js';
import {loadHistory,saveHistory} from './history.js';
export class SearchService {
  readonly runs=new Map<string,SearchRun>();
  private busy=false;
  constructor(private provider:Provider,private budget:Budget,private resolve?:Resolver,private historyPath?:string) {if(historyPath)for(const run of loadHistory(historyPath))this.runs.set(run.id,run);}
  select(input:SearchInput):Employer[] {
    if(!input.domains.length) return [...employers].slice(0,5);
    const selected=[...new Set(input.domains.map(d=>d.toLowerCase().replace(/^www\./,'')))].map(d=>employers.find(e=>e.domain===d));
    if(selected.some(e=>!e)) throw new AppError('unapproved_employer');
    return selected as Employer[];
  }
  start(input:SearchInput):SearchRun {
    const selected=this.select(input);
    if(input.maxJobs<selected.length)throw new AppError('invalid_preferences');
    if(this.busy) throw new AppError('search_already_running',409);
    if(this.budget.used()>=this.budget.limit) throw new AppError('daily_budget_reached',429);
    this.busy=true;
    // Store only a bounded number of runs, never provider prompts or raw HTML.
    while(this.runs.size>=10) this.runs.delete(this.runs.keys().next().value!);
    const run:SearchRun={id:randomUUID(),status:'running',stage:'Checking free-credit wallet',input,jobs:[],reports:[],startedAt:new Date().toISOString(),finishedAt:null,requests:0,mode:'live',error:null,workflow:this.provider.navigate?'browser':'agent'};
    this.runs.set(run.id,run);
    void this.execute(run,selected).finally(()=>{this.busy=false;});
    return run;
  }
  private async execute(run:SearchRun,selected:Employer[]) {
    const signal=AbortSignal.timeout(480000);
    const call=async<T>(fn:()=>Promise<T>,cost=1):Promise<T>=>{
      signal.throwIfAborted();
      if(run.requests+cost>32) throw new AppError('run_budget_reached');
      this.budget.take(cost);run.requests+=cost;
      return await fn();
    };
    try {
      const wallet=await call(()=>this.provider.wallet());
      if(!Number.isFinite(wallet.balance)||wallet.balance<=0||!['off','unconfigured'].includes(wallet.autoReload||'')||wallet.pendingTopUp) throw new AppError('wallet_not_safe');
      // Browser: reserve four billed minutes per employer, including startup/cleanup allowance.
      // Agent: reserve all 150 default steps per employer, as documented by TinyFish.
      const rate=this.provider.navigate?wallet.browserMinuteRate:wallet.agentStepRate;
      if(wallet.currency!=='USD'||!Number.isFinite(rate)||rate<0||rate>(this.provider.navigate?0.002:AGENT_MAX_RATE_USD)||wallet.searchRate!==0||wallet.fetchRate!==0)throw new AppError('provider_rates_unverified');
      const ceiling=selected.length*(this.provider.navigate?4:AGENT_DEFAULT_MAX_STEPS)*rate;
      if(ceiling>(this.provider.navigate?1:AGENT_MAX_RUN_RESERVE_USD)||wallet.balance<ceiling+0.01)throw new AppError('free_credit_reserve_reached');
      run.stage='Discovering official career pages';
      let discovered:string[]=[];
      try {discovered=await call(()=>this.provider.search(`${run.input.keywords} ${run.input.seniority==='any'?'':run.input.seniority==='early-career'?'internship graduate entry level':run.input.seniority} careers ${run.input.location} (${selected.map(e=>JSON.stringify(e.name)).join(' OR ')})`,[...new Set(selected.flatMap(e=>[e.domain,...e.hosts.filter(h=>h.includes('greenhouse.io'))]))]));}
      catch(e) {
        // Search failure is recorded; reviewed entry URLs remain valid starting points.
        run.error=errorCode(e);
        if(['credits_unavailable','credentials_invalid','daily_budget_reached','provider_rate_limit'].includes(run.error)) throw e;
      }
      // Official Fetch supports multiple URLs. Check the reviewed origins once
      // per run, including delegated ATS hosts; absent results fail closed.
      let robotPages:Map<string,import('./tinyfish.js').Page>|undefined;
      if(this.provider.readMany){
        const urls=new Set<string>();
        for(const employer of selected)for(const host of employer.hosts)urls.add(await safeUrl(`https://${host}/robots.txt`,employer,this.resolve));
        robotPages=new Map();const list=[...urls];
        for(let offset=0;offset<list.length;offset+=10){const pages=await call(()=>this.provider.readMany!(list.slice(offset,offset+10)));for(const [url,page] of pages)robotPages.set(url,page);}
      }
      const readRobots=async(url:string)=>{
        if(!robotPages)return call(()=>this.provider.read(url));
        const page=robotPages.get(url);if(!page)throw new AppError('robots_restricted');return page;
      };
      let candidatesChecked=0;
      for(const employer of selected.slice(0,5)) {
        const before=run.jobs.length;
        let rejected=0;
        try {
          signal.throwIfAborted();
          run.stage=`Reading ${employer.name} career listings`;
          let entry=await safeUrl(employer.url,employer,this.resolve);
          const detailHints:string[]=[];
          for(const raw of discovered) {
            try {
              const candidate=await safeUrl(raw,employer,this.resolve);
              // Search discovers an entry, not a single detail page which could prevent pagination.
              if(/\/jobs\/search\/?$|\/careers\/search\/?$|\/careers\/jobs\/?$|\/all-jobs\/?$/.test(new URL(candidate).pathname))entry=candidate;
              else if(detailHints.length<8 && !detailHints.includes(candidate))detailHints.push(candidate);
            } catch { /* Search URLs are untrusted. */ }
          }
          const robotsUrl=await safeUrl(new URL('/robots.txt',entry).href,employer,this.resolve);
          const robots=await readRobots(robotsUrl);
          await safeUrl(robots.finalUrl,employer,this.resolve);
          if(!robotsAllows(robots.text,new URL(entry).pathname)) throw new AppError('robots_restricted');
          const quota=Math.min(this.provider.navigate?4:20,Math.floor(run.input.maxJobs/selected.length),run.input.maxJobs-candidatesChecked);
          if(quota<=0) break;
          // Reserve Browser create + documented DELETE before creating a paid session.
          const extraction=await call(()=>this.provider.navigate?this.provider.navigate(employer,entry,run.input,quota,detailHints,signal):this.provider.extract(extractionRequest(employer,entry,run.input,quota,detailHints),signal),this.provider.navigate?2:1);
          const cleanup='cleanup' in extraction?String(extraction.cleanup):undefined;
          const warningCode='warningCode' in extraction&&typeof extraction.warningCode==='string'?extraction.warningCode:null;
          if(extraction.status!=='COMPLETED') throw new AppError('agent_failed');
          const result=extractionSchema.safeParse(extraction.result);
          if(!result.success) throw new AppError('invalid_provider_output');
          if(result.data.status==='blocked') throw new AppError('access_blocked');
          const list=result.data.jobs.slice(0,quota);
          const seen=new Set<string>();
          for(const raw of list) {
            candidatesChecked++;
            const parsed=candidateSchema.safeParse(normalizeCandidate(raw));
            if(!parsed.success) {rejected++;continue;}
            const job=parsed.data;
            try {
              job.sourceUrl=await safeUrl(job.sourceUrl,employer,this.resolve);
              if(seen.has(job.sourceUrl)) continue;
              seen.add(job.sourceUrl);
              // Same-host robots checked locally; delegated ATS hosts require their own gate.
              const source=new URL(job.sourceUrl);
              let ruleText=robots.text;
              if(source.hostname!==new URL(entry).hostname) {
                const safeRobots=await safeUrl(awaitableRobots(source),employer,this.resolve);
                const atsRobots=await readRobots(safeRobots);
                await safeUrl(atsRobots.finalUrl,employer,this.resolve);
                ruleText=atsRobots.text;
              }
              if(!robotsAllows(ruleText,source.pathname)) throw new AppError('robots_restricted');
              run.stage=`Checking ${employer.name} source pages`;
              const page=await call(()=>this.provider.read(job.sourceUrl));
              const finalUrl=await safeUrl(page.finalUrl,employer,this.resolve);
              if(new URL(finalUrl).hostname!==source.hostname || finalUrl!==job.sourceUrl) throw new AppError('source_redirected');
              // Role-specific source text can correct either navigation workflow.
              // Keep other claims only if the independent Fetch text corroborates them.
              const enriched=parseJobPage({text:page.text,heading:job.title,links:[],jsonLd:[]},job.sourceUrl,run.input,job.status==='open');
              const checkedBase=corroborate(job,page.text);
              if(!checkedBase){rejected++;continue;}
              const supplied=checkedBase as Record<string,unknown>;
              const sourceFields=enriched?Object.fromEntries(Object.entries(enriched).filter(([key,value])=>value!==null&&value!=='unknown'&&value!==''&&(['workArrangement','seniority','employmentType','status'].includes(key)||supplied[key]===null||supplied[key]==='unknown'||supplied[key]===''))):{};
              const checked=corroborate({...checkedBase,...sourceFields},page.text);
              if(!checked) {rejected++;continue;}
              if(matchesPreferences(run.input,checked)) run.jobs=dedupe([...run.jobs,normalizedJob(checked,employer.name,employer.id,run.input,new Date().toISOString())]);
            } catch(e) {
              rejected++;
              if(['daily_budget_reached','run_budget_reached','credits_unavailable','credentials_invalid','provider_rate_limit','timeout'].includes(errorCode(e))) throw e;
            }
          }
          const partial=result.data.status==='partial'||rejected>0||result.data.jobs.length>quota;
          run.reports.push({employer:employer.name,status:partial?'partial':run.jobs.length>before?'complete':'empty',code:cleanup&&cleanup!=='confirmed'?'browser_cleanup_unconfirmed':warningCode|| (rejected?'some_sources_unverified':null),count:run.jobs.length-before,pagesVisited:result.data.pagesVisited,...(cleanup?{cleanup}:{}),...('steps' in extraction&&typeof extraction.steps==='number'?{agentSteps:extraction.steps}:{})});
          if(cleanup&&cleanup!=='confirmed'){run.error='browser_cleanup_unconfirmed';break;}
        } catch(e) {
          const code=errorCode(e);
          run.reports.push({employer:employer.name,status:['access_blocked','robots_restricted','source_unavailable'].includes(code)?'blocked':'failed',code,count:run.jobs.length-before,pagesVisited:e instanceof BrowserNavigationError?e.pagesVisited:null,...(e instanceof BrowserNavigationError?{cleanup:e.cleanup}:{})});
          if(e instanceof BrowserNavigationError&&e.cleanup!=='confirmed'){run.error=code;break;}
          if(['daily_budget_reached','run_budget_reached','credits_unavailable','credentials_invalid','provider_rate_limit','timeout','agent_step_limit_unavailable','agent_access_unavailable','agent_budget_contract_violation','unsafe_provider_session'].includes(code)||this.provider.navigate&&code==='provider_failure'){run.error=code;break;}
        }
      }
      const incomplete=!!run.error||run.reports.length<selected.length||run.reports.some(r=>['failed','blocked','partial'].includes(r.status));
      run.status=run.jobs.length ? (incomplete?'partial':'complete') : incomplete?(run.reports.length && run.reports.every(r=>r.status==='blocked')?'blocked':run.reports.some(r=>r.status==='partial')?'partial':'failed'):'empty';
      run.stage='Finished';
    } catch(e) {run.status='failed';run.error=errorCode(e);run.stage='Search stopped';}
    finally {run.finishedAt=new Date().toISOString();if(this.historyPath){try{saveHistory(this.historyPath,[...this.runs.values()]);}catch{run.error||='local_history_unavailable';if(run.jobs.length)run.status='partial';}}}
  }
}
// Constant pathname, public allowed host already validated by safeUrl(source).
function awaitableRobots(source:URL){return new URL('/robots.txt',source).href;}

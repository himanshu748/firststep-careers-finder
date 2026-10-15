import {csv,cleanSaved,filterJobs,safeLink} from './shared.mjs';
const $=id=>document.getElementById(id);
const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','icon');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href','#icon-'+name);svg.append(use);return svg;}
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
function animateOnce(element,delay=0){if(reducedMotion.matches||!element?.animate)return;const animation=element.animate([{opacity:.35,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:320,delay,easing:'cubic-bezier(.2,0,0,1)'});const stop=()=>animation.cancel();reducedMotion.addEventListener('change',stop,{once:true});animation.finished.catch(()=>{}).finally(()=>reducedMotion.removeEventListener('change',stop));}
const seenJobs=new Set();
const state={config:null,jobs:[],saved:[],view:'discover',run:null,visible:[],polling:false,storageFailed:false,pollError:null};
const messages={agent_access_unavailable:'TinyFish Agent is unavailable on this account. The run stopped without retrying or switching workflows.',agent_budget_contract_violation:'TinyFish returned step usage outside its documented budget. Further Agent work stopped.',browser_startup_timeout:'TinyFish browser startup timed out. Further sessions stopped because termination could not be confirmed.',browser_connection_timeout:'The TinyFish browser connection timed out. The employer report records its cleanup status.',browser_listing_timeout:'The employer listing page timed out. Checked results are preserved.',browser_detail_timeout:'A job detail page timed out. Checked results are preserved.',local_history_unavailable:'Results were checked, but local history could not be saved. Export them before restarting.',browser_cleanup_unconfirmed:'Browser termination could not be confirmed. Further sessions stopped; the 30-second inactivity timeout is the fallback.',unsafe_provider_session:'TinyFish returned an unexpected browser address. No connection was made.',run_not_found:'This local run expired or the server restarted. Start a new bounded search.',provider_rates_unverified:'Search stopped: current TinyFish pricing could not be verified within the free-credit limits.',free_credit_reserve_reached:'Search stopped: existing credits do not cover the bounded run. No top-up was attempted.',agent_step_limit_unavailable:'This account rejected a custom Agent step cap. No automatic retry was made.',credentials_missing:'TinyFish is not connected. Add your API key on the server and restart.',free_credits_not_approved:'Verify and approve existing free credits on the server before searching.',wallet_not_safe:'Search stopped: wallet balance or auto-reload could not be verified as safe. Check existing credits; no top-up was attempted.',daily_budget_reached:'The daily request limit has been reached. Try again tomorrow or use your saved jobs.',run_budget_reached:'The request limit for this run was reached. Checked results are preserved.',search_already_running:'A search is already running. Wait for it to finish before starting another.',credentials_invalid:'TinyFish rejected the credentials. Update the server key and restart.',credits_unavailable:'TinyFish credits are unavailable. No top-up or purchase was attempted.',provider_rate_limit:'TinyFish rate limit reached. No automatic retry was made.',provider_failure:'TinyFish could not complete the request. Try a smaller search later.',timeout:'The time limit was reached. Checked results are preserved.',invalid_preferences:'Check your preferences. Keywords must contain at least two characters.',unapproved_employer:'Choose an employer from the reviewed catalog.',source_unavailable:'Source page could not be read.',robots_restricted:'Automated access is restricted or robots rules could not be verified.',access_blocked:'The career page blocked access. No bypass was attempted.',invalid_provider_output:'The provider returned an unexpected result. No unverified jobs were added.',some_sources_unverified:'Some sources could not be corroborated.',source_redirected:'Source redirected to a different page; excluded.'};
const explain=code=>messages[code]||'This part of the search could not be verified.';
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,4500);}
function readStorage(){try {state.saved=cleanSaved(JSON.parse(localStorage.getItem('firststep.saved.v1')||'[]'));}catch{state.saved=[];state.storageFailed=true;}}
function persist(){try{localStorage.setItem('firststep.saved.v1',JSON.stringify(state.saved));return true;}catch{toast('Browser storage is unavailable or full. This change was not saved.');return false;}}
function save(job) {
  const old=state.saved;const exists=old.some(j=>j.id===job.id);
  if(!exists&&old.length>=200){toast('Saved-job limit reached (200). Remove a job first.');return;}
  state.saved=exists?old.filter(j=>j.id!==job.id):[...old,job];
  if(!persist())state.saved=old;
  else toast(exists?'Removed from your saved jobs.':'Saved on this device.');
  render();
}
function shortDate(raw){if(!raw)return 'Not stated';const d=new Date(raw);return Number.isFinite(d.getTime())?d.toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):raw;}
function field(label,value){const row=node('div',undefined,'detail-row');row.append(node('dt',label),node('dd',value||'Not stated'));return row;}
function jobCard(job) {
  const card=node('article',undefined,'job-card');
  const top=node('div',undefined,'job-top');const identity=node('div',undefined,'job-identity');
  const monogram=node('div',job.employer.slice(0,2).toUpperCase(),'monogram');const info=node('div');
  info.append(node('p',job.employer,'job-employer'),node('h3',job.title));identity.append(monogram,info);
  const saved=state.saved.some(j=>j.id===job.id);const saveButton=node('button',undefined,'save-button');saveButton.append(icon('bookmark'));saveButton.type='button';saveButton.setAttribute('aria-label',(saved?'Unsave ':'Save ')+job.title);saveButton.setAttribute('aria-pressed',String(saved));saveButton.addEventListener('click',()=>save(job));top.append(identity,saveButton);card.append(top);
  const tags=node('div',undefined,'job-tags');
  tags.append(node('span',job.location||'Location not stated'),node('span',job.workArrangement==='unknown'?'Arrangement not stated':job.workArrangement),node('span',job.employmentType==='unknown'?'Type not stated':job.employmentType),node('span',job.seniority==='unknown'?'Seniority not stated':job.seniority));
  if(job.status==='expired') tags.append(node('span','Expired / closed','expired-tag'));
  if(job.status==='unknown') tags.append(node('span','Open status not stated'));
  card.append(tags);
  if(job.excerpt)card.append(node('p',job.excerpt.length>280?job.excerpt.slice(0,280).trimEnd()+'…':job.excerpt,'job-excerpt'));
  const geography=node('p',undefined,'geography');geography.append(node('strong','Geographic eligibility: '),node('span',job.geographicRestriction||'Not stated. Remote is not confirmation of eligibility from India.'));card.append(geography);
  const match=node('p',undefined,'match');match.append(node('span','↳ '),node('strong','Keyword matches: '),node('span',job.matches.length?job.matches.join(', '):'No keyword match recorded'));card.append(match);
  const details=node('details',undefined,'job-details');details.append(node('summary','Requirements & source details'));
  const list=node('dl');list.append(field('Experience',job.experienceRequirements),field('Visa sponsorship',job.visaSponsorship),field('Posted',job.postedDate),field('Deadline',job.deadline),field('Last checked',shortDate(job.checkedAt)),field('Status',job.status==='open'?'Listed as open when checked':job.status||'Not stated'),field('Source URL',job.sourceUrl));details.append(list);card.append(details);
  const bottom=node('div',undefined,'job-bottom');
  const age=Date.now()-Date.parse(job.checkedAt);bottom.append(node('span',!job.sourceVerified?'Unverified local snapshot':age>86400000?'Saved snapshot · check source for updates':'Source text checked · '+shortDate(job.checkedAt),'checked-time'));
  if(safeLink(job.sourceUrl)){const link=node('a','View source','source-link');link.append(icon('arrow'));link.href=job.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';bottom.append(link);}
  card.append(bottom);return card;
}
function updateEmployerFilter(jobs){const current=$('filter-employer').value;const names=[...new Set(jobs.map(j=>j.employer))];$('filter-employer').replaceChildren(node('option','All employers'));$('filter-employer').firstChild.value='';names.forEach(name=>{const option=node('option',name);option.value=name;$('filter-employer').append(option);});if(names.includes(current))$('filter-employer').value=current;}
function render() {
  $('saved-count').textContent=state.saved.length;
  $('discover-tab').classList.toggle('active',state.view==='discover');$('saved-tab').classList.toggle('active',state.view==='saved');$('page-name').textContent=state.view==='saved'?'Saved jobs':'Discover';
  $('search-panel').hidden=state.view==='saved';
  const all=state.view==='saved'?state.saved:state.jobs;
  state.visible=filterJobs(all,{query:$('filter-query').value,arrangement:$('filter-arrangement').value,employer:$('filter-employer').value,type:$('filter-type').value,hideExpired:$('hide-expired').checked,knownOnly:$('known-only').checked});
  $('result-count').textContent=state.visible.length;
  $('results-heading').firstChild.textContent=state.view==='saved'?'Your saved opportunities ':'Your next opportunities ';
  $('results-subtitle').textContent=state.view==='saved'?'Saved only on this browser. Refresh a search to check their sources again.':state.run?`${state.run.restored?'Recorded search · ':''}Checked ${state.run.reports.length} employers · ${state.run.requests} bounded provider requests · ${state.run.status==='running'?'Search in progress':shortDate(state.run.finishedAt)}`:'A live search starts here. Every result comes with a source.';
  $('filters').hidden=!all.length;$('export-button').disabled=!state.visible.length;
  $('job-list').replaceChildren(...state.visible.map(jobCard));
  [...$('job-list').children].forEach((card,index)=>{const id=state.visible[index].id;if(!seenJobs.has(id)){seenJobs.add(id);animateOnce(card,Math.min(index,4)*40);}});
  $('progress').hidden=state.view==='saved'||!state.polling;
  $('run-warning').hidden=state.view==='saved'||!(state.pollError||state.run&&['partial','blocked','failed'].includes(state.run.status));
  if(!$('run-warning').hidden){$('run-warning').replaceChildren(node('strong',state.pollError?'Status updates interrupted':state.run.status==='partial'?'Partial results: some pages could not be checked':'Search could not be completed'),node('p',state.pollError?'Checked results are retained. The server may still be finishing a bounded run; wait before trying again.':state.run.error?explain(state.run.error):'See the employer reports below. Checked listings remain available.'));}
  const reports=state.view==='discover'&&state.run?state.run.reports:[];
  $('employer-reports').replaceChildren(...reports.map(r=>{const el=node('div',undefined,'employer-report');el.append(node('strong',r.employer),node('span',`${r.status} · ${r.count} ${r.count===1?'job':'jobs'}`));if(r.code)el.append(node('small',explain(r.code)));return el;}));
  $('empty-state').hidden=state.visible.length>0||state.polling&&state.view==='discover';
  const empty=$('empty-state');
  if(!empty.hidden) {
    const heading=empty.querySelector('h3'),paragraph=heading.nextElementSibling;
    if(all.length){heading.textContent='No jobs match these filters.';paragraph.textContent='Clear a filter, or include expired jobs and unknown fields.';}
    else if(state.view==='saved'){heading.textContent='Keep the opportunities that catch your eye.';paragraph.textContent='Save a job from Discover. It stays on this device, ready when you return.';}
    else if(state.run&&state.run.status==='empty'){heading.textContent='No matching roles found in this search.';paragraph.textContent='Try broader keywords, another location, or different employers. A bounded search may not cover every listing.';}
    else if(state.run&&state.run.status==='partial'){heading.textContent='No matching roles in the pages checked.';paragraph.textContent='Some sources or pages remain unchecked. Broaden your preferences or review the employer reports.';}
    else if(state.run&&['failed','blocked'].includes(state.run.status)){heading.textContent='These sources could not be checked.';paragraph.textContent='No unverified listings were added. Review the status above before trying again.';}
    else {heading.textContent='Good opportunities start with a search.';paragraph.textContent='Tell us the role you’re after. We’ll check the sources, keep the useful details, and leave the guesswork out.';}
  }
}
async function api(path,options){const response=await fetch(path,options);const data=await response.json();if(!response.ok)throw new Error(data.error||'provider_failure');return data;}
async function poll(id) {
  const deadline=Date.now()+550000;
  let errors=0;
  while(Date.now()<deadline){
    try {state.run=await api('/api/runs/'+id);state.jobs=state.run.jobs;errors=0;$('progress-stage').textContent=state.run.stage;render();
      if(state.run.status!=='running')return;
    }catch(e){if(++errors>=3)throw e;}
    await new Promise(r=>setTimeout(r,1500));
  }
  throw new Error('timeout');
}
async function search(event) {
  event.preventDefault();if(state.polling)return;
  if(!state.config?.ready){$('setup-guide').hidden=false;toast(explain(state.config?.reason||'credentials_missing'));return;}
  state.polling=true;state.pollError=null;$('search-button').disabled=true;$('search-button').textContent='Checking sources…';state.view='discover';render();
  const input={keywords:$('keywords').value.trim(),location:$('location').value.trim(),remote:$('remote').value,employmentType:$('employment').value,seniority:$('seniority').value,visa:$('visa').value,domains:[...document.querySelectorAll('[name="employer"]:checked')].map(e=>e.value)};
  try {
    state.run=await api('/api/search',{method:'POST',headers:{'Content-Type':'application/json','x-firststep-token':state.config.token},body:JSON.stringify(input)});
    history.replaceState(null,'','?run='+state.run.id);state.jobs=[];updateEmployerFilter([]);render();await poll(state.run.id);updateEmployerFilter(state.jobs);
    // Update saved snapshots only for listings actually rechecked. Absence is never treated as closure.
    state.saved=state.saved.map(saved=>state.jobs.find(j=>j.id===saved.id)||saved);persist();
  } catch(e){toast(explain(e.message));if(state.run?.status==='running')state.pollError=e.message;}
  finally {state.polling=false;$('search-button').disabled=false;$('search-button').replaceChildren(node('span','Find live roles'),icon('arrow'));render();}
}
function changeView(view){state.view=view;updateEmployerFilter(view==='saved'?state.saved:state.jobs);$('filter-query').value='';$('filter-arrangement').value='';$('filter-type').value='';render();animateOnce($('results-heading'));}
$('discover-tab').addEventListener('click',()=>changeView('discover'));$('saved-tab').addEventListener('click',()=>changeView('saved'));
$('search-form').addEventListener('submit',search);$('setup-toggle').addEventListener('click',()=>$('setup-guide').hidden=!$('setup-guide').hidden);
['filter-query','filter-arrangement','filter-employer','filter-type','hide-expired','known-only'].forEach(id=>$(id).addEventListener('input',render));
$('export-button').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([csv(state.visible)],{type:'text/csv;charset=utf-8'}));const link=node('a');link.href=url;link.download='firststep-jobs.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Exported the visible listings with source links.');});
readStorage();render();
animateOnce(document.querySelector('.intro h1'));animateOnce(document.querySelector('.source-flow'),60);animateOnce(document.querySelector('.intro-copy'),100);animateOnce($('search-panel'),150);
try {
  state.config=await api('/api/config');$('setup-banner').hidden=state.config.ready;if(state.config.workflow){$('workflow-name').textContent=state.config.workflow==='agent'?'Agent':'Browser';document.querySelector('.source-flow').setAttribute('aria-label',`TinyFish Search discovers career pages, ${state.config.workflow==='agent'?'Agent':'Browser'} navigates listings, and Fetch verifies source text.`);}
  if(state.config.workflow==='agent'&&state.config.creditPolicy){$('credit-reserve').hidden=false;$('credit-reserve').textContent=`Agent credit reserve: up to $${state.config.creditPolicy.maxAgentReservePerEmployerUSD} per employer ($${state.config.creditPolicy.maxAgentReservePerRunUSD} for five), from approved existing free credits. Actual charges may be lower. No top-ups.`;}
  $('employer-choices').replaceChildren(...state.config.employers.map(e=>{const label=node('label',undefined,'employer-choice');const check=node('input');check.type='checkbox';check.name='employer';check.value=e.domain;label.append(check,node('span',e.name),node('small',e.domain));return label;}));
  const resumeId=new URLSearchParams(location.search).get('run');
  if(resumeId&&/^[0-9a-f-]{36}$/.test(resumeId)){try{state.polling=true;await poll(resumeId);updateEmployerFilter(state.jobs);if(state.run?.input){const i=state.run.input;$('keywords').value=i.keywords;$('location').value=i.location;$('remote').value=i.remote;$('employment').value=i.employmentType;$('seniority').value=i.seniority;$('visa').value=i.visa;document.querySelectorAll('[name="employer"]').forEach(c=>c.checked=i.domains.includes(c.value));}}catch(e){toast(explain(e.message));}finally{state.polling=false;render();}}
  if(state.storageFailed)toast('Saved-job storage could not be read. Your browser may have disabled local storage.');
}catch{$('setup-banner').hidden=false;$('setup-banner').querySelector('strong').textContent='The local server could not be reached';}

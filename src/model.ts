import {z} from 'zod';
import {createHash} from 'node:crypto';
import {canonicalUrl} from './policy.js';
const text=z.string().trim().max(120).refine(s=>!/[\u0000-\u001f]/u.test(s));
export const searchSchema=z.object({
  keywords:text.min(2), location:text.default(''), remote:z.enum(['any','remote','hybrid','onsite']).default('any'),
  employmentType:z.enum(['any','internship','full-time','part-time','contract']).default('any'),
  seniority:z.enum(['early-career','internship','entry-level','any']).default('early-career'),
  visa:z.enum(['any','sponsorship-stated']).default('any'), domains:z.array(text).max(5).default([]),
  maxJobs:z.number().int().min(1).max(20).default(20),
}).strict();
export type SearchInput=z.infer<typeof searchSchema>;
const nullable=z.string().max(2000).nullable().default(null);
const candidateEnums={workArrangement:['remote','hybrid','onsite','unknown'],seniority:['internship','entry-level','experienced','unknown'],employmentType:['internship','full-time','part-time','contract','unknown'],status:['open','expired','unknown']} as const;
export const candidateSchema=z.object({
  title:z.string().trim().min(2).max(200), sourceUrl:z.string().max(2000), location:nullable,
  workArrangement:z.enum(candidateEnums.workArrangement).default('unknown'),
  geographicRestriction:nullable, experienceRequirements:nullable,
  seniority:z.enum(candidateEnums.seniority).default('unknown'),
  employmentType:z.enum(candidateEnums.employmentType).default('unknown'),
  postedDate:nullable, deadline:nullable, visaSponsorship:nullable,
  sponsorshipAvailable:z.boolean().nullable().default(null), excerpt:z.string().max(3000).default(''),
  status:z.enum(candidateEnums.status).default('unknown'),
});
export type Candidate=z.infer<typeof candidateSchema>;
// Provider output is untrusted. Unsupported optional labels stay unknown until
// independently corroborated source text supplies a supported value.
export function normalizeCandidate(raw:unknown):unknown {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return raw;
  const data={...raw} as Record<string,unknown>;
  for(const [key,allowed] of Object.entries(candidateEnums)){
    const value=typeof data[key]==='string'?data[key].trim().toLowerCase().replace(/_/g,'-'):'';
    data[key]=(allowed as readonly string[]).includes(value)?value:'unknown';
  }
  return data;
}
export type Job=Candidate & {id:string; employer:string; employerId:string; checkedAt:string; matches:string[]; sourceVerified:boolean};
export type EmployerReport={employer:string; status:'complete'|'partial'|'empty'|'blocked'|'failed'; code:string|null; count:number; pagesVisited:number|null;cleanup?:string;agentSteps?:number};
export type SearchRun={id:string; status:'running'|'complete'|'partial'|'empty'|'blocked'|'failed'; stage:string; input:SearchInput; jobs:Job[]; reports:EmployerReport[]; startedAt:string; finishedAt:string|null; requests:number; mode:'live'; error:string|null;workflow?:'agent'|'browser';restored?:boolean};
export const extractionSchema=z.object({ status:z.enum(['complete','partial','blocked','empty']), jobs:z.array(z.unknown()).max(100), pagesVisited:z.number().int().min(0).max(2), });
const folded=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function keywordMatches(input:SearchInput, job:Candidate):string[] {
  const evidence=folded([job.title,job.excerpt,job.experienceRequirements].filter(Boolean).join(' '));
  return [...new Set(input.keywords.split(/[,\s]+/).map(x=>folded(x)).filter(x=>x.length>=2))].filter(x=>(' '+evidence+' ').includes(' '+x+' '));
}
export function matchesPreferences(input:SearchInput, job:Candidate):boolean {
  if (!keywordMatches(input,job).length) return false;
  // Keep missing fields visible. Known conflicts are filtered out.
  if(input.remote!=='any' && job.workArrangement!=='unknown' && input.remote!==job.workArrangement) return false;
  if(input.employmentType!=='any' && job.employmentType!=='unknown' && input.employmentType!==job.employmentType) return false;
  if(input.seniority==='early-career' && job.seniority==='experienced') return false;
  if(['internship','entry-level'].includes(input.seniority) && job.seniority!=='unknown' && input.seniority!==job.seniority) return false;
  if(input.visa==='sponsorship-stated' && job.sponsorshipAvailable!==true) return false;
  if(input.location && job.location && !folded(job.location).includes(folded(input.location))) {
    if(job.workArrangement!=='remote') return false;
    if(job.geographicRestriction && !/^(worldwide|global|any country|all countries|anywhere in the world)$/i.test(job.geographicRestriction.trim()) && !folded(job.geographicRestriction).includes(folded(input.location))) return false;
  }
  return true;
}
export function normalizedJob(candidate:Candidate, employer:string, employerId:string, input:SearchInput, checkedAt:string):Job {
  const sourceUrl=canonicalUrl(candidate.sourceUrl);
  const expired=candidate.status==='expired' || (!!candidate.deadline && /^\d{4}-\d{2}-\d{2}$/.test(candidate.deadline) && candidate.deadline<checkedAt.slice(0,10));
  return {...candidate,sourceUrl,status:expired?'expired':candidate.status,employer,employerId,checkedAt,id:createHash('sha256').update(employerId+'|'+sourceUrl).digest('hex').slice(0,24),matches:keywordMatches(input,candidate),sourceVerified:true};
}
export function dedupe(jobs:Job[]):Job[] {
  const urls=new Set<string>(), identities=new Set<string>();
  return jobs.filter(j=>{
    const url=canonicalUrl(j.sourceUrl), identity=[j.employer,j.title,j.location||''].map(folded).join('|');
    if(urls.has(url)||identities.has(identity)) return false;
    urls.add(url);identities.add(identity);return true;
  }).slice(0,20);
}
// Source evidence must contain the title and every claimed field. Uncorroborated optional claims become unknown.
export function corroborate(job:Candidate, page:string):Candidate|null {
  const evidence=folded(page);
  if(!evidence.includes(folded(job.title))) return null;
  const result={...job};
  for(const key of ['location','geographicRestriction','experienceRequirements','postedDate','deadline','visaSponsorship'] as const) {
    if(result[key] && !evidence.includes(folded(result[key]!))) result[key]=null;
  }
  // A country in the address or application questionnaire does not itself
  // establish geographic eligibility. Require an explicit restriction context.
  if(result.geographicRestriction&&!page.split(/[\r\n.!?]+/).some(line=>folded(line).includes(folded(result.geographicRestriction!))&&/\b(remote|eligible|eligibility|reside|only|must be|based in|located in|country of employment|work locations?)\b/i.test(line)))result.geographicRestriction=null;
  result.excerpt = evidence.includes(folded(job.excerpt)) ? job.excerpt : '';
  if(result.workArrangement!=='unknown' && !(result.workArrangement==='onsite'?/\b(on site|in office)\b/.test(evidence):evidence.includes(result.workArrangement))) result.workArrangement='unknown';
  if(!result.visaSponsorship) result.sponsorshipAvailable=null;
  else if(/no(t)? (visa )?sponsorship|cannot sponsor|do not sponsor|without sponsorship|unable to sponsor/i.test(result.visaSponsorship)) result.sponsorshipAvailable=false;
  else if(!/sponsorship (is )?(available|provided|offered)|will sponsor|can sponsor|visa sponsorship: yes/i.test(result.visaSponsorship)) result.sponsorshipAvailable=null;
  if(result.seniority==='experienced' && !/senior|staff|principal|lead|[3-9] years/.test(evidence)) result.seniority='unknown';
  if(result.seniority==='entry-level' && !/entry level|new grad|graduate|junior|0 2 years|early career/.test(evidence)) result.seniority='unknown';
  if(result.seniority==='internship' && !/intern/.test(evidence)) result.seniority='unknown';
  if(/\b(senior|staff|principal|lead)\b/i.test(job.title)) result.seniority='experienced';
  else if(/\bintern(ship)?\b/i.test(job.title)) result.seniority='internship';
  if(result.employmentType!=='unknown' && !evidence.includes(result.employmentType==='internship'?'intern':folded(result.employmentType))) result.employmentType='unknown';
  if(/no longer (available|accepting)|position (has been )?(closed|filled)|job (has )?expired/.test(evidence)) result.status='expired';
  // Prevent a provider assertion from converting an unavailable page into a live opening.
  if(/access denied|verify you are human|captcha|sign in to (view|continue)/.test(evidence)) return null;
  return result;
}
const outputEnums:Record<string,readonly string[]>=candidateEnums;
export const outputSchema={type:'object',properties:{status:{type:'string',enum:['complete','partial','blocked','empty']},pagesVisited:{type:'integer',minimum:0,maximum:2},jobs:{type:'array',maxItems:20,items:{type:'object',properties:Object.fromEntries(Object.keys(candidateSchema.shape).map(key=>[key,{type:key==='sponsorshipAvailable'?'boolean':'string',...(outputEnums[key]?{enum:outputEnums[key]}:{}),...(!['sourceUrl','title','excerpt','workArrangement','seniority','employmentType','status'].includes(key)?{nullable:true}:{})}])),required:['title','sourceUrl','workArrangement','seniority','employmentType','status']}}},required:['status','pagesVisited','jobs']};

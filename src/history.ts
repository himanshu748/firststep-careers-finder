import {readFileSync,writeFileSync,mkdirSync,renameSync,statSync} from 'node:fs';
import {dirname} from 'node:path';
import {z} from 'zod';
import {candidateSchema,searchSchema,type SearchRun} from './model.js';
import {employers} from './catalog.js';
const job=candidateSchema.extend({id:z.string().regex(/^[0-9a-f]{24}$/),employer:z.string().max(100),employerId:z.string().max(50),checkedAt:z.iso.datetime(),matches:z.array(z.string().max(120)).max(30),sourceVerified:z.boolean()});
const run=z.object({id:z.uuid(),status:z.enum(['complete','partial','empty','blocked','failed']),stage:z.string().max(200),input:searchSchema,jobs:z.array(job).max(20),reports:z.array(z.object({employer:z.string().max(100),status:z.enum(['complete','partial','empty','blocked','failed']),code:z.string().regex(/^[a-z_]+$/).nullable(),count:z.number().int().min(0).max(20),pagesVisited:z.number().int().min(0).max(2).nullable(),cleanup:z.enum(['confirmed','inactivity-fallback','unconfirmed']).optional(),agentSteps:z.number().int().min(0).max(150).optional()})).max(5),startedAt:z.iso.datetime(),finishedAt:z.iso.datetime(),requests:z.number().int().min(0).max(32),mode:z.literal('live'),error:z.string().regex(/^[a-z_]+$/).nullable(),workflow:z.enum(['browser','agent']).optional(),restored:z.boolean().optional()});
export function checkedHistory(data:unknown):SearchRun[]{
  const parsed=z.array(run).max(10).parse(data);
  return parsed.filter(r=>r.jobs.every(j=>{
    const employer=employers.find(e=>e.id===j.employerId&&e.name===j.employer);if(!employer)return false;
    try{const u=new URL(j.sourceUrl);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(employer.hosts as readonly string[]).includes(u.hostname)&&(employer.paths as readonly string[]).some(p=>u.pathname===p||u.pathname.startsWith(p+'/'));}catch{return false;}
  }));
}
export function loadHistory(path:string):SearchRun[]{try{if(statSync(path).size>2000000)return [];return checkedHistory(JSON.parse(readFileSync(path,'utf8'))).map(r=>({...r,restored:true}));}catch{return [];}}
export function saveHistory(path:string,runs:SearchRun[]){const data=checkedHistory(runs.filter(r=>r.status!=='running').slice(-10));mkdirSync(dirname(path),{recursive:true});const temp=path+'.tmp';writeFileSync(temp,JSON.stringify(data),{mode:0o600});renameSync(temp,path);}

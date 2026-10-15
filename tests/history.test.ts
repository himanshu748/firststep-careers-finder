import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {checkedHistory,loadHistory,saveHistory} from '../src/history.js';
import {candidateSchema,normalizedJob,searchSchema,type SearchRun} from '../src/model.js';
// OFFLINE HISTORY FIXTURE, stored only in a temporary test directory.
const input=searchSchema.parse({keywords:'software',domains:['stripe.com']});
const job=normalizedJob(candidateSchema.parse({title:'[TEST FIXTURE] Software Engineer Intern',sourceUrl:'https://stripe.com/careers/listing/test/123',status:'open'}),'Stripe','stripe',input,'2026-10-14T00:00:00Z');
const run:SearchRun={id:'dbbe83c3-4be6-4779-9114-d39f5cd898c4',status:'partial',stage:'Finished',input,jobs:[job],reports:[],startedAt:'2026-10-14T00:00:00Z',finishedAt:'2026-10-14T00:01:00Z',requests:5,mode:'live',workflow:'browser',error:null};
test('history retains checked timestamps across restart and never resumes provider work',()=>{
 const dir=mkdtempSync(join(tmpdir(),'firststep-history-'));try{const path=join(dir,'runs.json');saveHistory(path,[run]);const restored=loadHistory(path);assert.equal(restored[0].restored,true);assert.equal(restored[0].jobs[0].checkedAt,job.checkedAt);assert.equal(restored[0].id,run.id);assert.equal(restored[0].status,'partial');}finally{rmSync(dir,{recursive:true,force:true});}
});
test('history rejects malformed, fixture-mode, cross-employer and private source data',()=>{
 assert.throws(()=>checkedHistory([{...run,mode:'fixture'}]));assert.equal(checkedHistory([{...run,jobs:[{...job,sourceUrl:'https://127.0.0.1/jobs'}]}]).length,0);assert.equal(checkedHistory([{...run,jobs:[{...job,employerId:'affirm'}]}]).length,0);
 const dir=mkdtempSync(join(tmpdir(),'firststep-history-'));try{const path=join(dir,'runs.json');writeFileSync(path,'malformed');assert.deepEqual(loadHistory(path),[]);}finally{rmSync(dir,{recursive:true,force:true});}
});

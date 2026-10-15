import {writeFile,mkdir} from 'node:fs/promises';
import {searchSchema,type SearchRun} from '../src/model.js';
import {checkedRun,DemoError,localJson,runIdPattern,waitForRun} from './demo-client.js';
const port=Number(process.env.PORT||4317),base='http://127.0.0.1:'+port;
let id:string|null=null,lastRun:SearchRun|undefined;
try{
  await mkdir('evidence',{recursive:true});
  const resume=process.argv[2]==='--resume';
  if(resume){id=process.argv[3]||null;if(!id||!runIdPattern.test(id))throw new DemoError('demo_invalid_run_id');}
  else{
    const config=await localJson('/api/config',port) as {ready:boolean;reason:string;token:string};
    if(!config.ready){
      const code=config.reason==='free_credits_not_approved'?'free_credits_not_approved':'credentials_missing';
      await writeFile('evidence/demo-preflight.json',JSON.stringify({kind:'genuine local preflight; NOT live-job evidence',checkedAt:new Date().toISOString(),ready:false,code,providerCalls:0,jobs:[]},null,2)+'\n');
      console.log('Live demo blocked: '+code+'. No jobs were seeded or provider requests made.');process.exitCode=2;
    }else{
      const parsed=searchSchema.safeParse(process.argv[2]?JSON.parse(process.argv[2]):{keywords:'software engineer',location:'',domains:['affirm.com','cloudflare.com'],seniority:'early-career',maxJobs:2});
      if(!parsed.success)throw new DemoError('demo_invalid_preferences');
      // Exactly one start request. A failed response is never resubmitted.
      lastRun=checkedRun(await localJson('/api/search',port,{method:'POST',headers:{'x-firststep-token':config.token},body:parsed.data}));id=lastRun.id;
    }
  }
  if(id){
    console.log((resume?'Resuming local status only: ':'Live run: ')+id+' · '+base+'/?run='+id);
    const run=await waitForRun(id,port,{initial:lastRun,onProgress:r=>{lastRun=r;}});
    const evidence={kind:resume?'Recorded genuine TinyFish run; resumed status only, no new extraction':'TinyFish live search evidence',recordedAt:new Date().toISOString(),checkedAt:run.finishedAt,runId:run.id,workflow:run.workflow,input:run.input,status:run.status,requests:run.requests,reports:run.reports,error:run.error,jobs:run.jobs};
    await writeFile('evidence/live-demo.json',JSON.stringify(evidence,null,2)+'\n');
    console.log(run.status+': '+run.jobs.length+' source-checked jobs. See evidence/live-demo.json.');
    if(new Set(run.jobs.filter(j=>j.status==='open'&&j.sourceVerified).map(j=>j.employerId)).size<2){console.log('Demo gate remains open: two employers need source-verified current listings.');process.exitCode=2;}
  }
}catch(e){
  const code=e instanceof DemoError?e.code:'demo_validation_or_io_failed';
  const receipt={kind:'genuine local demo interruption; NOT successful live-job evidence',checkedAt:new Date().toISOString(),code,runId:id,lastKnownStatus:lastRun?.status??null,lastKnownRequests:lastRun?.requests??null,newSearchAutomaticallyRetried:false,resume:id?'npm run demo -- --resume '+id:null};
  try{await mkdir('evidence',{recursive:true});await writeFile('evidence/demo-interruption.json',JSON.stringify(receipt,null,2)+'\n');}catch{}
  console.log('Demo stopped: '+code+'. No raw error or credential logged.');if(id)console.log('Resume the same run without new provider work: npm run demo -- --resume '+id);process.exitCode=2;
}

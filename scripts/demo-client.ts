import {request} from 'node:http';
import type {SearchRun} from '../src/model.js';
export class DemoError extends Error {constructor(readonly code:string){super(code);}}
export const runIdPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Fresh local connections avoid stale keep-alive sockets. No arbitrary hosts,
// and no automatic retry of a POST that might have started provider work.
export async function localJson(path:string,port:number,options:{method?:'GET'|'POST';headers?:Record<string,string>;body?:unknown}={}):Promise<unknown>{
  if(!Number.isInteger(port)||port<1024||port>65535||!/^\/api\/(config|search|runs\/[0-9a-f-]{36})$/.test(path))throw new DemoError('demo_invalid_target');
  return new Promise((resolve,reject)=>{
    const payload=options.body===undefined?undefined:JSON.stringify(options.body);
    const req=request({hostname:'127.0.0.1',port,path,method:options.method||'GET',agent:false,headers:{...options.headers,...(payload?{'Content-Type':'application/json','Content-Length':String(Buffer.byteLength(payload))}:{})}},res=>{
      let bytes=0;const chunks:Buffer[]=[];
      res.on('data',chunk=>{bytes+=chunk.length;if(bytes>2000000)res.destroy(new Error('bounded_response'));else chunks.push(chunk);});
      res.on('error',()=>reject(new DemoError('demo_connection_lost')));
      res.on('end',()=>{
        if(!res.statusCode||res.statusCode>=400)return reject(new DemoError('demo_http_'+(res.statusCode||500)));
        try{resolve(JSON.parse(Buffer.concat(chunks).toString()));}catch{reject(new DemoError('demo_invalid_response'));}
      });
    });
    req.setTimeout(15000,()=>req.destroy(new Error('bounded_timeout')));
    req.on('error',()=>reject(new DemoError('demo_connection_lost')));req.end(payload);
  });
}
export function checkedRun(value:unknown,expectedId?:string):SearchRun{
  const run=value as SearchRun;
  if(!run||!runIdPattern.test(run.id)||expectedId&&run.id!==expectedId||!['running','complete','partial','empty','blocked','failed'].includes(run.status)||!Array.isArray(run.jobs)||run.jobs.length>20||!Array.isArray(run.reports))throw new DemoError('demo_invalid_response');
  return run;
}
export async function waitForRun(id:string,port:number,options:{initial?:SearchRun;onProgress?:(run:SearchRun)=>void;intervalMs?:number}={}):Promise<SearchRun>{
  if(!runIdPattern.test(id))throw new DemoError('demo_invalid_run_id');
  const until=Date.now()+650000,delay=Math.max(1,Math.min(options.intervalMs??1500,1500));
  let run=options.initial,failures=0;
  while(Date.now()<until){
    if(run){options.onProgress?.(run);if(run.status!=='running')return run;await new Promise(r=>setTimeout(r,delay));}
    try{run=checkedRun(await localJson('/api/runs/'+id,port),id);failures=0;}
    catch(e){if(e instanceof DemoError&&e.code==='demo_http_404')throw e;if(++failures>=3)throw new DemoError('demo_poll_interrupted');await new Promise(r=>setTimeout(r,delay));}
  }
  throw new DemoError('demo_poll_deadline');
}

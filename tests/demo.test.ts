import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer,type Server} from 'node:http';
import {checkedRun,DemoError,localJson,waitForRun} from '../scripts/demo-client.js';
const id='11111111-1111-4111-8111-111111111111';
// OFFLINE LOCAL HTTP FIXTURES, no TinyFish key, external request or live job.
const fixture={id,status:'running',jobs:[],reports:[],requests:0};
async function listen(server:Server){await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));return (server.address() as {port:number}).port;}
async function stop(server:Server){await new Promise<void>(resolve=>server.close(()=>resolve()));}
test('OFFLINE CLI: lost status socket recovers without repeating the search POST',async()=>{
  let starts=0,polls=0;const server=createServer((req,res)=>{
    if(req.method==='POST'){starts++;req.resume();res.end(JSON.stringify(fixture));return;}
    if(++polls===1){req.socket.destroy();return;}
    res.end(JSON.stringify({...fixture,status:'complete'}));
  });
  const port=await listen(server);
  try{const initial=checkedRun(await localJson('/api/search',port,{method:'POST',body:{keywords:'OFFLINE TEST'}}));const run=await waitForRun(id,port,{initial,intervalMs:1});assert.equal(run.status,'complete');assert.equal(starts,1);assert.equal(polls,2);}
  finally{await stop(server);}
});
test('OFFLINE CLI: three status failures stop with a fixed resumable error and no POST',async()=>{
  let posts=0,polls=0;const server=createServer((req)=>{if(req.method==='POST')posts++;else polls++;req.socket.destroy();});const port=await listen(server);
  try{await assert.rejects(()=>waitForRun(id,port,{intervalMs:1}),e=>e instanceof DemoError&&e.code==='demo_poll_interrupted');assert.equal(posts,0);assert.equal(polls,3);}
  finally{await stop(server);}
});
test('OFFLINE CLI: invalid IDs and non-API paths are refused before connecting',async()=>{
  assert.throws(()=>checkedRun({...fixture,id:'unsafe'}),/demo_invalid_response/);
  await assert.rejects(()=>waitForRun('unsafe',4317),/demo_invalid_run_id/);
  await assert.rejects(()=>localJson('https://127.0.0.1/secret',4317),/demo_invalid_target/);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {csv,csvCell,cleanSaved,safeLink,filterJobs} from '../public/shared.mjs';
// OFFLINE TEST FIXTURE, not live data.
const job={id:'test-123',title:'[TEST FIXTURE] Software Engineer',employer:'Stripe',sourceUrl:'https://stripe.com/jobs/listing/123',checkedAt:'2026-10-12T10:00:00Z',workArrangement:'remote',seniority:'unknown',employmentType:'internship',status:'open',matches:['software'],sourceVerified:true};
test('CSV escapes spreadsheet formulas, quotes, newlines, null fields and source links',()=>{
  for(const value of ['=HYPERLINK("http://evil")',' +cmd','-1+2','@SUM(A1)','\t=cmd','\n=cmd'])assert.ok(csvCell(value).startsWith('"\''));
  assert.equal(csvCell('A "quote"'),'"A ""quote"""');
  assert.equal(csvCell(null),'"not stated"');
  const file=csv([{...job,title:'=evil'}]);assert.match(file,/'=evil/);assert.match(file,/https:\/\/stripe.com\/jobs\/listing\/123/);assert.match(file,/checkedAt/);
});
test('saved-job validation discards unsafe links, invalid dates and unrelated data',()=>{
  assert.equal(cleanSaved([{...job,sourceUrl:'javascript:alert(1)'}]).length,0);
  assert.equal(cleanSaved([{...job,checkedAt:'invalid'}]).length,0);
  assert.equal(cleanSaved([{...job,title:42}]).length,0);
  assert.equal(cleanSaved(null).length,0);
  assert.deepEqual(cleanSaved([{...job,apiKey:'secret'}])[0].matches,['software']);
  assert.equal(JSON.stringify(cleanSaved([{...job,apiKey:'secret'}])).includes('secret'),false);
  assert.equal(safeLink('https://evil.test/jobs'),false);
});
test('filters handle remote, unknown, expired, employer and employment type',()=>{
  const jobs=[job,{...job,id:'2',status:'expired'},{...job,id:'3',workArrangement:'unknown',employer:'Cloudflare',seniority:'internship'}];
  assert.equal(filterJobs(jobs,{hideExpired:true}).length,2);
  assert.equal(filterJobs(jobs,{knownOnly:true}).length,0);
  assert.equal(filterJobs(jobs,{arrangement:'remote',hideExpired:true}).length,1);
  assert.equal(filterJobs(jobs,{query:'cloudflare'}).length,1);
  assert.equal(filterJobs(jobs,{type:'full-time'}).length,0);
});

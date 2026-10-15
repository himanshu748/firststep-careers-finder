import {test,expect} from '@playwright/test';
test('real setup state, empty saved view, server gates and mobile layout',async({page,request})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page).toHaveTitle(/FirstStep/);await expect(page.getByText('Connect TinyFish to start a live search')).toBeVisible();
  await page.getByRole('button',{name:'Find live roles'}).click();await expect(page.getByText('Local setup',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:/Saved jobs/}).click();await expect(page.getByRole('heading',{name:'Keep the opportunities that catch your eye.'})).toBeVisible();
  const config=await (await request.get('/api/config')).json();expect(config.ready).toBe(false);
  expect((await request.post('/api/search',{data:{keywords:'software'}})).status()).toBe(403);
  expect((await request.post('/api/search',{headers:{'x-firststep-token':config.token},data:{keywords:'software'}})).status()).toBe(503);
  expect((await request.post('/api/search',{headers:{'x-firststep-token':config.token,Origin:'https://evil.test'},data:{keywords:'software'}})).status()).toBe(403);
  expect((await request.get('/.env')).status()).toBe(404);
  expect((await request.get('/api/config',{headers:{Host:'evil.test'}})).status()).toBe(403);
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:/Discover jobs/}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);expect(errors).toEqual([]);
});
test('OFFLINE TEST FIXTURE: cards, unknown geography, save persistence, filters and CSV',async({page})=>{
  // Browser network interception is test-only. Real production server has no fixture route.
  const job={id:'test-fixture',title:'[TEST FIXTURE] Software Engineer Intern',employer:'Stripe',employerId:'stripe',sourceUrl:'https://stripe.com/jobs/listing/test-fixture',location:null,workArrangement:'remote',geographicRestriction:null,experienceRequirements:null,seniority:'internship',employmentType:'internship',postedDate:null,deadline:null,visaSponsorship:null,sponsorshipAvailable:null,excerpt:'[OFFLINE TEST FIXTURE] <img src=x onerror=alert(1)>',status:'open',checkedAt:'2026-10-12T10:00:00Z',matches:['software'],sourceVerified:true};
  await page.route('**/api/config',route=>route.fulfill({json:{ready:true,token:'test-only',employers:[]}}));
  await page.route('**/api/search',route=>route.fulfill({status:202,json:{id:'test-run',status:'running',jobs:[],reports:[],requests:0,stage:'Test fixture only'}}));
  await page.route('**/api/runs/test-run',route=>route.fulfill({json:{id:'test-run',mode:'fixture',status:'partial',jobs:[job,{...job,id:'expired-fixture',title:'[TEST FIXTURE] Expired Internship',status:'expired'}],reports:[{employer:'Stripe',status:'partial',count:2,code:'some_sources_unverified'}],requests:0,stage:'OFFLINE TEST FIXTURE',finishedAt:'2026-10-12T10:00:00Z',error:null}}));
  await page.goto('/');await page.getByRole('button',{name:'Find live roles'}).click();
  await expect(page.getByRole('heading',{name:job.title})).toBeVisible();await expect(page.getByText('Not stated. Remote is not confirmation of eligibility from India.',{exact:true})).toBeVisible();
  await page.getByLabel('Hide expired').uncheck();await expect(page.getByRole('heading',{name:'[TEST FIXTURE] Expired Internship'})).toBeVisible();await page.getByLabel('Hide expired').check();
  await expect(page.getByText('[OFFLINE TEST FIXTURE] <img src=x onerror=alert(1)>',{exact:true})).toBeVisible();expect(await page.locator('.job-excerpt img').count()).toBe(0);
  await page.getByText('Requirements & source details').click();await expect(page.getByText('Visa sponsorship',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Save '+job.title,exact:true}).click();await page.reload();await page.getByRole('button',{name:/Saved jobs/}).click();await expect(page.getByRole('heading',{name:job.title})).toBeVisible();
  await page.getByPlaceholder('Filter title, employer or location').fill('absent');await expect(page.getByText('No jobs match these filters.')).toBeVisible();
  await page.getByPlaceholder('Filter title, employer or location').fill('software');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV'}).click();expect((await download).suggestedFilename()).toBe('firststep-jobs.csv');
  await page.getByRole('button',{name:'Unsave '+job.title,exact:true}).click();await expect(page.getByText('Keep the opportunities that catch your eye.')).toBeVisible();
});
test('OFFLINE TEST FIXTURE: failed polling preserves an explicit interruption state',async({page})=>{
  await page.route('**/api/config',route=>route.fulfill({json:{ready:true,token:'test-only',employers:[]}}));
  await page.route('**/api/search',route=>route.fulfill({status:202,json:{id:'test-run',status:'running',jobs:[],reports:[],requests:0}}));
  await page.route('**/api/runs/test-run',route=>route.fulfill({status:503,json:{error:'provider_failure'}}));
  await page.goto('/');await page.getByRole('button',{name:'Find live roles'}).click();await expect(page.getByText('Status updates interrupted',{exact:true})).toBeVisible({timeout:15000});
});
test('OFFLINE TEST FIXTURE: empty and blocked states remain honest',async({page})=>{
  let status='empty';
  await page.route('**/api/config',route=>route.fulfill({json:{ready:true,token:'test-only',employers:[]}}));
  await page.route('**/api/search',route=>route.fulfill({status:202,json:{id:'test-run',status:'running',jobs:[],reports:[],requests:0}}));
  await page.route('**/api/runs/test-run',route=>route.fulfill({json:{id:'test-run',status,jobs:[],reports:status==='blocked'?[{employer:'Stripe',status:'blocked',code:'access_blocked',count:0}]:[],requests:0,finishedAt:'2026-10-12T10:00:00Z',error:null}}));
  await page.goto('/');await page.getByRole('button',{name:'Find live roles'}).click();await expect(page.getByText('No matching roles found in this search.')).toBeVisible();
  status='blocked';await page.getByRole('button',{name:'Find live roles'}).click();await expect(page.getByText('These sources could not be checked.')).toBeVisible();await expect(page.getByText('The career page blocked access. No bypass was attempted.')).toBeVisible();
});
test('custom-design: local fonts, 360 to 1440 layouts, touch targets and reduced motion',async({page,request})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  expect((await request.get('/fonts/manrope-latin.woff2')).status()).toBe(200);
  expect((await request.get('/fonts/space-grotesk-latin.woff2')).status()).toBe(200);
  expect((await request.get('/fonts/../../.env')).status()).toBe(404);
  expect(await page.evaluate(async()=>{await document.fonts.ready;return document.fonts.check('14px Manrope')&&document.fonts.check('40px "Space Grotesk"');})).toBe(true);
  for(const width of [360,390,768,1024,1440]) {
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'overflow at '+width).toBe(true);
    const targets=await page.locator('button:not([hidden]), select, a.brand').evaluateAll(els=>els.filter(el=>el.getBoundingClientRect().width>0).map(el=>({id:el.id,height:el.getBoundingClientRect().height})));
    expect(targets.filter(el=>el.height<40),'small targets at '+width).toEqual([]);
  }
  expect(await page.locator('.flow-trace').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
  expect(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)).toBe(0);
  await page.getByRole('button',{name:/Saved jobs/}).click();await expect(page.getByRole('heading',{name:'Keep the opportunities that catch your eye.'})).toBeVisible();
  expect(errors).toEqual([]);
});

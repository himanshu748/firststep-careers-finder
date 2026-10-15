// Shared pure functions, used by browser and automated tests. No fixture content.
export function csvCell(value) {
  let text=String(value??'not stated').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'');
  if(/^[\s\uFEFF]*[=+\-@]/u.test(text)||/^[\t\r\n]/.test(text)) text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}
export function csv(jobs) {
  const fields=['title','employer','location','workArrangement','geographicRestriction','experienceRequirements','seniority','employmentType','postedDate','deadline','visaSponsorship','status','sourceUrl','checkedAt'];
  return '\uFEFF'+[fields.map(csvCell).join(','),...jobs.slice(0,200).map(j=>fields.map(f=>csvCell(j[f])).join(','))].join('\r\n');
}
export function safeLink(raw) {
  try {const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port && ['www.cloudflare.com','cloudflare.com','stripe.com','www.stripe.com','www.atlassian.com','atlassian.com','careers.datadoghq.com','www.hubspot.com','hubspot.com','boards.greenhouse.io','job-boards.greenhouse.io'].includes(u.hostname);} catch{return false;}
}
export function cleanSaved(raw) {
  if(!Array.isArray(raw)) return [];
  const fields=['id','title','employer','employerId','sourceUrl','location','workArrangement','geographicRestriction','experienceRequirements','seniority','employmentType','postedDate','deadline','visaSponsorship','excerpt','status','checkedAt'];
  const list=raw.slice(0,200).filter(j=>j&&typeof j==='object'&&typeof j.id==='string'&&typeof j.title==='string'&&typeof j.employer==='string'&&safeLink(j.sourceUrl)&&typeof j.checkedAt==='string'&&Number.isFinite(Date.parse(j.checkedAt)));
  return list.map(j=>({...Object.fromEntries(fields.map(f=>[f,typeof j[f]==='string'?j[f].slice(0,3000):null])),matches:Array.isArray(j.matches)?j.matches.filter(x=>typeof x==='string').slice(0,30):[],sourceVerified:j.sourceVerified===true,sponsorshipAvailable:typeof j.sponsorshipAvailable==='boolean'?j.sponsorshipAvailable:null}));
}
export function filterJobs(jobs,filter) {
  const q=(filter.query||'').toLowerCase();
  return jobs.filter(j=>(!q||[j.title,j.employer,j.location,j.excerpt].join(' ').toLowerCase().includes(q))&&(!filter.arrangement||j.workArrangement===filter.arrangement)&&(!filter.employer||j.employer===filter.employer)&&(!filter.type||j.employmentType===filter.type)&&(!filter.hideExpired||j.status!=='expired')&&(!filter.knownOnly||(j.workArrangement!=='unknown'&&j.seniority!=='unknown')));
}

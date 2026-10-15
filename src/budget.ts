import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {AppError} from './policy.js';
export const MAX_DAILY_REQUESTS=64;
export function dailyRequestLimit(value:string|number|undefined){
  const limit=Number(value===undefined||value===''?40:value);
  if(!Number.isInteger(limit)||limit<1||limit>MAX_DAILY_REQUESTS)throw new AppError('invalid_budget');
  return limit;
}
export class Budget {
  private db:DatabaseSync;
  constructor(path:string, readonly limit=40) {
    dailyRequestLimit(limit);
    if(path!==':memory:') mkdirSync(dirname(path),{recursive:true});
    this.db=new DatabaseSync(path);
    this.db.exec('CREATE TABLE IF NOT EXISTS usage (day TEXT PRIMARY KEY, count INTEGER NOT NULL)');
  }
  day(now=new Date()) { return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(now); }
  used() { return Number((this.db.prepare('SELECT count FROM usage WHERE day=?').get(this.day()) as {count:number}|undefined)?.count||0); }
  take(count=1) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if(!Number.isInteger(count)||count<1||this.used()+count>this.limit) throw new AppError('daily_budget_reached',429);
      this.db.prepare('INSERT INTO usage(day,count) VALUES (?,?) ON CONFLICT(day) DO UPDATE SET count=count+excluded.count').run(this.day(),count);
      this.db.exec('COMMIT');
    } catch(e) {this.db.exec('ROLLBACK');throw e;}
  }
  close(){this.db.close();}
}

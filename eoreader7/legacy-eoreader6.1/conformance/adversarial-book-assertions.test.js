import test from 'node:test'; import assert from 'node:assert/strict'; import https from 'node:https';
import {createSession,admitReading,adversariallyResolveAssertions} from '../packages/host/index.js';
const get=url=>new Promise((resolve,reject)=>https.get(url,{headers:{'User-Agent':'eoreader6-adversarial'}},res=>{if(res.statusCode!==200){reject(new Error(`HTTP ${res.statusCode}`));res.resume();return;} res.setEncoding('utf8');let b='';res.on('data',c=>b+=c);res.on('end',()=>resolve(b));}).on('error',reject));
test('blind book: every cast and link assertion receives adversarial perturbation',{timeout:900000},async()=>{
 const raw=await get('https://raw.githubusercontent.com/GITenberg/A-Christmas-Carol_46/master/46-0.txt'); assert.ok(raw.length>150000);
 const session=createSession(); admitReading(session,{sourceId:'blind-book',text:raw,priors:[]}); const r=adversariallyResolveAssertions(session,{sourceId:'blind-book',priors:[]});
 console.log('ADVERSARIAL_BOOK_RESULT',JSON.stringify({summary:r.summary,cast:r.cast.filter(x=>x.disposition!=='survives').slice(0,30),links:r.links.filter(x=>x.disposition!=='survives').slice(0,30)}));
 assert.ok(r.summary.castAssertions>20); assert.ok(r.summary.linkAssertions>500); assert.equal(r.cast.length,r.summary.castAssertions); assert.equal(r.links.length,r.summary.linkAssertions);
});

import assert from 'node:assert/strict';
import { webcrypto, randomUUID } from 'node:crypto';
const API='https://qekcgsfeomjckctiubgm.supabase.co/functions/v1/smadbod-attendance-bridge';
const b64=b=>Buffer.from(b).toString('base64url');
const token=b64(webcrypto.getRandomValues(new Uint8Array(32)));
const keyBytes=webcrypto.getRandomValues(new Uint8Array(32));
const key=await webcrypto.subtle.importKey('raw',keyBytes,'AES-GCM',false,['encrypt','decrypt']);
const iv=webcrypto.getRandomValues(new Uint8Array(12));
const fake={schema:'smadbod.attendance.v1',date:'2026-10-24',year:'5',classCode:'T',className:'TERBILANG',
  pupils:[{id:'TEST-ONLY',examNo:'99',name:'SYNTHETIC TEST PUPIL',present:false,reason:'TEST'}],preparedAt:new Date().toISOString()};
const encrypted=new Uint8Array(await webcrypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(fake))));
async function post(body){
 const r=await fetch(API,{method:'POST',headers:{'x-bridge-token':token,'content-type':'application/json'},body:JSON.stringify(body)});
 const data=await r.json();
 assert.ok(r.ok,JSON.stringify(data));
 assert.equal(data.ok,true);
 return data;
}
const pushed=await post({action:'push',client_ref:randomUUID(),iv:b64(iv),ciphertext:b64(encrypted)});
const fetched=await post({action:'pull'});
assert.ok(fetched.packets.length>=1,'No bridge packet received');
const envelope=fetched.packets.find(p=>p.id===pushed.id);
assert.ok(envelope,'Cannot match sent packet ID');
const plaintext=await webcrypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(envelope.iv,'base64url')},
 key,Buffer.from(envelope.ciphertext,'base64url'));
assert.deepEqual(JSON.parse(new TextDecoder().decode(plaintext)),fake);
await post({action:'ack',id:pushed.id});
const after=await post({action:'pull'});
assert.equal(after.packets.filter(p=>p.id===pushed.id).length,0);
console.log('Attendance Bridge encrypted send → receive → decrypt → acknowledge: PASS (synthetic data only).');

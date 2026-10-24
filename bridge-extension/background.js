/* SMADBOD Attendance Bridge – Chrome/Edge service worker, no KPM credentials. */
const API='https://qekcgsfeomjckctiubgm.supabase.co/functions/v1/smadbod-attendance-bridge';
const MOEIS='https://moeispel.moe.gov.my/sahsiah/kehadiran/tabguru';
const PREFIX='SB1.';
function b64url(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function from64(s){let raw=atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0))}
function parsePair(text){const m=/^SB1\.([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/.exec(text||'');if(!m)throw Error('Invalid pairing code');return {token:m[1],secret:m[2]}}
async function request(pair,body){
 const response=await fetch(API,{method:'POST',cache:'no-store',headers:{'content-type':'application/json','x-bridge-token':pair.token},body:JSON.stringify(body)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||!data.ok)throw Error(data.error||'Bridge network error');
 return data;
}
async function decrypt(pair,packet){
 const key=await crypto.subtle.importKey('raw',from64(pair.secret),{name:'AES-GCM'},false,['decrypt']);
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(packet.iv)},key,from64(packet.ciphertext));
 const record=JSON.parse(new TextDecoder().decode(plain));
 if(record.schema!=='smadbod.attendance.v1'||!Array.isArray(record.pupils)||record.pupils.length>200)throw Error('Invalid attendance format');
 if(!/^20\d\d-\d\d-\d\d$/.test(record.date||''))throw Error('Invalid attendance date');
 return {id:packet.id,createdAt:packet.created_at,...record};
}
async function notifyAttendance(packet){
 const absent=packet.pupils.filter(p=>p.present===false).length;
 await chrome.notifications.create('smadbod-'+packet.id,{
  type:'basic',
  iconUrl:'icons/icon.png',
  title:'SMADBOD attendance ready',
  message:'Year '+packet.year+' '+packet.className+' · '+packet.date+' · '+absent+' absent. Click to open MOEIS for review.',
  priority:1
 }).catch(()=>{});
}
async function poll(){
 const {pairCode,pending=[],notifiedIds=[]}=await chrome.storage.local.get(['pairCode','pending','notifiedIds']);
 if(!pairCode)return {ok:false,error:'Not paired with SMADBOD'};
 const pair=parsePair(pairCode);
 const r=await request(pair,{action:'pull'});
 const loaded=Array.isArray(pending)?pending:[];
 const seen=new Set(loaded.map(p=>p.id));
 const notified=new Set(notifiedIds);
 let fresh=0;
 for(const envelope of r.packets||[]){
  if(seen.has(envelope.id))continue;
  try{
   const entry=await decrypt(pair,envelope);
   loaded.unshift(entry);seen.add(entry.id);fresh++;
   if(!notified.has(entry.id)){await notifyAttendance(entry);notified.add(entry.id)}
  }catch(e){console.warn('Unable to decrypt a private bridge packet',String(e).slice(0,80))}
 }
 await chrome.storage.local.set({pending:loaded.slice(0,35),notifiedIds:[...notified].slice(-150)});
 if(loaded.length)await chrome.action.setBadgeText({text:String(loaded.length)});
 else await chrome.action.setBadgeText({text:''});
 return {ok:true,fresh,count:loaded.length};
}
async function openAttendance(id){
 const {pending=[]}=await chrome.storage.local.get('pending');
 const item=pending.find(p=>p.id===id)||pending[0];
 if(!item)throw Error('No pending attendance record');
 await chrome.storage.local.set({activePacket:item.id});
 await chrome.tabs.create({url:MOEIS,active:true});
 return {ok:true};
}
async function dismissAttendance(id){
 const {pairCode,pending=[],notifiedIds=[]}=await chrome.storage.local.get(['pairCode','pending','notifiedIds']);
 if(!pairCode)throw Error('Not paired');
 await request(parsePair(pairCode),{action:'ack',id});
 const remaining=pending.filter(x=>x.id!==id);
 await chrome.storage.local.set({pending:remaining,notifiedIds:notifiedIds.filter(x=>x!==id)});
 if(remaining.length===0)await chrome.action.setBadgeText({text:''});
 else await chrome.action.setBadgeText({text:String(remaining.length)});
 const {activePacket}=await chrome.storage.local.get('activePacket');
 if(activePacket===id)await chrome.storage.local.remove('activePacket');
 return {ok:true};
}
async function createPair(){
 const a=crypto.getRandomValues(new Uint8Array(32)),b=crypto.getRandomValues(new Uint8Array(32));
 const code=PREFIX+b64url(a)+'.'+b64url(b);
 await chrome.storage.local.set({pairCode:code,pending:[],notifiedIds:[]});
 await chrome.action.setBadgeText({text:''});
 return {ok:true,code};
}
chrome.runtime.onInstalled.addListener(async()=>{
 await chrome.alarms.create('smadbod-poll',{periodInMinutes:1});
 try{await poll()}catch(e){console.warn('Bridge polling not ready',String(e))}
});
chrome.runtime.onStartup.addListener(async()=>{await chrome.alarms.create('smadbod-poll',{periodInMinutes:1});try{await poll()}catch{}});
chrome.alarms.onAlarm.addListener(a=>{if(a.name==='smadbod-poll')poll().catch(e=>console.warn('Bridge poll error',String(e).slice(0,100)))});
chrome.notifications.onClicked.addListener(id=>{
 if(id.startsWith('smadbod-'))openAttendance(id.slice(8)).catch(console.warn);
 chrome.notifications.clear(id);
});
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
 (async()=>{
  if(msg?.type==='CREATE_PAIR')return await createPair();
  if(msg?.type==='POLL')return await poll();
  if(msg?.type==='OPEN')return await openAttendance(msg.id);
  if(msg?.type==='DISMISS')return await dismissAttendance(msg.id);
  if(msg?.type==='GET_ACTIVE'){
   const {activePacket,pending=[]}=await chrome.storage.local.get(['activePacket','pending']);
   return {ok:true,packet:pending.find(p=>p.id===activePacket)||null};
  }
  return {ok:false,error:'Unsupported request'};
 })().then(reply).catch(e=>reply({ok:false,error:String(e.message||e)}));
 return true;
});

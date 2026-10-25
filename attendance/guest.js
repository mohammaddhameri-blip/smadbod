import {submitAttendance,parsePairing} from './bridge.js';

const $=id=>document.getElementById(id);
let roster=[],revision='',busy=false;
const LABELS={C:'CEMERLANG',G:'GEMILANG',T:'TERBILANG'};
const PAIR_MEMORY='smadbod_guest_master_pair';
const DRAFT='smadbod_guest_drafts_2026';
const byte64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
function localDate(){
 const d=new Date();
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
}
function liveClock(){
 $('liveDay').textContent=new Intl.DateTimeFormat('en-MY',{weekday:'long',day:'numeric',month:'short',year:'numeric'}).format(new Date());
}
liveClock();setInterval(liveClock,60000);
$('date').value=localDate();$('year').value='5';$('classCode').value='T';
try{$('pairing').value=sessionStorage.getItem(PAIR_MEMORY)||localStorage.getItem(PAIR_MEMORY)||'';
 $('rememberPair').checked=Boolean(localStorage.getItem(PAIR_MEMORY));}catch{}
function notify(id,text){$(id).textContent=text}
// The QR and share link transport the existing encrypted-queue pairing capability.
// Never send pairing secrets to QR websites or leak an imported secret in the address bar.
function extractPair(raw){
 const v=String(raw||'').trim();
 if(!v.startsWith('https://'))return v;
 const u=new URL(v);
 if(u.origin!==location.origin||!u.pathname.endsWith('/smadbod/attendance/index.html'))throw Error('Use an official SMADBOD invitation.');
 return new URLSearchParams(u.hash.slice(1)).get('pair')||'';
}
function readPairs(){
 const parts=$('pairing').value.split(/[\n\r,;]+/).map(x=>x.trim()).filter(Boolean);
 if(parts.length>3)throw Error('A maximum of three receivers is supported.');
 return [...new Set(parts.map(v=>{const code=extractPair(v);parsePairing(code);return code;}))];
}
function pairFeedback(msg,status=''){
 const el=$('pairStatus');el.textContent=msg;el.className='pair-status '+status;
}
function updatePairFeedback(){
 try{const count=readPairs().length;
 pairFeedback(count?count+' receiver'+(count===1?'':'s')+' ready. Send a record to test delivery.':'No Master paired. Open Pair phone on SMADBOD Master.',count?'ready':'');
 }catch{pairFeedback('Pairing details incomplete. Scan the QR, paste the invite, or enter its entire code.','error');}
}
function acceptPair(raw){
 const code=extractPair(raw);parsePairing(code);
 $('pairing').value=code;document.querySelector('.pair-fallback').open=false;
 try{sessionStorage.setItem(PAIR_MEMORY,code);
  if($('rememberPair').checked)localStorage.setItem(PAIR_MEMORY,code);
 }catch{}
 pairFeedback('Master details received. Ready to send securely.','ready');
}
$('pairing').addEventListener('input',updatePairFeedback);
$('savePair').addEventListener('click',()=>{
 try{const codes=readPairs();if(!codes.length)throw Error('Scan or paste your Master details first.');
  sessionStorage.setItem(PAIR_MEMORY,codes.join('\n'));
  if($('rememberPair').checked)localStorage.setItem(PAIR_MEMORY,codes.join('\n'));
  else localStorage.removeItem(PAIR_MEMORY);
  pairFeedback('Pairing saved on this device. Send attendance to test delivery.','ready');
 }catch(e){pairFeedback(e.message,'error');}
});
$('pastePair').addEventListener('click',async()=>{
 try{if(!navigator.clipboard?.readText)throw Error('Clipboard access unavailable. Long-press the manual entry field and paste.');
  acceptPair(await navigator.clipboard.readText());
 }catch(e){pairFeedback(e.message||'Paste failed. Use manual entry.','error');document.querySelector('.pair-fallback').open=true;}
});
let qrStream=null,qrScanning=false;
function stopQr(){
 qrScanning=false;
 if(qrStream){qrStream.getTracks().forEach(t=>t.stop());qrStream=null;}
 const video=$('pairVideo');video.pause();video.srcObject=null;$('pairCameraArea').hidden=true;
}
$('stopPairCamera').addEventListener('click',stopQr);
$('scanPair').addEventListener('click',async()=>{
 stopQr();
 try{
  if(!('BarcodeDetector' in window))throw Error('QR scanning not supported here. Use clipboard or manual entry.');
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera unavailable. Use clipboard or manual entry.');
  const scanner=new BarcodeDetector({formats:['qr_code']});
  qrStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
  const video=$('pairVideo');video.srcObject=qrStream;$('pairCameraArea').hidden=false;
  await video.play();qrScanning=true;
  $('pairCameraStatus').textContent='Aim your camera at the QR shown on Master.';
  const scan=async()=>{
   if(!qrScanning)return;
   try{const codes=await scanner.detect(video);if(!qrScanning)return;
    if(codes.length){acceptPair(codes[0].rawValue);stopQr();return;}
   }catch(e){$('pairCameraStatus').textContent='Cannot read QR. Improve lighting or use Paste.';}
   if(qrScanning)setTimeout(scan,280);
  };scan();
 }catch(e){stopQr();pairFeedback(e.message,'error');}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopQr();});
try{
 const invited=new URLSearchParams(location.hash.slice(1)).get('pair');
 if(invited){
  history.replaceState(null,'',location.pathname+location.search);
  try{acceptPair(invited)}catch(e){pairFeedback(e.message,'error');}
 }else updatePairFeedback();
}catch{updatePairFeedback();}

function sessionKey(){return $('date').value+'|'+$('year').value+'|'+$('classCode').value}
function readDraft(){
 try{let drafts=JSON.parse(sessionStorage.getItem(DRAFT)||'{}');let draft=drafts[sessionKey()];
   if(draft&&Array.isArray(draft.absent)&&draft.absent.length<=200)return draft;
 }catch{}
 return {absent:[],reasons:{}};
}
function writeDraft(draft){
 try{
  const data=JSON.parse(sessionStorage.getItem(DRAFT)||'{}');
  data[sessionKey()]={absent:[...new Set(draft.absent)],reasons:draft.reasons};
  sessionStorage.setItem(DRAFT,JSON.stringify(data));
 }catch{}
}
// Skorskal and SMADBOD use the same encrypted roster and private access phrase.
// Retry Skorskal's official encrypted copy if this Guest device has a stale one.
// No plaintext roster or passphrase is sent to either server.
async function decryptRoster(secret){
 if(!secret||!secret.trim())throw Error('Enter the same private roster access phrase used in Skorskal.');
 if(!crypto?.subtle||!('DecompressionStream'in window))throw Error('Update Chrome or Android System WebView to unlock the roster.');
 const pass=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),'PBKDF2',false,['deriveKey']);
 const sources=['./roster-2026.json','https://mohammaddhameri-blip.github.io/skorskal-omr/roster-2026.json'];
 let available=false,authenticationFailed=false,corrupt=false;
 for(const source of sources){
  let enc;
  try{
   const res=await fetch(source,{cache:'no-store'});
   if(!res.ok)continue;
   enc=await res.json();
  }catch{continue}
  available=true;
  if(enc.academicYear!==2026||enc.algorithm!=='PBKDF2-SHA256-250000+AES-256-GCM+zlib'){
   corrupt=true;continue;
  }
  let raw;
  try{
   const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:byte64(enc.salt),iterations:250000,hash:'SHA-256'},pass,{name:'AES-GCM',length:256},false,['decrypt']);
   raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:byte64(enc.iv),additionalData:new TextEncoder().encode('skorskal-roster-2026')},key,byte64(enc.data));
  }catch{authenticationFailed=true;continue}
  try{
   const stream=new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate'));
   const rows=JSON.parse(await new Response(stream).text());
   if(!Array.isArray(rows)||rows.length!==enc.count||rows.length<1)throw Error('Incomplete roster');
   const ids=new Set();
   const pupils=rows.map(row=>{
    if(!Array.isArray(row)||row.length!==4)throw Error('Invalid pupil record');
    const [year,classCode,examNo,name]=row.map(x=>String(x).trim());
    const id=year+classCode+'-'+examNo;
    if(!/^[1-6]$/.test(year)||!['C','G','T'].includes(classCode)||!/^[0-9]{2}$/.test(examNo)||!name||ids.has(id))throw Error('Invalid or duplicated pupil ID');
    ids.add(id);return {year,classCode,examNo,name,id};
   });
   return {pupils,version:enc.version};
  }catch{corrupt=true}
 }
 if(!available)throw Error('Could not load the encrypted 2026 roster. Connect to the internet and retry.');
 if(authenticationFailed)throw Error('Roster unlock failed. SMADBOD uses the SAME private phrase as Skorskal. Check capitals and spaces, then retry. If it unlocks in Skorskal but not here, update or refresh SMADBOD Guest.');
 if(corrupt)throw Error('The encrypted roster could not be read. Please update or refresh SMADBOD Guest.');
 throw Error('Could not open the official 2026 roster.');
}
$('unlock').addEventListener('click',async()=>{
 const button=$('unlock');button.disabled=true;
 notify('rosterStatus','Opening encrypted 2026 roster…');
 try{
  const decrypted=await decryptRoster($('rosterPhrase').value);
  roster=decrypted.pupils;revision=decrypted.version;
  $('rosterPhrase').value='';
  $('unlockPane').hidden=true;$('register').hidden=false;$('handoff').hidden=false;
  notify('rosterStatus',roster.length+' pupils available.');
  draw();
 }catch(e){notify('rosterStatus',e.message)}
 finally{button.disabled=false}
});
$('rosterPhrase').addEventListener('keydown',e=>{if(e.key==='Enter')$('unlock').click()});
function selected(){
 const year=$('year').value,cls=$('classCode').value;
 return roster.filter(p=>p.year===year&&p.classCode===cls).sort((a,b)=>Number(a.examNo)-Number(b.examNo)||a.name.localeCompare(b.name));
}
function updateTotals(){
 const current=selected(),draft=readDraft(),absent=new Set(draft.absent);
 $('total').textContent=current.length;
 $('absent').textContent=current.filter(p=>absent.has(p.id)).length;
 $('present').textContent=current.length-Number($('absent').textContent);
}
function draw(){
 const current=selected(),draft=readDraft(),absent=new Set(draft.absent);
 $('rosterMeta').textContent='2026 roster · '+revision;
 const list=$('pupils');list.replaceChildren();
 if(!current.length){notify('deliveryStatus','No pupils found in this class. Check year/class.');updateTotals();return}
 for(const pupil of current){
  const card=document.createElement('div');card.className='pupil';
  let isAbsent=absent.has(pupil.id);
  card.classList.toggle('is-absent',isAbsent);
  const label=document.createElement('label');label.className='pupil-row';
  const box=document.createElement('input');box.type='checkbox';box.checked=!isAbsent;
  box.setAttribute('aria-label',pupil.name+' present');
  const no=document.createElement('span');no.className='pupil-no';no.textContent=pupil.examNo;
  const name=document.createElement('strong');name.className='pupil-name';name.textContent=pupil.name;
  const state=document.createElement('span');state.className='pupil-state';state.textContent=isAbsent?'Absent':'Present';
  label.append(box,no,name,state);
  const reason=document.createElement('input');reason.className='reason';reason.type='text';
  reason.maxLength=140;reason.placeholder='Optional absence reason (verify KPM category)';
  reason.setAttribute('aria-label','Absence reason for '+pupil.name);
  reason.value=draft.reasons[pupil.id]||'';reason.hidden=!isAbsent;
  box.addEventListener('change',()=>{
   const now=readDraft(),set=new Set(now.absent);
   if(box.checked){set.delete(pupil.id);delete now.reasons[pupil.id]}
   else set.add(pupil.id);
   now.absent=[...set];writeDraft(now);draw();
  });
  reason.addEventListener('input',()=>{
   const now=readDraft();now.reasons[pupil.id]=reason.value;writeDraft(now);
  });
  card.append(label,reason);list.append(card);
 }
 updateTotals();
}
for(const id of ['date','year','classCode'])$(id).addEventListener('change',()=>{
 notify('deliveryStatus','Changes are local; press Send to Master when ready.');
 draw();
});
$('markAll').addEventListener('click',()=>{
 if(!confirm('Mark every pupil present for this class and date?'))return;
 writeDraft({absent:[],reasons:{}});draw();
});
$('forget').addEventListener('click',()=>{
 $('pairing').value='';$('rememberPair').checked=false;
 try{sessionStorage.removeItem(PAIR_MEMORY);localStorage.removeItem(PAIR_MEMORY)}catch{}
 updatePairFeedback();stopQr();notify('deliveryStatus','Receiver pairing cleared from this guest device.');
});
$('send').addEventListener('click',async()=>{
 if(busy||!roster.length)return;
 const current=selected();
 if(!current.length){notify('deliveryStatus','Choose a class with registered pupils.');return}
 const drafts=readDraft(),absent=new Set(drafts.absent);
 let codes=[];
 try{
  codes=readPairs();
  if(!codes.length)throw Error('Pair the Master phone using QR, clipboard or manual entry first.');
 }catch(e){notify('deliveryStatus',e.message);return}
 const date=$('date').value,year=$('year').value,classCode=$('classCode').value;
 if(!/^20\d\d-\d\d-\d\d$/.test(date)){notify('deliveryStatus','Select a valid date.');return}
 const payload={schema:'smadbod.attendance.v1',source:'smadbod-guest',rosterVersion:revision,
  date,year,classCode,className:LABELS[classCode],preparedAt:new Date().toISOString(),
  pupils:current.map(p=>({id:p.id,examNo:p.examNo,name:p.name,present:!absent.has(p.id),
    reason:absent.has(p.id)?String(drafts.reasons[p.id]||'').trim().slice(0,140):''}))};
 const count=payload.pupils.filter(p=>!p.present).length;
 if(!confirm('Send '+date+' · Year '+year+' '+LABELS[classCode]+' to '+codes.length+' Master/PC device(s)?\n'+(current.length-count)+' present · '+count+' absent.\nOfficial KPM attendance will NOT be changed by this action.'))return;
 busy=true;$('send').disabled=true;
 let delivered=0;const errors=[];
 for(let i=0;i<codes.length;i++){
  notify('deliveryStatus','Encrypting and sending to receiver '+(i+1)+' of '+codes.length+'…');
  try{await submitAttendance(codes[i],payload);delivered++}
  catch(e){errors.push('Device '+(i+1)+': '+e.message)}
 }
 if(delivered){
  try{
   if($('rememberPair').checked)localStorage.setItem(PAIR_MEMORY,codes.join('\n'));
   else localStorage.removeItem(PAIR_MEMORY);
   sessionStorage.setItem(PAIR_MEMORY,codes.join('\n'));
  }catch{}
 }
 notify('deliveryStatus',delivered+' of '+codes.length+' encrypted handoffs queued. '+(delivered?'Awaiting HOST review; KPM remains unchanged. ':'')+(errors.length?errors.join('; '):''));
 busy=false;$('send').disabled=false;
});

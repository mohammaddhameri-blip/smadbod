'use strict';
const el=id=>document.getElementById(id);
const request=message=>chrome.runtime.sendMessage(message);
function status(message){el('status').textContent=message}
async function render(){
 const {pairCode,pending=[]}=await chrome.storage.local.get(['pairCode','pending']);
 el('pairCode').value=pairCode||'';
 const area=el('pending');area.replaceChildren();
 if(!pairCode){status('Click New pairing, then copy the code into Skorskal on your attendance device.');return}
 if(!pending.length){area.textContent='No attendance waiting for review.';return}
 for(const packet of pending){
   const absent=packet.pupils.filter(p=>!p.present).length;
   const row=document.createElement('div');row.className='item';
   const title=document.createElement('strong');
   title.textContent='Year '+packet.year+' '+packet.className+' · '+packet.date;
   const info=document.createElement('p');
   info.textContent=packet.pupils.length+' pupils · '+absent+' absent';
   const open=document.createElement('button');open.textContent='Open MOEIS';open.onclick=async()=>{const res=await request({type:'OPEN',id:packet.id});if(!res.ok)status(res.error);else window.close()};
   const dismiss=document.createElement('button');dismiss.textContent='Dismiss';dismiss.title='Remove this bridge notification; does not mark KPM attendance';dismiss.onclick=async()=>{
     if(!confirm('Dismiss this handoff? This does not confirm attendance in MOEIS.'))return;
     const r=await request({type:'DISMISS',id:packet.id});status(r.ok?'Removed from bridge inbox.':r.error);await render()
   };
   row.append(title,info,open,dismiss);area.append(row);
 }
}
el('newPair').addEventListener('click',async()=>{
 const current=(await chrome.storage.local.get('pairCode')).pairCode;
 if(current&&!confirm('Replace current pairing? Other devices must use the new code.'))return;
 const r=await request({type:'CREATE_PAIR'});
 if(!r.ok)status(r.error);else{status('Pairing created. Copy this code to Skorskal.');await render()}
});
el('copyPair').addEventListener('click',async()=>{
 const code=el('pairCode').value;if(!code){status('Create a pairing first.');return}
 try{await navigator.clipboard.writeText(code);status('Code copied. Paste into Skorskal → Pupils → SMADBOD Attendance Bridge.')}
 catch{el('pairCode').select();status('Please copy the selected code manually.')}
});
el('checkNow').addEventListener('click',async()=>{
 status('Checking encrypted inbox…');const r=await request({type:'POLL'});
 status(r.ok?'Inbox checked: '+r.count+' pending.':r.error);await render();
});
render().catch(e=>status(String(e)));

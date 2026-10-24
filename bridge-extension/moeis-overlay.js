// Read-only attendance overlay inside the official MOEIS browser page.
// This deliberately does NOT inspect or edit KPM form controls.
(()=>{'use strict';
 const ROOT_ID='smadbod-attendance-preview';
 let lastId='';
 function node(tag,txt,style){
   const el=document.createElement(tag);if(txt!==undefined)el.textContent=txt;
   if(style)el.style.cssText=style;return el;
 }
 function render(packet){
   const prior=document.getElementById(ROOT_ID);
   if(!packet){if(prior)prior.remove();lastId='';return}
   if(prior&&lastId===packet.id)return;
   prior?.remove();lastId=packet.id;
   const host=node('aside');host.id=ROOT_ID;
   host.style.cssText='all:initial;position:fixed;z-index:2147483600;right:14px;top:90px;width:min(350px,calc(100vw - 24px));max-height:78vh;overflow:auto;background:#fdfcf8;color:#18382c;border:2px solid #2c6247;border-radius:12px;box-shadow:0 10px 35px #0019;font:13px system-ui,-apple-system,sans-serif;';
   const heading=node('div',undefined,'background:#21523b;color:white;padding:10px 13px;display:flex;justify-content:space-between;align-items:center;gap:10px');
   const title=node('strong','SMADBOD · Attendance review');
   const collapse=node('button','−','background:#fff;color:#1d4531;border:0;border-radius:5px;font:700 18px system-ui;cursor:pointer;padding:2px 9px');
   heading.append(title,collapse);host.append(heading);
   const content=node('div',undefined,'padding:12px');
   const absent=packet.pupils.filter(p=>p.present===false);
   content.append(node('strong','Year '+packet.year+' '+packet.className+' · '+packet.date));
   content.append(node('p',packet.pupils.length+' pupils · '+(packet.pupils.length-absent.length)+' present · '+absent.length+' absent','margin:6px 0'));
   if(!absent.length)content.append(node('p','All pupils marked present in SMADBOD/Skorskal.','margin:10px 0'));
   else{
     const head=node('p','ABSENT PUPILS','font-weight:bold;margin:11px 0 5px;color:#345e48');content.append(head);
     const list=node('ol',undefined,'padding-left:22px;max-height:260px;overflow-y:auto;margin:5px 0 10px;line-height:1.5');
     for(const pupil of absent){
       const item=node('li',String(pupil.examNo)+' · '+pupil.name+(pupil.reason?' — '+pupil.reason:''));
       list.append(item);
     }
     content.append(list);
   }
   const warning=node('p','PRIVATE PREVIEW ONLY. Attendance has NOT been entered, saved or approved in MOEIS. Review the official class/date/pupils and submit using MOEIS.','font-size:11px;color:#80532e;margin:10px 0;line-height:1.5');
   content.append(warning);
   const dismiss=node('button','Hide preview','border:1px solid #c1d5c6;border-radius:6px;background:#eef7f0;padding:7px 10px;cursor:pointer;color:#184d30');
   dismiss.addEventListener('click',()=>host.remove());content.append(dismiss);
   collapse.addEventListener('click',()=>{content.hidden=!content.hidden;collapse.textContent=content.hidden?'+':'−'});
   host.append(content);document.documentElement.append(host);
 }
 async function sync(){
   try{const {activePacket,pending=[]}=await chrome.storage.local.get(['activePacket','pending']);render(pending.find(p=>p.id===activePacket)||null)}
   catch(e){console.warn('SMADBOD preview unavailable',String(e).slice(0,60))}
 }
 chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&(changes.activePacket||changes.pending))sync()});
 sync();
})();
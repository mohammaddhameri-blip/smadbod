(() => {
'use strict';
const $ = (id) => document.getElementById(id);
const catalog = window.SMADBOD_CATALOG || [];
const boardKey = 'smadbod:boards:v1';
const currentKey = 'smadbod:active-board:v1';
const assignmentsKey = 'smadbod:homework-drafts:v1';
const uuid = () => (globalThis.crypto?.randomUUID?.() || 'id-'+Date.now()+'-'+Math.random().toString(36).slice(2));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeStore = (key, value) => {try{localStorage.setItem(key, JSON.stringify(value));return true}catch{toast('Storage is full or unavailable. Please export your board.');return false}};
const safeRead = (key, fallback) => {try {return JSON.parse(localStorage.getItem(key)) ?? fallback}catch{return fallback}};
let toastTimer; function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3000)}
function newBoard(name='Subject'){return {id:uuid(),name,items:[],updatedAt:Date.now()}}
let boards=safeRead(boardKey,[]);if(!Array.isArray(boards)||!boards.length)boards=[newBoard()];
let currentBoard=boards.find(b=>b.id===safeRead(currentKey,null)) || boards[0];
function uniqueName(input,ignoreId){
  const original=(String(input??'').trim().slice(0,80)||'Subject');
  const taken=n=>boards.some(b=>b.id!==ignoreId&&String(b.name).toLocaleLowerCase()===n.toLocaleLowerCase());
  if(!taken(original))return original;
  for(let i=2;i<10000;i++){const suffix=' '+i;const candidate=original.slice(0,80-suffix.length)+suffix;if(!taken(candidate))return candidate}
  return original+' '+Date.now()
}
// Existing saved boards are retained; only untouched legacy default titles migrate.
for(const b of boards){if(['Untitled board','New board'].includes(b.name)){b.name=uniqueName('Subject',b.id)}}
let redoItems=[],saveTimer=null,tool='chalk',color='#f3f5eb',size=4,gesture=null,awaitingText=null;
const canvas=$('chalkCanvas'),frame=$('boardFrame'),ctx=canvas.getContext('2d');
function boardItems(){return currentBoard.items}
function persistBoard(){currentBoard.updatedAt=Date.now();safeStore(boardKey,boards);safeStore(currentKey,currentBoard.id)}
function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(persistBoard,300)}
function refreshBoardHeader(){$('subjectDisplay').textContent=currentBoard.name;$('subjectDisplay').title='Rename '+currentBoard.name;$('emptyBoard').hidden=boardItems().length>0;$('undo').disabled=!boardItems().length;$('redo').disabled=!redoItems.length}
function pos(e){const r=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))}}
function sizeScale(){return Math.min(frame.clientWidth,frame.clientHeight)/650}
function paintStroke(item){if(!item.points?.length)return;ctx.save();ctx.globalCompositeOperation=item.kind==='eraser'?'destination-out':'source-over';ctx.strokeStyle=item.kind==='eraser'?'#000':item.color;ctx.lineWidth=Math.max(1,item.size*sizeScale()*(item.kind==='eraser'?3:1));ctx.lineCap='round';ctx.lineJoin='round';ctx.globalAlpha=item.kind==='eraser'?1:0.92;ctx.beginPath();item.points.forEach((p,i)=>i?ctx.lineTo(p.x*frame.clientWidth,p.y*frame.clientHeight):ctx.moveTo(p.x*frame.clientWidth,p.y*frame.clientHeight));if(item.points.length===1){const p=item.points[0];ctx.lineTo((p.x*frame.clientWidth)+0.1,p.y*frame.clientHeight+0.1)}ctx.stroke();ctx.restore()}
function paintText(item){ctx.save();ctx.globalAlpha=.94;ctx.fillStyle=item.color;ctx.font=`600 ${Math.max(18,item.size*sizeScale()*9)}px "Segoe UI",sans-serif`;ctx.textBaseline='top';const lines=String(item.text).split('\n');const lineHeight=Math.max(25,item.size*sizeScale()*11);lines.forEach((line,i)=>ctx.fillText(line,item.x*frame.clientWidth,(item.y*frame.clientHeight)+i*lineHeight,frame.clientWidth*(1-item.x)-10));ctx.restore()}
function redraw(){const w=frame.clientWidth,h=frame.clientHeight;ctx.clearRect(0,0,w,h);for(const item of boardItems()){if(item.kind==='text')paintText(item);else paintStroke(item)}refreshBoardHeader()}
function resize(){const w=Math.max(100,frame.clientWidth),h=Math.max(100,frame.clientHeight),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);redraw()}
new ResizeObserver(resize).observe(frame);
canvas.addEventListener('pointerdown',e=>{if(e.button!==0 && e.pointerType==='mouse')return;e.preventDefault();if(tool==='text'){
  if(awaitingText){currentBoard.items.push({kind:'text',text:awaitingText,color,size:Math.max(size,5),...pos(e)});awaitingText=null;redoItems=[];scheduleSave();redraw();toast('Text placed on blackboard')}
  else $('textDialog').showModal();return;
}canvas.setPointerCapture(e.pointerId);gesture={kind:tool,color,size,points:[pos(e)]};boardItems().push(gesture);redoItems=[];redraw()});
canvas.addEventListener('pointermove',e=>{if(!gesture)return;gesture.points.push(pos(e));redraw()});
const endGesture=e=>{if(!gesture)return;if(e?.pointerId!=null && canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);gesture=null;scheduleSave();redraw()};
canvas.addEventListener('pointerup',endGesture);canvas.addEventListener('pointercancel',endGesture);
function chooseTool(next){tool=next;document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));if(next==='text'){$('textDialog').showModal();$('chalkText').focus()}}
document.querySelectorAll('[data-tool]').forEach(el=>el.addEventListener('click',()=>chooseTool(el.dataset.tool)));
document.querySelectorAll('[data-color]').forEach(el=>el.addEventListener('click',()=>{color=el.dataset.color;document.querySelectorAll('[data-color]').forEach(e=>e.classList.toggle('chosen',e===el));if(tool==='eraser')chooseTool('chalk')}));
$('chalkWidth').addEventListener('input',e=>{size=Number(e.target.value)});
$('insertText').addEventListener('click',()=>{const text=$('chalkText').value.trim();if(!text){toast('Please type something first');return}awaitingText=text;$('textDialog').close();$('chalkText').value='';toast('Tap the blackboard to place your text')});
$('undo').addEventListener('click',()=>{if(!boardItems().length)return;redoItems.push(boardItems().pop());redraw();scheduleSave()});
$('redo').addEventListener('click',()=>{if(!redoItems.length)return;boardItems().push(redoItems.pop());redraw();scheduleSave()});
$('clearBoard').addEventListener('click',()=>{if(!boardItems().length)return;if(confirm('Clear everything on this board?')){currentBoard.items=[];redoItems=[];redraw();scheduleSave()}});
function openSavedBoards(){const list=$('savedBoardList');list.innerHTML='';boards.slice().sort((a,b)=>b.updatedAt-a.updatedAt).forEach(b=>{const row=document.createElement('div');row.className='saved-board';const open=document.createElement('button');open.type='button';open.textContent=b.name+(b.id===currentBoard.id?' ✓':'');open.onclick=()=>{persistBoard();currentBoard=b;redoItems=[];$('boardDialog').close();resize();persistBoard()};const del=document.createElement('button');del.type='button';del.className='delete';del.textContent='Delete';del.setAttribute('aria-label','Delete '+b.name);del.onclick=()=>{if(boards.length===1){toast('Keep at least one blackboard');return}if(!confirm(`Delete board “${b.name}”?`))return;boards=boards.filter(x=>x.id!==b.id);if(currentBoard.id===b.id)currentBoard=boards[0];persistBoard();resize();openSavedBoards()};row.append(open,del);list.append(row)});$('boardDialog').showModal()}
$('boardList').addEventListener('click',openSavedBoards);
$('exportBoard').addEventListener('click',()=>{const exported=document.createElement('canvas');exported.width=canvas.width;exported.height=canvas.height;const c=exported.getContext('2d');c.fillStyle='#173a30';c.fillRect(0,0,exported.width,exported.height);c.drawImage(canvas,0,0);const a=document.createElement('a');a.href=exported.toDataURL('image/png');a.download=(currentBoard.name.replace(/[^a-z0-9 -]/gi,'').trim()||'smadbod-board')+'.png';a.click();toast('Blackboard exported as a PNG picture')});
$('newBoard').addEventListener('click',()=>{persistBoard();currentBoard=newBoard(uniqueName('Subject'));boards.push(currentBoard);redoItems=[];persistBoard();resize();$('boardDialog').close();toast('Created '+currentBoard.name)});
$('saveBoard').addEventListener('click',()=>{clearTimeout(saveTimer);persistBoard();toast('Saved '+currentBoard.name+' on this device')});

// Edit board name directly by tapping the subject heading. Enter or blur commits; Escape cancels.
const subjectDisplay=$('subjectDisplay'),subjectInput=$('subjectInput');
subjectDisplay.addEventListener('click',()=>{
  subjectInput.value=currentBoard.name;subjectDisplay.hidden=true;subjectInput.hidden=false;
  subjectInput.focus();subjectInput.select();
});
subjectInput.addEventListener('blur',()=>{
  if(subjectInput.hidden)return;
  currentBoard.name=uniqueName(subjectInput.value,currentBoard.id);
  subjectInput.hidden=true;subjectDisplay.hidden=false;
  refreshBoardHeader();scheduleSave();
});
subjectInput.addEventListener('keydown',e=>{
  if(e.key==='Enter'){e.preventDefault();subjectInput.blur()}
  if(e.key==='Escape'){e.preventDefault();subjectInput.hidden=true;subjectDisplay.hidden=false;subjectInput.value=currentBoard.name;subjectDisplay.focus()}
});
// Left tools remain open for 30 seconds after the latest panel interaction.
const leftTools=$('leftTools'),toggleTools=$('toggleTools'),toolOptions=$('toolOptions');
let toolsTimeout=null;
function setToolsOpen(open){
  clearTimeout(toolsTimeout);
  leftTools.classList.toggle('is-open',open);
  toggleTools.setAttribute('aria-expanded',String(open));
  toggleTools.setAttribute('aria-label',open?'Collapse drawing tools':'Expand drawing tools');
  toolOptions.setAttribute('aria-hidden',String(!open));
  if(open)toolsTimeout=setTimeout(()=>setToolsOpen(false),30000);
}
toggleTools.addEventListener('click',()=>setToolsOpen(!leftTools.classList.contains('is-open')));
for(const action of ['click','input','pointerdown','keydown']){
  toolOptions.addEventListener(action,()=>{if(leftTools.classList.contains('is-open'))setToolsOpen(true)});
}
document.querySelectorAll('[data-bottom-action]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.bottomAction).click()));
// Live analog clock and date always reflect the device's local time.
const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const shortDays=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const shortMonths=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function updateClockDate(){
  const d=new Date(), h=d.getHours(),m=d.getMinutes(),sec=d.getSeconds();
  $('hourHand').style.transform='rotate('+((h%12)*30+m/2+sec/120)+'deg)';
  $('minuteHand').style.transform='rotate('+(m*6+sec/10)+'deg)';
  $('secondHand').style.transform='rotate('+(sec*6)+'deg)';
  const n=d.getDate(),ordinal=((n%100>=11&&n%100<=13)?'th':({1:'st',2:'nd',3:'rd'}[n%10]||'th'));
  const compact=window.innerWidth<=760;
  const label=compact?shortDays[d.getDay()]+', '+n+' '+shortMonths[d.getMonth()]+' '+d.getFullYear():days[d.getDay()]+', '+n+ordinal+' '+months[d.getMonth()]+', '+d.getFullYear();
  const dateEl=$('liveDate');dateEl.textContent=label;
  dateEl.dateTime=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(n).padStart(2,'0');
  $('liveClock').setAttribute('aria-label','Current local time: '+d.toLocaleTimeString());
}
updateClockDate();setInterval(updateClockDate,1000);

window.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLSelectElement)return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();$('undo').click()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();persistBoard();toast('Blackboard saved on this device')}});
// Six rapid bell taps are a convenience gesture, NOT an access-control mechanism.
let taps=0,firstTap=0;const bell=$('bell');bell.addEventListener('click',()=>{const now=Date.now();if(!firstTap||now-firstTap>3000){firstTap=now;taps=0}taps++;$('bellDots').textContent='●'.repeat(taps);if(taps>=6){taps=0;firstTap=0;$('bellDots').textContent='';openLibrary()}else setTimeout(()=>{if(Date.now()-firstTap>=3000){taps=0;$('bellDots').textContent='';firstTap=0}},3100)});
function openLibrary(){persistBoard();$('chalkScreen').classList.add('hidden');$('library').classList.remove('hidden');$('library').setAttribute('aria-hidden','false');$('librarySearch').value='';renderTiles();window.scrollTo(0,0)}
$('backToBoard').addEventListener('click',()=>{$('library').classList.add('hidden');$('library').setAttribute('aria-hidden','true');$('chalkScreen').classList.remove('hidden');$('tileDetail').classList.add('hidden');resize()});
function renderTiles(){const q=$('librarySearch').value.toLowerCase().trim();const filtered=catalog.filter(t=>[t.label,t.description,...t.apps.map(a=>a.name)].join(' ').toLowerCase().includes(q));$('tiles').innerHTML=filtered.map(t=>`<button class="tile" data-id="${t.id}"><span class="tile-icon" aria-hidden="true">${t.icon}</span><span class="tile-label">${esc(t.label)}</span><span class="tile-sub">${esc(t.description)}</span><span class="tile-bottom"><span>${t.id==='homework'?'Assignments':t.apps.length+' resources'}</span><span>↗</span></span></button>`).join('')||'<p>No matching apps found.</p>';$('appCount').textContent=`${catalog.length} categories · ${catalog.reduce((acc,c)=>acc+c.apps.length,0)} listed resources`;$('tileDetail').classList.add('hidden');$('tiles').classList.remove('hidden');document.querySelectorAll('.tile').forEach(el=>el.addEventListener('click',()=>showTile(el.dataset.id)))}
$('librarySearch').addEventListener('input',renderTiles);
$('closeDetail').addEventListener('click',()=>{$('tiles').classList.remove('hidden');$('tileDetail').classList.add('hidden')});
function showTile(id){if(id==='attendance'){window.open('https://mohammaddhameri-blip.github.io/skorskal-omr/?attendance=1','_blank','noopener,noreferrer');return;}const t=catalog.find(x=>x.id===id);if(!t)return;$('tiles').classList.add('hidden');$('detailTitle').textContent=t.label;$('detailMeta').textContent='SMADBOD / '+t.label;$('tileDetail').classList.remove('hidden');$('detailContent').innerHTML=id==='homework'?homeworkHTML():`<div class="app-grid">${t.apps.map(app=>`<article class="app-card"><h3>${esc(app.name)}</h3><p>${esc(app.description)}</p><div class="card-links">${app.url?`<a class="link" href="${esc(app.url)}" target="_blank" rel="noopener noreferrer">Open webapp ↗</a>`:''}${app.repository?`<a class="link" href="${esc(app.repository)}" target="_blank" rel="noopener noreferrer">GitHub project ↗</a>`:''}${!app.url?'<span class="disabled-link">'+(app.pending?'App link not yet connected':'Published website link not verified')+'</span>':''}</div></article>`).join('')}</div>`;
if(id==='homework')setupHomework();window.scrollTo({top:0,behavior:'smooth'})}
function homeworkHTML(){return `<div class="important"><b>Prototype mode:</b> Assignments are saved <b>only on this device</b>. ClassBell notifications, photo uploads, pupil completion tracking, and scheduled reminders will become active only after a secure backend connection. No parents will receive anything from this prototype.</div>
<div class="homework-grid"><section class="hw-panel"><h3>✎ Create homework</h3><form id="homeworkForm"><div class="field-row"><label class="field">Year<select id="hwYear">${Array.from({length:6},(_,i)=>`<option value="${i+1}"${i===4?' selected':''}>Year ${i+1}</option>`).join('')}</select></label><label class="field">Subject<select id="hwSubject"><option>English</option><option>Bahasa Melayu</option><option>Mathematics</option><option>Science</option><option>Music</option><option>PJPK</option><option>Other</option></select></label></div><div class="field"><span>Assign to class(es)</span><div class="class-picks" id="classPicks"><button type="button" class="classpick selected" data-class="CEMERLANG" aria-pressed="true">Cemerlang ✓</button><button type="button" class="classpick" data-class="GEMILANG" aria-pressed="false">Gemilang</button><button type="button" class="classpick" data-class="TERBILANG" aria-pressed="false">Terbilang</button></div></div>
<label class="field">Homework title<input id="hwTitle" required maxlength="100" placeholder="Example: Unit 9 — Workbook page 45"></label><label class="field">Instructions<textarea id="hwInstructions" required maxlength="2000" placeholder="Write instructions for pupils and parents..."></textarea></label><label class="field">Due date and time<input id="hwDue" type="datetime-local" required></label><label class="field">Attach worksheet/photo/PDF (preview only)<input id="hwAttachments" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp"></label><div class="toggle-line"><div><b>🔔 Auto Reminder</b><small>OFF by default. Only parents of pupils still incomplete.</small></div><label class="toggle"><input id="hwAuto" type="checkbox" aria-label="Enable automatic reminders"><span id="reminderState">Off</span></label></div><div id="reminderOptions" class="hidden"><label class="field">Reminder schedule<select id="hwReminder"><option value="1day">1 day before deadline</option><option value="2days">2 days before deadline</option><option value="sameDay">Morning of deadline</option><option value="custom">Custom reminder date and time</option></select></label><label class="field hidden" id="customReminderWrapper">Custom reminder<input id="hwCustomReminder" type="datetime-local"></label></div><p class="small-note">Parents may optionally upload photo proof when marking homework Completed in ClassBell. Teacher verification is separate.</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="action-btn" type="submit">Save local draft</button><button id="hwPreview" class="secondary-btn" type="button">Preview ClassBell notification</button></div></form></section><section class="hw-panel"><h3>Assignment dashboard</h3><div class="status-tally"><div><b id="hwTotal">0</b><small>Local drafts</small></div><div><b>—</b><small>Completed</small></div><div><b>—</b><small>Teacher verified</small></div></div><p class="small-note">Live per-pupil statuses will be displayed here when ClassBell synchronisation is connected. Parent-completed and teacher-verified statuses will remain separate.</p><div id="draftList"></div></section></div>`}
let assignmentDrafts=safeRead(assignmentsKey,[]);if(!Array.isArray(assignmentDrafts))assignmentDrafts=[];
function classesSelected(){return [...document.querySelectorAll('.classpick.selected')].map(e=>e.dataset.class)}
function setupHomework(){const form=$('homeworkForm');document.querySelectorAll('.classpick').forEach(el=>el.addEventListener('click',()=>{el.classList.toggle('selected');el.setAttribute('aria-pressed',String(el.classList.contains('selected')));el.textContent=el.dataset.class.charAt(0)+el.dataset.class.slice(1).toLowerCase()+(el.classList.contains('selected')?' ✓':'')}));$('hwAuto').addEventListener('change',e=>{$('reminderOptions').classList.toggle('hidden',!e.target.checked);$('reminderState').textContent=e.target.checked?'On':'Off'});$('hwReminder').addEventListener('change',e=>$('customReminderWrapper').classList.toggle('hidden',e.target.value!=='custom'));const future=new Date(Date.now()+48*3600000);const pad=n=>String(n).padStart(2,'0');$('hwDue').value=[future.getFullYear(),pad(future.getMonth()+1),pad(future.getDate())].join('-')+'T15:00';form.addEventListener('submit',e=>{e.preventDefault();const classes=classesSelected();if(!classes.length){toast('Choose at least one class');return}const due=new Date($('hwDue').value);if(!Number.isFinite(due.valueOf())||due<=new Date()){toast('Choose a future due date');return}let reminder=null;if($('hwAuto').checked){const schedule=$('hwReminder').value;const custom=$('hwCustomReminder').value;if(schedule==='custom'&&(!custom||new Date(custom)<=new Date()||new Date(custom)>=due)){toast('Reminder must be before the due date and in the future');return}reminder={enabled:true,schedule,customAt:schedule==='custom'?new Date(custom).toISOString():null}}else reminder={enabled:false};const selectedFiles=[...$('hwAttachments').files].map(f=>({name:f.name,size:f.size}));const obj={id:uuid(),year:Number($('hwYear').value),classes,subject:$('hwSubject').value,title:$('hwTitle').value.trim(),instructions:$('hwInstructions').value.trim(),dueAt:due.toISOString(),reminder,files:[],createdAt:new Date().toISOString(),status:'local-draft'};if(!obj.title||!obj.instructions){toast('Enter title and instructions');return}assignmentDrafts.unshift(obj);safeStore(assignmentsKey,assignmentDrafts);renderDrafts();form.reset();document.querySelectorAll('.classpick').forEach((el,i)=>{el.classList.toggle('selected',i===0);el.setAttribute('aria-pressed',String(i===0));el.textContent=el.dataset.class.charAt(0)+el.dataset.class.slice(1).toLowerCase()+(i===0?' ✓':'')});$('reminderOptions').classList.add('hidden');$('reminderState').textContent='Off';if(selectedFiles.length)toast('Draft saved. Attachments were NOT uploaded or saved.');else toast('Homework draft saved locally — not sent to parents.');});$('hwPreview').addEventListener('click',()=>{const title=$('hwTitle').value.trim()||'Homework title';const classes=classesSelected().map(x=>$('hwYear').value+' '+x.charAt(0)).join(', ')||'No class selected';const due=$('hwDue').value||'not set';alert(`CLASSBELL NOTIFICATION PREVIEW (not sent)\n\n📚 ${title}\nClass(es): ${classes}\nSubject: ${$('hwSubject').value}\nDue: ${due.replace('T',' ')}\n\n${$('hwInstructions').value.trim()||'Homework instructions appear here.'}\n\n${$('hwAuto').checked?'Auto reminder: ON — only for incomplete pupils':'Auto reminder: OFF'}`)});renderDrafts()}
function renderDrafts(){const target=$('draftList');if(!target)return;$('hwTotal').textContent=assignmentDrafts.length;target.innerHTML=assignmentDrafts.length?assignmentDrafts.map(a=>`<article class="assignment"><h4>${esc(a.title)}</h4><p>Year ${a.year} · ${esc(a.classes.join(', '))} · ${esc(a.subject)}<br>Due: ${esc(new Date(a.dueAt).toLocaleString())}</p><span class="tag">DRAFT · NOT SENT</span> <span class="tag">Reminder ${a.reminder?.enabled?'ON':'OFF'}</span><button class="secondary-btn" style="float:right" data-del="${esc(a.id)}" type="button">Delete</button></article>`).join(''):'<p class="small-note">No homework drafts yet. Create your first assignment to preview the workflow.</p>';target.querySelectorAll('[data-del]').forEach(el=>el.addEventListener('click',()=>{if(!confirm('Delete this local homework draft?'))return;assignmentDrafts=assignmentDrafts.filter(a=>a.id!==el.dataset.del);safeStore(assignmentsKey,assignmentDrafts);renderDrafts()}))}
persistBoard();resize();
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
})();
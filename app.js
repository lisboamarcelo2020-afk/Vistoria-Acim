'use strict';
const $=id=>document.getElementById(id), fields=['address','owner','date','time','type','code','purpose','inspector'];
let state={property:{},rooms:[]},editing=-1,db;
const uid=()=>crypto.randomUUID?.()||String(Date.now()+Math.random());
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const ACIM_LOGO='logo.jpg';
function acimHead(t){return `<div class="acim-head"><img src="${ACIM_LOGO}" alt="ACIM Imóveis"><div><h1>${escape(t)}</h1><p>ACIM Imóveis • CRECI 22335</p></div></div>`}
function acimContacts(){return `Rua Egas Bueno, 540 – Centro – Jaguariúna/SP<br>(19) 99451-1865 • (19) 3937-4700 • acim@acimimoveis.com.br • www.acimimoveis.com.br`}

function show(id){if(id!=='editor')$('photoList').replaceChildren();if(id!=='result')$('print').replaceChildren();if(id!=='compare'){$('comparePrint').replaceChildren();$('compareList').replaceChildren()}['home','property','rooms','editor','result','library','compare'].forEach(x=>$(x).classList.toggle('hidden',x!==id));scrollTo(0,0)}
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open('vistoria-acim',1);r.onupgradeneeded=()=>r.result.createObjectStore('data');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function get(key){return new Promise((res,rej)=>{const q=db.transaction('data').objectStore('data').get(key);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})}
function put(key,val){return new Promise((res,rej)=>{const tx=db.transaction('data','readwrite');tx.objectStore('data').put(val,key);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error||new Error('Gravação interrompida'))})}
async function persist(){try{syncHighlightNames();if(state.inspectionId||Object.keys(state.property||{}).length||state.rooms?.length)await acimEnsureNumber(state);await put('draft',JSON.parse(JSON.stringify(state,(k,v)=>k==='aiPending'?undefined:v)));$('resume').disabled=false;return true}catch(e){alert('Não foi possível salvar os dados neste aparelho. Exporte uma cópia antes de sair.');return false}}
function fillProperty(){fields.forEach(f=>$(f).value=state.property[f]||'');const locked=state.status==='finalizada'||!!state.finalizedAt;$('code').readOnly=locked;$('code').setAttribute('aria-readonly',String(locked));$('codeHint').textContent=locked?'Código bloqueado: esta vistoria já foi finalizada.':'Pode ser alterado até a finalização.';$('inspectionNumber').textContent=acimNumber(state);$('inspectionStatus').value=state.status==='finalizada'?'finalizada':state.status==='aguardando'?'aguardando':'andamento';$('inspectionStatus').disabled=locked}

function collectProperty(){fields.forEach(f=>{if(f==='code'&&(state.status==='finalizada'||state.finalizedAt))return;state.property[f]=$(f).value.trim()});if(state.status!=='finalizada'&&!state.finalizedAt)state.status=$('inspectionStatus').value}
function validateProperty(){collectProperty();for(const f of ['address','owner','date','type','code','purpose'])if(!state.property[f]){alert('Preencha os campos obrigatórios.');$(f).focus();return false}return true}
function renderRooms(){const out=$('roomList');out.innerHTML='';state.rooms.forEach((r,i)=>{const d=document.createElement('div');d.className='room';if(r.parentRoomId)d.style.marginLeft='18px';const label=document.createElement('span');label.textContent=`${i+1}. ${r.name||'Sem nome'} · ${r.photos.length} foto(s)`;const b=document.createElement('button');b.className='secondary';b.textContent='Editar';b.onclick=()=>openEditor(i);d.append(label,b);out.append(d)});if(!state.rooms.length)out.innerHTML='<p class="hint">Nenhum cômodo registrado ainda.</p>'}
function openEditor(i){editing=i;$('editorTitle').textContent=i<0?'Novo cômodo':state.rooms[i].parentRoomId?state.rooms[i].name:`Editar cômodo ${i+1}`;$('roomName').value=i<0?'':state.rooms[i].name;$('notes').value=i<0?'':state.rooms[i].notes;$('highlightPositive').value=i<0?'':state.rooms[i].highlights?.positive||'';$('highlightNegative').value=i<0?'':state.rooms[i].highlights?.negative||'';$('analyze').disabled=!!state.rooms[i]?.aiPending;$('aiStatus').textContent='Analise somente fotos deste ambiente e revise a descrição.';$('photos').value='';$('deleteRoom').classList.toggle('hidden',i<0);const parent=state.rooms.find(r=>r.id===currentRoom()?.parentRoomId);$('roomName').readOnly=!!parent;$('backToParentRoom').classList.toggle('hidden',!parent);$('parentDescription').classList.toggle('hidden',!parent);$('parentDescriptionText').textContent=parent?.notes||'Sem descrição registrada no ambiente principal.';renderPhotos();show('editor')}
function currentRoom(){return editing<0?null:state.rooms[editing]}
function collectRoomHighlights(room){if(!room.parentRoomId)return;room.highlights={positive:$('highlightPositive').value.trim(),negative:$('highlightNegative').value.trim()}}
function syncHighlightNames(){for(const room of state.rooms||[]){if(!room.parentRoomId)continue;const parent=state.rooms.find(r=>r.id===room.parentRoomId);if(parent)room.name=parent.name+' — DESTAQUES'}}
function renderRoomHighlights(){
 const room=currentRoom(),isHighlights=!!room?.parentRoomId;
 $('roomHighlightsTitle').textContent=isHighlights?room.name:($('roomName').value.trim()||room?.name||'Ambiente')+' — DESTAQUES';
 $('highlightsQuestion').textContent=isHighlights?'Quais evidências positivas e negativas você deseja destacar?':'Deseja registrar os destaques positivos e negativos deste ambiente?';
 $('openRoomHighlights').classList.toggle('hidden',isHighlights);
 $('highlightEvidenceFields').classList.toggle('hidden',!isHighlights);
 const hasText=$('highlightPositive').value.trim()||$('highlightNegative').value.trim();
 $('roomHighlights').classList.toggle('hidden',!isHighlights&&!room?.photos?.length&&!hasText);
}
async function openRoomHighlights(){
 const button=$('openRoomHighlights');if(button.disabled)return;button.disabled=true;
 try{
  const parent=await captureEditor();if(!parent||parent.parentRoomId)return;
  let child=state.rooms.find(r=>r.parentRoomId===parent.id);
  if(!child){child={id:uid(),parentRoomId:parent.id,name:parent.name+' — DESTAQUES',notes:'',photos:[],highlights:{positive:'',negative:''}};state.rooms.splice(state.rooms.indexOf(parent)+1,0,child)}
  if(!await persist())return;openEditor(state.rooms.indexOf(child));
 }finally{button.disabled=false}
}
$('openRoomHighlights').onclick=openRoomHighlights;
$('backToParentRoom').onclick=async()=>{const child=await captureEditor();if(!child)return;const index=state.rooms.findIndex(r=>r.id===child.parentRoomId);if(index>=0)openEditor(index)};
function reportRoomHighlights(room){
 const positive=String(room?.highlights?.positive||'').trim(),negative=String(room?.highlights?.negative||'').trim();
 if(!positive&&!negative)return '';
 return `<h3>${escape(room.parentRoomId?'Evidências positivas e negativas':(room.name||'Ambiente')+' — DESTAQUES')}</h3>`+
  (positive?`<p><strong>Evidências positivas:</strong> ${escape(positive)}</p>`:'')+
  (negative?`<p><strong>Evidências negativas / pontos de atenção:</strong> ${escape(negative)}</p>`:'');
}

function renderPhotos(){const el=$('photoList');el.innerHTML='';const room=currentRoom();(room?.photos||[]).forEach((p,i)=>{const d=document.createElement('div');d.className='photo';const img=document.createElement('img');img.src=p.thumbnail||p.data;img.loading='lazy';img.alt=`Foto ${i+1}`;const b=document.createElement('button');b.textContent='×';b.setAttribute('aria-label','Excluir foto');b.onclick=async()=>{if(!confirm('Excluir esta foto?'))return;room.photos.splice(i,1);room.analysisStale=true;await persist();renderPhotos()};d.append(img,b);el.append(d)});renderRoomHighlights()}
async function saveRoom(next){if(!await captureEditor())return;renderRooms();next?openEditor(-1):show('rooms')}
async function readPhoto(file){let source,url;const canvas=document.createElement('canvas');try{if(window.createImageBitmap){try{source=await createImageBitmap(file,{resizeWidth:1600,resizeQuality:'high'})}catch{}}if(!source){url=URL.createObjectURL(file);source=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Imagem incompatível. Use JPEG ou PNG.'));img.src=url})}const scale=Math.min(1,1600/source.width,1600/source.height);canvas.width=Math.max(1,Math.round(source.width*scale));canvas.height=Math.max(1,Math.round(source.height*scale));canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);const data=canvas.toDataURL('image/jpeg',.78),width=canvas.width,height=canvas.height;canvas.width=240;canvas.height=Math.max(1,Math.round(240*height/width));canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);return {data,thumbnail:canvas.toDataURL('image/jpeg',.65),width,height,name:file.name}}finally{source?.close?.();if(url)URL.revokeObjectURL(url);canvas.width=canvas.height=1}}
function formattedDate(s){if(!s)return '';const [y,m,d]=s.split('-').map(Number);return new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(y,m-1,d))}
function buildReport(){const p=state.property;let html=acimHead('Relatório de Vistoria de Imóvel')+`<div class="meta"><div><strong>Número da vistoria:</strong> ${escape(acimNumber(state))}</div><div><strong>Situação:</strong> ${escape(acimStatus(state))}</div>`;for(const [title,key] of [['Endereço','address'],['Proprietário','owner'],['Data e dia','date'],['Horário','time'],['Tipo de imóvel','type'],['Código','code'],['Finalidade','purpose'],['Responsável','inspector']])html+=`<div><strong>${title}:</strong> ${escape(key==='date'?formattedDate(p[key]):p[key]||'—')}</div>`;html+='</div><p>Registro descritivo baseado nas informações e fotos inseridas durante a vistoria.</p>';state.rooms.forEach((r,i)=>{html+=`<section class="p-room"><h2>${i+1}. ${escape(r.name)}</h2><p>${escape(r.notes)||'Sem observações registradas.'}</p>${reportRoomHighlights(r)}`;r.photos.forEach((photo,j)=>{html+=`<img class="report-photo" src="${escape(photo.data)}" alt="${escape(r.name)} - foto ${j+1}">`});html+='</section>'});html+=`<footer>${acimContacts()}<br><br>Relatório gerado em ${escape(new Date().toLocaleString('pt-BR'))}. As condições descritas devem ser conferidas pelo responsável antes do uso ou assinatura.<br><br>________________________________<br>Responsável pela vistoria</footer>`;$('print').innerHTML=html;$('summary').textContent=`${acimNumber(state)} · Imóvel ${p.code} · ${state.rooms.length} cômodo(s) · ${state.rooms.reduce((n,r)=>n+r.photos.length,0)} foto(s)`}
$('new').onclick=async()=>{if(state.rooms.length&&!confirm('Iniciar uma nova vistoria? O rascunho atual será substituído. Exporte uma cópia se precisar guardá-lo.'))return;if(!await acimArchiveCurrent(state.status||'andamento'))return;state={property:{date:new Date().toLocaleDateString('en-CA')},rooms:[],status:'aguardando',inspectionId:uid(),createdAt:new Date().toISOString()};if(!await persist())return;fillProperty();show('property')};
$('resume').onclick=()=>{fillProperty();if(state.rooms&&state.rooms.length){renderRooms();show('rooms')}else show(Object.keys(state.property).length?'property':'home')};$('backHome').onclick=async()=>{collectProperty();await persist();show('home')};
$('toRooms').onclick=async()=>{if(!validateProperty())return;if(state.status!=='finalizada')state.status='andamento';await persist();renderRooms();show('rooms')};$('editProperty').onclick=()=>{fillProperty();show('property')};
$('addRoom').onclick=()=>openEditor(-1);$('saveNext').onclick=()=>saveRoom(true);$('saveBack').onclick=()=>saveRoom(false);

$('saveExitRooms').onclick=async()=>{if(await persist()&&await acimArchiveCurrent(state.status||'andamento'))show('home')};
$('saveExit').onclick=async()=>{if(await captureEditor()&&await acimArchiveCurrent(state.status||'andamento'))show('home')};

$('deleteRoom').onclick=async()=>{const room=currentRoom();if(!room)return;const hasChild=state.rooms.some(r=>r.parentRoomId===room.id);if(!confirm(hasChild?'Excluir este ambiente, seus destaques e todas as fotos desses registros?':'Excluir este registro e suas fotos?'))return;state.rooms=state.rooms.filter(r=>r.id!==room.id&&r.parentRoomId!==room.id);await persist();renderRooms();show('rooms')};
$('analyze').onclick=async()=>{const room=currentRoom(),name=$('roomName').value.trim();if(!room?.photos.length)return alert('Adicione fotos deste cômodo antes de analisar.');if(!name)return alert('Informe o nome do cômodo.');if(room.photos.length>12)return alert('A IA aceita até 12 fotos por análise. Divida o registro em áreas menores.');if(room.aiPending)return;room.name=name;room.notes=$('notes').value.trim();collectRoomHighlights(room);const photos=room.photos.map(p=>p.data),notes=room.notes;room.aiPending=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),120000);$('analyze').disabled=true;$('aiStatus').textContent='Analisando os detalhes das fotos. Você pode aguardar ou continuar em outro ambiente.';try{const response=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({room:name,mode:room.parentRoomId?'highlights':'room',contextDescription:room.parentRoomId?String(state.rooms.find(r=>r.id===room.parentRoomId)?.notes||'').slice(0,10000):'',evidence:room.highlights||{},notes:room.declaredNotes??(room.aiGenerated||/Visível:/.test(notes)?'':notes),photos})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Falha na análise');if(!state.rooms.includes(room))return;const unchanged=room.photos.length===photos.length&&room.photos.every((p,i)=>p.data===photos[i])&&room.name===name&&room.notes===notes&&(!(currentRoom()===room)||$('notes').value.trim()===notes);if(!unchanged){if(currentRoom()===room)$('aiStatus').textContent='O cômodo foi alterado durante a análise. Analise novamente para usar as fotos e observações atuais.';return}room.declaredNotes=room.declaredNotes??(room.aiGenerated||/Visível:/.test(notes)?'':notes);room.notes=data.description;room.analysisStale=false;room.aiGenerated=true;if(currentRoom()===room){$('notes').value=data.description;$('aiStatus').textContent='Descrição criada para este cômodo. Confira e edite antes de finalizar.'}await persist()}catch(e){if(currentRoom()===room)$('aiStatus').textContent=e.name==='AbortError'?'A análise demorou demais. Tente novamente.':'Não foi possível analisar: '+e.message}finally{clearTimeout(timer);delete room.aiPending;if(currentRoom()===room)$('analyze').disabled=false}};
$('photos').onchange=async e=>{const files=[...e.target.files];if(!files.length)return;const room=await captureEditor();if(!room){e.target.value='';return}$('photos').disabled=true;try{for(const file of files){room.photos.push(await readPhoto(file));room.analysisStale=true;if(!await persist())break}if(currentRoom()===room)renderPhotos()}catch(err){alert('Não foi possível abrir uma das fotos: '+err.message)}finally{$('photos').disabled=false;e.target.value=''}};
$('finish').onclick=async()=>{if(!state.rooms.length)return alert('Adicione pelo menos um cômodo.');if(state.rooms.some(r=>r.aiPending))return alert('Aguarde a análise das fotos terminar.');const repeated=state.rooms.filter((r,i)=>r.notes?.trim()&&state.rooms.some((x,j)=>j<i&&x.notes?.trim()===r.notes.trim()));if(repeated.length&&!confirm('Há descrições iguais em cômodos diferentes: '+repeated.map(r=>r.name).join(', ')+'. Revise se correspondem às fotos. Continuar?'))return;const pending=state.rooms.filter(r=>!r.notes?.trim()||r.analysisStale);if(pending.length&&!confirm('Confira os ambientes sem descrição ou com fotos alteradas: '+pending.map(r=>r.name).join(', ')+'. Finalizar mesmo assim?'))return;if(!confirm('Finalizar esta vistoria? Você poderá reabrir depois.'))return;if(!await persist()||!await acimArchiveCurrent('finalizada'))return;buildReport();show('result')};$('pdf').onclick=async()=>{try{buildReport();await printReport('print')}catch(e){$('print').classList.remove('print-preparing');alert('Não foi possível preparar o PDF: '+e.message)}};$('editRooms').onclick=()=>{renderRooms();show('rooms')};$('fresh').onclick=()=>$('new').click();
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`vistoria-${state.property.code||'imovel'}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000)};
let recognition=null;
$('speak').onclick=()=>{if(recognition){recognition.stop();return}const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){alert('Este navegador não oferece ditado por voz. Use o microfone do teclado Android para escrever por voz.');return}recognition=new SR();recognition.lang='pt-BR';recognition.continuous=true;recognition.interimResults=false;recognition.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal)$('notes').value+=($('notes').value?' ':'')+e.results[i][0].transcript};recognition.onerror=e=>{if(e.error!=='no-speech')alert('Falha no reconhecimento de voz: '+e.error)};recognition.onend=()=>{$('speak').textContent='🎙️ Ditar observações';recognition=null};recognition.start();$('speak').textContent='Parar ditado'};

(async()=>{try{db=await openDB();state=await get('draft')||state;inspectionLibrary=await get(ACIM_LIBRARY_KEY)||[];if(!inspectionLibrary.length){let legacy;try{legacy=JSON.parse(localStorage.getItem(ACIM_LIBRARY_KEY)||'[]')}catch{legacy=[]}if(legacy.length){await acimSaveLibrary(legacy.map(x=>({id:x.id,status:x.status,createdAt:x.createdAt,updatedAt:x.updatedAt,property:x.property,data:x.data||x})));localStorage.removeItem(ACIM_LIBRARY_KEY)}}const recovery=sessionStorage.getItem('acim_camera_room');if(recovery){sessionStorage.removeItem('acim_camera_room');const index=state.rooms?.findIndex(r=>r.id===recovery);if(index>=0){openEditor(index);$('aiStatus').textContent='Rascunho recuperado. Se a câmera foi interrompida pelo celular, tire a foto pelo aplicativo Câmera e importe pela galeria.'}}state.rooms=state.rooms||[];await acimMigrateNumbers();fillProperty();$('resume').disabled=!Object.keys(state.property).length;if(location.protocol==='file:')$('aiStatus').textContent='Modo de teste local: cadastro, fotos e PDF funcionam; para analisar fotos com IA é necessário publicar e configurar o servidor.'}catch(e){alert('Seu navegador não permitiu salvar dados localmente. Ative o armazenamento do navegador e recarregue.')}if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{})})();


// ===== ACIM V2: biblioteca de múltiplas vistorias =====
const ACIM_LIBRARY_KEY='acim_inspections_v2';
let inspectionLibrary=[];const acimLoadLibrary=()=>inspectionLibrary;
const acimSaveLibrary=async v=>{await put(ACIM_LIBRARY_KEY,v);inspectionLibrary=v};
const acimInspectionId=()=>uid();
const acimNumber=v=>v.sequence?String(v.sequence).padStart(6,'0'):'Aguardando numeração';
const acimStatus=v=>v.status==='finalizada'||v.finalizedAt?'Finalizada':v.status==='aguardando'?'Aguardando':'Iniciada';
// The counter is shared atomically by tabs in this browser and never decreases.
const acimNumberPending=new WeakMap();
function acimEnsureNumber(v){
 if(v.sequence)return Promise.resolve();
 if(acimNumberPending.has(v))return acimNumberPending.get(v);
 const pending=new Promise((resolve,reject)=>{
  const tx=db.transaction('data','readwrite'),store=tx.objectStore('data');
  const req=store.get('acim_sequence_v1');let n;
  req.onsuccess=()=>{n=Number(req.result||0)+1;store.put(n,'acim_sequence_v1');};
  tx.oncomplete=()=>{v.sequence=n;v.inspectionId=v.inspectionId||uid();resolve()};
  tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Falha na numeração'));
 });
 acimNumberPending.set(v,pending);pending.finally(()=>acimNumberPending.delete(v)).catch(()=>{});return pending;
}
async function acimMigrateNumbers(){
 const lib=[...inspectionLibrary];let changed=false;
 const max=Math.max(0,...lib.map(x=>Number(x.sequence||x.data?.sequence||0)),Number(state.sequence||0));
 await new Promise((resolve,reject)=>{const tx=db.transaction('data','readwrite'),store=tx.objectStore('data'),q=store.get('acim_sequence_v1');q.onsuccess=()=>store.put(Math.max(max,Number(q.result||0)),'acim_sequence_v1');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});
 for(const item of [...lib].sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||'')))){
  item.sequence=item.sequence||item.data?.sequence;
  if(!item.sequence){await acimEnsureNumber(item);changed=true}
  if(item.data){item.data.sequence=item.sequence;if(item.status==='finalizada')item.data.finalizedAt=item.data.finalizedAt||item.updatedAt||new Date().toISOString()}
 }
 if(changed)await acimSaveLibrary(lib);
 if(Object.keys(state.property||{}).length||state.rooms.length){
  const item=lib.find(x=>x.id===state.inspectionId);if(item){state.sequence=item.sequence;if(item.status==='finalizada'){state.status='finalizada';state.finalizedAt=state.finalizedAt||item.updatedAt||new Date().toISOString()}}
  if(!state.status)state.status=state.rooms.length?'andamento':'aguardando';await persist();
 }
}

const acimSummary=(v)=>({
  id:v.id||acimInspectionId(),
  status:v.status||'andamento',
  createdAt:v.createdAt||new Date().toISOString(),
  updatedAt:new Date().toISOString(),
  property:v.property||{},
  rooms:v.rooms||[],
  data:v
});
async function acimArchiveCurrent(status='andamento'){
  if(!state || (!Object.keys(state.property||{}).length && !(state.rooms||[]).length)) return true;
  let lib=[...acimLoadLibrary()], id=state.inspectionId||acimInspectionId();
  state.inspectionId=id;state.status=state.finalizedAt||state.status==='finalizada'?'finalizada':status;if(state.status==='finalizada')state.finalizedAt=state.finalizedAt||new Date().toISOString();status=state.status;if(!await persist())return false;
  const data=JSON.parse(JSON.stringify({...state,id,status},(k,v)=>k==='aiPending'?undefined:v));let item={id,status,sequence:state.sequence,createdAt:state.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),property:data.property,data};state.createdAt=item.createdAt;
  let i=lib.findIndex(x=>x.id===id);
  if(i>=0) lib[i]=item; else lib.unshift(item);
  try{await acimSaveLibrary(lib);return await persist()}catch{alert('Não foi possível guardar a vistoria no histórico. Exporte os dados antes de sair.');return false}
}
async function acimOpenItem(id){
  id=decodeURIComponent(id);const item=acimLoadLibrary().find(x=>x.id===id); if(!item)return;
  state=JSON.parse(JSON.stringify(item.data||item)); state.inspectionId=item.id;state.sequence=item.sequence||state.sequence;if(item.status==='finalizada'){state.status='finalizada';state.finalizedAt=state.finalizedAt||item.updatedAt||new Date().toISOString()}
  if(await persist()){fillProperty();renderRooms();if(state.status==='finalizada'){buildReport();show('result')}else show('rooms')}
}
async function acimDeleteItem(id){
  id=decodeURIComponent(id);const item=acimLoadLibrary().find(x=>x.id===id);if(!item)return;
  const label=item.property?.code||item.data?.property?.code||item.property?.address||'sem código';
  if(prompt('Excluir a vistoria '+label+' e suas fotos do histórico deste aparelho?\nExporte uma cópia antes, se precisar guardá-la.\n\nDigite EXCLUIR para confirmar.','')!=='EXCLUIR')return;
  try{await acimSaveLibrary(acimLoadLibrary().filter(x=>x.id!==id))}catch{return alert('Não foi possível excluir. Tente novamente.')}acimRenderLibrary(window.__acimFilter||'all');
}
function acimRenderLibrary(filter='all'){
  window.__acimFilter=filter;
  const q=($('inspectionSearch')?.value||'').toLowerCase();
  const selected=filter==='all'?$('inspectionStatusFilter').value:filter;
  let lib=acimLoadLibrary().filter(x=>selected==='all'||x.status===selected);
  lib=lib.filter(x=>JSON.stringify(x.property||{}).toLowerCase().includes(q)||String(x.id).toLowerCase().includes(q)||String(x.createdAt).includes(q)||acimNumber(x).includes(q)||acimStatus(x).toLowerCase().includes(q));
  $('inspectionList').innerHTML=lib.length?lib.map(x=>{
    const p=x.property||{}, title=p.code||p.codigo||p.address||p.endereco||'Imóvel sem identificação';
    return `<div class="room-item"><div><strong>${escape(title)}</strong><br><small>Vistoria ${escape(acimNumber(x))} • ${escape(acimStatus(x))} • ${cmpRooms(x).length} cômodo(s)</small><br><small>Responsável: ${escape(p.inspector||'Não informado')}</small></div>
    <div class="actions"><button class="secondary" onclick="acimOpenItem('${escape(encodeURIComponent(x.id))}')">${x.status==='finalizada'?'Abrir relatório':'Continuar'}</button><button class="danger" onclick="acimDeleteItem('${escape(encodeURIComponent(x.id))}')">Excluir</button></div></div>`;
  }).join(''):'<p class="hint">Nenhuma vistoria encontrada.</p>';
}
async function acimShowLibrary(filter,title){
  if(!await acimArchiveCurrent(state.status||'andamento'))return;$('libraryTitle').textContent=title; $('inspectionSearch').value='';$('inspectionStatusFilter').value=filter; show('library'); acimRenderLibrary(filter);
}
window.acimOpenItem=acimOpenItem; window.acimDeleteItem=acimDeleteItem;
$('inspectionStatusFilter').addEventListener('change',()=>{window.__acimFilter='all';acimRenderLibrary('all')});
$('inspectionStatus').addEventListener('change',async()=>{collectProperty();await persist()});
$('inspectionSearch')?.addEventListener('input',()=>acimRenderLibrary(window.__acimFilter||'all'));
$('libraryBack')?.addEventListener('click',()=>show('home'));
$('openPending')?.addEventListener('click',()=>acimShowLibrary('all','Todas as vistorias'));
$('openHistory')?.addEventListener('click',()=>acimShowLibrary('finalizada','Vistorias finalizadas / Histórico'));
$('newInspection')?.addEventListener('click',()=>{acimArchiveCurrent(state.status||'andamento'); state={property:{},rooms:[],inspectionId:acimInspectionId()};persist();fillProperty();show('property')});



$('openCompare')?.addEventListener('click',()=>{show('compare');acimRenderCompare()});
$('compareBack')?.addEventListener('click',()=>show('home'));
$('compareSearch')?.addEventListener('input',acimRenderCompare);
function acimRenderCompare(){
  const q=($('compareSearch')?.value||'').toLowerCase();
  const lib=acimLoadLibrary().filter(x=>x.status==='finalizada' &&
    (JSON.stringify(x.property||{}).toLowerCase().includes(q)||String(x.id).toLowerCase().includes(q)));
  const list=$('compareList');
  list.innerHTML=lib.length?lib.map(x=>`
    <label class="room-item"><input type="checkbox" class="cmpPick" value="${escape(x.id)}">
    <span><strong>${escape(x.property?.code||x.property?.address||x.id)}</strong><br>
    <small>${escape(x.id)} • ${new Date(x.updatedAt||x.createdAt).toLocaleDateString('pt-BR')}</small></span></label>`).join('')+
    `<div class="actions"><button id="doCompare">Comparar selecionadas</button></div>`:
    '<p class="hint">Nenhuma vistoria finalizada encontrada.</p>';
  $('doCompare')?.addEventListener('click',()=>{
    const ids=[...list.querySelectorAll('.cmpPick:checked')].map(x=>x.value);
    if(ids.length!==2)return alert('Selecione exatamente duas vistorias.');
    const selected=ids.map(id=>lib.find(x=>String(x.id)===id));
    const key=x=>String(x.property?.code||x.property?.address||'').trim().toLowerCase();
    if(!key(selected[0])||key(selected[0])!==key(selected[1]))return alert('Selecione duas vistorias do mesmo imóvel.');
    selected.sort((a,b)=>String((a.property?.date||'')+' '+(a.property?.time||'')).localeCompare(String((b.property?.date||'')+' '+(b.property?.time||'')))||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
    renderComparison(selected[0],selected[1]);
  });
}
function cmpRooms(v){return v.rooms||v.data?.rooms||[]}
function cmpKey(r){return String(r?.name||'').trim().toLowerCase()}
function renderComparison(a,b){
  const list=$('compareList'),ra=cmpRooms(a),rb=cmpRooms(b);
  const names=[...new Set([...ra.map(cmpKey),...rb.map(cmpKey)])].filter(Boolean);
  const find=(arr,n)=>arr.find(r=>cmpKey(r)===n);
  const opts=['Sem alteração aparente','Melhorado','Reparado','Desgaste natural','Dano / avaria','Necessita manutenção','Substituído','Removido','Instalado','Não foi possível comparar','Revisar pelo vistoriador'];
  const photos=r=>(r?.photos||[]).map((p,i)=>`<img src="${escape(p.data)}" alt="Foto ${i+1}" style="display:block;width:100%;height:auto;margin:8px 0;border-radius:8px">`).join('')||'<p class="hint">Sem fotos.</p>';
  list.innerHTML=`<div class="status"><strong>Comparativo:</strong> ${escape(b.property?.code||a.property?.code||'')} — ${escape(b.property?.address||a.property?.address||'')}</div>
  <p class="hint">Revise cada classificação e observação antes de gerar o PDF.</p>`+
  names.map((n,i)=>{const x=find(ra,n),y=find(rb,n);const def=!x||!y?'Não foi possível comparar':'Revisar pelo vistoriador';return `
    <section class="card" data-cmp="${i}"><h2>${escape(y?.name||x?.name||n)}</h2>
    <label>Classificação da alteração</label><select class="cmpClass">${opts.map(o=>`<option ${o===def?'selected':''}>${o}</option>`).join('')}</select>
    <label>Observação comparativa do vistoriador</label><textarea class="cmpNote" placeholder="Descreva diferenças, reparos, desgaste ou outros pontos observados."></textarea>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px">
    <article style="min-width:0;padding:10px;border:1px solid #ddd;border-radius:10px"><strong>Anterior — ${escape(a.property?.date||'')}</strong><p style="white-space:pre-wrap">${escape(x?.notes||'Sem observações.')}</p>${reportRoomHighlights(x)}${photos(x)}</article>
    <article style="min-width:0;padding:10px;border:1px solid #ddd;border-radius:10px"><strong>Atual — ${escape(b.property?.date||'')}</strong><p style="white-space:pre-wrap">${escape(y?.notes||'Sem observações.')}</p>${reportRoomHighlights(y)}${photos(y)}</article>
    </div></section>`}).join('')+
  `<section class="card"><h2>Resumo Geral da Vistoria Comparativa</h2>
  <textarea id="generalSummary" style="min-height:180px">${escape(summaryText(names,ra,rb))}</textarea>
  <label>Observações finais do vistoriador</label><textarea id="finalCmpNotes" placeholder="Observações, ressalvas ou orientações finais."></textarea>
  <label>Responsável pela vistoria</label><input id="cmpInspector" value="${escape(b.property?.inspector||a.property?.inspector||'')}"></section>
  <div class="actions"><button id="cmpPdf">📄 Gerar PDF comparativo</button><button class="secondary" id="pickAgain">Escolher outras vistorias</button></div>`;
  $('pickAgain').onclick=acimRenderCompare;
  $('cmpPdf').onclick=()=>comparisonPdf(a,b,names,ra,rb);
  scrollTo(0,0);
}
function summaryText(names,ra,rb){
  let common=0,newer=0,missing=0;
  names.forEach(n=>{const a=ra.find(r=>cmpKey(r)===n),b=rb.find(r=>cmpKey(r)===n);if(a&&b)common++;else if(b)newer++;else missing++});
  return `Foram considerados ${names.length} ambiente(s) no comparativo. ${common} aparecem nas duas vistorias${newer?`, ${newer} aparece(m) apenas na vistoria atual`:''}${missing?` e ${missing} não aparece(m) na vistoria atual`:''}. As classificações e observações devem ser revisadas e confirmadas pelo responsável antes da emissão definitiva.`;
}
function comparisonPdf(a,b,names,ra,rb){
  const find=(arr,n)=>arr.find(r=>cmpKey(r)===n);
  const cards=[...document.querySelectorAll('[data-cmp]')];
  const imgs=r=>(r?.photos||[]).map((p,i)=>`<img class="report-photo" src="${escape(p.data)}" alt="Foto ${i+1}">`).join('');
  let h=acimHead('Relatório Comparativo de Vistorias')+`<div class="meta">
  <div><strong>Código:</strong> ${escape(b.property?.code||a.property?.code||'—')}</div>
  <div><strong>Endereço:</strong> ${escape(b.property?.address||a.property?.address||'—')}</div>
  <div><strong>Vistoria anterior:</strong> ${escape(a.property?.date||a.id)}</div>
  <div><strong>Vistoria atual:</strong> ${escape(b.property?.date||b.id)}</div></div>`;
  names.forEach((n,i)=>{const x=find(ra,n),y=find(rb,n),card=cards[i],cl=card?.querySelector('.cmpClass')?.value||'',note=card?.querySelector('.cmpNote')?.value||'';
    h+=`<section class="p-room"><h2>${escape(y?.name||x?.name||n)}</h2><p><strong>Classificação:</strong> ${escape(cl)}</p>${note?`<p><strong>Observação comparativa:</strong> ${escape(note)}</p>`:''}
    <h3>Registro anterior</h3><p>${escape(x?.notes||'Sem observações.')}</p>${reportRoomHighlights(x)}${imgs(x)}
    <h3>Registro atual</h3><p>${escape(y?.notes||'Sem observações.')}</p>${reportRoomHighlights(y)}${imgs(y)}</section>`});
  h+=`<section class="p-room"><h2>Resumo Geral da Vistoria Comparativa</h2><p>${escape($('generalSummary')?.value||'')}</p>
  <h3>Observações finais do vistoriador</h3><p>${escape($('finalCmpNotes')?.value||'Sem observações finais.')}</p></section>
  <footer>${acimContacts()}<br><br>Responsável: ${escape($('cmpInspector')?.value||'—')}<br>Relatório gerado em ${escape(new Date().toLocaleString('pt-BR'))}.<br><br>________________________________<br>Assinatura do responsável pela vistoria</footer>`;
  $('comparePrint').innerHTML=h;document.body.classList.add('compare-print');
  printReport('comparePrint');
}
// Captura dentro do aplicativo, sem abrir a câmera externa do Android.
(() => {
  const gallery = $('photos');
  const button = document.createElement('button');
  button.type = 'button';button.className = 'secondary';button.textContent = '📷 Tirar foto';button.style.margin = '8px 0';
  gallery.insertAdjacentElement('afterend',button);
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-label','Fotografar cômodo');
  dialog.style.cssText = 'width:min(92vw,640px);max-height:90vh;border:0;border-radius:16px;padding:16px;background:white;color:#173b59';
  dialog.innerHTML = '<h2 style="margin:0 0 12px">Fotografar cômodo</h2><video autoplay muted playsinline style="display:block;width:100%;max-height:60vh;object-fit:contain;background:#111"></video><p role="status">Abrindo câmera…</p><div style="display:flex;gap:12px;flex-wrap:wrap"><button type="button" data-shot disabled>Fotografar</button><button type="button" data-close class="secondary">Cancelar</button></div>';
  document.body.append(dialog);
  const video=dialog.querySelector('video'), status=dialog.querySelector('[role=status]'), shot=dialog.querySelector('[data-shot]');
  let stream=null, generation=0, room=null, busy=false;
  function stop(){generation++;stream?.getTracks().forEach(t=>t.stop());stream=null;video.pause();video.srcObject=null;shot.disabled=true;button.disabled=false;if(dialog.open)dialog.close();if(!$('editor').classList.contains('hidden'))renderPhotos()}
  dialog.querySelector('[data-close]').onclick=stop;
  dialog.addEventListener('cancel',e=>{e.preventDefault();stop()});
  window.addEventListener('pagehide',stop);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&dialog.open)stop()});
  video.addEventListener('loadeddata',()=>{if(dialog.open&&!busy&&video.videoWidth){shot.disabled=false;status.textContent='Enquadre o ambiente e toque em Fotografar.'}});
  button.onclick=async()=>{
    if(button.disabled)return;button.disabled=true;
    room=await captureEditor();if(!room){button.disabled=false;return}
    if(!navigator.mediaDevices?.getUserMedia){button.disabled=false;alert('Câmera indisponível neste navegador. Tire a foto pela câmera do celular e use Escolher arquivos.');return}
    $('photoList').replaceChildren();$('print').replaceChildren();$('comparePrint').replaceChildren();
    const token=++generation;busy=false;status.textContent='Abrindo câmera…';shot.disabled=true;dialog.showModal();
    try{
      const opened=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280,max:1600},height:{ideal:720,max:1600},frameRate:{ideal:15,max:20}}});
      if(token!==generation){opened.getTracks().forEach(t=>t.stop());return}
      stream=opened;video.srcObject=stream;await video.play();
      if(token===generation&&video.videoWidth){shot.disabled=false;status.textContent='Enquadre o ambiente e toque em Fotografar.'}
    }catch(error){if(token!==generation)return;stop();alert(error.name==='NotAllowedError'?'Permita o acesso à câmera nas configurações do navegador. Você também pode usar Escolher arquivos.':'Não foi possível abrir a câmera. Tire a foto pela câmera do celular e use Escolher arquivos.')}
  };
  shot.onclick=async()=>{
    if(busy||!video.videoWidth||!room)return;busy=true;shot.disabled=true;
    const target=room, canvas=document.createElement('canvas');
    try{
      const scale=Math.min(1,1600/video.videoWidth,1600/video.videoHeight);
      canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);
      canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
      const width=canvas.width,height=canvas.height,data=canvas.toDataURL('image/jpeg',.78);
      canvas.width=240;canvas.height=Math.max(1,Math.round(240*height/width));
      canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
      const thumbnail=canvas.toDataURL('image/jpeg',.65);
      // Libera a câmera antes de salvar e renderizar as fotos.
      stop();
      target.photos.push({data,thumbnail,width,height,name:'foto-'+Date.now()+'.jpg'});target.analysisStale=true;
      await persist();if(currentRoom()===target)renderPhotos();
    }catch(error){stop();alert('Não foi possível salvar a foto. Use Escolher arquivos e tente novamente.')}finally{canvas.width=canvas.height=1;busy=false}
  };
})();

async function captureEditor(){const name=$('roomName').value.trim();if(!name){alert('Informe o nome do cômodo antes de adicionar fotos.');return null}let room=currentRoom();if(!room){room={id:uid(),name,notes:$('notes').value.trim(),photos:[]};state.rooms.push(room);editing=state.rooms.length-1;$('deleteRoom').classList.remove('hidden')}else{if(room.name!==name)room.analysisStale=true;room.name=name;room.notes=$('notes').value.trim()}collectRoomHighlights(room);renderRoomHighlights();return await persist()?room:null}
let autosaveTimer;
for(const id of ['roomName','notes','highlightPositive','highlightNegative',...fields])$(id).addEventListener('input',()=>{clearTimeout(autosaveTimer);autosaveTimer=setTimeout(async()=>{if(!$('editor').classList.contains('hidden'))await captureEditor();else if(!$('property').classList.contains('hidden')){collectProperty();await persist()}},500)});

async function printReport(target){
 const root=$(target),other=target==='print'?'comparePrint':'print';$(other).replaceChildren();
 const images=[...root.querySelectorAll('img')];await Promise.all(images.map(img=>img.decode().catch(()=>{})));
 const source=[...root.children];root.replaceChildren();root.classList.add('print-preparing');
 let page,content;
 const newPage=()=>{page=document.createElement('section');page.className='report-page';page.innerHTML=`<img class="watermark" src="${ACIM_LOGO}" alt=""><div class="page-content"></div><div class="page-number"></div>`;root.append(page);content=page.querySelector('.page-content');return content};
 const fits=()=>content.scrollHeight<=content.clientHeight+1;
 newPage();
 for(const node of source){
  if(!node.classList.contains('p-room')){content.append(node);if(!fits()){node.remove();newPage().append(node)}continue}
  const title=node.querySelector('h2')?.textContent||'Ambiente';
  const photos=[...node.querySelectorAll('.report-photo')];const text=[...node.querySelectorAll('p,h3')].map(x=>x.textContent).join('\n\n');
  // Each room starts on its own sheet. Long descriptions keep space for photos.
  if(content.children.length)newPage();
  let remaining=text,photoIndex=0,part=0;
  do{
   const h=document.createElement('h2');h.textContent=title+(part?' — continuação':'');content.append(h);
   const paragraph=document.createElement('p');paragraph.className='room-description';content.append(paragraph);
   const grid=document.createElement('div');grid.className='report-photo-grid';content.append(grid);
   const reserve=photoIndex<photos.length?185:0;
   if(remaining){let words=remaining.match(/\S+\s*/g)||[],low=0,high=words.length;while(low<high){const mid=Math.ceil((low+high)/2);paragraph.textContent=words.slice(0,mid).join('');grid.style.height=reserve+'px';if(fits())low=mid;else high=mid-1}if(low===0)throw new Error('Não foi possível ajustar a descrição à página.');paragraph.textContent=words.slice(0,low).join('');remaining=words.slice(low).join('')}else paragraph.textContent='Continuação do registro fotográfico deste ambiente.';
   grid.style.height='';
   while(photoIndex<photos.length){const img=photos[photoIndex];const figure=document.createElement('figure');figure.append(img);const caption=document.createElement('figcaption');caption.textContent=`${title} • Foto ${photoIndex+1}`;figure.append(caption);grid.append(figure);if(!fits()){figure.remove();break}photoIndex++}
   part++;if(remaining||photoIndex<photos.length)newPage();
  }while(remaining||photoIndex<photos.length);
 }
 const pages=[...root.querySelectorAll('.report-page')];pages.forEach((p,i)=>p.querySelector('.page-number').textContent=`${state.property.code||'ACIM'} • Página ${i+1} de ${pages.length}`);
 root.classList.remove('print-preparing');
 document.body.classList.toggle('compare-print',target==='comparePrint');
 await Promise.all([...root.querySelectorAll('img')].map(img=>img.decode().catch(()=>{})));
 window.print();
}
window.addEventListener('afterprint',()=>{document.body.classList.remove('compare-print');$('print').replaceChildren();$('comparePrint').replaceChildren()});

$('roomName').addEventListener('input',renderRoomHighlights);

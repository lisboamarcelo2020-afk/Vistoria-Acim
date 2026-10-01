'use strict';
const $=id=>document.getElementById(id), fields=['address','owner','date','time','type','code','purpose','inspector'];
let state={property:{},rooms:[]},editing=-1,db;
const uid=()=>crypto.randomUUID?.()||String(Date.now()+Math.random());
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function show(id){['home','property','rooms','editor','result','library','compare'].forEach(x=>$(x).classList.toggle('hidden',x!==id));scrollTo(0,0)}
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open('vistoria-acim',1);r.onupgradeneeded=()=>r.result.createObjectStore('data');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function get(key){return new Promise((res,rej)=>{const q=db.transaction('data').objectStore('data').get(key);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})}
function put(key,val){return new Promise((res,rej)=>{const q=db.transaction('data','readwrite').objectStore('data').put(val,key);q.onsuccess=()=>res();q.onerror=()=>rej(q.error)})}
async function persist(){try{await put('draft',state)}catch(e){alert('Não foi possível salvar. O armazenamento do aparelho pode estar cheio. Exporte uma cópia dos dados.')}}
function fillProperty(){fields.forEach(f=>$(f).value=state.property[f]||'')}
function collectProperty(){fields.forEach(f=>state.property[f]=$(f).value.trim())}
function validateProperty(){collectProperty();for(const f of ['address','owner','date','type','code','purpose'])if(!state.property[f]){alert('Preencha os campos obrigatórios.');$(f).focus();return false}return true}
function renderRooms(){const out=$('roomList');out.innerHTML='';state.rooms.forEach((r,i)=>{const d=document.createElement('div');d.className='room';const label=document.createElement('span');label.textContent=`${i+1}. ${r.name||'Sem nome'} · ${r.photos.length} foto(s)`;const b=document.createElement('button');b.className='secondary';b.textContent='Editar';b.onclick=()=>openEditor(i);d.append(label,b);out.append(d)});if(!state.rooms.length)out.innerHTML='<p class="hint">Nenhum cômodo registrado ainda.</p>'}
function openEditor(i){editing=i;$('editorTitle').textContent=i<0?'Novo cômodo':`Editar cômodo ${i+1}`;$('roomName').value=i<0?'':state.rooms[i].name;$('notes').value=i<0?'':state.rooms[i].notes;$('photos').value='';$('deleteRoom').classList.toggle('hidden',i<0);renderPhotos();show('editor')}
function currentRoom(){return editing<0?null:state.rooms[editing]}
function renderPhotos(){const el=$('photoList');el.innerHTML='';(currentRoom()?.photos||[]).forEach((p,i)=>{const d=document.createElement('div');d.className='photo';const img=document.createElement('img');img.src=p.data;img.alt=`Foto ${i+1}`;const b=document.createElement('button');b.textContent='×';b.setAttribute('aria-label','Excluir foto');b.onclick=async()=>{currentRoom().photos.splice(i,1);await persist();renderPhotos()};d.append(img,b);el.append(d)})}
async function saveRoom(next){const name=$('roomName').value.trim();if(!name){alert('Informe o nome do cômodo.');$('roomName').focus();return}const room=currentRoom();if(room){room.name=name;room.notes=$('notes').value.trim()}else state.rooms.push({id:uid(),name,notes:$('notes').value.trim(),photos:[]});await persist();renderRooms();next?openEditor(-1):show('rooms')}
async function readPhoto(file){return new Promise((resolve,reject)=>{const image=new Image(),url=URL.createObjectURL(file);image.onload=()=>{const scale=Math.min(1,1600/image.width,1600/image.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);resolve({data:canvas.toDataURL('image/jpeg',.78),name:file.name})};image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Imagem incompatível'))};image.src=url})}
function formattedDate(s){if(!s)return '';const [y,m,d]=s.split('-').map(Number);return new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(y,m-1,d))}
function buildReport(){const p=state.property;let html='<h1>Relatório de vistoria de imóvel</h1><div class="meta">';for(const [title,key] of [['Endereço','address'],['Proprietário','owner'],['Data e dia','date'],['Horário','time'],['Tipo de imóvel','type'],['Código','code'],['Finalidade','purpose'],['Responsável','inspector']])html+=`<div><strong>${title}:</strong> ${escape(key==='date'?formattedDate(p[key]):p[key]||'—')}</div>`;html+='</div><p>Registro descritivo baseado nas informações e fotos inseridas durante a vistoria.</p>';state.rooms.forEach((r,i)=>{html+=`<section class="p-room"><h2>${i+1}. ${escape(r.name)}</h2><p>${escape(r.notes)||'Sem observações registradas.'}</p>`;r.photos.forEach((photo,j)=>{html+=`<img src="${photo.data}" alt="${escape(r.name)} - foto ${j+1}">`});html+='</section>'});html+=`<footer>Relatório gerado em ${escape(new Date().toLocaleString('pt-BR'))}. As condições descritas devem ser conferidas pelo responsável antes do uso ou assinatura.<br><br>________________________________<br>Responsável pela vistoria</footer>`;$('print').innerHTML=html;$('summary').textContent=`${p.code} · ${state.rooms.length} cômodo(s) · ${state.rooms.reduce((n,r)=>n+r.photos.length,0)} foto(s)`}
$('new').onclick=async()=>{if(state.rooms.length&&!confirm('Iniciar uma nova vistoria? O rascunho atual será substituído. Exporte uma cópia se precisar guardá-lo.'))return;state={property:{date:new Date().toLocaleDateString('en-CA')},rooms:[]};await persist();fillProperty();show('property')};
$('resume').onclick=()=>{fillProperty();if(state.rooms&&state.rooms.length){renderRooms();show('rooms')}else show(Object.keys(state.property).length?'property':'home')};$('backHome').onclick=async()=>{collectProperty();await persist();show('home')};
$('toRooms').onclick=async()=>{if(!validateProperty())return;await persist();renderRooms();show('rooms')};$('editProperty').onclick=()=>{fillProperty();show('property')};
$('addRoom').onclick=()=>openEditor(-1);$('saveNext').onclick=()=>saveRoom(true);$('saveBack').onclick=()=>saveRoom(false);

$('saveExitRooms').onclick=async()=>{await persist();show('home')};
$('saveExit').onclick=async()=>{const name=$('roomName').value.trim();if(name){let room=currentRoom();if(room){room.name=name;room.notes=$('notes').value.trim()}else{room={id:uid(),name,notes:$('notes').value.trim(),photos:[]};state.rooms.push(room);editing=state.rooms.length-1}}await persist();show('home')};

$('deleteRoom').onclick=async()=>{if(!confirm('Excluir este cômodo e suas fotos?'))return;state.rooms.splice(editing,1);await persist();renderRooms();show('rooms')};
$('analyze').onclick=async()=>{if(location.protocol==='file:'){$('aiStatus').textContent='A análise por IA não funciona abrindo o arquivo index.html. É necessário abrir o endereço do aplicativo publicado com o servidor de IA configurado.';return}const room=currentRoom();if(!room?.photos.length){alert('Adicione pelo menos uma foto deste cômodo antes de analisar.');return}const name=$('roomName').value.trim();if(!name){alert('Informe o nome do cômodo.');return}const button=$('analyze');button.disabled=true;$('aiStatus').textContent='Analisando as fotos. Aguarde...';try{const response=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({room:name,notes:$('notes').value,photos:room.photos.map(p=>p.data)})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Falha na análise');$('notes').value=data.description;$('aiStatus').textContent='Descritivo criado. Revise e corrija o texto antes de salvar.';room.notes=data.description;await persist()}catch(e){$('aiStatus').textContent=e instanceof TypeError?'Não foi possível conectar ao servidor de IA. Confira a internet e se o aplicativo foi publicado com o servidor ativo.':'Não foi possível analisar as fotos: '+e.message}finally{button.disabled=false}};
$('photos').onchange=async e=>{const files=[...e.target.files];if(!files.length)return;let room=currentRoom();if(!room){const name=$('roomName').value.trim();if(!name){alert('Informe o nome do cômodo antes de adicionar fotos.');e.target.value='';return}room={id:uid(),name,notes:$('notes').value.trim(),photos:[]};state.rooms.push(room);editing=state.rooms.length-1;$('deleteRoom').classList.remove('hidden')}$('photos').disabled=true;try{for(const file of files){room.photos.push(await readPhoto(file));await persist();renderPhotos()}}catch(err){alert('Não foi possível abrir uma das fotos: '+err.message)}finally{$('photos').disabled=false;e.target.value=''}};
$('finish').onclick=()=>{if(!state.rooms.length){alert('Adicione pelo menos um cômodo.');return}if(!confirm('Deseja finalizar a vistoria agora? Você poderá reabrir para editar e acrescentar fotos depois.'))return;buildReport();show('result')};$('pdf').onclick=()=>{buildReport();setTimeout(()=>window.print(),200)};$('editRooms').onclick=()=>{renderRooms();show('rooms')};$('fresh').onclick=()=>$('new').click();
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`vistoria-${state.property.code||'imovel'}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000)};
let recognition=null;
$('speak').onclick=()=>{if(recognition){recognition.stop();return}const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){alert('Este navegador não oferece ditado por voz. Use o microfone do teclado Android para escrever por voz.');return}recognition=new SR();recognition.lang='pt-BR';recognition.continuous=true;recognition.interimResults=false;recognition.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal)$('notes').value+=($('notes').value?' ':'')+e.results[i][0].transcript};recognition.onerror=e=>{if(e.error!=='no-speech')alert('Falha no reconhecimento de voz: '+e.error)};recognition.onend=()=>{$('speak').textContent='🎙️ Ditar observações';recognition=null};recognition.start();$('speak').textContent='Parar ditado'};

(async()=>{try{db=await openDB();state=await get('draft')||state;state.rooms=state.rooms||[];fillProperty();$('resume').disabled=!Object.keys(state.property).length;if(location.protocol==='file:')$('aiStatus').textContent='Modo de teste local: cadastro, fotos e PDF funcionam; para analisar fotos com IA é necessário publicar e configurar o servidor.'}catch(e){alert('Seu navegador não permitiu salvar dados localmente. Ative o armazenamento do navegador e recarregue.')}if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{})})();


// ===== ACIM V2: biblioteca de múltiplas vistorias =====
const ACIM_LIBRARY_KEY='acim_inspections_v2';
const acimLoadLibrary=()=>{try{return JSON.parse(localStorage.getItem(ACIM_LIBRARY_KEY)||'[]')}catch{return []}};
const acimSaveLibrary=(v)=>localStorage.setItem(ACIM_LIBRARY_KEY,JSON.stringify(v));
const acimInspectionId=()=>`ACIM-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
const acimSummary=(v)=>({
  id:v.id||acimInspectionId(),
  status:v.status||'andamento',
  createdAt:v.createdAt||new Date().toISOString(),
  updatedAt:new Date().toISOString(),
  property:v.property||{},
  rooms:v.rooms||[],
  data:v
});
function acimArchiveCurrent(status='andamento'){
  if(!state || (!Object.keys(state.property||{}).length && !(state.rooms||[]).length)) return;
  let lib=acimLoadLibrary(), id=state.inspectionId||acimInspectionId();
  state.inspectionId=id;
  let item=acimSummary({...state,id,status});
  let i=lib.findIndex(x=>x.id===id);
  if(i>=0) lib[i]=item; else lib.unshift(item);
  acimSaveLibrary(lib);
}
function acimOpenItem(id){
  const item=acimLoadLibrary().find(x=>x.id===id); if(!item)return;
  state=item.data||item; state.inspectionId=item.id;
  persist(); fillProperty(); renderRooms(); show('rooms');
}
function acimDeleteItem(id){
  if(!confirm('Excluir esta vistoria deste aparelho?'))return;
  acimSaveLibrary(acimLoadLibrary().filter(x=>x.id!==id)); acimRenderLibrary(window.__acimFilter||'all');
}
function acimRenderLibrary(filter='all'){
  window.__acimFilter=filter;
  const q=($('inspectionSearch')?.value||'').toLowerCase();
  let lib=acimLoadLibrary().filter(x=>filter==='all'||x.status===filter);
  lib=lib.filter(x=>JSON.stringify(x.property||{}).toLowerCase().includes(q)||String(x.id).toLowerCase().includes(q)||String(x.createdAt).includes(q));
  $('inspectionList').innerHTML=lib.length?lib.map(x=>{
    const p=x.property||{}, title=p.code||p.codigo||p.address||p.endereco||'Imóvel sem identificação';
    return `<div class="room-item"><div><strong>${title}</strong><br><small>${x.id} • ${x.status==='finalizada'?'Finalizada':'Em andamento'} • ${(x.rooms||[]).length} cômodo(s)</small></div>
    <div class="actions"><button class="secondary" onclick="acimOpenItem('${x.id}')">${x.status==='finalizada'?'Abrir / reabrir':'Continuar'}</button><button class="danger" onclick="acimDeleteItem('${x.id}')">Excluir</button></div></div>`;
  }).join(''):'<p class="hint">Nenhuma vistoria encontrada.</p>';
}
function acimShowLibrary(filter,title){
  $('libraryTitle').textContent=title; $('inspectionSearch').value=''; show('library'); acimRenderLibrary(filter);
}
window.acimOpenItem=acimOpenItem; window.acimDeleteItem=acimDeleteItem;
$('inspectionSearch')?.addEventListener('input',()=>acimRenderLibrary(window.__acimFilter||'all'));
$('libraryBack')?.addEventListener('click',()=>show('home'));
$('openPending')?.addEventListener('click',()=>acimShowLibrary('andamento','Vistorias em andamento'));
$('openHistory')?.addEventListener('click',()=>acimShowLibrary('finalizada','Vistorias finalizadas / Histórico'));
$('newInspection')?.addEventListener('click',()=>{acimArchiveCurrent('andamento'); state={property:{},rooms:[],inspectionId:acimInspectionId()};persist();fillProperty();show('property')});
$('saveExitRooms')?.addEventListener('click',()=>acimArchiveCurrent('andamento'));
$('saveExit')?.addEventListener('click',()=>acimArchiveCurrent('andamento'));
$('finish')?.addEventListener('click',()=>setTimeout(()=>acimArchiveCurrent('finalizada'),0));
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
    selected.sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
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
  names.map((n,i)=>{const x=find(ra,n),y=find(rb,n);const def=!x?'Instalado':!y?'Removido':'Revisar pelo vistoriador';return `
    <section class="card" data-cmp="${i}"><h2>${escape(y?.name||x?.name||n)}</h2>
    <label>Classificação da alteração</label><select class="cmpClass">${opts.map(o=>`<option ${o===def?'selected':''}>${o}</option>`).join('')}</select>
    <label>Observação comparativa do vistoriador</label><textarea class="cmpNote" placeholder="Descreva diferenças, reparos, desgaste ou outros pontos observados."></textarea>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px">
    <article style="min-width:0;padding:10px;border:1px solid #ddd;border-radius:10px"><strong>Anterior — ${escape(a.property?.date||'')}</strong><p style="white-space:pre-wrap">${escape(x?.notes||'Sem observações.')}</p>${photos(x)}</article>
    <article style="min-width:0;padding:10px;border:1px solid #ddd;border-radius:10px"><strong>Atual — ${escape(b.property?.date||'')}</strong><p style="white-space:pre-wrap">${escape(y?.notes||'Sem observações.')}</p>${photos(y)}</article>
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
  const imgs=r=>(r?.photos||[]).map((p,i)=>`<img src="${escape(p.data)}" alt="Foto ${i+1}">`).join('');
  let h=`<h1>Relatório Comparativo de Vistorias</h1><div class="meta">
  <div><strong>Código:</strong> ${escape(b.property?.code||a.property?.code||'—')}</div>
  <div><strong>Endereço:</strong> ${escape(b.property?.address||a.property?.address||'—')}</div>
  <div><strong>Vistoria anterior:</strong> ${escape(a.property?.date||a.id)}</div>
  <div><strong>Vistoria atual:</strong> ${escape(b.property?.date||b.id)}</div></div>`;
  names.forEach((n,i)=>{const x=find(ra,n),y=find(rb,n),card=cards[i],cl=card?.querySelector('.cmpClass')?.value||'',note=card?.querySelector('.cmpNote')?.value||'';
    h+=`<section class="p-room"><h2>${escape(y?.name||x?.name||n)}</h2><p><strong>Classificação:</strong> ${escape(cl)}</p>${note?`<p><strong>Observação comparativa:</strong> ${escape(note)}</p>`:''}
    <h3>Registro anterior</h3><p>${escape(x?.notes||'Sem observações.')}</p>${imgs(x)}
    <h3>Registro atual</h3><p>${escape(y?.notes||'Sem observações.')}</p>${imgs(y)}</section>`});
  h+=`<section class="p-room"><h2>Resumo Geral da Vistoria Comparativa</h2><p>${escape($('generalSummary')?.value||'')}</p>
  <h3>Observações finais do vistoriador</h3><p>${escape($('finalCmpNotes')?.value||'Sem observações finais.')}</p></section>
  <footer>Responsável: ${escape($('cmpInspector')?.value||'—')}<br>Relatório gerado em ${escape(new Date().toLocaleString('pt-BR'))}.<br><br>________________________________<br>Assinatura do responsável pela vistoria</footer>`;
  $('comparePrint').innerHTML=h;document.body.classList.add('compare-print');
  setTimeout(()=>{window.print();setTimeout(()=>document.body.classList.remove('compare-print'),700)},250);
}

import http from 'node:http';
import {buildAnalysisInput} from './analysis-prompt.mjs';
import {readFile,stat} from 'node:fs/promises';
import {join,extname,resolve,sep} from 'node:path';
const root=new URL('.',import.meta.url).pathname,port=Number(process.env.PORT||3000);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
const server=http.createServer(async(req,res)=>{
 if(req.method==='POST'&&req.url==='/api/analyze'){
  if(!process.env.OPENAI_API_KEY)return send(res,503,{error:'A chave de IA ainda não foi configurada no servidor.'});
  let raw='';try{for await(const chunk of req){raw+=chunk;if(raw.length>22_000_000)return send(res,413,{error:'Envie menos fotos por análise.'})}
   const {room,notes,photos,mode='room',contextDescription='',evidence={}}=JSON.parse(raw);
   if(!['room','highlights'].includes(mode)||typeof contextDescription!=='string'||contextDescription.length>10000||!evidence||typeof evidence!=='object'||Array.isArray(evidence)||['positive','negative'].some(k=>evidence[k]!==undefined&&(typeof evidence[k]!=='string'||evidence[k].length>5000))||typeof room!=='string'||room.length>100||typeof notes!=='string'||notes.length>10000||!Array.isArray(photos)||photos.length<1||photos.length>12||!photos.every(p=>typeof p==='string'&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(p)))return send(res,400,{error:'Dados das fotos inválidos. Use até 12 fotos JPEG por cômodo.'});
   const input=buildAnalysisInput({room,notes,photos,mode,contextDescription,evidence});
   const upstream=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5',store:false,input:[{role:'user',content:input}],max_output_tokens:8000})});
   const data=await upstream.json();if(!upstream.ok)return send(res,502,{error:'Serviço de IA indisponível. Verifique a chave, créditos e modelo configurado.'});
   const description=(data.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n').trim();if(!description)return send(res,502,{error:'A IA não produziu um descritivo. Tente novamente.'});return send(res,200,{description});
  }catch(e){return send(res,500,{error:'Falha ao processar a análise. Tente novamente.'})}
 }
 if(req.method!=='GET')return send(res,405,{error:'Método não permitido'});
 const path=new URL(req.url,'http://localhost').pathname==='/'?'index.html':decodeURIComponent(new URL(req.url,'http://localhost').pathname.slice(1));
 try{const file=resolve(root,path);if(!file.startsWith(resolve(root)+sep))return send(res,403,{error:'Acesso não permitido'});const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(bytes)}catch(e){send(res,404,{error:'Arquivo não encontrado'})}
});
server.listen(port,()=>console.log(`Vistoria disponível em http://localhost:${port}`));

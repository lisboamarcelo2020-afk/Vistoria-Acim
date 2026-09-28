import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {join,extname} from 'node:path';
const root=new URL('.',import.meta.url).pathname,port=Number(process.env.PORT||3000);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
const server=http.createServer(async(req,res)=>{
 if(req.method==='POST'&&req.url==='/api/analyze'){
  if(!process.env.OPENAI_API_KEY)return send(res,503,{error:'A chave de IA ainda não foi configurada no servidor.'});
  let raw='';try{for await(const chunk of req){raw+=chunk;if(raw.length>22_000_000)return send(res,413,{error:'Envie menos fotos por análise.'})}
   const {room,notes,photos}=JSON.parse(raw);
   if(typeof room!=='string'||room.length>100||typeof notes!=='string'||notes.length>10000||!Array.isArray(photos)||photos.length<1||photos.length>12||!photos.every(p=>typeof p==='string'&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(p)))return send(res,400,{error:'Dados das fotos inválidos. Use até 12 fotos JPEG por cômodo.'});
   const input=[{type:'input_text',text:`Cômodo: ${room}. Observações fornecidas pelo vistoriador: ${notes||'nenhuma'}. Redija em português do Brasil um descritivo técnico conciso, em texto corrido, para vistoria imobiliária. Separe o que é visível do que foi declarado pelo vistoriador. Descreva apenas elementos e condições que podem ser observados com segurança. Para pintura, piso, teto, paredes, portas, janelas, iluminação, instalações e equipamentos, mencione somente os itens visíveis. Não conclua funcionamento, voltagem, integridade estrutural, ausência de infiltração ou estado de instalações ocultas por foto. Quando não for possível avaliar, diga que não foi possível verificar. Não invente detalhes, medições, marcas ou defeitos. Não faça diagnóstico nem atribua responsabilidade. O texto será revisado por um profissional antes de entrar no relatório.`},...photos.map(p=>({type:'input_image',image_url:p,detail:'low'}))];
   const upstream=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5',store:false,input:[{role:'user',content:input}],max_output_tokens:700})});
   const data=await upstream.json();if(!upstream.ok)return send(res,502,{error:'Serviço de IA indisponível. Verifique a chave, créditos e modelo configurado.'});
   const description=(data.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n').trim();if(!description)return send(res,502,{error:'A IA não produziu um descritivo. Tente novamente.'});return send(res,200,{description});
  }catch(e){return send(res,500,{error:'Falha ao processar a análise. Tente novamente.'})}
 }
 if(req.method!=='GET')return send(res,405,{error:'Método não permitido'});
 const path=req.url==='/'?'index.html':decodeURIComponent(req.url.split('?')[0]).replace(/^\//,'');if(!['index.html','app.js','sw.js','manifest.webmanifest','icon.svg'].includes(path))return send(res,404,{error:'Arquivo não encontrado'});
 try{const file=join(root,path);const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(bytes)}catch(e){send(res,404,{error:'Arquivo não encontrado'})}
});
server.listen(port,()=>console.log(`Vistoria disponível em http://localhost:${port}`));

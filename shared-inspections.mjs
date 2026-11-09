import {createHmac, timingSafeEqual, scrypt as derive} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(derive);
const equal=(a,b)=>a.length===b.length&&timingSafeEqual(a,b);
const sessionKey=process.env.VISTORIA_SESSION_SECRET;
const enabled=!!(process.env.DATABASE_URL&&sessionKey?.length>=32&&process.env.VISTORIA_ACCOUNTS);
const accounts=enabled?new Map(JSON.parse(process.env.VISTORIA_ACCOUNTS).map(a=>[a.login,a])):new Map();
let pool;
async function database(){
 if(!pool)pool=(async()=>{
 const {Pool}=await import('pg');const db=new Pool({connectionString:process.env.DATABASE_URL,max:4});
 await db.query(`CREATE TABLE IF NOT EXISTS acim_inspections(id text PRIMARY KEY, owner text NOT NULL, revision int NOT NULL, report jsonb NOT NULL);
 CREATE TABLE IF NOT EXISTS acim_inspection_audit(id text REFERENCES acim_inspections(id), revision int NOT NULL, actor text NOT NULL, at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(id,revision));`);
 return db;
 })().catch(e=>{pool=null;throw e});
 return pool;
}
const sign=p=>createHmac('sha256',sessionKey).update(p).digest('base64url');
function account(req){
 try{
 const token=req.headers.cookie?.split(/;\s*/).find(x=>x.startsWith('acim_session='))?.slice(13);
 const [p,s,extra]=token.split('.');if(extra||!equal(Buffer.from(s),Buffer.from(sign(p))))return;
 const {login,expires}=JSON.parse(Buffer.from(p,'base64url'));
 if(expires>Date.now())return accounts.get(login);
 }catch{}
}
function cookie(res,value,age){res.setHeader('Set-Cookie',`acim_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${process.env.RENDER?' ; Secure':''}`)}
async function body(req,limit){
 let size=0;const chunks=[];
 for await(const c of req){size+=c.length;if(size>limit)throw Object.assign(new Error('Arquivo grande demais.'),{status:413});chunks.push(c)}
 try{return JSON.parse(Buffer.concat(chunks).toString())}catch{throw Object.assign(new Error('Dados inválidos.'),{status:400})}
}
const attempts=new Map();
export async function sharedInspections(req,res,send){
 const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith('/api/vistorias/'))return false;
 const route=url.pathname.slice('/api/vistorias/'.length);
 if(route==='status'&&req.method==='GET'){send(res,200,{enabled,user:enabled?account(req)?.name||null:null});return true}
 if(!enabled){send(res,503,{error:'O histórico compartilhado ainda não foi configurado.'});return true}
 try{
 if(req.method==='POST'&&req.headers['content-type']?.split(';')[0]!=='application/json'){send(res,415,{error:'Formato inválido.'});return true}
 if(route==='entrar'&&req.method==='POST'){
 const key=req.socket.remoteAddress;const now=Date.now();for(const [k,v] of attempts)if(v.until<now)attempts.delete(k);
 const count=attempts.get(key)||{count:0,until:now+60000};if(count.count++>=15){send(res,429,{error:'Aguarde um minuto para tentar novamente.'});return true}attempts.set(key,count);
 const {login,password}=await body(req,4096);
 const a=accounts.get(login);if(typeof password!=='string'||password.length>256){send(res,400,{error:'Senha inválida.'});return true}
 const [salt,hash]=(a?.hash||'00000000000000000000000000000000:'+'0'.repeat(128)).split(':');
 const derived=await scrypt(password,salt,64);
 if(!a||!equal(derived,Buffer.from(hash,'hex'))){send(res,401,{error:'Usuário ou senha inválidos.'});return true}
 const p=Buffer.from(JSON.stringify({login:a.login,expires:now+8*3600000})).toString('base64url');
 cookie(res,p+'.'+sign(p),28800);send(res,200,{user:a.name});return true;
 }
 if(route==='sair'&&req.method==='POST'){cookie(res,'',0);send(res,200,{});return true}
 const a=account(req);if(!a){send(res,401,{error:'Entre com sua conta da equipe.'});return true}
 const db=await database();
 if(route==='historico'&&req.method==='GET'){
 const {rows}=await db.query("SELECT id, revision, owner=$1 AS editable, report->'property' AS property, report->>'finalizedAt' AS finalized FROM acim_inspections ORDER BY report->>'finalizedAt' DESC",[a.login]);send(res,200,{rows});return true;
 }
 if(!/^registro\/[a-zA-Z0-9_-]{1,120}$/.test(route)){send(res,404,{error:'Registro não encontrado.'});return true}
 const id=route.split('/')[1];
 if(req.method==='GET'){
 const {rows}=await db.query('SELECT revision, owner=$2 AS editable, report FROM acim_inspections WHERE id=$1',[id,a.login]);
 if(!rows.length){send(res,404,{error:'Registro não encontrado.'});return true}
 const audit=await db.query('SELECT revision, actor, at FROM acim_inspection_audit WHERE id=$1 ORDER BY revision DESC',[id]);
 send(res,200,{...rows[0],history:audit.rows});return true;
 }
 if(req.method==='POST'){
 const {report,revision}=await body(req,35_000_000);
 if(!report?.property||typeof report.property!=='object'||Array.isArray(report.property)||!Array.isArray(report.rooms)||!report.rooms.length||!report.rooms.every(room=>room&&typeof room.name==='string'&&Array.isArray(room.photos)&&room.photos.every(photo=>typeof photo?.data==='string'&&/^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(photo.data)))||!Number.isInteger(revision)||revision<0){send(res,400,{error:'Laudo inválido.'});return true}
 const existing=await db.query("SELECT owner,report->>'finalizedAt' AS finalized FROM acim_inspections WHERE id=$1",[id]);
 if(existing.rows[0]&&existing.rows[0].owner!==a.login){send(res,403,{error:'Somente o corretor responsável pode alterar este laudo.'});return true}
 report.status='finalizada';report.finalizedAt=existing.rows[0]?.finalized||new Date().toISOString();
 report.inspectionId=id;report.property.inspector=a.name;
 const {rows}=await db.query(`WITH saved AS (
 INSERT INTO acim_inspections(id,owner,revision,report) SELECT $1,$2,1,$3::jsonb WHERE $4::int=0
 ON CONFLICT(id) DO NOTHING RETURNING revision
 ), updated AS (
 UPDATE acim_inspections SET report=$3::jsonb,revision=revision+1 WHERE id=$1 AND owner=$2 AND revision=$4 AND $4>0 RETURNING revision
 ) INSERT INTO acim_inspection_audit(id,revision,actor) SELECT $1,revision,$5 FROM (SELECT * FROM saved UNION ALL SELECT * FROM updated) changes RETURNING revision`,[id,a.login,JSON.stringify(report),revision,a.name]);
 if(!rows.length){send(res,409,{error:'A versão mudou. Abra o laudo no histórico compartilhado antes de salvar novamente.'});return true}
 send(res,200,{revision:rows[0].revision,finalizedAt:report.finalizedAt,inspector:a.name});return true;
 }
 send(res,405,{error:'Método não permitido.'});
 }catch(e){send(res,e.status||503,{error:e.status?e.message:'Não foi possível acessar o histórico compartilhado. Tente novamente.'})}
 return true;
}

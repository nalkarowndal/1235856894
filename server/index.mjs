import http from 'node:http';
import crypto from 'node:crypto';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {openDB,getCatalog,availableUnits,validRentalDates,createRental,createOrder,getMetrics} from './db.mjs';
const db=openDB();
const port=Number(process.env.PORT||4100);
const sessions=new Map();
const base=path.dirname(fileURLToPath(import.meta.url));
const dist=path.resolve(base,'../client/dist');
const mime={'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.json':'application/json'};
function send(res,status,object,headers={}) {res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers});res.end(JSON.stringify(object));}
function parseCookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').map(s=>s.trim().split('=').map(decodeURIComponent)).filter(v=>v.length===2));}
function isAdmin(req){const cookie=parseCookies(req).lr_session;return cookie && sessions.get(cookie)>Date.now();}
async function jsonBody(req){let body='';for await (const part of req){body+=part;if(body.length>16384) throw Object.assign(new Error('요청이 너무 큽니다.'),{status:413});}try{return JSON.parse(body||'{}')}catch{throw Object.assign(new Error('JSON 형식 오류'),{status:400})}}
function compare(a,b){const ha=crypto.createHash('sha256').update(a).digest();const hb=crypto.createHash('sha256').update(b).digest();return crypto.timingSafeEqual(ha,hb)}
async function api(req,res,url){
 const {pathname,searchParams}=url, method=req.method;
 if(pathname==='/api/health') return send(res,200,{ok:true,mode:'demo',backend:'Node.js + SQLite'});
 if(pathname==='/api/products'&&method==='GET') return send(res,200,{products:getCatalog(db)});
 const available=pathname.match(/^\/api\/products\/([^/]+)\/availability$/);
 if(available&&method==='GET') {
  const from=searchParams.get('from'),to=searchParams.get('to');
  if(!validRentalDates(from,to))return send(res,400,{error:'날짜 범위가 올바르지 않습니다.'});
  return send(res,200,{count:availableUnits(db,available[1],from,to).length});
 }
 if(pathname==='/api/rentals'&&method==='POST')return send(res,201,{rental:createRental(db,await jsonBody(req))});
 if(pathname==='/api/orders'&&method==='POST')return send(res,201,{order:createOrder(db,await jsonBody(req))});
 if(pathname==='/api/admin/login'&&method==='POST'){
  const {password}=await jsonBody(req), expected=process.env.ADMIN_PASSWORD;
  if(!expected||expected==='REPLACE_WITH_RANDOM_STRONG_PASSWORD')return send(res,503,{error:'ADMIN_PASSWORD 환경변수를 먼저 설정해야 합니다.'});
  if(typeof password!=='string'||!compare(password,expected))return send(res,401,{error:'비밀번호가 올바르지 않습니다.'});
  const id=crypto.randomBytes(32).toString('hex');sessions.set(id,Date.now()+3600000);
  return send(res,200,{ok:true},{'set-cookie':`lr_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600${process.env.NODE_ENV==='production'?'; Secure':''}`});
 }
 if(pathname==='/api/admin/logout'&&method==='POST'){const c=parseCookies(req).lr_session;sessions.delete(c);return send(res,200,{ok:true},{'set-cookie':'lr_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});}
 if(pathname==='/api/admin/me'&&method==='GET')return send(res,200,{authenticated:!!isAdmin(req)});
 if(pathname.startsWith('/api/admin/')){
  if(!isAdmin(req))return send(res,401,{error:'관리자 로그인이 필요합니다.'});
  if(pathname==='/api/admin/dashboard'&&method==='GET')return send(res,200,{metrics:getMetrics(db),rentals:db.prepare('SELECT r.*,p.brand,p.name FROM rentals r JOIN products p ON p.id=r.product_id ORDER BY r.created_at DESC LIMIT 40').all(),units:db.prepare('SELECT u.*,p.brand,p.name FROM units u JOIN products p ON p.id=u.product_id ORDER BY u.id').all(),orders:db.prepare('SELECT o.*,p.name FROM orders o JOIN products p ON p.id=o.product_id ORDER BY o.created_at DESC LIMIT 20').all()});
  const rentalMatch=pathname.match(/^\/api\/admin\/rentals\/([^/]+)$/);
  if(rentalMatch&&method==='PATCH'){
   const {status}=await jsonBody(req);
   if(!['shipped','returned','cancelled'].includes(status))return send(res,400,{error:'잘못된 상태입니다.'});
   const rental=db.prepare('SELECT * FROM rentals WHERE id=?').get(rentalMatch[1]);
   if(!rental)return send(res,404,{error:'대여를 찾을 수 없습니다.'});
   const allowed={confirmed:['shipped','cancelled'],shipped:['returned'],returned:[],cancelled:[]};
   if(!allowed[rental.status].includes(status))return send(res,409,{error:'허용되지 않은 상태 변경입니다.'});
   db.exec('BEGIN IMMEDIATE');
   try {db.prepare('UPDATE rentals SET status=? WHERE id=?').run(status,rental.id);
     if(status==='returned')db.prepare("UPDATE units SET state='cleaning' WHERE id=?").run(rental.unit_id);
     db.prepare('INSERT INTO inventory_events(unit_id,event_type,details) VALUES(?,?,?)').run(rental.unit_id,'RENTAL_'+status.toUpperCase(),rental.id);db.exec('COMMIT');}
   catch(e){db.exec('ROLLBACK');throw e;}
   return send(res,200,{ok:true});
  }
  const unitMatch=pathname.match(/^\/api\/admin\/units\/([^/]+)$/);
  if(unitMatch&&method==='PATCH'){
   const {state}=await jsonBody(req);
   if(!['ready','cleaning','repair'].includes(state))return send(res,400,{error:'잘못된 상태입니다.'});
   const unit=db.prepare('SELECT * FROM units WHERE id=?').get(unitMatch[1]);
   if(!unit)return send(res,404,{error:'실물을 찾을 수 없습니다.'});
   if(unit.state==='sold')return send(res,409,{error:'판매된 실물은 변경할 수 없습니다.'});
   if(state==='ready'&&db.prepare("SELECT 1 FROM rentals WHERE unit_id=? AND status='shipped' LIMIT 1").get(unit.id)) return send(res,409,{error:'진행중인 예약이 있습니다.'});
   db.prepare('UPDATE units SET state=? WHERE id=?').run(state,unit.id);
   db.prepare('INSERT INTO inventory_events(unit_id,event_type,details) VALUES(?,?,?)').run(unit.id,'UNIT_STATE_CHANGED',state);
   return send(res,200,{ok:true});
  }
 }
 return send(res,404,{error:'존재하지 않는 API입니다.'});
}
async function serveStatic(req,res,url){
 if(req.method!=='GET') return send(res,405,{error:'지원하지 않는 요청입니다.'});
 let pathName;try{pathName=decodeURIComponent(url.pathname)}catch{return send(res,400,{error:'잘못된 경로'})}
 const filePath=path.resolve(dist,'.'+pathName);
 if(!filePath.startsWith(dist+path.sep)&&filePath!==dist)return send(res,403,{error:'허용되지 않은 경로'});
 try {let target=filePath;const s=await stat(filePath);if(s.isDirectory())target=path.join(filePath,'index.html');const data=await readFile(target);res.writeHead(200,{'content-type':mime[path.extname(target)]||'application/octet-stream'});return res.end(data);}catch{}
 try {const html=await readFile(path.join(dist,'index.html'));res.writeHead(200,{'content-type':mime['.html']});res.end(html)}catch{send(res,404,{error:'빌드된 UI가 없습니다. npm run dev 또는 npm run build를 실행하세요.'})}
}
const server=http.createServer(async(req,res)=>{const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);try {if(url.pathname.startsWith('/api/'))await api(req,res,url);else await serveStatic(req,res,url)}catch(e){console.error(e);send(res,e.status||500,{error:e.status?e.message:'서버 오류가 발생했습니다.'})}});
if(process.env.NODE_ENV!=='test')server.listen(port,()=>console.log(`luxuryRental API: http://localhost:${port}`));
export {server};

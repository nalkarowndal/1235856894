import crypto from "node:crypto";
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(fileURLToPath(import.meta.url));
const products = [
  ['p1','ATELIER LUNE','The Sera Top Handle','핸드백','arch','#ddd2be',4280000,79000,500000,'조형적인 실루엣과 부드러운 카프 레더. 절제된 존재감의 클래식 톱 핸들 백.','NEW ARRIVAL'],
  ['p2','MAISON ARGENT','Étoile Quilted Bag','숄더백','quilt','#c2ac98',3650000,69000,450000,'시간이 지나도 변하지 않는 퀼팅 디테일의 숄더백.','EDITOR’S PICK'],
  ['p3','SOLENNE','Le Voyage Tote','토트백','tote','#c3c6b1',2890000,54000,350000,'일상과 여행 사이의 우아함. 넉넉한 수납과 정제된 비례.','POPULAR'],
  ['p4','ÉLAN PARIS','Mini Sculpt Bag','미니백','mini','#a38673',2390000,48000,300000,'가볍게 들수록 빛나는 디자인. 작은 크기 안에 담은 선명한 개성.','EXCLUSIVE'],
  ['p5','NOIR & CO.','The Arc Saddle','크로스백','saddle','#534941',3100000,64000,400000,'우아한 곡선과 세련된 버클. 데일리룩을 완성하는 한 점.','TRENDING'],
  ['p6','ATELIER LUNE','Signature Frame','핸드백','frame','#af968b',4930000,95000,600000,'건축적인 프레임과 절제된 광택. 기념일을 위한 시그니처 피스.','CURATED']
];
export function openDB(filename=process.env.LR_DB_PATH || path.join(root,'luxuryrental.db')) {
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,brand TEXT NOT NULL,name TEXT NOT NULL,category TEXT NOT NULL,art TEXT NOT NULL,color TEXT NOT NULL,buy_price INTEGER NOT NULL,day_price INTEGER NOT NULL,deposit INTEGER NOT NULL,description TEXT NOT NULL,tag TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS units(id TEXT PRIMARY KEY,product_id TEXT NOT NULL REFERENCES products(id),serial TEXT NOT NULL UNIQUE,condition_grade TEXT NOT NULL DEFAULT 'A',state TEXT NOT NULL CHECK(state IN ('ready','cleaning','repair','sold')) DEFAULT 'ready');
    CREATE TABLE IF NOT EXISTS rentals(id TEXT PRIMARY KEY,product_id TEXT NOT NULL REFERENCES products(id),unit_id TEXT NOT NULL REFERENCES units(id),customer TEXT NOT NULL,start_date TEXT NOT NULL,end_date TEXT NOT NULL,days INTEGER NOT NULL,fee INTEGER NOT NULL,deposit INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN ('confirmed','shipped','returned','cancelled')) DEFAULT 'confirmed',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,product_id TEXT NOT NULL REFERENCES products(id),unit_id TEXT NOT NULL REFERENCES units(id),customer TEXT NOT NULL,amount INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'demo_pending_payment',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS inventory_events(id INTEGER PRIMARY KEY AUTOINCREMENT,unit_id TEXT NOT NULL REFERENCES units(id),event_type TEXT NOT NULL,details TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS rental_overlap ON rentals(unit_id,start_date,end_date,status);
    CREATE INDEX IF NOT EXISTS unit_product ON units(product_id,state);
  `);
  if(!db.prepare('SELECT 1 FROM products LIMIT 1').get()) {
    const insert=db.prepare('INSERT INTO products VALUES (?,?,?,?,?,?,?,?,?,?,?)');
    const unit=db.prepare('INSERT INTO units(id,product_id,serial,condition_grade,state) VALUES (?,?,?,?,?)');
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const p of products) {
        insert.run(...p);
        const count=p[0]==='p1'?3:2;
        for(let i=1;i<=count;i++) unit.run(`${p[0]}-u${i}`,p[0],`LR-${p[0].toUpperCase()}-${String(i).padStart(3,'0')}`,i===1?'S':'A','ready');
      }
      db.exec('COMMIT');
    } catch(e){db.exec('ROLLBACK');throw e;}
  }
  return db;
}
export function getCatalog(db){
 return db.prepare(`SELECT p.*, COUNT(u.id) AS total_units,
 SUM(CASE WHEN u.state='ready' THEN 1 ELSE 0 END) AS ready_units
 FROM products p LEFT JOIN units u ON u.product_id=p.id GROUP BY p.id ORDER BY p.id`).all();
}
export function availableUnits(db,productId,start,end){
 return db.prepare(`SELECT u.* FROM units u WHERE u.product_id=? AND u.state='ready'
   AND NOT EXISTS(SELECT 1 FROM rentals r WHERE r.unit_id=u.id AND r.status IN ('confirmed','shipped')
   AND r.start_date <= ? AND r.end_date >= ?) ORDER BY u.id`).all(productId,end,start);
}
export function validRentalDates(start,end){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start??'') || !/^\d{4}-\d{2}-\d{2}$/.test(end??'')) return null;
 const a = new Date(start+'T00:00:00Z'),b=new Date(end+'T00:00:00Z');
 if(!Number.isFinite(a.getTime())||!Number.isFinite(b.getTime())||a.toISOString().slice(0,10)!==start||b.toISOString().slice(0,10)!==end) return null;
 const today=new Date().toISOString().slice(0,10);
 const days=Math.round((b-a)/86400000)+1;
 if(start<today || days<1 || days>30) return null;
 return days;
}
export function createRental(db,{productId,customer,startDate,endDate}){
 const days=validRentalDates(startDate,endDate);
 if(!days) throw Object.assign(new Error('올바른 렌탈 날짜를 입력하세요. (최대 30일)'),{status:400});
 if(typeof customer!=='string'||customer.trim().length<2||customer.length>80) throw Object.assign(new Error('고객 이름은 2~80자여야 합니다.'),{status:400});
 db.exec('BEGIN IMMEDIATE');
 try {
  const p=db.prepare('SELECT * FROM products WHERE id=?').get(productId);
  if(!p) throw Object.assign(new Error('상품을 찾을 수 없습니다.'),{status:404});
  const unit=availableUnits(db,productId,startDate,endDate)[0];
  if(!unit) throw Object.assign(new Error('선택 날짜에 대여 가능한 실물이 없습니다.'),{status:409});
  const id='R-'+crypto.randomUUID().slice(0,8).toUpperCase();
  const fee=days*p.day_price;
  db.prepare('INSERT INTO rentals(id,product_id,unit_id,customer,start_date,end_date,days,fee,deposit,status) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,p.id,unit.id,customer.trim(),startDate,endDate,days,fee,p.deposit,'confirmed');
  db.prepare('INSERT INTO inventory_events(unit_id,event_type,details) VALUES(?,?,?)').run(unit.id,'RENTAL_CREATED',id);
  db.exec('COMMIT'); return {id,product:p.name,days,fee,deposit:p.deposit,total:fee+p.deposit,status:'confirmed',payment:'demo_not_charged'};
 } catch(e){db.exec('ROLLBACK'); throw e;}
}
export function createOrder(db,{productId,customer}) {
 if(typeof customer!=='string'||customer.trim().length<2||customer.length>80) throw Object.assign(new Error('고객 이름은 2~80자여야 합니다.'),{status:400});
 db.exec('BEGIN IMMEDIATE');
 try {
  const p=db.prepare('SELECT * FROM products WHERE id=?').get(productId);
  if(!p) throw Object.assign(new Error('상품을 찾을 수 없습니다.'),{status:404});
  // 이미 예약된 상품은 판매할 수 없습니다. 구매/렌탈 동시 경합을 원자적으로 차단.
  const unit=db.prepare(`SELECT u.* FROM units u WHERE u.product_id=? AND u.state='ready' AND NOT EXISTS
  (SELECT 1 FROM rentals r WHERE r.unit_id=u.id AND r.status IN ('confirmed','shipped')) ORDER BY u.id LIMIT 1`).get(productId);
  if(!unit) throw Object.assign(new Error('현재 구매 가능한 실물이 없습니다.'),{status:409});
  const id='O-'+crypto.randomUUID().slice(0,8).toUpperCase();
  db.prepare("UPDATE units SET state='sold' WHERE id=?").run(unit.id);
  db.prepare('INSERT INTO orders(id,product_id,unit_id,customer,amount) VALUES(?,?,?,?,?)').run(id,p.id,unit.id,customer.trim(),p.buy_price);
  db.prepare('INSERT INTO inventory_events(unit_id,event_type,details) VALUES(?,?,?)').run(unit.id,'ORDER_DEMO_CREATED',id);
  db.exec('COMMIT'); return {id,product:p.name,amount:p.buy_price,status:'demo_pending_payment',payment:'demo_not_charged'};
 }catch(e){db.exec('ROLLBACK');throw e;}
}
export function getMetrics(db){
 const g=sql=>db.prepare(sql).get().n;
 return {
  activeRentals:g("SELECT COUNT(*) n FROM rentals WHERE status IN ('confirmed','shipped')"),
  completedRentals:g("SELECT COUNT(*) n FROM rentals WHERE status='returned'"),
  rentRevenue:g("SELECT COALESCE(SUM(fee),0) n FROM rentals WHERE status IN ('confirmed','shipped','returned')"),
  demoOrders:g("SELECT COUNT(*) n FROM orders"),
  buyRevenue:g("SELECT COALESCE(SUM(amount),0) n FROM orders"),
  totalUnits:g('SELECT COUNT(*) n FROM units'),
  readyUnits:g("SELECT COUNT(*) n FROM units WHERE state='ready'"),
  cleaningUnits:g("SELECT COUNT(*) n FROM units WHERE state='cleaning'"),
  repairUnits:g("SELECT COUNT(*) n FROM units WHERE state='repair'"),
  soldUnits:g("SELECT COUNT(*) n FROM units WHERE state='sold'")
 };
}

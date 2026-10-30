import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'luxuryrental-api-'));
process.env.NODE_ENV = 'test';
process.env.LR_DB_PATH = path.join(tempDir, 'qa.db');
process.env.ADMIN_PASSWORD = 'qa-test-password-only-not-for-deployment';
const { server } = await import('./index.mjs');
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
after(() => new Promise((resolve,reject) => server.close(err => err ? reject(err) : resolve())));
const request = async (url, method='GET', body, cookie) => {
 const res = await fetch(base+url, {method, headers:{...(body?{'content-type':'application/json'}:{}), ...(cookie?{cookie}:{})}, body:body?JSON.stringify(body):undefined});
 return {res,data:await res.json()};
};

test('API health and product catalog are available', async () => {
 const health=await request('/api/health'); assert.equal(health.res.status,200);assert.equal(health.data.ok,true);
 const products=await request('/api/products'); assert.equal(products.res.status,200);assert.equal(products.data.products.length,6);
});

test('unauthorized ERP requests are denied and invalid login rejected', async()=>{
 assert.equal((await request('/api/admin/dashboard')).res.status,401);
 assert.equal((await request('/api/admin/login','POST',{password:'wrong'})).res.status,401);
});

test('rental creation, admin shipment/return workflow and cleaning', async()=>{
 const from=new Date(Date.now()+86400000*10).toISOString().slice(0,10);
 const to=new Date(Date.now()+86400000*11).toISOString().slice(0,10);
 const made=await request('/api/rentals','POST',{productId:'p3',customer:'QA Customer',startDate:from,endDate:to});
 assert.equal(made.res.status,201);assert.equal(made.data.rental.payment,'demo_not_charged');
 const login=await request('/api/admin/login','POST',{password:process.env.ADMIN_PASSWORD});
 assert.equal(login.res.status,200);const cookie=login.res.headers.get('set-cookie').split(';')[0];
 const dashboard=await request('/api/admin/dashboard','GET',undefined,cookie);
 assert.equal(dashboard.res.status,200); const rental=dashboard.data.rentals.find(r=>r.id===made.data.rental.id);
 assert.ok(rental);
 assert.equal((await request(`/api/admin/rentals/${rental.id}`,'PATCH',{status:'returned'},cookie)).res.status,409);
 assert.equal((await request(`/api/admin/rentals/${rental.id}`,'PATCH',{status:'shipped'},cookie)).res.status,200);
 assert.equal((await request(`/api/admin/rentals/${rental.id}`,'PATCH',{status:'returned'},cookie)).res.status,200);
 const newDashboard=await request('/api/admin/dashboard','GET',undefined,cookie);
 assert.equal(newDashboard.data.units.find(u=>u.id===rental.unit_id).state,'cleaning');
 assert.equal((await request('/api/admin/logout','POST',undefined,cookie)).res.status,200);
 assert.equal((await request('/api/admin/dashboard','GET',undefined,cookie)).res.status,401);
});

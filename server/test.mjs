import test from 'node:test';import assert from 'node:assert/strict';
import {openDB,getCatalog,availableUnits,createRental,createOrder,validRentalDates} from './db.mjs';
const today=new Date(Date.now()+86400000*2).toISOString().slice(0,10);
const day3=new Date(Date.now()+86400000*4).toISOString().slice(0,10);
test('seed generates six products and available units',()=>{const db=openDB(':memory:');assert.equal(getCatalog(db).length,6);assert.equal(availableUnits(db,'p1',today,day3).length,3);db.close()});
test('rental price and booking conflicts are checked per physical unit',()=>{const db=openDB(':memory:');const a=createRental(db,{productId:'p3',customer:'Test Customer',startDate:today,endDate:day3});assert.equal(a.days,3);assert.equal(a.fee,162000);const b=createRental(db,{productId:'p3',customer:'Test Customer',startDate:today,endDate:day3});assert.notEqual(a.id,b.id);assert.equal(availableUnits(db,'p3',today,day3).length,0);assert.throws(()=>createRental(db,{productId:'p3',customer:'Test Customer',startDate:today,endDate:day3}),{status:409});db.close()});
test('purchase consumes an unreserved physical unit without charging money',()=>{const db=openDB(':memory:');const a=createOrder(db,{productId:'p2',customer:'Demo Buyer'});assert.equal(a.status,'demo_pending_payment');assert.equal(a.payment,'demo_not_charged');db.close()});
test('invalid dates cannot be booked',()=>{assert.equal(validRentalDates('2021-01-01','2021-01-03'),null);assert.equal(validRentalDates('2026-02-30','2026-03-02'),null)});

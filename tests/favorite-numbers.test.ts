import test from 'node:test';
import assert from 'node:assert/strict';
import {nextFavoriteNumber,normalizeFavoriteCounter,reconcileFavoriteNumbers} from '../src/favorite-numbers';
import type {ProfileId} from '../src/music';
const item=(number:number,profile:ProfileId='lofi')=>({number,settings:{profile}});

test('favorite numbers wrap at 999 and skip occupied numbers',()=>{
  assert.equal(nextFavoriteNumber(998,new Set()),999);
  assert.equal(nextFavoriteNumber(999,new Set()),1);
  assert.equal(nextFavoriteNumber(999,new Set([1,2])),3);
  assert.equal(nextFavoriteNumber(998,new Set([999,1,2])),3);
  assert.equal(normalizeFavoriteCounter(1001),2);
  assert.equal(normalizeFavoriteCounter(Infinity),0);
});
test('reload preserves a wrapped counter even while 999 is saved',()=>{
  const items=[item(3),item(999),item(1),item(2,'dub')];
  const counters=reconcileFavoriteNumbers(items,{lofi:3,dub:999});
  assert.deepEqual(items.map(i=>i.number),[3,999,1,2]);
  assert.equal(nextFavoriteNumber(counters.lofi,new Set([3,999,1])),4);
  assert.equal(nextFavoriteNumber(counters.dub,new Set([2])),1);
});
test('migration reserves valid labels, keeps oldest duplicates and only renumbers invalid entries',()=>{
  const items=[item(1),item(1002),item(999),item(1),item(0),item(1,'dub')];
  const counters=reconcileFavoriteNumbers(items,{lofi:1001});
  assert.deepEqual(items.map(i=>i.number),[5,4,999,1,3,1]);
  const again=structuredClone(items);
  assert.deepEqual(reconcileFavoriteNumbers(again,counters),counters);
  assert.deepEqual(again,items);
  assert.equal(new Set(items.filter(i=>i.settings.profile==='lofi').map(i=>i.number)).size,5);
});
test('missing counters recover from the newest valid saved item',()=>{
  const items=[item(2),item(999),item(1)];
  assert.equal(reconcileFavoriteNumbers(items,undefined).lofi,2);
});

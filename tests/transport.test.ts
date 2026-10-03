import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {musicScore,normalizeSettings,type MusicEvent} from '../src/music';
import {Score} from '../src/score';
import {Transport} from '../src/transport';
const baseline=JSON.parse(readFileSync(new URL('./fixtures/strudel-v080.json',import.meta.url),'utf8'));
const round=(n:number)=>Math.round(n*1e8)/1e8;

test('independent score preserves 26k+ old Strudel onsets, notes and seconds across v1-v5',()=>{
 for(const c of baseline.cases){
  const events=musicScore(normalizeSettings(c.settings)).onsets(0,64);
  const rows=events.map(e=>[round(e.at*240/c.settings.bpm),round(e.length*240/c.settings.bpm),e]);
  assert.equal(rows.length,c.count);
  assert.equal(createHash('sha256').update(JSON.stringify(events)).digest('hex'),c.eventHash);
  events.forEach((e,i)=>{assert.ok(Math.abs(e.at*240/c.settings.bpm-c.timings[i][0])<baseline.toleranceSeconds);assert.ok(Math.abs(e.length*240/c.settings.bpm-c.timings[i][1])<baseline.toleranceSeconds);});
 }
});

test('fixed-tempo dispatch agrees with captured Strudel clock times and durations',()=>{
 let now=10;const found:{at:number;time:number;duration:number}[]=[];
 const t=new Transport({clock:()=>now,trigger:(e,time,duration)=>found.push({at:e.at,time,duration}),onError:e=>{throw e;}});
 t.start(musicScore(normalizeSettings(baseline.clock.settings)),120);
 for(let i=0;i<175;i++){now=10+i*.05;t.tick();}
 const actual=found.filter(e=>e.at<4);assert.equal(actual.length,baseline.clock.triggered.length);
 actual.forEach((e,i)=>{const old=baseline.clock.triggered[i];assert.equal(e.at,old.at);assert.ok(Math.abs(e.time-old.time)<1e-8);assert.ok(Math.abs(e.duration-old.duration)<1e-8);});
 t.stop();now+=10;t.tick();assert.equal(found.filter(e=>e.at<4).length,actual.length);
});

const score=(note:number)=>new Score(bar=>Array.from({length:4},(_,i):MusicEvent=>({at:bar+i/4,length:i===0?2:.1,voice:'keys',layer:'harmony',notes:[note],gain:.1,pan:0,cutoff:3000})));
const rig=()=>{
 let now=0;const events:{at:number;note:number;time:number;duration:number;bpm:number}[]=[];
 const t=new Transport({clock:()=>now,trigger:(e,time,duration,bpm)=>events.push({at:e.at,note:e.notes[0],time,duration,bpm}),onError:e=>{throw e;}});
 return {t,events,get now(){return now;},advance(to:number){while(now<to){now=Math.min(to,now+.037);t.tick();}},jump(to:number){now=to;t.tick();}};
};

test('tempo changes preserve phase; rapid edits only replace audio not yet reserved',()=>{
 const r=rig(),activated:number[]=[];r.t.start(score(60),100);r.advance(.6);
 assert.equal(r.t.queue(score(61),180,()=>activated.push(180)),1);
 r.advance(1.2);assert.equal(r.t.queue(score(62),60,()=>activated.push(60)),1);
 r.advance(2.45);assert.equal(r.t.queue(score(63),150,()=>activated.push(150)),2);
 r.advance(8.5);assert.deepEqual(activated,[60,150]);assert.equal(r.t.pending,false);
 const unique=new Set(r.events.map(e=>e.at));assert.equal(unique.size,r.events.length);
 for(const e of r.events){
  const time=e.at<1?.19+e.at*2.4:e.at<2?2.59+(e.at-1)*4:6.59+(e.at-2)*1.6;
  assert.ok(Math.abs(e.time-time)<1e-10);
  assert.equal(e.note,e.at<1?60:e.at<2?62:63);
 }
 assert.equal(r.events.find(e=>e.at===0)!.duration,4.8);
 assert.ok(Math.abs(r.t.position-(2+(8.5-6.59)/1.6))<1e-10);
});

test('jitter never duplicates onsets, and a long stall skips backlog without losing phase',()=>{
 const r=rig();r.t.start(score(60),137);r.advance(10);
 const before=r.events.length;r.jump(21600);r.advance(21602);
 const after=r.events.slice(before);assert.ok(after.length>0&&after.length<8);
 assert.ok(after.every(e=>e.time>=21600));
 for(const e of after)assert.ok(Math.abs(e.time-(.19+e.at*240/137))<1e-8);
 assert.equal(new Set(r.events.map(e=>e.at)).size,r.events.length);
 assert.ok(r.t.stalled>0);
 r.t.stop();const count=r.events.length;r.advance(21604);assert.equal(r.events.length,count);
 r.t.start(score(64),60);r.advance(21605);assert.equal(r.events[count].at,0);assert.equal(r.events[count].note,64);
});

test('half-open onset queries include exact boundaries once and errors stop dispatch',()=>{
 const s=score(60);const whole=s.onsets(0,4);
 const split=Array.from({length:160},(_,i)=>s.onsets(i/40,(i+1)/40)).flat();assert.deepEqual(split,whole);
 assert.deepEqual(s.onsets(NaN,2),[]);assert.deepEqual(s.onsets(2,2),[]);
 let now=0,errors=0;const t=new Transport({clock:()=>now,trigger:()=>{throw Error('voice');},onError:()=>errors++});
 t.start(s,120);now=.05;t.tick();assert.equal(errors,1);assert.equal(t.running,false);t.tick();assert.equal(errors,1);
 assert.throws(()=>t.start(s,0),RangeError);
});

test('future reservations receive their immutable render context before audible activation',()=>{
 let now=0,active='old';const seen:{at:number;render:string;active:string}[]=[];
 const t=new Transport<string>({clock:()=>now,trigger:(e,_t,_d,_b,render)=>seen.push({at:e.at,render,active}),onError:e=>{throw e;}});
 t.start(score(60),180,'old');now=.2;t.tick();t.queue(score(61),90,()=>{active='new';},'new');
 now=1.4;t.tick();
 const reservation=seen.find(e=>e.at===1)!;assert.ok(reservation);assert.equal(reservation.render,'new');assert.equal(reservation.active,'old');
 now=1.6;t.tick();assert.equal(active,'new');
});

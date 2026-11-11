import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULTS,selectProfile,eventsForBar,chordAt,normalizeSettings,upgradeSettings,type Settings,type MusicEvent} from '../src/music';
import {nextHarmonyBoundary} from '../src/harmony-v5';
import {chordScale} from '../src/harmony-v17';
import {melodyRestsV17} from '../src/melody-v17';
import {melodyV35} from '../src/melody-v32';
import {capturePhrase,normalizePhrase,playbackScore} from '../src/saved-phrase';
const modes=['lofi','ambient','dub','dnb'] as const;
type Mode=typeof modes[number];
const SEEDS=['SLOWFLOW','AB12CD','PULSE2','ZK9Q','MOON77','RAIN3','DESK01','NIGHT8','Q1W2E3','TT55','LOFI99','XYZW'];
// Pinned to v35: later generators have their own suites.
const make=(mode:Mode,extra:Partial<Settings>={}):Settings=>{
  const base=selectProfile({...DEFAULTS,seed:'SLOWFLOW'},mode==='dnb'?'dub':mode);
  return {...base,generatorVersion:35,groove:mode==='dnb'?'dnb':'straight',bpm:mode==='dnb'?170:base.bpm,...extra};
};
const sha=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const score=(s:Settings,start=0,n=8)=>Array.from({length:n},(_,i)=>eventsForBar(s,start+i)).flat().sort((a,b)=>a.at-b.at);
const leadOf=(s:Settings,start:number)=>score(s,start).filter(e=>e.layer==='motif'&&e.role!=='neighbor');
const pc=(n:number)=>((n%12)+12)%12;
/** The sixteenth a note belongs to, whether or not it lies back behind the grid. */
const stepOf=(e:MusicEvent,from:number)=>Math.floor((e.at-from)*16+.2);
/** A sentence bar by bar: each bar's rhythm, and the rhythm with its pitches. */
function barsOf(lead:MusicEvent[],start:number) {
  const rhythm=Array.from({length:8},()=>[] as number[]),notes=Array.from({length:8},()=>[] as string[]);
  for(const e of lead){const step=stepOf(e,start),bar=Math.floor(step/16);if(bar<0||bar>7)continue;rhythm[bar].push(step%16);notes[bar].push(`${step%16}:${e.notes[0]}`);}
  return {rhythm:rhythm.map(x=>x.join()),notes:notes.map(x=>x.join())};
}
/** How a sentence repeats itself, bar by bar. */
function repeats(s:Settings,seeds=SEEDS,span=128) {
  let sentences=0,answer=0,most=0,run=0,exact=0,twoBar=0,sameBar=0,notes=0;
  for(const seed of seeds)for(const repetition of [0,2] as const)for(let start=0;start<span;start+=8){
    const lead=leadOf({...s,seed,melodyRepetition:repetition},start);
    if(lead.length<3)continue;
    sentences++;notes+=lead.length;
    const {rhythm,notes:full}=barsOf(lead,start);
    if(rhythm[0]&&rhythm[0]===rhythm[2]&&rhythm[1]===rhythm[3])answer++;
    if(rhythm[0]&&rhythm[0]===rhythm[1])sameBar++;
    if(rhythm[0]!==rhythm[1]&&rhythm[0]===rhythm[2]&&rhythm[1]===rhythm[3])twoBar++;
    const count=new Map<string,number>();
    for(const r of rhythm)if(r)count.set(r,(count.get(r)??0)+1);
    most+=Math.max(...count.values());
    let here=1,best=1;
    for(let b=1;b<8;b++){here=rhythm[b]&&rhythm[b]===rhythm[b-1]?here+1:1;best=Math.max(best,here);}
    run+=best;
    for(let b=1;b<8;b++)if(rhythm[b]&&full.slice(0,b).includes(full[b]))exact++;
  }
  return {answer:answer/sentences,most:most/sentences,run:run/sentences,exact:exact/sentences,twoBar:twoBar/sentences,sameBar:sameBar/sentences,notes:notes/sentences/8};
}
const sparse:[string,Settings][]=[['ambient',make('ambient')],['dnb',make('dnb')],['low-energy lofi',make('lofi',{energy:25})]];

test('v34 favorites keep exact scores while new music and upgrades use v35',()=>{
  // Recorded from v34 before v35 existed: 96 bars × four moods × repetition off/normal.
  const hashes:Record<string,string>={
    'lofi:0':'d22e685528e21474dfbe33257655c8a5fe90122c9d8330e4ba411ef04706c450','lofi:2':'14b1d04e5befde86ac9bcf8a6d576548bb18137bcb4cbf295e5d2affe94d24e1',
    'ambient:0':'4bcb9b26b327b376648847581a8113f59e746ff10086a4917ecc2911393c1667','ambient:2':'40d85c6f1dfdb09ea49c131c6cdcf5a55b0a3f5240362a322bac4bf064f1fe0c',
    'dub:0':'14afdbc91a4bc204df9609aaa76ec9dbbf01d15fd4962ea12c597b1fb07464c9','dub:2':'82bf983baff4b9521a8de83419208aced586abe88cb5450e2106844ae668103e',
    'dnb:0':'09273aaeacef0c5613aa0ac6a3b8423ca7d28a21306fc453c2650e48a117b451','dnb:2':'53dbe6c8da15cd63634a01db53e922fcd87dc5a6dd7c1167d74c470338d1af4f'};
  for(const mode of modes)for(const rep of [0,2] as const){
    const old=make(mode,{generatorVersion:34,melodyRepetition:rep});
    assert.equal(sha(Array.from({length:96},(_,b)=>eventsForBar(old,b))),hashes[`${mode}:${rep}`],`${mode}:${rep}`);
    assert.equal(normalizeSettings(old).generatorVersion,34);
    assert.equal(upgradeSettings(old).generatorVersion,DEFAULTS.generatorVersion);
    assert.equal(melodyV35(old),false);
  }
  assert.ok(DEFAULTS.generatorVersion>=35);
  assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:35}).generatorVersion,35);
});

test('the cell grammar is the v34 one; the sparse moods and house get a new lead over the same drums and chords',()=>{
  for(const seed of SEEDS.slice(0,6)){
    for(const s of [make('lofi',{seed}),make('lofi',{seed,energy:70})])
      assert.deepEqual(score(s,0,96),score({...s,generatorVersion:34},0,96),`lofi ${s.energy} ${seed}`);
    for(const now of [make('ambient',{seed}),make('dnb',{seed}),make('dub',{seed}),make('lofi',{seed,energy:25})]){
      const old={...now,generatorVersion:34 as const},name=`${now.profile}/${now.groove}/${now.energy} ${seed}`;
      assert.deepEqual(score(now,0,64).filter(e=>e.layer==='rhythm'),score(old,0,64).filter(e=>e.layer==='rhythm'),`${name} drums`);
      for(let bar=0;bar<64;bar++)assert.deepEqual(chordAt(now,bar),chordAt(old,bar));
      assert.notDeepEqual(score(now,0,64).filter(e=>e.layer==='motif'),score(old,0,64).filter(e=>e.layer==='motif'),`${name}: the lead is new`);
    }
  }
});

test('a sparse sentence no longer says one bar rhythm four times',()=>{
  for(const [name,s] of sparse){
    const now=repeats(s),before=repeats({...s,generatorVersion:34}),old=repeats({...s,generatorVersion:31});
    const show=(key:keyof typeof now)=>`${name} ${key} ${now[key].toFixed(2)} (v34 ${before[key].toFixed(2)}, v31 ${old[key].toFixed(2)})`;
    // The answer took the statement's rhythm in nine sentences of ten (v31: about half).
    assert.ok(now.answer>.2&&now.answer<.6&&before.answer>.8,show('answer'));
    // The commonest bar rhythm of a sentence, and the longest run of one rhythm, are back near v31.
    assert.ok(now.most<before.most-.6&&now.most<old.most+.2,show('most'));
    assert.ok(now.run<before.run-.4,show('run'));
    assert.ok(now.exact<before.exact,show('exact'));
    assert.ok(Math.abs(now.notes-before.notes)<before.notes*.1,show('notes'));
  }
});

test('the house riff is two bars long: said twice, not one bar four times',()=>{
  for(const energy of [undefined,70]){
    const s=make('dub',energy?{energy}:{}),now=repeats(s),before=repeats({...s,generatorVersion:34}),old=repeats({...s,generatorVersion:31});
    const show=(key:keyof typeof now)=>`house ${energy??'default'} ${key} ${now[key].toFixed(2)} (v34 ${before[key].toFixed(2)}, v31 ${old[key].toFixed(2)})`;
    // Bars one and two differ and come back as bars three and four.
    assert.ok(now.twoBar>.85&&before.twoBar<.15,show('twoBar'));
    assert.ok(now.sameBar<.1&&before.sameBar>.85,show('sameBar'));
    // One rhythm ran through five or six bars in a row; a bar came back note for note about three times.
    assert.ok(now.run<1.6&&before.run>4.5&&old.run>3,show('run'));
    assert.ok(now.most<4&&before.most>5,show('most'));
    assert.ok(now.exact<2&&before.exact>2.4,show('exact'));
    assert.ok(Math.abs(now.notes-before.notes)<before.notes*.12,show('notes'));
  }
});

test('what v32 gained stays in every mood: a travelling line, breath after two bars, a late peak, three landings',()=>{
  for(const [name,s] of [...sparse,['house',make('dub')],['house 70',make('dub',{energy:70})]] as [string,Settings][]){
    let windows=0,rocking=0,units=0,breath=0,phrases=0,late=0,dense=0;
    const landings=new Set<number>();
    for(const seed of SEEDS)for(let start=0;start<128;start+=8){
      const x={...s,seed},lead=leadOf(x,start),p=lead.map(e=>e.notes[0]);
      if(lead.length<2)continue;
      phrases++;
      for(let i=2;i<p.length;i++){windows++;if(p[i]===p[i-2]&&p[i]!==p[i-1])rocking++;}
      for(let k=0;k<2;k++){
        const from=start+k*2,unit=lead.filter(e=>e.at>=from&&e.at<from+2);
        if(unit.length<2)continue;
        units++;
        const last=unit.at(-1)!,next=lead.find(e=>e.at>=from+2);
        if(((next?next.at:start+8)-last.at-last.length)*4>=.95)breath++;
      }
      const top=Math.max(...p);
      if(lead.find(e=>e.notes[0]===top)!.at>=start+4)late++;
      landings.add(stepOf(lead.at(-1)!,start+6));
      for(let b=0;b<8;b++)dense=Math.max(dense,score(x,start+b,1).filter(e=>e.layer==='motif').length);
    }
    assert.ok(rocking/windows<.13,`${name}: A–B–A turns ${(rocking/windows).toFixed(2)}`);
    assert.ok(breath>=units*.78,`${name}: units followed by a beat of rest ${breath}/${units}`);
    assert.ok(late>=phrases*.7,`${name}: peak in bars five to eight ${late}/${phrases}`);
    assert.ok([...landings].every(step=>[14,16,24].includes(step)),`${name}: landings ${[...landings]}`);
    assert.ok(dense<=6,`${name}: lead notes in one bar ${dense}`);
  }
});

test('the v35 lines are sound: chord-scale notes, resolved passing tones, no wide leaps, nothing rings into the next chord',()=>{
  let passing=0;
  for(const seed of SEEDS.slice(0,6))for(const s of [make('ambient',{seed,evolution:60}),make('dnb',{seed,energy:80}),make('dub',{seed,energy:90,bpm:128}),make('dub',{seed,bpm:100}),make('lofi',{seed,energy:20,bpm:60})]){
    // The ambient lead breathes (v30): its long releases overlap on purpose, as they did in v34.
    const seconds=s.bpm/240,dry=s.profile!=='ambient';
    for(let start=0;start<96;start+=8){
      const events=score(s,start).filter(e=>e.layer==='motif'),lead=events.filter(e=>e.role!=='neighbor');
      if(!lead.length){assert.ok(melodyRestsV17(s,start),`${seed}: only the breakdown rest is silent`);continue;}
      for(let i=0;i<events.length;i++){
        const e=events[i],next=events[i+1],tail=e.at+e.length+e.release!*seconds,chord=chordAt(s,Math.floor(e.at));
        assert.ok(e.length>0&&e.gain>0&&e.gain<.09&&e.notes[0]>=60&&e.notes[0]<=81);
        assert.ok(chordScale(s,chord).includes(pc(e.notes[0])),'every lead note belongs to its chord-scale');
        if(dry)assert.ok(tail<=nextHarmonyBoundary(s,e.at)+1e-7,`${seed}: the release fits before the harmony changes`);
        if(dry&&next&&tail>next.at+1e-7)assert.ok(Math.abs(next.notes[0]-e.notes[0])>=1&&Math.abs(next.notes[0]-e.notes[0])<=2,'only steps are slurred');
        if(e.role==='passing'){passing++;assert.ok(next&&next.notes[0]===e.resolvesTo&&Math.abs(next.notes[0]-e.notes[0])<=2);}
        if(e.role==='neighbor')assert.ok(next&&next.notes[0]===e.resolvesTo&&Math.abs(next.notes[0]-e.notes[0])<=2);
      }
      for(let i=1;i<lead.length;i++)assert.ok(Math.abs(lead[i].notes[0]-lead[i-1].notes[0])<=9,'no leap beyond a sixth');
      assert.ok(lead.at(-1)!.at>=start+6.75,`${seed} ${start}: a closing note in the last two bars`);
    }
  }
  assert.ok(passing>100,`passing tones ${passing}`);
});

test('the repetition control still orders how often a hook returns, and the score is reproducible',()=>{
  for(const mode of ['dub','dnb','ambient'] as const){
    const s=make(mode,{seed:'BREATH'});
    const hooks=(x:Settings)=>{
      const set=new Set<string>();
      for(let start=8;start<512;start+=8){const hook=leadOf(x,start).filter(e=>e.at<start+2);if(hook.length)set.add(hook.map(e=>stepOf(e,start)+':'+(e.notes[0]-hook[0].notes[0])).join());}
      return set.size;
    };
    const [off,low,normal,high]=([0,1,2,3] as const).map(level=>hooks({...s,melodyRepetition:level}));
    assert.ok(Math.min(off,low)>normal&&normal>high,`${mode}: ${off}/${low}/${normal}/${high}`);
    const replay=make(mode,{seed:'REPLAY35',evolution:70}),original=score(replay,56);
    for(let bar=512;bar>=0;bar-=8)eventsForBar({...replay,seed:`EVICT${bar}`},bar);
    assert.deepEqual([63,57,61,56,62,59,58,60].flatMap(b=>eventsForBar(replay,b)).sort((a,b)=>a.at-b.at),original);
    assert.ok(score({...replay,generatorVersion:34},56).length>0); // interleaved old queries share no cache
    assert.deepEqual(score(replay,56),original);
    const saved=capturePhrase({settings:replay,opening:true},56),loaded=normalizePhrase(JSON.parse(JSON.stringify(saved)))!;
    assert.deepEqual(playbackScore({settings:replay,phrase:loaded,opening:true}).onsets(0,8),saved.events);
    for(const layer of ['bass','motif','harmony'] as const)
      assert.deepEqual(score({...replay,layers:{...replay.layers,[layer]:false}},56),original.filter(e=>e.layer!==layer));
  }
});

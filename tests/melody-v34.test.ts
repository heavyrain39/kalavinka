import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULTS,selectProfile,eventsForBar,chordAt,normalizeSettings,upgradeSettings,type Settings,type MusicEvent} from '../src/music';
import {nextHarmonyBoundary} from '../src/harmony-v5';
import {chordScale} from '../src/harmony-v17';
import {melodyRestsV17} from '../src/melody-v17';
import {melodyV34} from '../src/melody-v32';
import {capturePhrase,normalizePhrase,playbackScore} from '../src/saved-phrase';
const modes=['lofi','ambient','dub','dnb'] as const;
type Mode=typeof modes[number];
const SEEDS=['SLOWFLOW','AB12CD','PULSE2','ZK9Q','MOON77','RAIN3','DESK01','NIGHT8','Q1W2E3','TT55','LOFI99','XYZW'];
// Pinned to v34: later generators have their own suites.
const make=(mode:Mode,extra:Partial<Settings>={}):Settings=>{
  const base=selectProfile({...DEFAULTS,seed:'SLOWFLOW'},mode==='dnb'?'dub':mode);
  return {...base,generatorVersion:34,groove:mode==='dnb'?'dnb':'straight',bpm:mode==='dnb'?170:base.bpm,...extra};
};
const sha=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const score=(s:Settings,start=0,n=8)=>Array.from({length:n},(_,i)=>eventsForBar(s,start+i)).flat().sort((a,b)=>a.at-b.at);
const leadOf=(s:Settings,start:number)=>score(s,start).filter(e=>e.layer==='motif'&&e.role!=='neighbor');
const pc=(n:number)=>((n%12)+12)%12;
/** The sixteenth a note belongs to, whether or not it lies back behind the grid. */
const stepOf=(e:MusicEvent,from:number)=>Math.floor((e.at-from)*16+.2);
/** Half-bar windows of a sentence that hold a cell (two notes or more): its rhythm, its contour and where it starts. */
function cells(lead:MusicEvent[],start:number,bars:number) {
  const windows=new Map<number,{step:number;note:number}[]>();
  for(const e of lead){const step=stepOf(e,start),w=Math.floor(step/8);if(w<bars*2)(windows.get(w)??windows.set(w,[]).get(w)!).push({step:step%8,note:e.notes[0]});}
  const out=new Map<number,{rhythm:string;shape:string;first:number}>();
  for(const [w,list] of windows)if(list.length>=2)out.set(w,{rhythm:list.map(x=>x.step).join(),shape:list.slice(1).map((x,i)=>Math.sign(x.note-list[i].note)).join(),first:list[0].note});
  return out;
}
/** How often the commonest half-bar rhythm occurs. */
const commonest=(found:ReturnType<typeof cells>)=>{const count=new Map<string,number>();for(const c of found.values())count.set(c.rhythm,(count.get(c.rhythm)??0)+1);return Math.max(0,...count.values());};
/** Steps of a sequence: a cell followed, half a bar or a bar later, by itself at another height. */
const stairs=(found:ReturnType<typeof cells>)=>[...found].filter(([w,c])=>[1,2].some(d=>{const next=found.get(w+d);return !!next&&next.rhythm===c.rhythm&&next.shape===c.shape&&next.first!==c.first;})).length;

test('v33 favorites keep exact scores while new music and upgrades use v34',()=>{
  // Recorded from v33 before v34 existed: 96 bars × four moods × repetition off/normal.
  const hashes:Record<string,string>={
    'lofi:0':'1a654a5084b7a00f99e514f3b72368941ea8a7123015ff4a60e0ea9684307643','lofi:2':'3d2751ccadf4ceb92ab1a8327f5e71fbfd1fa0bb7c4cf2fbad80d284ee0b3a85',
    'ambient:0':'4bcb9b26b327b376648847581a8113f59e746ff10086a4917ecc2911393c1667','ambient:2':'40d85c6f1dfdb09ea49c131c6cdcf5a55b0a3f5240362a322bac4bf064f1fe0c',
    'dub:0':'14afdbc91a4bc204df9609aaa76ec9dbbf01d15fd4962ea12c597b1fb07464c9','dub:2':'82bf983baff4b9521a8de83419208aced586abe88cb5450e2106844ae668103e',
    'dnb:0':'09273aaeacef0c5613aa0ac6a3b8423ca7d28a21306fc453c2650e48a117b451','dnb:2':'53dbe6c8da15cd63634a01db53e922fcd87dc5a6dd7c1167d74c470338d1af4f'};
  for(const mode of modes)for(const rep of [0,2] as const){
    const old=make(mode,{generatorVersion:33,melodyRepetition:rep});
    assert.equal(sha(Array.from({length:96},(_,b)=>eventsForBar(old,b))),hashes[`${mode}:${rep}`],`${mode}:${rep}`);
    assert.equal(normalizeSettings(old).generatorVersion,33);
    assert.equal(upgradeSettings(old).generatorVersion,DEFAULTS.generatorVersion);
    assert.equal(melodyV34(old),false);
  }
  assert.ok(DEFAULTS.generatorVersion>=34);
  assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:34}).generatorVersion,34);
});

test('only the cell grammar changes: sparse moods, house riffs, drums and chords are the v33 ones',()=>{
  for(const seed of SEEDS.slice(0,6)){
    // Ambient, D&B and low energy use the sparse grammar; house plays riffs.
    for(const s of [make('ambient',{seed}),make('dnb',{seed}),make('dub',{seed}),make('dub',{seed,energy:70}),make('lofi',{seed,energy:25})])
      assert.deepEqual(score(s,0,96),score({...s,generatorVersion:33},0,96),`${s.profile}/${s.groove}/${s.energy} ${seed}`);
    const now=make('lofi',{seed}),old=make('lofi',{seed,generatorVersion:33});
    assert.deepEqual(score(now,0,64).filter(e=>e.layer==='rhythm'),score(old,0,64).filter(e=>e.layer==='rhythm'),`${seed} drums`);
    for(let bar=0;bar<64;bar++)assert.deepEqual(chordAt(now,bar),chordAt(old,bar));
    assert.notDeepEqual(score(now,0,64).filter(e=>e.layer==='motif'),score(old,0,64).filter(e=>e.layer==='motif'),`${seed}: the lo-fi lead is new`);
  }
});

test('a sentence no longer opens with the same half bar four times',()=>{
  const measure=(version:31|32|34)=>{
    let sentences=0,four=0,three=0,steps=0,many=0,most=0;
    for(const seed of SEEDS)for(const energy of [42,70])for(const repetition of [0,2] as const)for(let start=0;start<128;start+=8){
      const lead=leadOf(make('lofi',{seed,energy,melodyRepetition:repetition,generatorVersion:version}),start);
      if(lead.length<4)continue;
      sentences++;
      const opening=commonest(cells(lead,start,4)),whole=cells(lead,start,8),climbed=stairs(whole);
      if(opening>=4)four++;if(opening>=3)three++;
      steps+=climbed;if(climbed>=3)many++;most+=commonest(whole);
    }
    return {four:four/sentences,three:three/sentences,steps:steps/sentences,many:many/sentences,most:most/sentences};
  };
  const now=measure(34),before=measure(32),old=measure(31);
  // The same rhythm four times in the first four bars: 5% in v31, 71% in v32.
  assert.ok(now.four<.08&&before.four>.55,`four times ${now.four.toFixed(2)} (v32 ${before.four.toFixed(2)})`);
  assert.ok(now.three<.4,`three times ${now.three.toFixed(2)}`);
  // Sequence steps over the whole sentence: about one in v34, about two in v32.
  assert.ok(now.steps<1.1&&before.steps>1.5,`steps per sentence ${now.steps.toFixed(2)} (v32 ${before.steps.toFixed(2)})`);
  assert.ok(now.many<.08&&before.many>.2,`sentences with three steps or more ${now.many.toFixed(2)} (v32 ${before.many.toFixed(2)})`);
  // The commonest half-bar rhythm of a sentence is back to how often v31 used one.
  assert.ok(now.most<old.most+.5&&before.most>old.most+.8,`commonest rhythm ${now.most.toFixed(1)} (v31 ${old.most.toFixed(1)}, v32 ${before.most.toFixed(1)})`);
});

test('an idea steps its cell or follows it with another one; the answer keeps the cell, not the whole idea',()=>{
  let ideas=0,stepped=0,pairs=0,head=0,whole=0,tails=0;
  for(const seed of SEEDS)for(const energy of [42,70])for(let start=0;start<128;start+=8){
    const lead=leadOf(make('lofi',{seed,energy}),start);
    const a=lead.filter(e=>e.at<start+2),b=lead.filter(e=>e.at>=start+2&&e.at<start+4);
    if(a.length<3||b.length<3)continue;
    ideas++;
    const steps=a.map(e=>stepOf(e,start)),cell=steps.filter(x=>x<8);
    if([8,16].some(shift=>cell.every(x=>steps.includes(x+shift))))stepped++;
    pairs++;
    const rhythm=(unit:MusicEvent[],from:number)=>unit.map(e=>stepOf(e,from));
    const first=rhythm(a,start),second=rhythm(b,start+2);
    if(cell.every((x,i)=>second[i]===x))head++;
    if(first.join()===second.join())whole++;
    if(a.at(-1)!.notes[0]!==b.at(-1)!.notes[0])tails++;
  }
  // v32 repeated the cell in at least 70% of its ideas.
  assert.ok(stepped>=ideas*.2&&stepped<=ideas*.55,`ideas that repeat their cell ${stepped}/${ideas}`);
  assert.ok(head>=pairs*.85,`answers that open with the statement's cell ${head}/${pairs}`);
  // v32 answers took the whole rhythm of the statement (over 90%).
  assert.ok(whole>=pairs*.25&&whole<=pairs*.7,`answers in the statement's whole rhythm ${whole}/${pairs}`);
  assert.ok(tails>=pairs*.7,`answers with a new last note ${tails}/${pairs}`);
});

test('what v32 gained stays: a travelling line, breath after an idea, a late peak, the same density',()=>{
  let windows=0,rocking=0,units=0,breath=0,phrases=0,late=0,notes=0,bars=0,oldNotes=0,oldBars=0,dense=0;
  const landings=new Map<number,number>();
  for(const seed of SEEDS)for(const energy of [42,70])for(let start=0;start<128;start+=8){
    const s=make('lofi',{seed,energy}),lead=leadOf(s,start),p=lead.map(e=>e.notes[0]);
    const old=leadOf({...s,generatorVersion:31},start);
    if(old.length){oldNotes+=old.length;oldBars+=8;}
    if(lead.length<2)continue;
    notes+=lead.length;bars+=8;phrases++;
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
    const step=stepOf(lead.at(-1)!,start+6);landings.set(step,(landings.get(step)??0)+1);
    for(let b=0;b<8;b++)dense=Math.max(dense,score(s,start+b,1).filter(e=>e.layer==='motif').length);
  }
  assert.ok(rocking/windows<.12,`A–B–A turns ${(rocking/windows).toFixed(2)}`);
  assert.ok(breath>=units*.85,`ideas followed by a beat of rest ${breath}/${units}`);
  assert.ok(late>=phrases*.7,`peak in bars five to eight ${late}/${phrases}`);
  assert.ok([...landings.keys()].every(step=>[14,16,24].includes(step)),`landings ${[...landings.keys()]}`);
  const now=notes/bars,before=oldNotes/oldBars;
  assert.ok(now<=before*1.2&&now>=before*.8,`${now.toFixed(2)} notes per bar (v31 ${before.toFixed(2)})`);
  assert.ok(dense<=7,`lead notes in one bar ${dense}`);
});

test('the v34 line is sound: chord-scale notes, resolved passing tones, no wide leaps, nothing rings into the next chord',()=>{
  let passing=0;
  for(const seed of SEEDS.slice(0,8))for(const [bpm,energy] of [[50,80],[180,42],[108,100]]){
    const s=make('lofi',{seed,bpm,energy,evolution:60}),seconds=s.bpm/240;
    for(let start=0;start<96;start+=8){
      const events=score(s,start).filter(e=>e.layer==='motif'),lead=events.filter(e=>e.role!=='neighbor');
      if(!lead.length){assert.ok(melodyRestsV17(s,start),`${seed}: only the breakdown rest is silent`);continue;}
      for(let i=0;i<events.length;i++){
        const e=events[i],next=events[i+1],tail=e.at+e.length+e.release!*seconds,chord=chordAt(s,Math.floor(e.at));
        assert.ok(e.length>0&&e.gain>0&&e.gain<.09&&e.notes[0]>=60&&e.notes[0]<=81);
        assert.ok(chordScale(s,chord).includes(pc(e.notes[0])),'every lead note belongs to its chord-scale');
        assert.ok(tail<=nextHarmonyBoundary(s,e.at)+1e-7,`${seed}: the release fits before the harmony changes`);
        if(next&&tail>next.at+1e-7)assert.ok(Math.abs(next.notes[0]-e.notes[0])>=1&&Math.abs(next.notes[0]-e.notes[0])<=2,'only steps are slurred');
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
  const s=make('lofi',{seed:'BREATH'});
  const hooks=(x:Settings)=>{
    const set=new Set<string>();
    for(let start=8;start<512;start+=8){const hook=leadOf(x,start).filter(e=>e.at<start+2);if(hook.length)set.add(hook.map(e=>stepOf(e,start)+':'+(e.notes[0]-hook[0].notes[0])).join());}
    return set.size;
  };
  const [off,low,normal,high]=([0,1,2,3] as const).map(level=>hooks({...s,melodyRepetition:level}));
  assert.ok(Math.min(off,low)>normal&&normal>high,`${off}/${low}/${normal}/${high}`);
  const replay=make('lofi',{seed:'REPLAY34',evolution:70}),original=score(replay,56);
  for(let bar=512;bar>=0;bar-=8)eventsForBar({...replay,seed:`EVICT${bar}`},bar);
  assert.deepEqual([63,57,61,56,62,59,58,60].flatMap(b=>eventsForBar(replay,b)).sort((a,b)=>a.at-b.at),original);
  assert.ok(score({...replay,generatorVersion:32},56).length>0); // interleaved old queries share no cache
  assert.deepEqual(score(replay,56),original);
  const saved=capturePhrase({settings:replay,opening:true},56),loaded=normalizePhrase(JSON.parse(JSON.stringify(saved)))!;
  assert.deepEqual(playbackScore({settings:replay,phrase:loaded,opening:true}).onsets(0,8),saved.events);
  for(const layer of ['bass','motif','harmony'] as const)
    assert.deepEqual(score({...replay,layers:{...replay.layers,[layer]:false}},56),original.filter(e=>e.layer!==layer));
});

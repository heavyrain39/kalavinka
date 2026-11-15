import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULTS,selectProfile,eventsForBar,chordAt,upgradeSettings,type Settings} from '../src/music';
import {chordScale,toneClass,keyPcs,tonicPc} from '../src/harmony-v17';
import {recipeV18,companionV18,bankV18,eraBarsV36} from '../src/harmony-v18';
import {PROGRESSIONS_V18,MODES_V18} from '../src/harmony-catalog-v18';
import {arrangementAt} from '../src/arrangement';
import {capturePhrase,normalizePhrase} from '../src/saved-phrase';
const modes=['lofi','ambient','dub','dnb'] as const;
type Mode=typeof modes[number];
// Pinned to v36: later generators have their own suites.
const make=(mode:Mode,extra:Partial<Settings>={}):Settings=>{
  const base=selectProfile({...DEFAULTS,seed:'SLOWFLOW'},mode==='dnb'?'dub':mode);
  return {...base,generatorVersion:36,groove:mode==='dnb'?'dnb':'straight',bpm:mode==='dnb'?170:base.bpm,...extra};
};
const sha=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const pc=(n:number)=>((n%12)+12)%12;
const RELATIVE:Record<string,number>={major:0,lydian:7,minor:3,dorian:10};
const family=(mode:string)=>mode==='major'||mode==='lydian'?'major':'minor';
const window=(s:Settings,start:number,form:number)=>Array.from({length:form},(_,i)=>chordAt(s,start+i).label).join(' ');

test('v35 favorites keep exact scores while new music and upgrades use v36',()=>{
  // Recorded from v0.43.1 (generator v35) before the catalogue grew.
  const hashes:Record<string,string>={
    'lofi:0':'d22e685528e21474dfbe33257655c8a5fe90122c9d8330e4ba411ef04706c450','lofi:2':'14b1d04e5befde86ac9bcf8a6d576548bb18137bcb4cbf295e5d2affe94d24e1',
    'ambient:0':'6047c591ca38464656fb0af96f9c475a2e82e05c9f6780a605e9865b9bf99feb','ambient:2':'24136aa5277a64faf77e288d5643628994476fa81cadba839c5107594c1516a5',
    'dub:0':'b6ddd2484929651c433151eda6d29d255cc337e1775d527111e22a58eec00c1b','dub:2':'8bb723444566c1c8546cd9ee01208f8c0723db1473b92d9fb4693efd69303a11',
    'dnb:0':'b490c13b8d9505674542e06ea1a3937675eddcd222419ee3c91d5c3589579a71','dnb:2':'4b40242499ada8236884b592ea5bb50ad5f700699384a98ec5fc68c24392a75a',
  };
  assert.ok(DEFAULTS.generatorVersion>=36);
  for(const mode of modes)for(const rep of [0,2] as const){
    const old=make(mode,{generatorVersion:35,melodyRepetition:rep});
    assert.equal(sha(Array.from({length:96},(_,b)=>eventsForBar(old,b))),hashes[`${mode}:${rep}`],`${mode}:${rep}`);
    assert.equal(upgradeSettings(old).generatorVersion,DEFAULTS.generatorVersion);
    // A v35 song keeps one pair and one key however long it plays, and its chords carry no key.
    assert.equal(recipeV18(old,4000).id,recipeV18(old).id);assert.equal(tonicPc(old,4000),tonicPc(old));
    assert.equal(chordAt(old,4000).key,undefined);
  }
});

test('the catalogue: 128 progressions, the new ones only for v36 and every one of them reached',()=>{
  const banks=new Map<string,number>(),added=PROGRESSIONS_V18.filter(r=>r.since===36);
  for(const r of PROGRESSIONS_V18)banks.set(r.bank,(banks.get(r.bank)??0)+1);
  assert.deepEqual(Object.fromEntries(banks),{lofi:44,ambient:30,house:28,dnb:26});
  assert.equal(added.length,54);
  // Every bank gains both mode families.
  for(const bank of ['lofi','ambient','house','dnb'])for(const f of ['major','minor'])assert.ok(added.some(r=>r.bank===bank&&family(r.mode)===f),`${bank} ${f}`);
  const reached=new Set<string>();
  for(let seed=0;seed<60;seed++)for(const mode of modes){
    const s=make(mode,{seed:`CAT${seed}`}),old={...s,generatorVersion:35 as const},era=eraBarsV36(s);
    assert.ok((recipeV18(old).since??18)<=35&&(companionV18(old).since??18)<=35,'v35 never picks a v36 progression');
    for(let e=0;e<8;e++){reached.add(recipeV18(s,e*era).id);reached.add(companionV18(s,e*era).id);}
  }
  assert.equal(reached.size,PROGRESSIONS_V18.length,`reached ${reached.size}`);
});

test('a long flow moves to a new pair of progressions in a related key every few minutes, at a form intro',()=>{
  for(const mode of modes){
    let eras=0,sameParent=0,fifth=0,parallel=0;
    for(let seed=0;seed<24;seed++){
      const s=make(mode,{seed:`ERA${seed}`}),length=eraBarsV36(s),form=arrangementAt(s,0).formLength;
      assert.equal(length%form,0);assert.ok(length>=form*2);
      const minutes=length*4/s.bpm;
      assert.ok(minutes>=5&&minutes<=11,`${mode} era ${minutes.toFixed(1)} min`);
      // More evolution, shorter eras.
      assert.ok(eraBarsV36({...s,evolution:100})<eraBarsV36({...s,evolution:0}),mode);
      for(let e=1;e<8;e++){
        const at=e*length,before=at-1;
        assert.equal(arrangementAt(s,at).section,'intro');
        const a=recipeV18(s,at),old=recipeV18(s,before);
        assert.equal(a.bank,bankV18(s));assert.notEqual(a.id,old.id);assert.notEqual(a.id,companionV18(s,before).id);
        assert.equal(recipeV18(s,at+length-1).id,a.id);assert.equal(family(companionV18(s,at).mode),family(a.mode));assert.notEqual(companionV18(s,at).id,a.id);
        assert.deepEqual(keyPcs(s,at),MODES_V18[a.mode].map(n=>pc(n+tonicPc(s,at))));
        const shift=pc(tonicPc(s,at)+RELATIVE[a.mode]-tonicPc(s,before)-RELATIVE[old.mode]);
        eras++;
        if(shift===0)sameParent++;else if(shift===5||shift===7)fifth++;
        else{assert.equal(tonicPc(s,at),tonicPc(s,before),`${mode} ${seed}: a parallel key change`);assert.notEqual(a.mode,old.mode);parallel++;}
      }
    }
    assert.ok(sameParent>eras*.2&&fifth>eras*.3&&parallel>0,`${mode}: ${sameParent}/${fifth}/${parallel} of ${eras}`);
  }
});

test('eras keep the chords sound: their own key, chord-scales that hold every tone, and lead lines inside them',()=>{
  for(const mode of modes)for(let seed=0;seed<4;seed++){
    const s=make(mode,{seed:`SOUND${seed}`}),length=eraBarsV36(s);
    for(const at of [length,length*2]){
      const tonic=tonicPc(s,at),sharps=[7,2,9,4,11].includes(pc(tonic+RELATIVE[recipeV18(s,at).mode]));
      for(let bar=at-16;bar<at+16;bar++){
        const chord=chordAt(s,bar),scale=chordScale(s,chord),key=keyPcs(s,bar);
        assert.deepEqual(chord.key,key,`${mode} bar ${bar}`);
        assert.ok(chord.tones!.every(t=>scale.includes(t)),`${chord.label} scale ${scale}`);
        if(bar>=at&&key.includes(pc(chord.root)))assert.ok(!chord.label.slice(1,2).includes(sharps?'♭':'♯'),`${chord.label} in a ${sharps?'sharp':'flat'} key`);
        for(const e of eventsForBar(s,bar))if(e.layer==='motif'){
          const c=chordAt(s,Math.floor(e.at));
          for(const n of e.notes)assert.notEqual(toneClass(c,chordScale(s,c),n),'out',`${mode} ${seed} bar ${bar}: ${n} over ${c.label}`);
        }
      }
    }
  }
});

test('the last bar before an era leads into the new key as often as a round leads back into its own',()=>{
  let led=0,eras=0;
  for(const mode of ['lofi','dub','dnb'] as const)for(let seed=0;seed<40;seed++){
    const s=make(mode,{seed:`TURN${seed}`}),length=eraBarsV36(s);
    for(let e=1;e<4;e++){
      const at=e*length,last=chordAt(s,at-1),next=chordAt(s,at),gap=pc(last.root-next.root);
      eras++;
      if((gap===7||gap===1)&&['7','9','13','7b9','7#9','9#11','9sus4','7sus4'].includes(last.quality!))led++;
    }
  }
  assert.ok(led>eras*.35,`${led} of ${eras} eras are entered from their own dominant`);
});

test('every round gets its own colours and approach chords; evolution 0 keeps the round steady',()=>{
  for(const mode of modes){
    let rounds=0,distinct=0,same=0,windows=0;
    for(let seed=0;seed<12;seed++){
      const s=make(mode,{seed:`ROUND${seed}`}),form=arrangementAt(s,0).formLength,length=eraBarsV36(s),seen=new Set<string>();
      for(let f=0;f<length;f+=form){rounds++;const k=window(s,f,form);if(!seen.has(k)){seen.add(k);distinct++;}}
      for(let at=form;at<length;at+=8){windows++;if(window(s,at,8)===window(s,at-form,8))same++;}
      const steady={...s,evolution:0};
      assert.equal(window(steady,form,form),window(steady,0,form),`${mode}: evolution 0 repeats the round`);
    }
    assert.ok(distinct/rounds>.9,`${mode}: ${distinct}/${rounds} rounds differ`);
    // Ambient holds each chord for two bars and its intro is plain, so more of its windows match.
    assert.ok(same/windows<(mode==='ambient'?.6:.45),`${mode}: ${same}/${windows} windows equal the last round`);
  }
});

test('a saved phrase keeps the key of its chords, and a bad key is refused',()=>{
  const s=make('lofi',{seed:'PHRASEKEY'}),at=eraBarsV36(s)+8;
  const saved=capturePhrase({settings:s,opening:true},at),loaded=normalizePhrase(JSON.parse(JSON.stringify(saved)))!;
  assert.deepEqual(loaded,saved);
  assert.deepEqual(loaded.chords[0].key,keyPcs(s,at));
  for(const key of [[12],[],'C',[0.5]]){
    const bad=JSON.parse(JSON.stringify(saved));bad.chords[0].key=key;
    assert.equal(normalizePhrase(bad),undefined,JSON.stringify(key));
  }
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DEFAULTS,selectProfile,eventsForBar,chordAt,normalizeSettings,upgradeSettings,type Settings} from '../src/music';
import {chordScale,toneClass,keyPcs,tonicPc} from '../src/harmony-v17';
import {recipeV18,companionV18,bankV18,eraBarsV36} from '../src/harmony-v18';
import {PROGRESSIONS_V18} from '../src/harmony-catalog-v18';
const modes=['lofi','ambient','dub','dnb'] as const;
type Mode=typeof modes[number];
// Pinned to v37: later generators have their own suites.
const make=(mode:Mode,extra:Partial<Settings>={}):Settings=>{
  const base=selectProfile({...DEFAULTS,seed:'SLOWFLOW'},mode==='dnb'?'dub':mode);
  return {...base,generatorVersion:37,groove:mode==='dnb'?'dnb':'straight',bpm:mode==='dnb'?170:base.bpm,...extra};
};
const sha=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const pc=(n:number)=>((n%12)+12)%12;
const RELATIVE:Record<string,number>={major:0,lydian:7,minor:3,dorian:10};
const family=(mode:string)=>mode==='major'||mode==='lydian'?'major':'minor';
const DOMINANT=['7','9','13','7b9','7#9','9#11','7sus4','9sus4'];
/** How far the parent scale moves, in fifths (−6…6). */
const fifths=(s:Settings,from:number,to:number)=>{
  const d=pc((tonicPc(s,to)+RELATIVE[recipeV18(s,to).mode]-tonicPc(s,from)-RELATIVE[recipeV18(s,from).mode])*7);
  return d>6?d-12:d;
};

test('v36 favorites keep exact scores, across their era seams too, while new music and upgrades use v37',()=>{
  // Recorded from v0.44.0 (generator v36): 96 bars, the 32 bars around the first two era seams, and the chords of three eras.
  const hashes:Record<string,string>={
    'lofi:0':'c0a24fe7e71a956d7dcb5b612c26ce916d65fccec1ffb280ac104681a755ae5e','lofi:0:seams':'ff432df946d55f6b3d9dd864c427101960c2536cef811b447a71d145722c81c8',
    'lofi:chords':'650ac199b20f749f74cc363cdab2890c78f7562ac9939aede5c2fbe35934fa52',
    'lofi:2':'9161e5c02e9c0f6f63f1e6360b9ed82dae0ea77c9bd79bbc7f9550751e1c5805','lofi:2:seams':'5b2c493706543c50903154f697a4f56a5c53f8feac4cecc9ba0082a3f76dd238',
    'ambient:0':'73e6eeb621985fb078b882d4f005456c9cb90a736137973aad8bedd9e3fb8688','ambient:0:seams':'4e5962d507886bfb3bb6e2b604651aa702c8729c95c4f7f9730408a61b514bd3',
    'ambient:chords':'3701c42dafaa7e0411927ed46ae0ed933d783912387afc46566e52af909e13ad',
    'ambient:2':'7f424b1cb0aa278581712de996d4b36386b6c9d14644c5549a7dc392899e4220','ambient:2:seams':'82108af2c2b65521aa7cdc6e020a4e00e116b243b03f99b9e7fe9fa0d2842f02',
    'dub:0':'c9c9f0e19a50a9fab1ac4736645571e9329e6dba61fda338992a9e02808be971','dub:0:seams':'75cabaf01f90e86eba35bffc3ac1951395d430f42c6346b6f4b038d9613f748d',
    'dub:chords':'6562eee52f853eb30d807c5595774c3c5b6faa76c1db871daf6c30a2344ead2b',
    'dub:2':'7a8fe50928945fb4405aceebf932c81bcc8d2be2dc2cf93e47c30110f2deb1b0','dub:2:seams':'359f0fa2a6021388b28367ae3bf8fb1188542b720b184f56421cf3cdab7b0ca0',
    'dnb:0':'f68b2cf1fe19493982cf571b876fe295f2c220353bd3c2064186a95607cff0ff','dnb:0:seams':'4dcd9e27997d50fcdcfb8e7c959503c61347d3e24abf06bdc8e3e296cb3e8af1',
    'dnb:chords':'cbd9c10ae6a6a1df1109ecbd31ef4f39f190b6111c70192b161231d302a08f91',
    'dnb:2':'e713eaf786cbb3922a714752e7be76e80f1e8a66e3e82cf7948a5f11447375f0','dnb:2:seams':'7a891b46353e1ba11c8f0380d614ef3b1e056bb2c5e07c81e30af0c3cf1db277',
  };
  for(const mode of modes)for(const rep of [0,2] as const){
    const old=make(mode,{generatorVersion:36,melodyRepetition:rep}),length=eraBarsV36(old);
    assert.equal(sha(Array.from({length:96},(_,b)=>eventsForBar(old,b))),hashes[`${mode}:${rep}`],`${mode}:${rep}`);
    assert.equal(sha([length,length*2].map(at=>Array.from({length:32},(_,b)=>eventsForBar(old,at-16+b)))),hashes[`${mode}:${rep}:seams`],`${mode}:${rep} seams`);
    if(!rep)assert.equal(sha(Array.from({length:length*3},(_,b)=>chordAt(old,b))),hashes[`${mode}:chords`],`${mode} chords`);
    assert.equal(normalizeSettings(old).generatorVersion,36);
    assert.equal(upgradeSettings(old).generatorVersion,DEFAULTS.generatorVersion);
    // The catalogue, the first pair and the era length are v36's.
    const now=make(mode,{melodyRepetition:rep});
    assert.equal(eraBarsV36(now),length);assert.equal(recipeV18(now).id,recipeV18(old).id);assert.equal(companionV18(now).id,companionV18(old).id);
  }
  assert.ok(DEFAULTS.generatorVersion>=37);
  assert.equal(normalizeSettings({...DEFAULTS,generatorVersion:37}).generatorVersion,37);
});

test('the last bar of an era leads into the next: a dominant a fifth or a semitone above its first chord',()=>{
  for(const mode of ['lofi','dub','dnb'] as const){
    let seams=0,led=0,before=0,stranded=0,strandedBefore=0;
    for(let seed=0;seed<40;seed++){
      const s=make(mode,{seed:`TURN${seed}`}),old={...s,generatorVersion:36 as const},length=eraBarsV36(s);
      // Era 1 holds the same pair in the same key as in v36 unless the move was minor–lydian parallel, so the two seams compare.
      for(const [settings,count] of [[s,1],[old,0]] as const){
        const at=length,last=chordAt(settings,at-1),next=chordAt(settings,at),gap=pc(last.root-next.root);
        if(last.label===next.label)continue;
        if(count)seams++;
        const dominant=DOMINANT.includes(last.quality!),resolves=dominant&&(gap===7||gap===1);
        if(resolves)count?led++:before++;
        // A plain dominant (not a suspended one) that goes somewhere else, into a chord an approach could reach.
        if(dominant&&!resolves&&!last.quality!.includes('sus')&&!['m7b5','dim7'].includes(next.quality!)&&gap!==10)count?stranded++:strandedBefore++;
      }
    }
    // The rest come in by the backdoor or a borrowed iv, or start on a half-diminished chord.
    assert.ok(led>seams*.75,`${mode}: ${led} of ${seams} era seams are entered from their dominant`);
    assert.ok(led>before*1.3,`${mode}: ${led} now, ${before} in v36`);
    assert.ok(stranded<=1&&stranded<strandedBefore,`${mode}: ${stranded} dominants left unresolved (${strandedBefore} in v36)`);
  }
  // An authored one-bar dominant that pointed at the old first chord is re-aimed: the default song's first seam.
  const s=make('lofi'),length=eraBarsV36(s),old={...s,generatorVersion:36 as const};
  assert.equal(chordAt(old,length-1).label,'A♭9');assert.equal(chordAt(s,length-1).label,'G♭9♯11');assert.equal(chordAt(s,length).label,'Fm9');
  // Ordinary rounds inside an era keep the v36 turnaround plan.
  for(const mode of modes){
    const now=make(mode,{seed:'INSIDE'}),was={...now,generatorVersion:36 as const},inside=eraBarsV36(now)-8;
    assert.deepEqual(Array.from({length:inside},(_,b)=>chordAt(now,b)),Array.from({length:inside},(_,b)=>chordAt(was,b)),mode);
  }
});

test('an era brings a companion the last two eras did not use, and keys stay within three fifths',()=>{
  for(const mode of modes){
    let eras=0,repeats=0;
    for(let seed=0;seed<30;seed++){
      const s=make(mode,{seed:`PAIR${seed}`}),old={...s,generatorVersion:36 as const},length=eraBarsV36(s),bank=PROGRESSIONS_V18.filter(r=>r.bank===bankV18(s));
      for(let e=1;e<10;e++){
        const at=e*length,a=recipeV18(s,at),b=companionV18(s,at);
        const recent=new Set([recipeV18(s,at-1).id,companionV18(s,at-1).id,...(e>1?[recipeV18(s,at-length-1).id,companionV18(s,at-length-1).id]:[])]);
        assert.ok(!recent.has(a.id),`${mode} ${seed} era ${e}: A ${a.id}`);
        assert.notEqual(b.id,a.id);assert.equal(family(b.mode),family(a.mode));
        // Wherever A's mode (or, with none left in it, its family) has an unused progression, B is one.
        let pool=bank.filter(r=>r.id!==a.id&&r.mode===a.mode);
        if(!pool.length)pool=bank.filter(r=>r.id!==a.id&&family(r.mode)===family(a.mode));
        if(pool.some(r=>!recent.has(r.id)))assert.ok(!recent.has(b.id),`${mode} ${seed} era ${e}: B ${b.id}`);
        eras++;
        const oldRecent=[recipeV18(old,at-1).id,companionV18(old,at-1).id,...(e>1?[recipeV18(old,at-length-1).id,companionV18(old,at-length-1).id]:[])];
        if(oldRecent.includes(companionV18(old,at).id))repeats++;
        // Same parent scale, a fifth, or a parallel key, and minor ↔ lydian never by the parallel four fifths.
        const move=Math.abs(fifths(s,at-1,at)),pair=[a.mode,recipeV18(s,at-1).mode];
        assert.ok(move<=3,`${mode} ${seed} era ${e}: ${move} fifths`);
        if(move>1)assert.equal(tonicPc(s,at),tonicPc(s,at-1));
        if(pair.includes('minor')&&pair.includes('lydian'))assert.ok(move<=1,`${mode} ${seed} era ${e}: minor–lydian by ${move} fifths`);
      }
    }
    assert.ok(repeats>eras*.04,`${mode}: v36 repeated a companion in ${repeats} of ${eras} eras`);
  }
});

test('the prepared seams keep the chords sound: their own key, complete chord-scales and lead lines inside them',()=>{
  for(const mode of modes)for(let seed=0;seed<6;seed++){
    const s=make(mode,{seed:`SOUND${seed}`}),length=eraBarsV36(s);
    for(const at of [length,length*2,length*3]){
      for(let bar=at-16;bar<at+8;bar++){
        const chord=chordAt(s,bar),scale=chordScale(s,chord),key=keyPcs(s,bar);
        assert.deepEqual(chord.key,key,`${mode} bar ${bar}`);
        assert.equal(chord.notes.length,4);
        assert.ok(chord.tones!.every(t=>scale.includes(t)),`${chord.label} scale ${scale}`);
        for(const e of eventsForBar(s,bar))if(e.layer==='motif'){
          const c=chordAt(s,Math.floor(e.at));
          for(const n of e.notes)assert.notEqual(toneClass(c,chordScale(s,c),n),'out',`${mode} ${seed} bar ${bar}: ${n} over ${c.label}`);
        }
      }
    }
  }
});

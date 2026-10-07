// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
// Corpus metrics for tuning the composer. Usage: node --import tsx scripts/music-metrics.ts [version] [repetition]
// e.g. `node --import tsx scripts/music-metrics.ts 16 2` vs `... 17 2`. Heuristics only; they do not replace listening.
import {DEFAULTS,selectProfile,eventsForBar,chordAt,type Settings,type MusicEvent} from '../src/music';
import {fillPlan} from '../src/fills';
const modes=['lofi','ambient','dub','dnb'] as const;
const seeds=['SLOWFLOW','AB12CD','PULSE2','ZK9Q','MOON77','RAIN3','DESK01','NIGHT8','Q1W2E3','TT55','LOFI99','XYZW','HJ4K','BLUE6','GRN22','SKY111'];
const version=Number(process.argv[2]??DEFAULTS.generatorVersion) as Settings['generatorVersion'];
const repetition=Number(process.argv[3]??2) as 0|1|2|3;
const pc=(n:number)=>((n%12)+12)%12;
const pct=(a:number,b:number)=>`${(a/Math.max(1,b)*100).toFixed(0)}%`;
const avg=(a:number[])=>(a.reduce((x,y)=>x+y,0)/Math.max(1,a.length)).toFixed(1);
const bars=256;
for(const mode of modes){
  const m={notes:0,moves:0,repeat:0,step:0,leap:0,chordTone:0,belowComp:0,climax:0,phrases:0,sounding:0,ranges:[] as number[],
    bass:0,root:0,nonChord:0,octave:0,shared:0,harsh:0,chords:[] as number[],hooks:[] as number[],shapes:[] as number[],
    boundaries:0,fills:0,strokes:0,kinds:new Map<string,number>()};
  for(const seed of seeds){
    const base=selectProfile({...DEFAULTS,seed},mode==='dnb'?'dub':mode);
    const s:Settings={...base,seed,generatorVersion:version,melodyRepetition:repetition,groove:mode==='dnb'?'dnb':'straight',bpm:mode==='dnb'?170:base.bpm};
    const labels=new Set<string>(),hooks=new Set<string>(),shapes=new Set<string>();
    for(let start=0;start<bars;start+=8){
      const events=Array.from({length:8},(_,b)=>eventsForBar(s,start+b)).flat();
      const lead=events.filter(e=>e.layer==='motif'&&e.role!=='neighbor').sort((a,b)=>a.at-b.at);
      const bass=events.filter(e=>e.layer==='bass').sort((a,b)=>a.at-b.at);
      for(let b=0;b<8;b++)labels.add(chordAt(s,start+b).label);
      const plan=fillPlan(s,start+7);m.boundaries++;
      if(plan){const kind='kind' in plan?plan.kind:'fill';m.fills++;m.kinds.set(kind,(m.kinds.get(kind)??0)+1);m.strokes+=events.filter(e=>e.fill!==undefined&&Math.floor(e.at)===start+7).length;}
      m.phrases++;
      const hook=lead.filter(e=>e.at<start+2),step=(e:MusicEvent)=>Math.round((e.at-start)*16);
      if(start)hooks.add(hook.map(step).join()),shapes.add(hook.map((e,i)=>`${step(e)}:${i?Math.sign(e.notes[0]-hook[i-1].notes[0]):0}`).join());
      if(lead.length>1){
        m.sounding++;
        const pitches=lead.map(e=>e.notes[0]),top=Math.max(...pitches);
        m.ranges.push(top-Math.min(...pitches));
        const peak=lead.find(e=>e.notes[0]===top)!.at-start;
        if(peak>=3.5&&peak<6.5)m.climax++;
      }
      lead.forEach((e,i)=>{
        const chord=chordAt(s,Math.floor(e.at)),n=e.notes[0];m.notes++;
        if(chord.notes.some(c=>pc(c)===pc(n)))m.chordTone++;
        if(n<=Math.max(...chord.notes))m.belowComp++;
        if(!i)return;
        const d=Math.abs(n-lead[i-1].notes[0]);m.moves++;
        if(!d)m.repeat++;else if(d<=2)m.step++;else m.leap++;
      });
      bass.forEach((e,i)=>{
        const chord=chordAt(s,e.at),n=e.notes[0];m.bass++;
        if(pc(n-chord.root)===0)m.root++;
        if(!chord.notes.some(c=>pc(c)===pc(n)))m.nonChord++;
        if(i&&Math.abs(n-bass[i-1].notes[0])===12)m.octave++;
        for(const l of lead){const o=Math.min(e.at+e.length,l.at+l.length)-Math.max(e.at,l.at);if(o>0){m.shared+=o;if([1,6,11].includes(pc(l.notes[0]-n)))m.harsh+=o;}}
      });
    }
    m.chords.push(labels.size);m.hooks.push(hooks.size);m.shapes.push(shapes.size);
  }
  console.log(`${mode.padEnd(7)} v${version} rep${repetition}`
    +` | lead/bar ${(m.notes/m.phrases/8).toFixed(2)} repeat ${pct(m.repeat,m.moves)} step ${pct(m.step,m.moves)} leap ${pct(m.leap,m.moves)}`
    +` range ${avg(m.ranges)} chordTone ${pct(m.chordTone,m.notes)} belowComp ${pct(m.belowComp,m.notes)} climaxMid ${pct(m.climax,m.sounding)} restingPhrases ${pct(m.phrases-m.sounding,m.phrases)}`
    +` | hooks/seed rhythm ${avg(m.hooks)} shape ${avg(m.shapes)}`
    +` | bass/bar ${(m.bass/m.phrases/8).toFixed(2)} root ${pct(m.root,m.bass)} nonChord ${pct(m.nonChord,m.bass)} octave ${(m.octave/(seeds.length*bars)).toFixed(2)}/bar harsh ${pct(m.harsh,m.shared)}`
    +` | chords/seed ${avg(m.chords)}`
    +` | fills ${pct(m.fills,m.boundaries)} of 8-bar boundaries, ${(m.strokes/Math.max(1,m.fills)).toFixed(1)} strokes (${[...m.kinds].map(([k,v])=>`${k} ${v}`).join(', ')})`);
}

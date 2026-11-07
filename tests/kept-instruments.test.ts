import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,selectProfile,regenerateSettings} from '../src/music';
import {chooseInstruments,legacyInstruments} from '../src/instruments';
import {keptMix,normalizeKept,rememberMix,type KeptMixes} from '../src/kept-instruments';

const lofi={harmony:'h-organ',bass:'b-analog',rhythm:'r-click',motif:'m-flute',arpeggio:'m-nylon'};
const ambient={harmony:'h-felt',bass:'b-pluck',rhythm:'r-tape',motif:'m-pluck'};

test('keep sounds returns each atmosphere to the sounds it had',()=>{
  // Switching with keep on: lo-fi → ambient (first visit keeps its seeded mix) → lo-fi again.
  let kept:KeptMixes={},s={...DEFAULTS,instruments:{...lofi}};
  kept=rememberMix(kept,s.profile,s.instruments);
  s=selectProfile(s,'ambient',kept.ambient);
  assert.deepEqual(s.instruments,chooseInstruments('ambient',s.seed));
  s={...s,instruments:{...ambient}};kept=rememberMix(kept,s.profile,s.instruments);
  s=regenerateSettings(s,'NEWSEED',true);kept=rememberMix(kept,s.profile,s.instruments);
  s=selectProfile(s,'dub',kept.dub);kept=rememberMix(kept,s.profile,s.instruments);
  s=selectProfile(s,'lofi',kept.lofi);
  assert.deepEqual(s.instruments,lofi);
  s=selectProfile(s,'ambient',kept.ambient);
  assert.deepEqual(s.instruments,ambient);
  assert.equal(s.seed,'NEWSEED');
  // The kept mix is copied, never shared with the settings object.
  s.instruments.harmony='h-pad';assert.equal(kept.ambient!.harmony,'h-felt');
  // Without a kept mix the seeded choice is unchanged.
  assert.deepEqual(selectProfile(DEFAULTS,'dub'),selectProfile(DEFAULTS,'dub',undefined));
});

test('kept mixes are validated when stored and read back',()=>{
  assert.equal(keptMix(legacyInstruments()),undefined);
  assert.equal(keptMix({...lofi,bass:'b-nope'}),undefined);
  assert.deepEqual(keptMix({...ambient,arpeggio:'x',extra:1}),ambient);
  assert.deepEqual(rememberMix({},'lofi',legacyInstruments()),{});
  assert.deepEqual(normalizeKept(JSON.parse(JSON.stringify({lofi,ambient,dub:{harmony:1},jazz:lofi}))),{lofi,ambient});
  for(const bad of [null,'x',3,[]])assert.deepEqual(normalizeKept(bad),{});
});

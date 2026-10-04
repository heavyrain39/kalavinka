import {test} from 'node:test';
import assert from 'node:assert/strict';
import {browserLanguage, messages, translate, instrumentName} from '../src/i18n.ts';
import {resetSliders} from '../src/controls.ts';
import {DEFAULTS, AUDIO_LAYERS, normalizeSettings, selectProfile, type ProfileId} from '../src/music.ts';
import {INSTRUMENTS} from '../src/instruments.ts';

test('only a Korean primary browser locale starts in Korean', () => {
  for (const locale of ['ko','ko-KR','KO-kr']) assert.equal(browserLanguage(locale),'ko');
  for (const locale of ['en-US','ja-JP','zh-Hant','fr','', 'kok-IN']) assert.equal(browserLanguage(locale),'en');
});

test('all copy and instrument choices have complete English translations', () => {
  assert.deepEqual(Object.keys(messages.en).sort(), Object.keys(messages.ko).sort());
  for (const key of Object.keys(messages.ko) as (keyof typeof messages.ko)[]) {
    assert.ok(messages.en[key].length);
    assert.doesNotMatch(messages.en[key], /[가-힣]/);
    assert.deepEqual(messages.en[key].match(/\{\w+\}/g)?.sort(), messages.ko[key].match(/\{\w+\}/g)?.sort());
  }
  for (const layer of AUDIO_LAYERS) for (const instrument of INSTRUMENTS[layer]) {
    assert.notEqual(instrumentName(instrument.id,'en'),'Legacy sound');
    assert.notEqual(instrumentName(instrument.id,'ko'),'기존 음색');
  }
  assert.equal(translate('en','timerReady',{count:25}),'The 25-minute timer starts when you press Play.');
});

test('reset restores six sliders while preserving the composition and muted parts', () => {
  for (const profile of ['lofi','ambient','dub'] as ProfileId[]) for (const groove of ['straight','dnb'] as const) {
    const s=normalizeSettings({...selectProfile(DEFAULTS,profile),groove,seed:'KEEPMIX1',bpm:180,energy:99,warmth:1,evolution:99,reverb:1,volume:99,layers:{...DEFAULTS.layers,bass:false}});
    const before=structuredClone(s), result=resetSliders(s);
    assert.deepEqual(s,before);
    const expected={lofi:[78,42,72,35,28,55],ambient:[64,25,60,25,76,55],dub:[groove==='dnb'?170:108,48,62,40,28,55]}[profile];
    assert.deepEqual([result.bpm,result.energy,result.warmth,result.evolution,result.reverb,result.volume],expected);
    const composition=({bpm,energy,warmth,evolution,reverb,volume,...rest}: typeof s)=>rest;
    assert.deepEqual(composition(result),composition(s));
    assert.deepEqual(resetSliders(result),result);
  }
  const legacy=normalizeSettings({...DEFAULTS,generatorVersion:1});
  assert.equal(resetSliders(legacy).generatorVersion,1);
});

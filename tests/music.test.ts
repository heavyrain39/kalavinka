import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, eventsForBar, musicScore, normalizeSettings, progression, selectProfile, type ProfileId } from '../src/music.ts';

test('seeded score is stable across reloads and independent of query order', () => {
  const a = musicScore(DEFAULTS), b = musicScore(DEFAULTS);
  b.onsets(20, 21);
  const serialize = (pattern: typeof a) => pattern.onsets(0, 8).map((event) => [event.at, event]);
  assert.deepEqual(serialize(a), serialize(b));
  assert.notDeepEqual(progression(DEFAULTS), progression({ ...DEFAULTS, seed: 'OTHERFLOW' }));
});
test('a sustained pad is triggered once across scheduler query fragments', () => {
  const pattern = musicScore(selectProfile(DEFAULTS, 'ambient'));
  const onsets = Array.from({ length: 80 }, (_, i) => pattern.onsets(i / 20, (i + 1) / 20)).flat();
  assert.equal(onsets.filter((hap) => hap.voice === 'pad' && hap.at === 0).length, 1);
  assert.ok(onsets.some((hap) => hap.voice === 'pluck'));
});
test('all profiles keep note range, event density and duration bounded over a long session', () => {
  for (const profile of ['lofi', 'ambient', 'dub'] as ProfileId[]) {
    const settings = { ...selectProfile(DEFAULTS, profile), energy: 100, evolution: 100, layers: { harmony: true, bass: true, rhythm: true, motif: true } };
    for (let bar = 0; bar < 256; bar++) {
      const events = eventsForBar(settings, bar);
      assert.ok(events.filter(e=>e.layer!=='arpeggio').length <= 24);
      assert.ok(events.filter(e=>e.layer==='arpeggio').length <= 8);
      for (const event of events) {
        assert.ok(event.at >= bar && event.at < bar + 1);
        assert.ok(event.length > 0 && event.length <= 2);
        assert.ok(event.gain >= 0 && event.gain <= .36);
        for (const note of event.notes) assert.ok(note >= 34 && note <= 81);
      }
    }
  }
});
test('v6 zero evolution repeats the authored phrase and mutes remove entire parts', () => {
  const settings = { ...DEFAULTS, generatorVersion:6 as const, evolution: 0 };
  const a = eventsForBar(settings, 1).map((event) => ({ ...event, at: event.at - 1 }));
  const b = eventsForBar(settings, 129).map((event) => ({ ...event, at: event.at - 129 }));
  for (let i = 0; i < a.length; i++) assert.ok(Math.abs(a[i].at - b[i].at) < .000001);
  assert.deepEqual(a.map(({ at, ...event }) => event), b.map(({ at, ...event }) => event));
  assert.equal(eventsForBar({ ...DEFAULTS, layers: { harmony: false, bass: false, rhythm: false, motif: false } }, 0).length, 0);
});
test('stored and shared settings cannot introduce code, invalid numbers, or prototype keys', () => {
  const normalized = normalizeSettings({ profile: '__proto__', seed: '<script>', bpm: NaN, volume: 500, energy: -10, layers: {} });
  assert.equal(normalized.profile, 'lofi'); assert.equal(normalized.seed, DEFAULTS.seed);
  assert.equal(normalized.bpm, DEFAULTS.bpm); assert.equal(normalized.volume, 100); assert.equal(normalized.energy, 0);
  assert.deepEqual(normalizeSettings({ ...DEFAULTS, generatorVersion: 99 }), DEFAULTS);
  assert.equal(normalizeSettings({ profile: { toString: 'invalid' } }).profile, 'lofi');
});

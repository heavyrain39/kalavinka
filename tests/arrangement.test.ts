import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DEFAULTS, eventsForBar, chordAt, selectProfile as currentProfile, normalizeSettings, type ProfileId, type Settings } from '../src/music.ts';
import { arrangementAt, scalePitches } from '../src/arrangement.ts';
import { scheduleDuck } from '../src/duck.ts';
const selectProfile = (s: Settings, profile: ProfileId): Settings => ({ ...currentProfile(s, profile), generatorVersion: 2 });
const profiles: ProfileId[] = ['lofi', 'ambient', 'dub'];
const score = (s: Settings, start = 0) => Array.from({ length: arrangementAt(s, 0).formLength }, (_, i) => eventsForBar(s, i + start).map((e) => ({ ...e, at: Number((e.at - start).toFixed(8)) })));

test('legacy favorites and versionless links retain the exact v1 scores', () => {
  const expected = ['56b4b8eb54c41022eeac31deca38ebb74ef7bd8577448237bceb52344ed8d628', 'c30858552f411277085e412d3b3b4a6860527707e15924e6ba65edb78ee02578', '9a4936b367e7905b418892ba9abce4e1bb576a00ca2dabc1296b9d5f716114d2'];
  profiles.forEach((profile, i) => {
    const s = { ...selectProfile(DEFAULTS, profile), generatorVersion: 1 as const };
    const events = Array.from({ length: 32 }, (_, bar) => eventsForBar(s, bar));
    assert.equal(createHash('sha256').update(JSON.stringify(events)).digest('hex'), expected[i]);
  });
  assert.equal(normalizeSettings({ seed: 'SLOWFLOW' }).generatorVersion, 1);
  assert.equal(normalizeSettings(null).generatorVersion, 17);
});
test('phrases vary note counts, pitch, spacing and bass lines within the first form', () => {
  for (const profile of profiles) {
    const s = selectProfile(DEFAULTS, profile), bars = score(s);
    const melody = bars.map((bar) => bar.filter((e) => e.layer === 'motif'));
    assert.ok(new Set(melody.map((m) => m.length)).size >= 3, profile + ': counts');
    assert.ok(new Set(melody.flat().flatMap((e) => e.notes)).size >= 5, profile + ': pitches');
    assert.ok(new Set(melody.map((m) => JSON.stringify(m.map((e) => Number((e.at % 1).toFixed(5)))))).size >= 5, profile + ': rhythm');
    assert.ok(new Set(bars.map((b) => JSON.stringify(b.filter((e) => e.layer === 'bass').map((e) => [e.at % 1, e.notes[0], e.length])))).size >= 4);
  }
});
test('authored beatless sections, arpeggios and rhythm returns follow each genre', () => {
  for (const profile of profiles) {
    const s = { ...selectProfile(DEFAULTS, profile), energy: 80, layers: { ...DEFAULTS.layers } };
    const bars = score(s);
    assert.ok(bars.some((b) => b.some((e) => e.voice === 'arp')));
    if (profile === 'ambient') { assert.ok(bars.flat().every((e) => e.voice !== 'kick' && !e.duck)); continue; }
    for (let bar = 16; bar < 20; bar++) assert.ok(eventsForBar(s, bar).every((e) => e.layer !== 'rhythm' && !e.duck));
    assert.ok(eventsForBar(s, 24).some((e) => e.voice === 'kick'));
    assert.ok(bars.flat().some((e) => e.duck));
    assert.ok(score({ ...s, layers: { ...s.layers, rhythm: false } }).flat().every((e) => !e.duck));
    if (profile === 'dub') assert.ok(bars.flat().filter((e) => e.layer === 'bass' && !arrangementAt(s, Math.floor(e.at)).beatless).every((e) => Math.abs(e.at * 4 - Math.round(e.at * 4)) > .01));
  }
});
test('diatonic melodies anchor to chords and passing tones resolve by step', () => {
  for (const seed of ['SLOWFLOW', 'OTHERFLOW', 'ABCD', 'YACHA2026', 'MINORKEY', 'CALMDESK', 'NEWSEEDS', 'WORK2026']) for (const profile of profiles) {
    const s = { ...selectProfile(DEFAULTS, profile), seed, energy: 100, evolution: 100 };
    for (let bar = 0; bar < 128; bar++) {
      const events = eventsForBar(s, bar), chord = chordAt(s, bar);
      const melody = events.filter((e) => e.layer === 'motif');
      const scale = scalePitches(s, 34, 81);
      for (const e of events.filter((e) => e.layer === 'motif' || e.layer === 'bass')) {
        assert.ok(e.notes.every((n) => scale.includes(n)), `${profile} ${seed} ${bar} diatonic`);
        if (e.role === 'anchor' || e.role === 'arpeggio') assert.ok(chord.notes.some((n) => n % 12 === e.notes[0] % 12));
        if (e.role === 'passing') {
          const next = melody[melody.indexOf(e) + 1];
          assert.ok(next && next.notes[0] === e.resolvesTo && Math.abs(next.notes[0] - e.notes[0]) <= 2);
        }
      }
      for (let i = 1; i < melody.length; i++) assert.ok(Math.abs(melody[i].notes[0] - melody[i - 1].notes[0]) <= 7);
      if (profile !== 'ambient') {
        const bass = events.filter((e) => e.layer === 'bass');
        for (let i = 1; i < bass.length; i++) assert.ok(bass[i - 1].at + bass[i - 1].length + .06 * s.bpm / 240 <= bass[i].at + .00001, 'bass release must finish before next onset');
      }
    }
  }
});
test('evolution repeats or develops complete forms deterministically', () => {
  for (const profile of profiles) {
    const s = { ...selectProfile(DEFAULTS, profile), evolution: 0 };
    const length = arrangementAt(s, 0).formLength;
    assert.deepEqual(score(s), score(s, length));
    const evolving = { ...s, evolution: 100 };
    assert.notDeepEqual(score(evolving), score(evolving, length));
    assert.deepEqual(score(evolving, length), score(evolving, length));
  }
});
test('kick duck automation targets only the provided bass bus and returns to unity', () => {
  const calls: [string, number, number?][] = [];
  const param = {
    cancelAndHoldAtTime: (t: number) => calls.push(['hold', t]),
    linearRampToValueAtTime: (v: number, t: number) => calls.push(['linear', v, t]),
    setValueAtTime: (v: number, t: number) => calls.push(['set', v, t]),
    exponentialRampToValueAtTime: (v: number, t: number) => calls.push(['exponential', v, t]),
  } as unknown as AudioParam;
  scheduleDuck(param, 10, .58, 108, 9.9);
  assert.equal(calls[0][0], 'hold'); assert.ok(calls[0][1] >= 9.9 && calls[0][1] <= 10);
  assert.ok(Math.abs(calls[1][1] - .42) < 1e-12); assert.equal(calls.at(-1)![1], 1);
  assert.ok(calls.at(-1)![2]! > 10.035 && calls.at(-1)![2]! <= 10.22);
});

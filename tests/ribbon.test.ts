import test from 'node:test';
import assert from 'node:assert/strict';
import { ribbonLayout } from '../src/ribbon';
import { DEFAULTS, selectProfile, type MusicEvent } from '../src/music';
import { capturePhrase } from '../src/saved-phrase';

const note = (layer: MusicEvent['layer'], at: number, length: number, pitch: number): MusicEvent =>
  ({ layer, voice: layer === 'bass' ? 'bass' : 'pluck', at, length, notes: [pitch], gain: .05, pan: 0, cutoff: 2000 });

test('the ribbon shows only the melody and maps eight bars across the width', () => {
  const notes = ribbonLayout([note('motif', 0, 1, 60), note('motif', 4, 2, 76), note('motif', 7.5, 2, 68), note('bass', 0, 8, 40),
    note('arpeggio', 2, .5, 72), { ...note('rhythm', 1, .1, 0), notes: [] }, note('harmony', 0, 1, 60)]);
  assert.equal(notes.length, 3);
  assert.ok(notes[1].y < notes[2].y && notes[2].y < notes[0].y, 'a higher pitch sits higher');
  assert.deepEqual([notes[1].x, notes[1].w], [.5, .25]);
  assert.equal(notes[2].end, 8, 'a note cannot run past the phrase');
  for (const n of notes) assert.ok(n.x >= 0 && n.x + n.w <= 1 && n.y > .1 && n.y < .9);
});

test('a narrow line stays near the middle, and a resting melody leaves the ribbon empty', () => {
  const lead = ribbonLayout([note('motif', 0, 1, 70), note('motif', 1, 1, 72)]);
  assert.ok(lead.every(n => n.y > .4 && n.y < .6));
  assert.deepEqual(ribbonLayout([note('bass', 0, 1, 36)]), []);
});

test('every mood lays out its opening melody inside the canvas', () => {
  for (const profile of ['lofi', 'ambient', 'dub'] as const) {
    const notes = ribbonLayout(capturePhrase({ settings: selectProfile(DEFAULTS, profile), opening: true }).events);
    assert.ok(notes.length > 0, profile);
    for (const n of notes) assert.ok(n.x >= 0 && n.x < 1 && n.x + n.w <= 1 + 1e-9 && n.y >= .15 && n.y <= .85 && n.end > n.at, profile);
  }
});

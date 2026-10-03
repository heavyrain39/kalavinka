import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, normalizeSettings, eventsForBar } from '../src/music';
import { reverbGain } from '../src/reverb';

test('reverb survives saved/shared settings, rejects invalid values and supplies old-link defaults', () => {
  for (const reverb of [0, 38, 100]) assert.equal(normalizeSettings(JSON.parse(JSON.stringify({ ...DEFAULTS, reverb }))).reverb, reverb);
  assert.equal(normalizeSettings({ ...DEFAULTS, reverb: -50 }).reverb, 0);
  assert.equal(normalizeSettings({ ...DEFAULTS, reverb: 300 }).reverb, 100);
  assert.equal(normalizeSettings({ ...DEFAULTS, reverb: NaN }).reverb, 28);
  assert.equal(normalizeSettings({ profile: 'ambient', seed: 'OLDLINK' }).reverb, 76);
  assert.equal(normalizeSettings({ profile: 'lofi', seed: 'OLDLINK' }).generatorVersion, 1);
});

test('reverb is a bounded mix parameter and cannot alter notes or rhythm', () => {
  assert.equal(reverbGain(0), 0); assert.equal(reverbGain(100), .46);
  assert.equal(reverbGain(Infinity), 0);
  for (let i = 1; i <= 100; i++) assert.ok(reverbGain(i) >= reverbGain(i - 1));
  for (let bar = 0; bar < 16; bar++) assert.deepEqual(eventsForBar({ ...DEFAULTS, reverb: 0 }, bar), eventsForBar({ ...DEFAULTS, reverb: 100 }, bar));
});

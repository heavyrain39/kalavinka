import { test } from 'node:test';
import assert from 'node:assert/strict';
import { peakCurve, volumeGain } from '../src/mastering.ts';

test('Mastermind peak guard is transparent below its knee, monotonic, symmetric and bounded', () => {
  const ceiling = 10 ** (-1 / 20), start = ceiling / 10 ** (3 / 20);
  assert.equal(peakCurve(.1), .1);
  assert.ok(Math.abs(peakCurve(start) - start) < 1e-12);
  assert.ok(Math.abs((peakCurve(start + 1e-6) - peakCurve(start)) / 1e-6 - 1) < 1e-5);
  let previous = 0;
  for (let i = 0; i <= 10000; i++) {
    const x = i / 1000, y = peakCurve(x);
    assert.ok(y >= previous && y <= ceiling && y <= x + 1e-12);
    assert.ok(Math.abs(peakCurve(-x) + y) < 1e-12);
    previous = y;
  }
});

test('output volume has an exact zero and unity maximum without exceeding the peak guard', () => {
  assert.equal(volumeGain(0), 0); assert.equal(volumeGain(100), 1);
  assert.equal(volumeGain(-1), 0); assert.equal(volumeGain(101), 1);
  for (let i = 1; i <= 100; i++) assert.ok(volumeGain(i) > volumeGain(i - 1));
});

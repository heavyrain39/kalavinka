import test from 'node:test';
import assert from 'node:assert/strict';
import { projectPoint } from '../src/starfield';

test('perspective preserves near/far snow depth and clips behind the near plane', () => {
  const near = projectPoint(100, 0, 500, 0, 0)!;
  const far = projectPoint(100, 0, -500, 0, 0)!;
  assert.equal(near.x, 200);
  assert.ok(Math.abs(far.x - 100 * 2 / 3) < 1e-10);
  assert.equal(near.scale / far.scale, 3);
  assert.equal(projectPoint(0, 0, 901, 0, 0), null);
});

test('a quarter-turn orbit crosses the camera axis and changes apparent size', () => {
  const side = projectPoint(500, 0, 0, 0, 0)!;
  const front = projectPoint(500, 0, 0, Math.PI / 2, 0)!;
  const back = projectPoint(500, 0, 0, -Math.PI / 2, 0)!;
  assert.equal(side.scale, 1);
  assert.ok(Math.abs(front.x) < 1e-10);
  assert.ok(Math.abs(back.x) < 1e-10);
  assert.equal(front.depth, 500);
  assert.equal(back.depth, -500);
  assert.equal(front.scale / back.scale, 3);
});

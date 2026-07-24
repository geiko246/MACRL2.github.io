// Unit tests for the pure planar-biped dynamics used by the humanoid-balance
// demo. Run with: node --test tests/humanoid-dynamics.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { PARAMS, standingState, deriv, pose } from '../static/demos/humanoid-dynamics.js';
import { integrate } from '../static/demo-kit/sim.js';

const neutral = { targetL: PARAMS.l0, targetR: PARAMS.l0, tau: 0 };
const allFinite = (v) => v.every(Number.isFinite);

test('the resting stand is an equilibrium (near-zero acceleration)', () => {
  const d = deriv(standingState(), neutral);
  // velocities are zero, accelerations (indices 1,3,5) are ~0: gravity is
  // exactly carried by the two ground normals.
  assert.ok(Math.abs(d[1]) < 1e-6, `xdd=${d[1]}`);
  assert.ok(Math.abs(d[3]) < 1e-6, `ydd=${d[3]}`);
  assert.ok(Math.abs(d[5]) < 1e-6, `phidd=${d[5]}`);
});

test('contracting the left leg tips the trunk to the left (phi > 0)', () => {
  let s = standingState();
  const input = { targetL: PARAMS.l0 - PARAMS.dContract, targetR: PARAMS.l0, tau: 0 };
  for (let i = 0; i < 120; i++) s = integrate((st) => deriv(st, input), s, 0.004);
  assert.ok(allFinite(s), `state not finite: ${s}`);
  assert.ok(s[4] > 0.02, `expected leftward lean (phi>0), got phi=${s[4]}`);
});

test('contracting the right leg tips the trunk to the right (phi < 0)', () => {
  let s = standingState();
  const input = { targetL: PARAMS.l0, targetR: PARAMS.l0 - PARAMS.dContract, tau: 0 };
  for (let i = 0; i < 120; i++) s = integrate((st) => deriv(st, input), s, 0.004);
  assert.ok(s[4] < -0.02, `expected rightward lean (phi<0), got phi=${s[4]}`);
});

test('trunk torque rotates the trunk in its sign', () => {
  let s = standingState();
  const input = { ...neutral, tau: PARAMS.tau };
  for (let i = 0; i < 60; i++) s = integrate((st) => deriv(st, input), s, 0.004);
  assert.ok(s[4] > 0, `+tau should raise phi, got ${s[4]}`);
});

test('stays finite over 4 s; bounded while upright (demo freezes on fall)', () => {
  let s = standingState();
  const seq = [
    { targetL: PARAMS.l0 - 0.3, targetR: PARAMS.l0, tau: 2 },
    { targetL: PARAMS.l0, targetR: PARAMS.l0 - 0.3, tau: -2 },
    { targetL: PARAMS.l0 - 0.2, targetR: PARAMS.l0 - 0.2, tau: 0 },
    neutral,
  ];
  for (let i = 0; i < 1000; i++) {
    const input = seq[Math.floor(i / 100) % seq.length];
    s = integrate((st) => deriv(st, input), s, 0.004);
    // The real numerical guarantee: never NaN/Inf, never a runaway explosion.
    assert.ok(allFinite(s), `not finite at step ${i}: ${s}`);
    assert.ok(s.every((v) => Math.abs(v) < 100), `runaway at step ${i}: ${s}`);
    // Once it has toppled the demo freezes the sim; stop asserting "upright".
    if (Math.abs(s[4]) > 1.3) break;
    assert.ok(s[2] > 0.3 && s[2] < 3, `CoM height out of range while upright: ${s[2]}`);
  }
});

test('pose() returns finite geometry for drawing', () => {
  const g = pose(standingState());
  for (const pt of [g.com, g.hip, g.shoulder, g.head, ...g.legs.flatMap(l => [l.foot, l.knee])]) {
    assert.ok(Number.isFinite(pt.x) && Number.isFinite(pt.y), `bad point ${JSON.stringify(pt)}`);
  }
  assert.equal(g.legs.length, 2);
});

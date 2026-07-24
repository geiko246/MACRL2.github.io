// humanoid-dynamics.js — pure planar biped dynamics for the Unit 1 demo.
//
// A rigid trunk (mass, inertia) balances on two massless, length-actuated legs
// that make compliant (penalty) contact with the ground. The reader "contracts"
// a leg like a muscle (shortening its rest length) and can torque the trunk.
// Legs splay from a hip below the centre of mass; a narrow stance + high CoM
// make it an honestly unstable balancing problem, richer than a single pole.
//
// Convention: trunk orientation `phi` is the standard CCW angle of the trunk's
// up-axis, so up = (-sin phi, cos phi). phi > 0 leans the trunk to the LEFT (-x).
//
// This module is PURE (no imports, no window/document), so it runs under Node
// and is unit-tested in tests/humanoid-dynamics.test.mjs. The browser demo
// imports it by absolute path.

export const PARAMS = {
  m: 1.0,        // trunk mass
  g: 9.81,       // gravity
  J: 0.14,       // trunk moment of inertia about its CoM
  a: 0.5,        // hip distance below the CoM (metres)
  l0: 0.9,       // natural (straight) leg length
  dContract: 0.35, // how much a leg shortens when fully contracted
  beta: 0.34,    // leg splay half-angle (rad); larger = wider, steadier stance
  kLen: 9.0,     // muscle speed: how fast a leg approaches its target length
  kG: 1400,      // ground contact stiffness (penalty spring)
  cG: 70,        // ground contact damping
  cF: 90,        // tangential (friction) damping at the foot
  kF: 1600,      // tangential stiffness pinning a planted foot to its anchor
  mu: 1.4,       // friction coefficient (bounds tangential force by mu*N)
  tau: 6.0,      // trunk torque magnitude when a torso control is held
  liftThresh: 0.02, // a foot this far above ground counts as lifted (released)
};

// The resting stand: symmetric, upright, legs straight, feet just settled into
// the ground so the two normal forces carry the weight (net acceleration ~0).
export function standingState(p = PARAMS) {
  const pen = (p.m * p.g) / (2 * p.kG);            // equilibrium penetration
  const y = p.a + p.l0 * Math.cos(p.beta) - pen;   // CoM height at rest
  return [0, 0, y, 0, 0, 0, p.l0, p.l0];           // [x,xd, y,yd, phi,phid, lL,lR]
}

// One leg's world geometry + ground reaction. Returns positions (for drawing)
// and the force it applies to the trunk. `anchor` is the foot's planted x
// position (null when the foot is free), which pins it for push-off and stepping.
function legForce(s, p, gamma, target, lIdx, anchor) {
  const [x, xd, y, yd, phi, w] = s;
  const l = s[lIdx];
  const ld = p.kLen * (target - l);                // muscle length rate
  const sinP = Math.sin(phi), cosP = Math.cos(phi);
  // hip (below CoM along the trunk's down-axis)
  const hipx = x + p.a * sinP, hipy = y - p.a * cosP;
  const hipvx = xd + p.a * cosP * w, hipvy = yd + p.a * sinP * w;
  // leg direction = trunk rotated by its splay, pointing down-outward
  const ang = phi + gamma;
  const sinA = Math.sin(ang), cosA = Math.cos(ang);
  const dirx = sinA, diry = -cosA;
  const footx = hipx + l * dirx, footy = hipy + l * diry;
  const footvx = hipvx + ld * dirx + l * cosA * w;
  const footvy = hipvy + ld * diry + l * sinA * w;
  // compliant ground contact (only pushes; never pulls)
  let N = 0, f = 0;
  if (footy < 0) {
    N = p.kG * (-footy) - p.cG * footvy;
    if (N < 0) N = 0;
    const fMax = p.mu * N;
    // tangential force: velocity damping, plus a spring to the planted anchor
    // (static friction) so the foot grips for push-off instead of sliding.
    f = -p.cF * footvx;
    if (anchor != null) f -= p.kF * (footx - anchor);
    if (f > fMax) f = fMax; else if (f < -fMax) f = -fMax;
  }
  return { ld, footx, footy, N, f };
}

export function deriv(s, input, p = PARAMS) {
  const [x, , y, , phi] = s;
  const L = legForce(s, p, -p.beta, input.targetL, 6, input.anchorL);
  const R = legForce(s, p, p.beta, input.targetR, 7, input.anchorR);

  let Fx = 0, Fy = -p.m * p.g, Tz = input.tau || 0;
  for (const leg of [L, R]) {
    Fx += leg.f; Fy += leg.N;
    const rx = leg.footx - x, ry = leg.footy - y;
    Tz += rx * leg.N - ry * leg.f;                 // z-torque of the foot force
  }
  return [
    s[1], Fx / p.m,          // x,  xdd
    s[3], Fy / p.m,          // y,  ydd
    s[5], Tz / p.J,          // phi, phidd
    L.ld, R.ld,              // leg length rates
  ];
}

// Geometry helper for rendering: hip, knees, feet (+contact flags), shoulder,
// head — all in world metres. Knees bulge outward as a leg contracts, so the
// muscle action reads as a bending knee.
export function pose(s, p = PARAMS) {
  const [x, , y, , phi] = s;
  const sinP = Math.sin(phi), cosP = Math.cos(phi);
  const hip = { x: x + p.a * sinP, y: y - p.a * cosP };
  const up = { x: -sinP, y: cosP };
  const legs = [
    { gamma: -p.beta, l: s[6], sign: -1 },
    { gamma: p.beta, l: s[7], sign: 1 },
  ].map(({ gamma, l, sign }) => {
    const ang = phi + gamma;
    const dir = { x: Math.sin(ang), y: -Math.cos(ang) };
    const foot = { x: hip.x + l * dir.x, y: hip.y + l * dir.y };
    // knee: two equal bones of length l0/2 spanning the current length l,
    // bulging outward (sign) perpendicular to the leg.
    const half = p.l0 / 2;
    const bulge = Math.sqrt(Math.max(0, half * half - (l / 2) * (l / 2)));
    const perp = { x: sign * -dir.y, y: sign * dir.x };
    const knee = {
      x: hip.x + (l / 2) * dir.x + bulge * perp.x,
      y: hip.y + (l / 2) * dir.y + bulge * perp.y,
    };
    return { foot, knee, contact: foot.y < 0.002 };
  });
  const shoulder = { x: x + up.x * (p.a * 0.9), y: y + up.y * (p.a * 0.9) };
  const head = { x: x + up.x * (p.a * 1.5), y: y + up.y * (p.a * 1.5) };
  return { com: { x, y }, hip, shoulder, head, up, legs };
}

// World foot positions [{x,y},{x,y}] for the left, right leg.
export function footPositions(s, p = PARAMS) {
  return pose(s, p).legs.map((leg) => leg.foot);
}

// Advance the per-foot ground anchors: a foot that touches down (and has no
// anchor) grips where it lands; a foot lifted clear of the ground releases.
// `anchors` is [xL|null, xR|null]; returns the updated pair. Pure.
export function stepAnchors(anchors, s, p = PARAMS) {
  const feet = footPositions(s, p);
  return feet.map((foot, i) => {
    if (foot.y > p.liftThresh) return null;         // lifted -> released
    if (foot.y <= 0 && anchors[i] == null) return foot.x; // touchdown -> grip
    return anchors[i];                              // hold current anchor
  });
}

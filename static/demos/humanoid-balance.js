// humanoid-balance.js — Unit 1 (feedback control), first beat: keep a planar
// biped standing BY HAND. A rigid trunk balances on two length-actuated legs
// that make ground contact; the reader contracts either leg (like a muscle) and
// torques the trunk. The dynamics live in the pure, unit-tested sibling module.
import { PARAMS, standingState, deriv, pose } from '/static/demos/humanoid-dynamics.js';

function mount(el, params, ctx) {
  const { Anim, Controls, Theme } = ctx;

  const p = { ...PARAMS };
  // reader-tunable feel
  const opts = {
    betaDeg: PARAMS.beta * 180 / Math.PI,
    dContract: PARAMS.dContract,
    tau: PARAMS.tau,
  };
  const active = { legL: false, legR: false, torL: false, torR: false };
  let fallen = false, uprightTime = 0, lastTs = null;

  function buildInput() {
    return {
      targetL: active.legL ? p.l0 - opts.dContract : p.l0,
      targetR: active.legR ? p.l0 - opts.dContract : p.l0,
      tau: (active.torL ? opts.tau : 0) + (active.torR ? -opts.tau : 0),
    };
  }

  function freshState() {
    p.beta = opts.betaDeg * Math.PI / 180;
    const s = standingState(p);
    s[4] = 0.03;            // a slight initial lean so it starts to topple
    return s;
  }

  el.innerHTML =
    '<div class="hb-stage" style="height:300px">' +
    '<canvas style="width:100%;height:100%;display:block;touch-action:none"></canvas></div>' +
    '<div class="hb-push">' +
    '<button class="ctl-btn hb-btn" type="button" data-flag="legL">left leg <kbd>A</kbd></button>' +
    '<button class="ctl-btn hb-btn" type="button" data-flag="torL">torso <kbd>←</kbd></button>' +
    '<button class="ctl-btn hb-btn" type="button" data-flag="torR">torso <kbd>→</kbd></button>' +
    '<button class="ctl-btn hb-btn" type="button" data-flag="legR"><kbd>D</kbd> right leg</button>' +
    '</div><output class="hb-readout" aria-live="off"></output>' +
    '<div class="hb-controls"></div>';

  const stage = el.querySelector('.hb-stage');
  const canvas = el.querySelector('canvas');
  const out = el.querySelector('.hb-readout');

  // --- drawing --------------------------------------------------------------
  function draw(gg, s) {
    const t = Theme.tokens();
    gg.fit();
    gg.setWorld({ x0: -1.7, x1: 1.7, y0: -0.3, y1: 2.5 });
    gg.clear();
    const c = gg.ctx;
    const S = (pt) => [gg.sx(pt.x), gg.sy(pt.y)];
    const g0 = pose(s, p);

    // ground
    const groundY = gg.sy(0);
    c.strokeStyle = t.rule; c.lineWidth = gg.px(1.5);
    c.beginPath(); c.moveTo(gg.sx(-1.7), groundY); c.lineTo(gg.sx(1.7), groundY); c.stroke();
    // faint upright reference through the feet centre
    c.save();
    c.strokeStyle = t.faint; c.lineWidth = gg.px(1); c.setLineDash([gg.px(4), gg.px(5)]);
    c.beginPath(); c.moveTo(gg.sx(0), groundY); c.lineTo(gg.sx(0), gg.sy(2.1)); c.stroke();
    c.restore();

    const base = fallen ? t.muted : t.accent;
    c.lineCap = 'round'; c.lineJoin = 'round';
    const seg = (a, b, w, col) => {
      c.strokeStyle = col; c.lineWidth = gg.px(w);
      const A = S(a), B = S(b);
      c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke();
    };

    // legs (hip -> knee -> foot); a contracting leg is drawn brighter/heavier
    g0.legs.forEach((leg, i) => {
      const engaged = !fallen && (i === 0 ? active.legL : active.legR);
      const col = engaged ? t.fg : base;
      seg(g0.hip, leg.knee, engaged ? 7 : 5, col);
      seg(leg.knee, leg.foot, engaged ? 7 : 5, col);
      // foot bar; highlighted while in ground contact
      const fx = leg.foot.x, fy = Math.max(leg.foot.y, 0);
      seg({ x: fx - 0.13, y: fy }, { x: fx + 0.13, y: fy }, 4, leg.contact ? t.fg : base);
    });

    // trunk + head + arms
    seg(g0.hip, g0.shoulder, 8, base);
    const right = { x: g0.up.y, y: -g0.up.x };       // trunk-right unit
    const hand = (sgn) => ({
      x: g0.shoulder.x + right.x * 0.32 * sgn - g0.up.x * 0.22,
      y: g0.shoulder.y + right.y * 0.32 * sgn - g0.up.y * 0.22,
    });
    seg(g0.shoulder, hand(1), 4, base);
    seg(g0.shoulder, hand(-1), 4, base);
    const H = S(g0.head);
    c.fillStyle = base; c.beginPath(); c.arc(H[0], H[1], gg.px(15), 0, Math.PI * 2); c.fill();

    // trunk-torque indicator: an arc near the shoulders
    const inTau = (active.torL ? opts.tau : 0) + (active.torR ? -opts.tau : 0);
    if (inTau !== 0 && !fallen) {
      const Sh = S(g0.shoulder), r = gg.px(24), dir = Math.sign(inTau);
      c.strokeStyle = t.fg; c.lineWidth = gg.px(2.5);
      c.beginPath();
      c.arc(Sh[0], Sh[1], r, -0.4 * Math.PI, 0.4 * Math.PI, dir > 0);
      c.stroke();
    }
  }

  const anim = Anim({
    state: freshState(),
    deriv: (s) => (fallen ? [0, 0, 0, 0, 0, 0, 0, 0] : deriv(s, buildInput(), p)),
    dt: 0.004, integrator: 'rk4', canvas, draw, autoplay: true,
  });

  function render() {
    const phi = anim.state[4];
    const deg = -phi * 180 / Math.PI;   // report lean as +right for the reader
    out.textContent = fallen
      ? 'fell — press reset'
      : `upright ${uprightTime.toFixed(1)}s · lean ${deg >= 0 ? '+' : ''}${deg.toFixed(0)}°`;
  }

  anim.on('tick', (s) => {
    const now = (typeof performance !== 'undefined' ? performance.now() : 0);
    if (lastTs != null && !fallen) uprightTime += (now - lastTs) / 1000;
    lastTs = now;
    if (!fallen && (Math.abs(s[4]) > 1.25 || s[2] < 0.55)) {
      fallen = true;
      for (const k in active) active[k] = false;
      setTimeout(() => anim.pause(), 0);
    }
    render();
  });

  // --- reader input: hold-to-actuate buttons + keys -------------------------
  const btns = [...el.querySelectorAll('.hb-btn')];
  const setFlag = (flag, on) => {
    if (fallen) return;
    active[flag] = on;
    const b = btns.find((x) => x.dataset.flag === flag);
    if (b) b.classList.toggle('is-on', on);
  };
  btns.forEach((btn) => {
    const flag = btn.dataset.flag;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      stage.focus({ preventScroll: true });   // arm the keyboard on first touch
      setFlag(flag, true);
    });
    const up = () => setFlag(flag, false);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('pointercancel', up);
  });

  const KEYMAP = { a: 'legL', A: 'legL', d: 'legR', D: 'legR',
    ArrowLeft: 'torL', ArrowRight: 'torR' };
  stage.tabIndex = 0;
  const keydown = (e) => { const f = KEYMAP[e.key]; if (f) { e.preventDefault(); setFlag(f, true); } };
  const keyup = (e) => { const f = KEYMAP[e.key]; if (f) setFlag(f, false); };
  stage.addEventListener('keydown', keydown);
  stage.addEventListener('keyup', keyup);

  // --- control panel (play/pause/reset also focus the stage) ----------------
  const focusStage = () => stage.focus({ preventScroll: true });
  function doPlay() { if (fallen) return; lastTs = null; anim.play(); focusStage(); }
  function doPause() { anim.pause(); lastTs = null; focusStage(); }
  function doReset() {
    fallen = false; uprightTime = 0; lastTs = null;
    for (const k in active) active[k] = false;
    btns.forEach((b) => b.classList.remove('is-on'));
    anim.state = freshState();
    anim.redraw(); render(); doPlay();
  }

  Controls(el.querySelector('.hb-controls'), [
    { type: 'button', label: 'play', onClick: doPlay },
    { type: 'button', label: 'pause', onClick: doPause },
    { type: 'button', label: 'reset', onClick: doReset },
    { type: 'slider', key: 'betaDeg', min: 6, max: 30, step: 1, value: opts.betaDeg,
      label: 'stance width', unit: '°', dp: 0 },
    { type: 'slider', key: 'dContract', min: 0.15, max: 0.5, step: 0.01, value: opts.dContract,
      label: 'contract depth', unit: 'm', dp: 2 },
    { type: 'slider', key: 'tau', min: 2, max: 12, step: 0.5, value: opts.tau,
      label: 'torso torque', unit: 'N·m', dp: 1 },
  ], opts, (key) => { if (key === 'betaDeg') p.beta = opts.betaDeg * Math.PI / 180; });

  const off = Theme.onChange(() => anim.redraw());
  render();

  return () => {
    anim.pause();
    off();
    stage.removeEventListener('keydown', keydown);
    stage.removeEventListener('keyup', keyup);
  };
}

window.Demos.register('humanoid-balance', mount);

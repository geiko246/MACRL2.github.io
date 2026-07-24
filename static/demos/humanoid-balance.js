// humanoid-balance.js — Unit 1 (feedback control), first beat: WALK a planar
// biped forward by hand. A rigid trunk on two length-actuated legs makes ground
// contact; feet grip when planted and release when a leg contracts, so the
// reader can push off and step. Contract a leg, torque the trunk, and try to
// travel forward without toppling. Dynamics live in the pure sibling module.
import { PARAMS, standingState, deriv, pose, footPositions, stepAnchors }
  from '/static/demos/humanoid-dynamics.js';

function mount(el, params, ctx) {
  const { Anim, Controls, Theme } = ctx;

  const p = { ...PARAMS };
  const opts = {
    betaDeg: PARAMS.beta * 180 / Math.PI,
    dContract: PARAMS.dContract,
    tau: PARAMS.tau,
  };
  const activeFlags = { legL: false, legR: false, torL: false, torR: false };
  let anchors = [null, null];
  let fallen = false, dist = 0, best = 0;

  function buildInput() {
    return {
      targetL: activeFlags.legL ? p.l0 - opts.dContract : p.l0,
      targetR: activeFlags.legR ? p.l0 - opts.dContract : p.l0,
      tau: (activeFlags.torL ? opts.tau : 0) + (activeFlags.torR ? -opts.tau : 0),
      anchorL: anchors[0], anchorR: anchors[1],
    };
  }

  function freshState() {
    p.beta = opts.betaDeg * Math.PI / 180;
    const s = standingState(p);
    s[4] = -0.03;                  // a slight forward (rightward) lean to set off
    anchors = stepAnchors([null, null], s, p);
    return s;
  }

  el.innerHTML =
    '<div class="hb-stage" style="height:300px">' +
    '<canvas style="width:100%;height:100%;display:block;touch-action:none"></canvas></div>' +
    '<div class="hb-push">' +
    '<button class="ctl-btn hb-btn" type="button" data-flag="legL">left leg <kbd>A</kbd></button>' +
    '<button class="ctl-btn hb-btn" type="button" data-flag="torL">lean back <kbd>←</kbd></button>' +
    '<button class="ctl-btn hb-btn" type="button" data-flag="torR">lean fwd <kbd>→</kbd></button>' +
    '<button class="ctl-btn hb-btn" type="button" data-flag="legR"><kbd>D</kbd> right leg</button>' +
    '</div><output class="hb-readout" aria-live="off"></output>' +
    '<div class="hb-controls"></div>';

  const stage = el.querySelector('.hb-stage');
  const canvas = el.querySelector('canvas');
  const out = el.querySelector('.hb-readout');

  // --- drawing (camera follows the biped; ground ticks show distance) -------
  function draw(gg, s) {
    const t = Theme.tokens();
    gg.fit();
    const cx = s[0];
    gg.setWorld({ x0: cx - 1.7, x1: cx + 1.7, y0: -0.35, y1: 2.5 });
    gg.clear();
    const c = gg.ctx;
    const S = (pt) => [gg.sx(pt.x), gg.sy(pt.y)];
    const g0 = pose(s, p);
    const groundY = gg.sy(0);

    // ground line
    c.strokeStyle = t.rule; c.lineWidth = gg.px(1.5);
    c.beginPath(); c.moveTo(gg.sx(cx - 1.7), groundY); c.lineTo(gg.sx(cx + 1.7), groundY); c.stroke();
    // distance ticks every 0.5 m, labelled in metres
    c.fillStyle = t.faint; c.strokeStyle = t.faint; c.lineWidth = gg.px(1);
    c.font = `${gg.px(10)}px ${getComputedStyle(document.documentElement).getPropertyValue('--mono') || 'monospace'}`;
    c.textAlign = 'center';
    for (let tx = Math.ceil((cx - 1.7) / 0.5) * 0.5; tx <= cx + 1.7; tx += 0.5) {
      const px = gg.sx(tx);
      c.beginPath(); c.moveTo(px, groundY); c.lineTo(px, groundY + gg.px(7)); c.stroke();
      c.fillText(tx.toFixed(1), px, groundY + gg.px(19));
    }
    // start line at x = 0
    if (0 >= cx - 1.7 && 0 <= cx + 1.7) {
      c.strokeStyle = t.accent; c.lineWidth = gg.px(1.5); c.setLineDash([gg.px(3), gg.px(4)]);
      c.beginPath(); c.moveTo(gg.sx(0), groundY); c.lineTo(gg.sx(0), gg.sy(0.6)); c.stroke();
      c.setLineDash([]);
    }

    const base = fallen ? t.muted : t.accent;
    c.lineCap = 'round'; c.lineJoin = 'round';
    const seg = (a, b, w, col) => {
      c.strokeStyle = col; c.lineWidth = gg.px(w);
      const A = S(a), B = S(b);
      c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke();
    };

    g0.legs.forEach((leg, i) => {
      const engaged = !fallen && (i === 0 ? activeFlags.legL : activeFlags.legR);
      const col = engaged ? t.fg : base;
      seg(g0.hip, leg.knee, engaged ? 7 : 5, col);
      seg(leg.knee, leg.foot, engaged ? 7 : 5, col);
      const fx = leg.foot.x, fy = Math.max(leg.foot.y, 0);
      seg({ x: fx - 0.13, y: fy }, { x: fx + 0.13, y: fy }, 4, leg.contact ? t.fg : base);
    });

    seg(g0.hip, g0.shoulder, 8, base);
    const right = { x: g0.up.y, y: -g0.up.x };
    const hand = (sgn) => ({
      x: g0.shoulder.x + right.x * 0.32 * sgn - g0.up.x * 0.22,
      y: g0.shoulder.y + right.y * 0.32 * sgn - g0.up.y * 0.22,
    });
    seg(g0.shoulder, hand(1), 4, base);
    seg(g0.shoulder, hand(-1), 4, base);
    const H = S(g0.head);
    c.fillStyle = base; c.beginPath(); c.arc(H[0], H[1], gg.px(15), 0, Math.PI * 2); c.fill();

    const inTau = (activeFlags.torL ? opts.tau : 0) + (activeFlags.torR ? -opts.tau : 0);
    if (inTau !== 0 && !fallen) {
      const Sh = S(g0.shoulder), r = gg.px(24), dir = Math.sign(inTau);
      c.strokeStyle = t.fg; c.lineWidth = gg.px(2.5);
      c.beginPath(); c.arc(Sh[0], Sh[1], r, -0.4 * Math.PI, 0.4 * Math.PI, dir > 0); c.stroke();
    }
  }

  const anim = Anim({
    state: freshState(),
    deriv: (s) => (fallen ? [0, 0, 0, 0, 0, 0, 0, 0] : deriv(s, buildInput(), p)),
    dt: 0.004, integrator: 'rk4', canvas, draw, autoplay: true,
  });

  function render() {
    out.textContent = fallen
      ? `fell at ${dist.toFixed(1)} m — press reset  ·  best ${best.toFixed(1)} m`
      : `forward ${dist.toFixed(1)} m  ·  best ${best.toFixed(1)} m`;
  }

  anim.on('tick', (s) => {
    if (!fallen) {
      anchors = stepAnchors(anchors, s, p);
      dist = s[0];
      if (dist > best) best = dist;
      if (Math.abs(s[4]) > 1.25 || s[2] < 0.55) {
        fallen = true;
        for (const k in activeFlags) activeFlags[k] = false;
        setTimeout(() => anim.pause(), 0);
      }
    }
    render();
  });

  // --- reader input ---------------------------------------------------------
  const btns = [...el.querySelectorAll('.hb-btn')];
  const setFlag = (flag, on) => {
    if (fallen) return;
    activeFlags[flag] = on;
    const b = btns.find((x) => x.dataset.flag === flag);
    if (b) b.classList.toggle('is-on', on);
  };
  btns.forEach((btn) => {
    const flag = btn.dataset.flag;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      stage.focus({ preventScroll: true });
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
  function doPlay() { if (fallen) return; anim.play(); focusStage(); }
  function doPause() { anim.pause(); focusStage(); }
  function doReset() {
    fallen = false; dist = 0;
    for (const k in activeFlags) activeFlags[k] = false;
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

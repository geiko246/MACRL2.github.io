// humanoid-balance.js — Unit 1 (feedback control), first beat: WALK a planar
// biped forward by hand. A rigid trunk on two length-actuated legs makes ground
// contact; feet grip when planted and release when a leg contracts, so the
// reader can push off and step. Contract a leg, torque the trunk, and try to
// travel forward without toppling. Dynamics live in the pure sibling module.
import { PARAMS, standingState, deriv, pose, footPositions, stepAnchors }
  from '/static/demos/humanoid-dynamics.js';

// Vertical world extent kept on screen (metres); the horizontal view follows.
const VIEW = { y0: -0.35, y1: 2.55 };

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
  let fallen = false, running = true, dist = 0, best = 0;

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
    '<div class="hb-actions">' +
    '<button class="ctl-btn" type="button" data-act="play">play <kbd>Space</kbd></button>' +
    '<button class="ctl-btn" type="button" data-act="pause">pause</button>' +
    '<button class="ctl-btn" type="button" data-act="reset">reset <kbd>R</kbd></button>' +
    '</div><div class="hb-controls"></div>';

  const stage = el.querySelector('.hb-stage');
  const canvas = el.querySelector('canvas');
  const out = el.querySelector('.hb-readout');

  // --- drawing: isotropic world->pixel map (equal x/y scale => no distortion
  // when the trunk rotates), with the camera following the biped in x. --------
  function draw(gg, s) {
    const t = Theme.tokens();
    gg.fit();
    const c = gg.ctx;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width, H = canvas.height;
    const scale = H / (VIEW.y1 - VIEW.y0);      // pixels per metre, same in x and y
    const camX = s[0];
    const mx = (x) => (x - camX) * scale + W / 2;
    const my = (y) => H - (y - VIEW.y0) * scale;
    const S = (pt) => [mx(pt.x), my(pt.y)];
    const LW = (w) => w * dpr;                   // constant stroke width (device px)

    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W, H);
    const g0 = pose(s, p);
    const groundY = my(0);
    const halfView = (W / 2) / scale;
    const xL = camX - halfView, xR = camX + halfView;

    // ground + distance ticks (every 0.5 m) + start line
    c.strokeStyle = t.rule; c.lineWidth = LW(1.5);
    c.beginPath(); c.moveTo(mx(xL), groundY); c.lineTo(mx(xR), groundY); c.stroke();
    c.fillStyle = t.faint; c.strokeStyle = t.faint; c.lineWidth = LW(1);
    c.font = `${Math.round(LW(10))}px monospace`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    for (let tx = Math.ceil(xL / 0.5) * 0.5; tx <= xR; tx += 0.5) {
      const px = mx(tx);
      c.beginPath(); c.moveTo(px, groundY); c.lineTo(px, groundY + LW(7)); c.stroke();
      c.fillText(tx.toFixed(1), px, groundY + LW(19));
    }
    if (0 >= xL && 0 <= xR) {
      c.strokeStyle = t.accent; c.lineWidth = LW(1.5); c.setLineDash([LW(3), LW(4)]);
      c.beginPath(); c.moveTo(mx(0), groundY); c.lineTo(mx(0), my(0.6)); c.stroke();
      c.setLineDash([]);
    }

    const baseCol = fallen ? t.muted : t.accent;
    c.lineCap = 'round'; c.lineJoin = 'round';
    const seg = (a, b, w, col) => {
      c.strokeStyle = col; c.lineWidth = LW(w);
      const A = S(a), B = S(b);
      c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke();
    };

    g0.legs.forEach((leg, i) => {
      const engaged = !fallen && (i === 0 ? activeFlags.legL : activeFlags.legR);
      const col = engaged ? t.fg : baseCol;
      seg(g0.hip, leg.knee, engaged ? 7 : 5, col);
      seg(leg.knee, leg.foot, engaged ? 7 : 5, col);
      const fx = leg.foot.x, fy = Math.max(leg.foot.y, 0);
      seg({ x: fx - 0.13, y: fy }, { x: fx + 0.13, y: fy }, 4, leg.contact ? t.fg : baseCol);
    });

    seg(g0.hip, g0.shoulder, 8, baseCol);
    const right = { x: g0.up.y, y: -g0.up.x };
    const hand = (sgn) => ({
      x: g0.shoulder.x + right.x * 0.32 * sgn - g0.up.x * 0.22,
      y: g0.shoulder.y + right.y * 0.32 * sgn - g0.up.y * 0.22,
    });
    seg(g0.shoulder, hand(1), 4, baseCol);
    seg(g0.shoulder, hand(-1), 4, baseCol);
    const Hd = S(g0.head);
    c.fillStyle = baseCol; c.beginPath(); c.arc(Hd[0], Hd[1], 0.16 * scale, 0, Math.PI * 2); c.fill();

    const inTau = (activeFlags.torL ? opts.tau : 0) + (activeFlags.torR ? -opts.tau : 0);
    if (inTau !== 0 && !fallen) {
      const Sh = S(g0.shoulder), r = 0.22 * scale, dir = Math.sign(inTau);
      c.strokeStyle = t.fg; c.lineWidth = LW(2.5);
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
      ? `fell at ${dist.toFixed(1)} m — reset (R)  ·  best ${best.toFixed(1)} m`
      : `forward ${dist.toFixed(1)} m  ·  best ${best.toFixed(1)} m`;
  }

  anim.on('tick', (s) => {
    if (!fallen) {
      anchors = stepAnchors(anchors, s, p);
      dist = s[0];
      if (dist > best) best = dist;
      if (Math.abs(s[4]) > 1.25 || s[2] < 0.55) {
        fallen = true; running = false;
        for (const k in activeFlags) activeFlags[k] = false;
        setTimeout(() => anim.pause(), 0);
      }
    }
    render();
  });

  // --- reader input ---------------------------------------------------------
  const focusStage = () => stage.focus({ preventScroll: true });
  const btns = [...el.querySelectorAll('.hb-btn')];
  const setFlag = (flag, on) => {
    if (fallen) return;
    activeFlags[flag] = on;
    const b = btns.find((x) => x.dataset.flag === flag);
    if (b) b.classList.toggle('is-on', on);
  };
  btns.forEach((btn) => {
    const flag = btn.dataset.flag;
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); focusStage(); setFlag(flag, true); });
    const up = () => setFlag(flag, false);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('pointercancel', up);
  });

  function doPlay() { if (fallen) return; running = true; anim.play(); focusStage(); }
  function doPause() { running = false; anim.pause(); focusStage(); }
  function doReset() {
    fallen = false; running = true; dist = 0;
    for (const k in activeFlags) activeFlags[k] = false;
    btns.forEach((b) => b.classList.remove('is-on'));
    anim.state = freshState();
    anim.redraw(); render(); anim.play(); focusStage();
  }
  const ACT = { play: doPlay, pause: doPause, reset: doReset };
  el.querySelectorAll('.hb-actions .ctl-btn').forEach((b) =>
    b.addEventListener('click', () => ACT[b.dataset.act]()));

  const KEYMAP = { a: 'legL', A: 'legL', d: 'legR', D: 'legR',
    ArrowLeft: 'torL', ArrowRight: 'torR' };
  stage.tabIndex = 0;
  const keydown = (e) => {
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); doReset(); return; }
    if (e.key === ' ') { e.preventDefault(); (running ? doPause : doPlay)(); return; }
    const f = KEYMAP[e.key];
    if (f) { e.preventDefault(); setFlag(f, true); }
  };
  const keyup = (e) => { const f = KEYMAP[e.key]; if (f) setFlag(f, false); };
  stage.addEventListener('keydown', keydown);
  stage.addEventListener('keyup', keyup);

  // --- tuning sliders -------------------------------------------------------
  Controls(el.querySelector('.hb-controls'), [
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

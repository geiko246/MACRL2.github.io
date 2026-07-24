// humanoid-balance.js — Unit 1 (feedback control), first beat: balance a humanoid
// BY HAND. The body is a rigid inverted pendulum hinged at the ankle (the
// classic single-link "ankle strategy" model of standing balance). The reader
// is the controller: press-and-hold the buttons (or arrow keys) to apply an
// ankle torque and feel how quickly upright runs away.

function mount(el, params, ctx) {
  const { Anim, Controls, Theme } = ctx;

  // --- physics constants (a rigid uniform body pivoting at the ankle) --------
  const m = 1;            // body mass
  const g = 9.81;         // gravity
  const L = 2.0;          // body height (ankle -> head), metres
  const I = (1 / 3) * m * L * L;   // moment of inertia about the ankle
  const b = 0.02;         // tiny joint damping

  // push strength (ankle torque magnitude, N·m) is reader-tunable
  const opts = { push: params && params.push ? +params.push : 7 };

  let input = 0;          // current ankle torque applied by the reader
  let fallen = false;     // true once the body has toppled past recovery
  let uprightTime = 0;    // seconds kept from falling since the last reset
  let lastTs = null;      // wall-clock stamp for the upright timer

  // state = [theta, thetaDot]; theta measured from vertical, +right.
  function deriv(s) {
    if (fallen) return [0, 0];                 // freeze once toppled
    const th = s[0], w = s[1];
    const gravityTorque = m * g * (L / 2) * Math.sin(th);   // destabilising
    const thddot = (gravityTorque + input - b * w) / I;
    return [w, thddot];
  }

  el.innerHTML =
    '<div class="hb-stage" style="height:280px">' +
    '<canvas style="width:100%;height:100%;display:block;touch-action:none"></canvas></div>' +
    '<div class="hb-push">' +
    '<button class="ctl-btn hb-btn" type="button" data-dir="-1" aria-label="push left">◀ push</button>' +
    '<output class="hb-readout" aria-live="off"></output>' +
    '<button class="ctl-btn hb-btn" type="button" data-dir="1" aria-label="push right">push ▶</button>' +
    '</div><div class="hb-controls"></div>';

  const stage = el.querySelector('.hb-stage');
  const canvas = el.querySelector('canvas');
  const out = el.querySelector('.hb-readout');

  // --- drawing: a stick humanoid rotating rigidly about the ankle -----------
  // Landmarks are axial distances up the body from the ankle at (0,0); `w` is a
  // lateral offset. up = (sinθ, cosθ); right-perp = (cosθ, -sinθ).
  function draw(gg, s) {
    const t = Theme.tokens();
    gg.fit();
    gg.setWorld({ x0: -1.6, x1: 1.6, y0: -0.4, y1: 2.4 });
    gg.clear();
    const c = gg.ctx;
    const th = s[0];
    const P = (d, w = 0) => [
      gg.sx(d * Math.sin(th) + w * Math.cos(th)),
      gg.sy(d * Math.cos(th) - w * Math.sin(th)),
    ];

    // ground
    const groundY = gg.sy(0);
    c.strokeStyle = t.rule; c.lineWidth = gg.px(1.5);
    c.beginPath(); c.moveTo(gg.sx(-1.6), groundY); c.lineTo(gg.sx(1.6), groundY); c.stroke();

    // faint upright reference
    c.save();
    c.strokeStyle = t.faint; c.lineWidth = gg.px(1); c.setLineDash([gg.px(4), gg.px(5)]);
    c.beginPath(); c.moveTo(gg.sx(0), groundY); c.lineTo(gg.sx(0), gg.sy(L * 0.98)); c.stroke();
    c.restore();

    const col = fallen ? t.muted : t.accent;
    c.strokeStyle = col; c.fillStyle = col;
    c.lineWidth = gg.px(6); c.lineCap = 'round'; c.lineJoin = 'round';

    const seg = (a, bb) => { c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(bb[0], bb[1]); c.stroke(); };
    // legs: hip -> two feet
    seg(P(0.95, 0.12), P(0.0, 0.20));
    seg(P(0.95, -0.12), P(0.0, -0.20));
    // torso: hip -> shoulder
    seg(P(0.95, 0), P(1.6, 0));
    // arms: shoulder -> two hands (hanging slightly forward)
    seg(P(1.6, 0), P(1.15, 0.30));
    seg(P(1.6, 0), P(1.15, -0.30));
    // head
    const head = P(1.87, 0);
    c.beginPath(); c.arc(head[0], head[1], gg.px(16), 0, Math.PI * 2); c.fill();

    // active-push indicator: a short arc at the ankle
    if (input !== 0 && !fallen) {
      c.save();
      c.strokeStyle = t.fg; c.lineWidth = gg.px(2.5);
      const r = gg.px(26), dir = Math.sign(input);
      c.beginPath();
      c.arc(gg.sx(0), groundY, r, -0.35 * Math.PI, 0.35 * Math.PI, dir < 0);
      c.stroke();
      c.restore();
    }
  }

  const anim = Anim({
    state: [0.05, 0], deriv, dt: 0.01, integrator: 'rk4',
    canvas, draw, autoplay: true,
  });

  function render() {
    const th = anim.state[0];
    const deg = th * 180 / Math.PI;
    out.textContent = fallen
      ? 'fell — press reset'
      : `upright ${uprightTime.toFixed(1)}s · ${deg >= 0 ? '+' : ''}${deg.toFixed(0)}°`;
  }

  anim.on('tick', (s) => {
    const now = (typeof performance !== 'undefined' ? performance.now() : 0);
    if (lastTs != null && !fallen) uprightTime += (now - lastTs) / 1000;
    lastTs = now;
    if (!fallen && Math.abs(s[0]) > 1.35) {
      fallen = true; input = 0;
      // Pause after this frame settles (pausing mid-tick is undone by Anim's
      // own reschedule), to stop the loop once the body is down.
      setTimeout(() => anim.pause(), 0);
    }
    render();
  });

  // --- reader input: press-and-hold buttons + arrow keys --------------------
  function setInput(v) { input = fallen ? 0 : v; render(); }
  const btns = [...el.querySelectorAll('.hb-btn')];
  const release = () => { setInput(0); btns.forEach((b2) => b2.classList.remove('is-on')); };
  btns.forEach((btn) => {
    const dir = +btn.dataset.dir;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (fallen) return;
      setInput(dir * opts.push);
      btns.forEach((b2) => b2.classList.remove('is-on'));
      btn.classList.add('is-on');
    });
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('pointercancel', release);
  });

  stage.tabIndex = 0;
  const keydown = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a') { e.preventDefault(); setInput(-opts.push); }
    else if (e.key === 'ArrowRight' || e.key === 'd') { e.preventDefault(); setInput(opts.push); }
  };
  const keyup = (e) => {
    if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) setInput(0);
  };
  stage.addEventListener('keydown', keydown);
  stage.addEventListener('keyup', keyup);

  // --- control panel --------------------------------------------------------
  function doPlay() { if (fallen) return; lastTs = null; anim.play(); }
  function doPause() { anim.pause(); lastTs = null; }
  function doReset() {
    fallen = false; input = 0; uprightTime = 0; lastTs = null;
    anim.reset();       // back to the initial slight tilt
    render(); doPlay();
  }

  Controls(el.querySelector('.hb-controls'), [
    { type: 'button', label: 'play', onClick: doPlay },
    { type: 'button', label: 'pause', onClick: doPause },
    { type: 'button', label: 'reset', onClick: doReset },
    { type: 'slider', key: 'push', min: 2, max: 14, step: 1, value: opts.push,
      label: 'push strength', unit: 'N·m', dp: 0 },
  ], opts);

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

---
title: "Researcher · Humanoid"
description: The researcher journey — teach a humanoid to stand and move, across feedback control, optimal control, reinforcement learning, and imitation.
part: "Journeys"
summary: One humanoid, four units — feedback control, optimal control, reinforcement learning, and imitation.
interactive: true
hide_from_toc: true
---

# Teaching a Humanoid to Stand

Walk it forward. Contract a leg to unweight and push off, torque the trunk to
stay over your feet — buttons, or **A** / **D** and **←** / **→**. Get as far as
you can before it falls.

<div class="demo" data-demo="humanoid-balance"></div>

It fights you because upright isn't where the body rests — it's where it runs
*away* from, and every step is a small controlled fall you have to catch. Making
forward progress means watching the whole body and correcting a few times a
second. That loop is **feedback control**, and you just ran it by hand.

The rest of this journey automates that loop, then rebuilds it four times — each
unit taking over exactly where the last one breaks.

## Unit 1 · Feedback control

The tempting shortcut is a fixed, pre-planned schedule of torques. It can't do
what you just did — it never looks at the body, so one nudge ends it. Feedback
makes the torque depend on the measured state: sense, then react. This unit
builds the core of classical control — state, stability, and state-feedback
design.

<aside class="callout" data-kind="note">
  <span class="callout-label">coming next in this unit</span>
  <p>Author an open-loop torque schedule, watch a disturbance break it, then add
  feedback and watch it recover.</p>
</aside>

## Unit 2 · Optimal control &amp; MPC

Feedback that holds near upright is still ad hoc — which gains, and why? And it
can't plan: to rise from the floor, or hold a load with no margin, the
controller must look ahead and respect real limits. Give it a model and a cost
and control becomes optimization — the linear-quadratic regulator in closed
form, and **model predictive control** when constraints force a replan every
step.

<aside class="callout" data-kind="try">
  <span class="callout-label">interactive — coming</span>
  <p>Shape a cost and watch the optimal controller trade effort against accuracy;
  watch MPC replan against constraints in real time.</p>
</aside>

## Unit 3 · Reinforcement learning

Optimal control assumes you *have* the model. On a real humanoid you don't. So
drop it and let the body improve by trying: run a policy, measure a reward, keep
what worked — from the crudest search up to policy-gradient methods.

<aside class="callout" data-kind="try">
  <span class="callout-label">interactive — coming</span>
  <p>Watch a policy that does nothing teach itself to balance, one episode at a
  time, as the return climbs.</p>
</aside>

## Unit 4 · Imitation learning &amp; IRL

A reward for anything lifelike — a natural gait, a graceful recovery — is
painfully hard to write. So show it instead. **Imitation learning** trains from
demonstrations; **inverse RL** infers the objective itself, so the humanoid
generalizes the intent rather than copying the motion.

<aside class="callout" data-kind="try">
  <span class="callout-label">interactive — coming</span>
  <p>Demonstrate a motion, train a policy to imitate it, then recover the reward
  that explains it and watch it generalize.</p>
</aside>

---

*The interactive humanoid and the worked mathematics for each unit continue from
here.*

<script>
  // Progressive enhancement: make the demo the landing screen, then reveal the
  // lesson blocks as they scroll into view. With JS off, everything just shows.
  (function () {
    var art = document.querySelector('.page-content');
    if (!art) return;
    var demo = art.querySelector('.demo');
    if (!demo) return;

    // Move everything from the top through the demo into a full-height hero.
    var hero = document.createElement('section');
    hero.className = 'journey-hero';
    var node = art.firstChild, batch = [];
    while (node) { batch.push(node); if (node === demo) break; node = node.nextSibling; }
    batch.forEach(function (n) { hero.appendChild(n); });
    art.insertBefore(hero, art.firstChild);

    var cue = document.createElement('div');
    cue.className = 'hero-cue';
    cue.setAttribute('aria-hidden', 'true');
    cue.textContent = '↓';
    hero.appendChild(cue);

    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px' });

    for (var sib = hero.nextElementSibling; sib; sib = sib.nextElementSibling) {
      if (sib.tagName !== 'SCRIPT') { sib.classList.add('reveal'); io.observe(sib); }
    }
  })();
</script>

---
title: "Researcher · Humanoid"
description: The researcher journey — teach a humanoid to stand and move, across feedback control, optimal control, reinforcement learning, and imitation.
part: "Journeys"
summary: One humanoid, four units — feedback control, optimal control, reinforcement learning, and imitation.
interactive: true
hide_from_toc: true
---

# Teaching a Humanoid to Stand

Here is a body with joints — ankles, knees, hips — and gravity pulling on every
one of them. It wants to fall. Across this journey we keep it upright, then keep
it upright under pressure, then let it teach *itself* to stay up. The humanoid
never changes; what changes is the sophistication of the loop keeping it
standing.

Each unit below is motivated the same way: the previous approach hits a wall —
a disturbance it can't see, a constraint it can't respect, a model it doesn't
have, an objective it can't name — and the next unit is the tool that gets past
it.

<aside class="callout" data-kind="note">
  <span class="callout-label">the four units</span>
  <p><strong>Feedback control</strong> → <strong>optimal control &amp; MPC</strong>
  → <strong>reinforcement learning</strong> → <strong>imitation learning &amp;
  IRL</strong>. Each is introduced through the humanoid, and each earns its place
  by fixing where the one before it breaks.</p>
</aside>

## Unit 1 · Feedback control

Start by getting a feel for the problem: keep the body upright by hand, and
discover that "upright" is not a place the body rests — it is a place it runs
*away* from. Lean a little and the lean accelerates. That is an **unstable
equilibrium**, and it is why doing nothing is never an option.

A fixed, pre-planned schedule of torques won't survive a single nudge, because
it never looks at the body. The fix is **feedback**: make the torques depend on
the measured state, so the controller senses and reacts. This unit builds the
core of classical control — state, stability, and state-feedback design — the
foundation everything later stands on.

<aside class="callout" data-kind="try">
  <span class="callout-label">interactive — coming next</span>
  <p>Balance the humanoid by hand; then watch an open-loop schedule fail under a
  nudge, and a feedback law catch it.</p>
</aside>

## Unit 2 · Optimal control &amp; MPC

Feedback that holds near upright is still ad hoc: which gains, and why? And it
has no way to *plan* — to get up off the floor, or to hold a load level with no
margin to spare, the controller has to look ahead and respect real limits.

Give it a **model** and a **cost**, and control becomes optimization: choose the
torques that minimize cost over a horizon. That is optimal control — the
linear-quadratic regulator as the clean closed-form case, and **model predictive
control** when constraints and nonlinearity mean you re-solve the plan at every
step.

<aside class="callout" data-kind="try">
  <span class="callout-label">interactive — coming next</span>
  <p>Shape a cost, watch the optimal controller trade off effort against
  accuracy, and see MPC replan against constraints in real time.</p>
</aside>

## Unit 3 · Reinforcement learning

Optimal control assumes you *have* the model — the masses, the contact, the
friction. On a real humanoid you don't, and small errors compound. So drop the
model and let the body improve by *trying*: run a policy, measure a reward, keep
what worked.

This unit builds up from the crudest possible learner to policy-gradient
methods — a policy, a reward, and a loop that improves one from the other. It is
the same balancing problem, now solved from experience instead of equations.

<aside class="callout" data-kind="try">
  <span class="callout-label">interactive — coming next</span>
  <p>Watch a policy that does nothing teach itself to balance, one episode at a
  time, as the return climbs.</p>
</aside>

## Unit 4 · Imitation learning &amp; IRL

Reinforcement learning needs a reward, and for anything lifelike — a natural
gait, a graceful recovery — a good reward is painfully hard to write down. But
we can *show* the behavior.

**Imitation learning** trains a policy directly from demonstrations;
**inverse reinforcement learning** goes further and infers the objective itself
from an expert, so the humanoid can generalize the *intent* rather than copy the
motion. This closes the journey: from hand-tuned feedback to a controller that
learns not just how to act, but what it is trying to do.

<aside class="callout" data-kind="try">
  <span class="callout-label">interactive — coming next</span>
  <p>Demonstrate a motion, train a policy to imitate it, then recover the reward
  that explains the demonstration and watch it generalize.</p>
</aside>

---

*This page is the spine of the researcher journey. The interactive humanoid and
the worked mathematics for each unit land next.*

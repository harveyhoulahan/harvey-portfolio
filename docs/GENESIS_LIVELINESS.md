# Genesis — making the substrates feel alive (M2.5)

*Why Particle Life reads as "alive" and Lenia (initially) didn't, and the new reacting
variables introduced to close the gap. Reasoned design notes for the liveliness pass that
precedes M3.*

## Diagnosis — what "reactive/alive" actually means here

Particle Life feels the most alive for three concrete reasons:

1. **High-dimensional coupling.** Behaviour is governed by a K×K attraction matrix (36
   numbers at K=6). Every species reacts to every other; small asymmetries (A[i][j] ≠
   A[j][i]) produce chasing, orbiting and self-propulsion. Many interacting degrees of
   freedom ⇒ rich, surprising dynamics.
2. **Persistent motion.** Particles carry velocity and momentum; with friction < 1 they
   keep drifting rather than settling. There's always kinetic energy in the system.
3. **It never fully equilibrates** — clusters form, collide, dissolve.

Base Lenia, by contrast, is a *single* scalar field with one symmetric kernel and four
fixed constants (R, μ, σ, dt). From random soup it relaxes into a near-static, Turing-like
labyrinth: a stable fixed point. Few degrees of freedom + radial symmetry + a fixed
attractor ⇒ it looks frozen. Symmetry is the key culprit: a radially symmetric kernel has
no preferred direction, so structures have no reason to *translate*.

## Principle

To make a system feel alive, add **coupled variables that (a) break symmetry, (b) inject
energy, and (c) drift over time** — and crucially let them *react to each other and to the
field*, not just animate on a fixed schedule. Randomness alone reads as noise; randomness
that the dynamics respond to reads as life.

## Lenia — four new reacting variables

1. **Metabolism (breathing μ/σ).** The growth centre μ and width σ oscillate slowly:
   `μ(t) = μ₀ + μ_amp·sin(ω t + φ)`, likewise σ. This walks the system back and forth across
   the bifurcation between "dies", "stable" and "chaotic", so structures perpetually
   re-form instead of settling. The oscillator phase is randomised per reset, and nudged by
   noise, so no two runs breathe alike.
2. **Energy injection.** A small, sparse stochastic birth term each step (hash-based, so
   it's deterministic per frame but spatially random): a few cells get a jolt of state. This
   is the "primordial energy" that stops the field freezing and keeps spawning new structure
   — analogous to mutation/perturbation in real ecologies.
3. **Anisotropic flow (self-propulsion via advection).** After the Lenia update, the field
   is advected by a slowly evolving velocity field
   `v = drift·(cosθ, sinθ) + swirl·curl-noise(x,y,t)`. The uniform drift breaks radial
   symmetry so creatures *travel*; the swirl term adds rotation so they wander rather than
   scroll. This is the single biggest "it moves!" change.
4. **Wandering heading θ.** The drift direction is itself a variable that does a slow random
   walk (`θ += 𝒩(0, jitter)`) and is the thing the flow reacts to — so the whole organism
   changes the direction it's exploring over time, like a creature foraging.

Together: the field breathes (metabolism), is fed (energy), swims (drift) and wanders (θ).
All four are coupled through the same evolving field, so it behaves like one organism rather
than four independent animations.

Stability is the risk (advection + energy can blow up or wash out). The reference
implementation in `lib/genesis/lenia.ts` is validated headlessly first — mass must stay
bounded in (0, N²) with no NaNs, *and* the field's centre-of-mass must actually move
(displacement > 0) to confirm we bought motion, not just churn.

## Particle Life — three new reacting variables

1. **Drifting attraction matrix.** Instead of a frozen matrix, every entry does a slow
   bounded random walk (`A += 𝒩(0, rate)`, clamped to [−1,1]) updated on the CPU every few
   frames. The "laws of physics" themselves slowly evolve, so an ecosystem that has settled
   into stable cells will, minutes later, be pulled into new behaviour. This is the
   strongest "living" lever for particles.
2. **Brownian jitter.** A small per-particle random impulse each step (hash by particle
   index + frame seed) keeps clusters shimmering and exploring instead of locking solid —
   thermal energy.
3. **Cursor field (reacts to *you*).** The pointer becomes an attractor/repeller: particles
   within a radius feel a force toward (or, with a modifier, away from) the cursor. This
   makes the system reactive to the viewer — you can herd, stir and scatter the swarm.

## What stays out of scope (for M3+)

Flow Lenia (mass-conserving particle flow), multi-channel Lenia (RGB coupled fields), and a
full curl-noise turbulence field are noted but deferred — they're larger reworks. The four
Lenia + three Particle variables above deliver the "living organism" feel at low risk and
set up M3's sliders (each new variable becomes a knob).

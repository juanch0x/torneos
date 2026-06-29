# Product Vision — Torneos (Pelota Paleta)

> **Purpose of this document.** This is the *why* and the *for whom*, not the *how*.
> The codebase already documents the architecture (`README.md`, `CLAUDE.md`). What was
> missing was the product intent: the real problem, the user, the core pain, and the
> scope boundaries that should guide every future feature exploration.
>
> Read this **before** running any `sdd-explore`. It is the compass that keeps each
> feature honest: does this serve the problem below, or is it scope drift?

---

## 1. The problem

A pelota-paleta club runs tournaments **on a recurring but irregular basis** — almost
every month, sometimes internal-only, sometimes open to outside players. Each tournament
has **N categories** depending on who signs up, their level, and the ball type
(e.g. *primera / segunda / tercera*, or *pelota normal / pelota lenta*).

Today **the entire process is manual**, lives in spreadsheets and on paper, and is
distributed by WhatsApp:

1. **Sign-ups** → a list of people who said "I'm in", dumped into Excel.
2. **Categorization** → group pairs into coherent categories by level. By hand, by judgment.
3. **Groups** → decide how many groups per category based on how many pairs there are
   (4 pairs → maybe one group; 10 pairs → maybe two groups of five). By eye.
   → *First deliverable, sent over WhatsApp: a spreadsheet with categories + groups.*
4. **Fixture** → build the playing schedule by hand in Excel, across 2–3 days, with
   **per-category match durations** (a *primera* match can last twice a *pelota lenta*
   one, because stronger players miss faster and points end sooner).
   → *Second deliverable: the fixture, including semifinals and finals.*
5. **Results** → recorded **on paper**, match by match.
6. **Next-phase bracket** → compute each group's standings by mental math (points,
   point-difference, tie-breaks) and improvise the knockout crosses. By eye.

This works, but it is slow, error-prone, and — for one step in particular — genuinely painful.

---

## 2. The user

- **The organizer** — the single person (or two) who runs the tournament. This is the
  one who edits everything. **Single-writer by design.**
- **The players** — everyone else. They only ever **read**: their group, when they play,
  how the standings look, who advanced.

This `single-writer / everyone-reads` shape is not an accident — it is the product's DNA
and is already baked into the architecture (`README.md:3`).

---

## 3. The core pain: the fixture

If the product solves **one** thing well, it is the **fixture**. It is the step that
**depends on everything before it and conditions everything after it**, and it changes
the most.

The fixture hurts not because of arithmetic, but because it is an **optimization problem
with constraints** that a human has to juggle in their head:

- **Generation.** Each group of N pairs is a round-robin (all-play-all) → a pile of
  matches appears at once.
- **Single court.** There is **always exactly one court.** Everything is serialized.
  Durations vary by category, so you constantly calculate spacing.
- **Rules of a "good" fixture** (this is the organizer's *judgment*, the part Excel can't hold):
  - A pair should **not play two matches back-to-back**.
  - A group should **not be resolved in one block** — if all of a group's matches run
    consecutively, the early losers are eliminated and go home. Groups and categories
    must be **interleaved**.
- **Re-flow is the real hell.** You send v1, someone says "I can't play at that time",
  you move one match — and the interleaving breaks. You re-shuffle the whole thing by
  hand, again and again.

> **The product's true value is not building the fixture once — it is re-building it
> twenty times without breaking the rules.** "Let me pin/move the little that changed,
> and re-flow the rest automatically, respecting the rules."

### Constraints that trigger re-flows

- **What counts:** real personal availability windows — *"I have English class Thursday
  at 20:00"*, *"I have a doctor's appointment at 11:00"*. Modeled simply as **"pair X is
  unavailable in this time window."**
- **What does NOT count:** a person playing in two categories overlapping with themselves.
  If you signed up for two, you deal with it. The product does **not** model
  person-vs-themselves conflicts.
- **Frequency:** the goal is **zero** constraints, and they try for it. In practice 1, 2,
  sometimes N appear — **but never many.** The pain is not the *quantity* (it's not a
  giant solver problem); the pain is that **moving a single one breaks the interleaving.**

---

## 4. The bracket (knockout phase) — a deliberate product stance

The knockout bracket is today **pure in-the-moment judgment**. Examples from the last
tournament (3 categories):

- **Núcleo Damas** — 5 pairs, one group, top 4 advance → semifinal → final.
- **Núcleo** — 6 pairs, two groups of 3, top 2 per group advance → semifinals → final.
- **Goma** — 4 pairs, one group, top 2 advance → straight to the final.

The fear was: *"how do I make the bracket deterministic for a system?"* — especially once
a third group forces you to improvise quarterfinals.

**The key insight: stop looking for the universal bracket formula. It does not exist —
that is precisely why it gets improvised every time.** Two different things are tangled here:

1. **Computing who finishes 1st/2nd/Nth in each group** → this is **NOT by eye**, it is
   pure math (points, point-difference, tie-breaks). The system can **always** do this.
   It is exactly what is done today with mental math and paper.
2. **The bracket topology** (how many advance, semis vs quarters, who goes straight to the
   final) → this is genuine organizer judgment and **should stay that way.**

The product does **not** need to *decide* the bracket. It needs to let the organizer
**declare** it easily, and then do the heavy lifting: compute standings and schedule the
declared matches on the court under the same fixture rules.

**Chosen direction: (B) the organizer designs the bracket; the system serves the
standings and schedules what was declared.** More flexible, keeps the organizer's
judgment, the system does the heavy work.

When this becomes parametrizable (see Step 3), every bracket ever built can be expressed
with just **two reference primitives**:

- **"Position P in Group G"** (e.g. *1st of Group A*) — resolved deterministically from standings.
- **"Winner / loser of match M"** — resolved when M finishes.

A semifinal is `Winner(QF1) vs Winner(QF2)`. A final with a bye is
`1st of Group A vs Winner(Semi)`. The organizer snaps these LEGO bricks together; the
system resolves them automatically as results come in. **Infinite flexibility for the
human, trivial deterministic math for the machine.**

---

## 5. The two faces of the product

This is **not** just a tool to generate a fixture and export it. It is two surfaces over
**a single source of truth**:

1. **The organizer's cockpit** (single-writer): create the tournament, the fixture, the
   bracket; enter results.
2. **The public viewer** (everyone, read-only): a simple page where players see the
   **groups, fixture, and results of the ongoing tournament**, live.

---

## 6. Scope — V1 (the MVP)

**V1 solves the core pain: the fixture engine.** This is also largely what is already
built today.

In scope:

- Categories, groups, round-robin generation per group.
- **Scheduling on a single court** with the organizer's rules: no back-to-back matches for
  a pair, interleave groups and categories, per-category match durations.
- **Availability constraints** ("pair X unavailable in this window") respected by scheduling.
- **Pin / re-flow**: change the little that changed, re-flow the rest without breaking the rules.
- **Result entry inside the app** — **required**, not optional. It is the foundation of the
  automatic leaderboard: standings cannot be computed if results live on paper. This kills
  the paper + mental-math step.
- **Automatic leaderboard** per group (points, point-difference, tie-breaks).
- Export of the fixture / standings.
- **A real, presentable UI with a design system** — not "all white". The cockpit is used
  every tournament; being usable and pleasant is part of the product, not a luxury.
- **Mobile-first as a posture, with a boundary:**
  - **Result entry → truly mobile-first.** It is the screen that goes to the court, on a
    phone, one-handed.
  - **Data-dense setup views** (loading ~40 pairs, group assignment, the multi-day fixture
    table) → **"responsive, must not break on mobile"** is enough. Do **not** burn V1
    making a 40-row matrix beautiful at 375px — that is gold-plating for screens that, in
    V1, are used on desktop. Building responsive-aware from day one means Step 2's mobile
    use is **not a rewrite**.

> Note: *which* UI library / design system is **not** a decision for this document — it is
> a dedicated `sdd-explore`. This doc captures the **requirement** (presentable,
> responsive-aware, result-entry mobile-first); the **tool choice** is decided with
> judgment in its own exploration. Concepts before frameworks.

What V1 deliberately leaves manual (and how that pain is lived):

- The knockout **bracket is built by hand** (in Excel), as today.
- Deliverables are **distributed by WhatsApp**, as today.

> This is **not** settling for less. Accepting manual brackets + WhatsApp in V1 is a
> conscious choice to **not split the source of truth** until it can be done well.

### V1 persistence note (single device)

V1 runs **local-first on a single device** (IndexedDB). There is **no cross-device sync**
in V1: the tournament lives in one browser. Live result entry works on that one device.
The "set up on desktop → enter results on mobile" workflow is **only unlocked in Step 2**.

---

## 7. Vision — the roadmap beyond V1

| Step | Delivers | Nature | How the unsolved part is lived |
|------|----------|--------|--------------------------------|
| **1 · Local (MVP)** | Fixture engine + result entry + auto-leaderboard, one device, IndexedDB | Domain + UI | Bracket by hand in Excel · WhatsApp |
| **2 · Shared** | The tournament travels across devices (real backend) | Infra | Frees the person otherwise chained to the club all day |
| **3 · Bracket** | Parametrizable knockout (the two reference primitives) | Pure domain | — |
| **4 · Viewer** | Public read-only page over the **same** shared source of truth | Separate codebase, **same** DB | Only worth it once Steps 1–3 exist |

**Notes on the roadmap:**

- **Steps 2 and 3 are interchangeable** — do whichever pain bites first. Step 3 (bracket)
  is **pure domain** (no infra, runs on local IndexedDB); Step 2 (shared) is **pure infra**.
  They do not depend on each other. Suggested sequence, not a rigid one.
- **Step 2 — why shared matters.** The real driver is operational: with no sync, one person
  must be **physically at the club the whole tournament** to enter results. Sharing across
  devices removes that. The backend swap is already designed as a **one-line seam**
  (`src/persistence/repo.ts`, with a documented `SupabaseRepository` stub) — built decoupled
  on purpose so this day would not hurt.
- **Step 4 — same source of truth, not a second database.** The viewer is a separate
  *codebase* (a thin read-only surface) that reads from the **same** shared backend of
  Step 2. It must **not** introduce a separate database — that would re-create the exact
  split-source-of-truth problem this whole plan avoids.
- **Why the viewer waits.** A public viewer is cheap to build but only earns its keep once
  the *whole* tournament (including the bracket) lives inside the system. Built earlier, it
  shows half the picture while the finals live in an external Excel — splitting the source
  of truth and creating false confidence. That is **worse than not having it.**

---

## 8. Success criteria

V1 is successful when:

- The organizer can run a **real tournament end-to-end** — generate the fixture, enter
  results, read the standings — **without an external spreadsheet for the group phase.**
- A late "I can't play at that time" no longer means **rebuilding the fixture by hand** —
  the system re-flows it while respecting the rules.
- The **mental math is gone**: group standings are computed by the system, not in someone's head.
- The cockpit is **pleasant enough to actually use** every tournament, and result entry
  works **comfortably on a phone**.

The product as a whole succeeds when a player can open **one link** and see their group,
their next match, and the live standings — without anyone copying anything into WhatsApp.

---

## 9. Non-goals (product-level)

- Modeling person-vs-themselves scheduling conflicts (two categories overlapping).
- Auto-deciding the knockout bracket topology with hard universal rules.
- A heavy constraint solver — availability constraints are few by design.
- Multi-court scheduling — there is **always one court**.
- Cross-tournament statistics, rankings, or player history.
- Polished mobile optimization of data-dense setup screens in V1.

(Architecture-level out-of-scope items are tracked in `README.md`.)

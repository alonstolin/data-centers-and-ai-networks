# ex3: Miswire Hunt (Unit 3 home assignment)

A single-player, browser-based game about **Neighbor Discovery and centralized configuration** in
*Jupiter Rising* (SIGCOMM 2015, Sections 5.2.1 and 5.3). About 15-20 minutes per student, no grade.

The student sees **JR-16**, a 16-switch Clos fabric (4 spine, 4 aggregation in two blocks, 8 ToR, one
link per connected pair). Five faults are hidden in it. The student opens a switch, probes its ports
(plan from the cluster config vs. what Neighbor Discovery heard, PHY state, error rate, whether the
peer hears them) and gives each port a diagnosis. A fault is *found* when the switches at two
different ends of it have been diagnosed correctly; the cable turns red and its explanation is shown.
After finding a fault, the student can play the **Firepath master** (a node on the map): drain the broken links out of routing, recompute, and see how many equal-cost paths remain between ToRs. Then the student answers two root-cause questions (T7's software crashed; a one-way link) and can do
Part 2, placing the parts of Firepath on the SDN planes.

The switch T7 is dark (its software crashed), so it has no port table: its neighbours' ports are the clue.

Everything runs in the browser. Progress is kept in `localStorage`. There is no server, no login and no database.

| Path | What it is |
|---|---|
| `site/index.html` | The page |
| `site/js/puzzle.js` | Puzzle data, including the answer key (generated, see below) |
| `site/js/topology.js`, `map.js` | The fabric and its drawing |
| `site/js/student.js` | Game logic |
| `site/js/planes.js` | Part 2 (Firepath on the SDN planes) |
| `tools/gen_puzzle.py` | Generates `puzzle.js` from the cluster model |

The answer key is inside `puzzle.js`, so a student who reads the source can see it. That is fine for an ungraded exercise.

## Publishing

Merging changes to `site/` on `main` runs `.github/workflows/ex3-pages.yml` and publishes the site at
`https://shaygol.github.io/data-centers-and-ai-networks/`. A branch named `claude/**` is published
under `/preview/` for review before merging.

## In class (suggested)

1. Which faults did people find first, and which took longest?
2. Q1: why is "T7's software crashed" right and "two cable faults" wrong? (PHY up on every
   T7 port; ND is also the keepalive.)
3. Q2: SP3 p3 looks exactly like a crashed peer from SP3. What did AG3 see?
4. Bridge to Firepath: this check is possible only because every switch has the same intended
   topology. What would OSPF do with a miswired link? (The paper: a miscabled link can lead to
   forwarding loops.)

## Saving and class results

- The page gives no feedback while students play. Work is kept in the browser (`localStorage`) and sent to Supabase when the student presses **Submit** (the student enters their email; it is stored in the `nick` column).
- Run `supabase/submissions.sql` once in the Supabase SQL Editor. It creates `submissions`, `submit_work` and `all_submissions`.
- `site/instructor.html` shows class results. It asks for the instructor key stored in `settings` (`k = 'instructor_key'`).
- Part 2 (planes) still gives instant feedback.

## Layout

The page is a console: the map on the left, an inspector on the right, and four mission steps in the top bar (Inspect, Drain, Explain, Submit). In Inspect, picking a diagnosis moves on to the next port of the open switch; keys 1-6 pick a diagnosis.

## Homework page

`site/homework.html` is the Unit 3 homework (Jupiter and SDN). It has two visuals (a diagram of the Firepath parts that reacts to the table, and an animation of what happens when a link fails under options A, B and C) and an answer form that replaces the Google Form. Answers go to Supabase (`supabase/homework.sql`, run once) and appear on `instructor.html`: the A/B/C tally (answers after Sun Nov 15, 13:00 Israel time are marked late and not counted), the 1a placements, and every written answer.

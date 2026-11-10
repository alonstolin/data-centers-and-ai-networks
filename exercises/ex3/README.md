# ex3: Miswire Hunt (Unit 3 homework)

A single-player, browser-based homework about **Neighbor Discovery and centralized configuration** in
*Jupiter Rising* (SIGCOMM 2015, Sections 5.2, 5.2.1, 5.2.2 and 5.3.1). About 15-20 minutes for the game and 15 for questions 1-3, no grade.

The page has three parts and one Submit:

- **A. Read**: four clippings of the paper (about 900 words), cut from the SIGCOMM PDF with our highlights (`site/img/paper-*.png`).
- **B. Play the game**: the student sees **JR-16**, a 16-switch Clos fabric (4 spine, 4 aggregation in two
  blocks, 8 ToR, one link per connected pair) with five hidden faults. Four steps:
  1. **Collect**: the Firepath master gathers link state from every switch over the CPN.
  2. **Inspect**: open a switch, probe its ports (plan from the cluster config vs. what Neighbor
     Discovery heard, PHY state, error rate, whether the peer hears them) and give each port a diagnosis.
  3. **Drain**: take broken links out of routing, recompute, and see how many equal-cost paths remain.
  4. **Explain**: two root-cause questions (T7's software crashed; a one-way link).
- **C. Questions 1-3**: place the parts of Firepath on the SDN planes and explain.

The switch T7 is dark (its software crashed), so it has no port table: its neighbours' ports are the clue.
The page gives no feedback while students play; the answers are discussed in class.

| Path | What it is |
|---|---|
| `site/index.html` | The page |
| `site/js/config.js` | Supabase URL, publishable key and the submission deadline |
| `site/js/puzzle.js` | Puzzle data, including the answer key (generated, see below) |
| `site/js/topology.js`, `map.js` | The fabric and its drawing |
| `site/js/student.js` | Game logic and the one Submit |
| `site/js/homework.js`, `homework-form.js` | Part C: the diagram of the Firepath parts and the answer form |
| `site/instructor.html`, `js/instructor.js` | Class results |
| `supabase/submissions.sql`, `homework.sql` | Tables and functions (run once in the Supabase SQL Editor) |
| `tools/gen_puzzle.py` | Generates `puzzle.js` from the cluster model |

The answer key is inside `puzzle.js`, so a student who reads the source can see it. That is fine for an ungraded exercise.

## Publishing

Merging changes to `site/` on `main` runs `.github/workflows/ex3-pages.yml` and publishes the site at
`https://shaygol.github.io/data-centers-and-ai-networks/`. The `dev` branch is published
under `/preview/` for review before merging.

## Saving, deadline and class results

- Work is kept in the browser (`localStorage`) while the student plays and types. One **Submit** at the
  bottom of the page sends the game (`submit_work`) and questions 1-3 (`submit_homework`) together,
  with one name and email (the email is stored in the `nick` column of `submissions`).
- The page keeps the student's **active time** (tab visible and some click, key or scroll in the last
  minute; summed over visits in `localStorage`). It is shown read-only as "Time spent" in the Submit card and
  sent in seconds as `answers.activeSec` of `submit_work`, so there is no database change. `instructor.html`
  shows it in the Students table. It is self-reported, so use it as a hint and not as proof.
- Submit closes at the deadline: **Sunday, Nov 15, 2026, 13:00** (Israel time). The page disables the
  button and both SQL functions refuse later calls. To move the deadline, change `DEADLINE` in
  `site/js/config.js` and the timestamp in both `supabase/*.sql` files, then run the SQL again.
- Run `supabase/submissions.sql` and `supabase/homework.sql` in the Supabase SQL Editor (safe to run again).
- `site/instructor.html` shows class results. It asks for the instructor key stored in `settings`
  (`k = 'instructor_key'`).
- `site/homework.html` only redirects to the game.

## In class (suggested)

1. Which faults did people find first, and which took longest?
2. Explain Q1: why is "T7's software crashed" right and "two cable faults" or "lost power" wrong? (PHY up on
   every T7 port; ND is also the keepalive.)
3. Explain Q2: SP3 p3 looks exactly like a crashed peer from SP3. What did AG3 see?
4. Bridge to Firepath: this check is possible only because every switch has the same intended
   topology. What would OSPF do with a miswired link? (The paper: a miscabled link can lead to
   forwarding loops.)

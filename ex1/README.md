# HW1: Fat-Tree Topology Generation and Analysis

Course 361.2.2460 (Data center networks & AI), Semester A 2026.

A Python tool that generates a k-ary fat-tree data center topology [1], injects random link failures, and measures how the network degrades.

## 1. Background: the k-ary fat-tree

A fat-tree is built from identical k-port switches, where `k` is even.

| Element | Count |
|---|---|
| Pods | k |
| Edge switches per pod | k/2 |
| Aggregation switches per pod | k/2 |
| Core switches | (k/2)² |
| Hosts per edge switch | k/2 |
| **Hosts** | **k³/4** |
| **Switches** | **5k²/4** |
| Switch–switch links | k³/2 |
| Host–edge links | k³/4 |

Wiring:

- Each edge switch connects to its k/2 hosts and to all k/2 aggregation switches in its pod (a full bipartite graph inside the pod).
- Aggregation switch *i* in every pod connects to core switches `i·(k/2)` … `(i+1)·(k/2) − 1`.
- Every switch has degree exactly k.
- Two hosts in different pods have (k/2)² equal-cost shortest paths, each 6 hops long.

Example, k = 4: 4 pods, 2 edge + 2 aggregation switches per pod, 4 core switches, 16 hosts, 20 switches.

## 2. Install and run

Requires Python 3.9+.

```bash
# from the repo root
python -m venv .venv
.venv\Scripts\activate          # Windows (Linux/macOS: source .venv/bin/activate)
pip install -r requirements.txt
cd ex1
```

Build a fat-tree and print its node and link counts next to the formulas:

```
$ python -m fattree.cli --k 4
Fat-tree k=4
                actual  formula
hosts               16       16
edge                 8        8
agg                  8        8
core                 4        4
switches            20       20
switch_links        32       32
host_links          16       16
total links         48
all switches have degree k: True
```

Intended usage *(planned)*:

```bash
# fail 5% of links, reproducibly
python -m fattree.cli --k 8 --failure-rate 5 --seed 42

# export the graph
python -m fattree.cli --k 4 --output fattree_k4.json
```

## 3. Input parameters

| Flag | Type | Default | Description | Status |
|---|---|---|---|---|
| `--k` | even int ≥ 2 | required | Switch port count | implemented |
| `--failure-rate` | float, 0–100 | 0 | Percentage of links to fail | planned |
| `--failure-scope` | `switch` \| `all` | `switch` | Fail only switch–switch links, or also host links | planned |
| `--seed` | int | none | RNG seed for reproducible failures | planned |
| `--trials` | int | 1 | Number of independent failure draws to average over | planned |
| `--config` | path | none | YAML/JSON file providing the same options | planned |
| `--output` | path | none | Export the (failed) graph as JSON / edge list | planned |

`k` is validated: it must be even and ≥ 2. *(Planned:)* the failure rate will be validated to be in [0, 100], and if a value is given both on the command line and in the config file, the command line will win.

## 4. Failure model *(planned)*

A failed link is simply removed from the graph. Given a failure rate `p` (in percent), the tool removes exactly `⌊p·|E|⌋` links, chosen uniformly at random. For example, with 1,000 links and `p = 5`, exactly 50 links fail. The same number fail in every trial, so differences between trials come only from *which* links fail.

By default only switch–switch links can fail. A failed host–switch link disconnects that host entirely, which would dominate every connectivity result. `--failure-scope all` also allows host links to fail.

Failures are always applied to a copy of the graph, so the original is never modified. With `p = 0` the graph is unchanged.

## 5. Experiments *(planned)*

**Summary of findings:** *(TBD: two or three lines with the headline result once the experiments have run.)*

Raw data is in `results/` and figures are in `figures/`.

### 5.1 Experiment 1: hosts vs. k (sanity check)

**Question:** does the generated topology match the k³/4 host formula?

**Setup:** k ∈ {2, 4, 6, …, 32}, no failures. *(TBD: confirm parameters.)*

**Figure:**

<!-- ![Hosts vs. k](figures/exp1_hosts_vs_k.png) -->
*(TBD)*

**What we see:** *(TBD)*

**Why it happens:** *(TBD)*

**Why it matters:** *(TBD)*

**Reproduce:** `python experiments/exp1_hosts_vs_k.py` *(planned)*

### 5.2 Experiment 2: robustness to link failures (main experiment)

**Question:** how quickly does a fat-tree lose connectivity and path quality as links fail, and does a larger k help?

**Hypothesis (written before running):** path length stays near 6 hops and connectivity stays near 100% until failures get high, because of path diversity. Larger k should be more robust.

**Setup:**

| Parameter | Value |
|---|---|
| k | 4, 8, 16 |
| Failure rate | 0–30% |
| Failure scope | switch–switch links only |
| Trials per point | 20 or more |
| Seed | *(TBD)* |
| Host pairs | all pairs for small k, a random sample for large k *(TBD: sample size)* |

**Metrics:**
- Fraction of host pairs still connected.
- Average shortest-path length between connected host pairs.
- Average number of equal-cost shortest paths between hosts in different pods (ideal: (k/2)²).

**Figures:** mean ± std over trials, with k in the legend.

<!-- ![Connectivity vs. failure rate](figures/exp2_connectivity.png) -->
<!-- ![Path length vs. failure rate](figures/exp2_path_length.png) -->
<!-- ![Path diversity vs. failure rate](figures/exp2_path_diversity.png) -->
*(TBD)*

**What we see:** *(TBD)*

**Why it happens:** *(TBD)*

**Why it matters:** *(TBD)*

**Did the results match the hypothesis?** *(TBD)*

**Reproduce:** `python experiments/exp2_failure_sweep.py && python experiments/plot.py` *(planned)*

## 6. Validation *(planned)*

`tests/test_topology.py` asserts the host, switch and link counts above and that every switch has degree k, for k = 4, 6 and 8. It also checks that odd k is rejected.

## Planned sub-repo layout

```
fattree/
  topology.py     # build_fattree(k) -> networkx.Graph (attrs: layer, pod, index; nodes named by IP)
  failures.py     # fail_links(G, pct, seed, scope)
  metrics.py      # path length, #shortest paths, connectivity
  cli.py          # argparse entry point
experiments/
  exp1_hosts_vs_k.py
  exp2_failure_sweep.py   # writes results/exp2.csv
  plot.py                 # reads results/*.csv -> figures/*.png
results/                  # CSVs, one per experiment
figures/                  # PNGs embedded in this README
tests/test_topology.py
config.example.yaml
README.md
```

Dependencies are listed in `requirements.txt` at the repo root, shared by all exercises.

## Status

- [x] Topology generator and counts (verified against the formulas for k = 2, 4, 6, 8, 16)
- [x] Basic CLI (`--k`) with validation of k
- [ ] Remaining CLI options, config file
- [ ] Failure injection with seed
- [ ] Metrics and experiments
- [ ] Plots and discussion
- [ ] Unit tests

## AI usage

Claude (Anthropic) was used to help draft this README from the assignment hints and outline, and to write the initial topology generator and CLI skeleton.

## References

[1] M. Al-Fares, A. Loukissas, A. Vahdat. "A scalable, commodity data center network architecture." ACM SIGCOMM 2008.

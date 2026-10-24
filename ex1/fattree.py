"""Build a k-ary fat-tree, fail random links, and measure how the network degrades.

Usage:
  python fattree.py --k 4                                   # counts vs. formulas
  python fattree.py --k 8 --failure-rate 5 --seed 42        # one failure scenario
  python fattree.py --k 4 --output fattree_k4.json          # export the graph
  python fattree.py --experiment all --seed 42              # experiments -> results/, figures/

Node names follow the addressing scheme of Al-Fares et al. [1]:
  pod switch  10.pod.switch.1   (switch 0..k/2-1 = edge, k/2..k-1 = aggregation)
  core switch 10.k.j.i          (j, i in 1..k/2)
  host        10.pod.switch.ID  (ID in 2..k/2+1, attached to edge switch `switch`)

Every node carries the attributes `layer` (core/agg/edge/host), `pod`
(None for core switches) and `index`.
"""

import argparse
import csv
import json
import math
import random
import statistics
import sys
from collections import deque
from pathlib import Path

import networkx as nx

# =========================================================================== CONFIG
# Default values of every option. A flag given on the command line overrides the
# value here (e.g. `--k 8` beats "k": 4). Values are validated like flags.
CONFIG = {
    "k": None,                         # switch port count (even, >= 2); None = must pass --k
    "failure_rate": 0.0,               # % of candidate links to fail, 0-100
    "failure_scope": "switch",         # "switch": only switch-switch links fail; "all": host links too
    "seed": None,                      # RNG seed; None = draw a random one and print it
    "trials": None,                    # failure draws to average; None = 1 (single run) / 20 (experiments)
    "samples": 64,                     # source hosts sampled for path metrics; 0 = all hosts
    "output": None,                    # export path for the (failed) graph: *.json or edge list
    "experiment": None,                # None, "hosts", "failures" or "all"
    "ks": [4, 8, 16],                  # k values for the failure experiment
    "rates": list(range(0, 31, 2)),    # failure rates (%) for the failure experiment
}
# ==================================================================================

HERE = Path(__file__).resolve().parent
SCOPES = ("switch", "all")
EXPERIMENTS = ("hosts", "failures", "all")
COUNT_KEYS = ("hosts", "edge", "agg", "core", "switches", "switch_links", "host_links")
METRIC_KEYS = ("connected", "path_len", "ecmp", "ecmp_norm")
HOSTS_EXPERIMENT_KS = list(range(2, 33, 2))
EXPERIMENT_TRIALS = 20


# --------------------------------------------------------------------------- topology


def expected_counts(k):
    """Closed-form node and link counts for a k-ary fat-tree."""
    return {
        "hosts": k**3 // 4,
        "edge": k * k // 2,
        "agg": k * k // 2,
        "core": (k // 2) ** 2,
        "switches": 5 * k * k // 4,
        "switch_links": k**3 // 2,
        "host_links": k**3 // 4,
    }


def build_fattree(k):
    half = k // 2
    G = nx.Graph(k=k)

    # Core switches: (k/2)^2, grouped into k/2 groups of k/2.
    for c in range(half * half):
        j, i = c // half + 1, c % half + 1
        G.add_node(f"10.{k}.{j}.{i}", layer="core", pod=None, index=c)

    for pod in range(k):
        edges = [f"10.{pod}.{s}.1" for s in range(half)]
        aggs = [f"10.{pod}.{s}.1" for s in range(half, k)]

        for s, name in enumerate(edges):
            G.add_node(name, layer="edge", pod=pod, index=s)
        for a, name in enumerate(aggs):
            G.add_node(name, layer="agg", pod=pod, index=a)

        # Hosts -> edge switches: k/2 hosts per edge switch.
        for s, edge in enumerate(edges):
            for h in range(half):
                host = f"10.{pod}.{s}.{h + 2}"
                G.add_node(host, layer="host", pod=pod, index=h)
                G.add_edge(host, edge)

        # Edge -> aggregation: full bipartite graph inside the pod.
        for edge in edges:
            for agg in aggs:
                G.add_edge(edge, agg)

        # Aggregation switch a -> core switches a*(k/2) .. (a+1)*(k/2)-1.
        for a, agg in enumerate(aggs):
            for i in range(half):
                G.add_edge(agg, f"10.{k}.{a + 1}.{i + 1}")

    return G


def hosts_of(G):
    return [n for n, layer in G.nodes(data="layer") if layer == "host"]


def is_host_link(G, u, v):
    return "host" in (G.nodes[u]["layer"], G.nodes[v]["layer"])


def count_nodes_and_links(G):
    """Count nodes per layer and links by type in a built graph."""
    layers = nx.get_node_attributes(G, "layer")
    counts = {layer: 0 for layer in ("host", "edge", "agg", "core")}
    for layer in layers.values():
        counts[layer] += 1

    host_links = sum(1 for u, v in G.edges if "host" in (layers[u], layers[v]))
    return {
        "hosts": counts["host"],
        "edge": counts["edge"],
        "agg": counts["agg"],
        "core": counts["core"],
        "switches": counts["edge"] + counts["agg"] + counts["core"],
        "switch_links": G.number_of_edges() - host_links,
        "host_links": host_links,
    }


def switches_with_wrong_degree(G):
    k = G.graph["k"]
    return [n for n, d in G.degree if G.nodes[n]["layer"] != "host" and d != k]


# --------------------------------------------------------------------------- failures


def candidate_links(G, scope="switch"):
    """Links allowed to fail: switch-switch only, or every link."""
    if scope not in SCOPES:
        raise ValueError(f"scope must be one of {SCOPES}, got {scope!r}")
    if scope == "all":
        return list(G.edges)
    return [(u, v) for u, v in G.edges if not is_host_link(G, u, v)]


def num_failures(num_candidates, rate):
    """Exactly floor(rate% * |candidates|) links fail (epsilon guards float error)."""
    return math.floor(rate / 100 * num_candidates + 1e-9)


def fail_links(G, rate, seed=None, scope="switch"):
    """Return a copy of G with floor(rate% * |candidates|) random links removed.

    The candidates are shuffled with `seed` and the first m are removed, so for a
    fixed seed the failures at a higher rate are a superset of those at a lower
    rate. The removed links are stored in H.graph["failed_links"]. G is unchanged.
    """
    if not 0 <= rate <= 100:
        raise ValueError(f"failure rate must be in [0, 100], got {rate}")
    candidates = candidate_links(G, scope)
    random.Random(seed).shuffle(candidates)
    failed = candidates[: num_failures(len(candidates), rate)]
    H = G.copy()
    H.remove_edges_from(failed)
    H.graph["failed_links"] = failed
    return H


# --------------------------------------------------------------------------- metrics


def bfs_counts(adj, source):
    """BFS from source: hop distance and number of shortest paths to every reachable node."""
    dist = {source: 0}
    sigma = {source: 1}
    queue = deque([source])
    while queue:
        u = queue.popleft()
        du, su = dist[u] + 1, sigma[u]
        for v in adj[u]:
            dv = dist.get(v)
            if dv is None:
                dist[v] = du
                sigma[v] = su
                queue.append(v)
            elif dv == du:
                sigma[v] += su
    return dist, sigma


def connected_pair_fraction(G):
    """Exact fraction of host pairs that can still reach each other."""
    layers = G.nodes(data="layer")
    num_hosts = sum(1 for _, layer in layers if layer == "host")
    total = num_hosts * (num_hosts - 1) // 2
    if total == 0:
        return 1.0
    connected = 0
    for component in nx.connected_components(G):
        h = sum(1 for n in component if layers[n] == "host")
        connected += h * (h - 1) // 2
    return connected / total


def path_metrics(G, sources):
    """Mean shortest-path length and mean number of shortest paths, over connected
    inter-pod host pairs (s, t) with s in `sources` and t any host in another pod."""
    pods = G.nodes(data="pod")
    hosts = hosts_of(G)
    lengths, counts = [], []
    for s in sources:
        dist, sigma = bfs_counts(G.adj, s)
        for t in hosts:
            if pods[t] != pods[s] and t in dist:
                lengths.append(dist[t])
                counts.append(sigma[t])
    if not lengths:
        return {"path_len": math.nan, "ecmp": math.nan}
    return {"path_len": statistics.fmean(lengths), "ecmp": statistics.fmean(counts)}


def evaluate(G, sources):
    """All metrics for one (possibly failed) graph."""
    ideal_paths = (G.graph["k"] // 2) ** 2
    m = path_metrics(G, sources)
    return {
        "connected": connected_pair_fraction(G),
        "path_len": m["path_len"],
        "ecmp": m["ecmp"],
        "ecmp_norm": m["ecmp"] / ideal_paths,
    }


def sample_sources(G, samples, rng):
    hosts = hosts_of(G)
    if samples <= 0 or samples >= len(hosts):
        return hosts
    return rng.sample(hosts, samples)


def run_trials(G, rate, scope, trials, seed, samples):
    """Evaluate `trials` independent failure draws. Trial t uses seed "{seed}/{t}",
    so failures are nested across rates and the same source hosts are sampled."""
    results = []
    for t in range(trials):
        H = fail_links(G, rate, seed=f"{seed}/{t}", scope=scope)
        sources = sample_sources(G, samples, random.Random(f"{seed}/{t}/sources"))
        results.append(evaluate(H, sources))
    return results


def summarize(results):
    """Mean and std of each metric over trials (NaN values are skipped)."""
    summary = {}
    for key in METRIC_KEYS:
        values = [r[key] for r in results if not math.isnan(r[key])]
        mean = statistics.fmean(values) if values else math.nan
        std = statistics.stdev(values) if len(values) > 1 else 0.0
        summary[key] = (mean, std)
    return summary


# --------------------------------------------------------------------------- export


def export_graph(G, path):
    """.json -> nodes with attributes, links and failed links; anything else -> edge list."""
    path = Path(path)
    if path.parent:
        path.parent.mkdir(parents=True, exist_ok=True)
    if path.suffix.lower() == ".json":
        data = {
            "k": G.graph["k"],
            "nodes": [{"id": n, **attrs} for n, attrs in G.nodes(data=True)],
            "links": [[u, v] for u, v in G.edges],
            "failed_links": [[u, v] for u, v in G.graph.get("failed_links", [])],
        }
        path.write_text(json.dumps(data, indent=1), encoding="utf-8")
    else:
        nx.write_edgelist(G, path, data=False)


# --------------------------------------------------------------------------- experiments


def write_csv(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def pyplot():
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    return plt


def experiment_hosts(results_dir, figures_dir):
    """Experiment 1: measured hosts and switches vs. k, against k^3/4 and 5k^2/4."""
    rows = []
    for k in HOSTS_EXPERIMENT_KS:
        G = build_fattree(k)
        actual, expected = count_nodes_and_links(G), expected_counts(k)
        rows.append({
            "k": k,
            "hosts": actual["hosts"],
            "hosts_formula": expected["hosts"],
            "switches": actual["switches"],
            "switches_formula": expected["switches"],
            "links": G.number_of_edges(),
            "links_formula": expected["switch_links"] + expected["host_links"],
            "degree_ok": not switches_with_wrong_degree(G),
        })
    write_csv(results_dir / "exp1_hosts_vs_k.csv", rows)

    plt = pyplot()
    ks = [r["k"] for r in rows]
    dense = [x / 10 for x in range(20, 321)]
    fig, ax = plt.subplots(figsize=(6, 4))
    ax.plot(dense, [x**3 / 4 for x in dense], "-", color="tab:blue", label="k³/4 (formula)")
    ax.plot(ks, [r["hosts"] for r in rows], "o", color="tab:blue", label="hosts (generated)")
    ax.plot(dense, [5 * x * x / 4 for x in dense], "-", color="tab:orange", label="5k²/4 (formula)")
    ax.plot(ks, [r["switches"] for r in rows], "s", color="tab:orange", label="switches (generated)")
    ax.set_yscale("log")
    ax.set_xlabel("k (switch port count)")
    ax.set_ylabel("count (log scale)")
    ax.set_title("Fat-tree size vs. k")
    ax.grid(True, which="both", alpha=0.3)
    ax.legend()
    fig.tight_layout()
    figures_dir.mkdir(parents=True, exist_ok=True)
    fig.savefig(figures_dir / "exp1_hosts_vs_k.png", dpi=150)
    plt.close(fig)

    ok = all(r["hosts"] == r["hosts_formula"] and r["switches"] == r["switches_formula"]
             and r["links"] == r["links_formula"] and r["degree_ok"] for r in rows)
    print(f"exp1: k={ks[0]}..{ks[-1]}, all counts match formulas: {ok}")
    return rows


def experiment_failures(ks, rates, trials, seed, samples, scope, results_dir, figures_dir):
    """Experiment 2: connectivity, path length and path diversity vs. failure rate."""
    rows = []
    for k in ks:
        G = build_fattree(k)
        n_candidates = len(candidate_links(G, scope))
        for rate in rates:
            for t, r in enumerate(run_trials(G, rate, scope, trials, seed, samples)):
                rows.append({"k": k, "rate": rate, "trial": t,
                             "failed_links": num_failures(n_candidates, rate), **r})
        print(f"exp2: k={k} done ({len(rates)} rates x {trials} trials)", file=sys.stderr)
    write_csv(results_dir / "exp2_failures.csv", rows)
    plot_failures(rows, ks, rates, figures_dir)
    return rows


def plot_failures(rows, ks, rates, figures_dir):
    plt = pyplot()
    figures_dir.mkdir(parents=True, exist_ok=True)
    colors = dict(zip(ks, plt.rcParams["axes.prop_cycle"].by_key()["color"]))
    dense = [x / 2 for x in range(0, 2 * int(max(rates)) + 1)]

    def series(k, key, scale=1.0):
        means, stds = [], []
        for rate in rates:
            mean, std = summarize([r for r in rows if r["k"] == k and r["rate"] == rate])[key]
            means.append(mean * scale)
            stds.append(std * scale)
        return means, stds

    def figure(key, scale, ylabel, title, filename, model=None, model_label=None, ideal=None,
               shared_model=False, cap=math.inf):
        fig, ax = plt.subplots(figsize=(6, 4))
        for k in ks:
            means, stds = series(k, key, scale)
            ax.plot(rates, means, "o-", ms=3, color=colors[k], label=f"k={k}")
            ax.fill_between(rates, [m - s for m, s in zip(means, stds)],
                            [min(m + s, cap) for m, s in zip(means, stds)], color=colors[k], alpha=0.2)
            if model is not None and not shared_model:
                ax.plot(dense, [model(k, p) * scale for p in dense], ":", color=colors[k])
        if model is not None and shared_model:
            ax.plot(dense, [model(None, p) * scale for p in dense], ":", color="black", lw=1.5)
        if model_label:
            ax.plot([], [], ":", color="black" if shared_model else "gray", label=model_label)
        if ideal is not None:
            ax.axhline(ideal, color="black", lw=0.8, ls="--", label="no failures")
        ax.set_xlabel("failed switch-switch links (%)")
        ax.set_ylabel(ylabel)
        ax.set_title(title)
        ax.grid(True, alpha=0.3)
        ax.legend()
        fig.tight_layout()
        fig.savefig(figures_dir / filename, dpi=150)
        plt.close(fig)

    figure("connected", 100, "connected host pairs (%)", "Connectivity vs. link failures",
           "exp2_connectivity.png",
           model=lambda k, p: (1 - (p / 100) ** (k // 2)) ** 2,
           model_label="model: (1 - p^(k/2))²", cap=100)
    figure("path_len", 1, "mean inter-pod shortest path (hops)", "Path length vs. link failures",
           "exp2_path_length.png", ideal=6)
    figure("ecmp_norm", 100, "surviving shortest paths (% of (k/2)²)",
           "Inter-pod path diversity vs. link failures", "exp2_path_diversity.png",
           model=lambda k, p: (1 - p / 100) ** 4, model_label="model: (1 - p)⁴", shared_model=True)


# --------------------------------------------------------------------------- CLI


def even_k(value):
    k = int(value)
    if isinstance(value, float) and value != k:
        raise argparse.ArgumentTypeError(f"k must be an even integer >= 2, got {value}")
    if k < 2 or k % 2 != 0:
        raise argparse.ArgumentTypeError(f"k must be an even integer >= 2, got {k}")
    return k


def percent(value):
    rate = float(value)
    if not 0 <= rate <= 100:
        raise argparse.ArgumentTypeError(f"failure rate must be between 0 and 100, got {value}")
    return rate


def positive_int(value):
    n = int(value)
    if n < 1:
        raise argparse.ArgumentTypeError(f"expected an integer >= 1, got {value}")
    return n


def nonneg_int(value):
    n = int(value)
    if n < 0:
        raise argparse.ArgumentTypeError(f"expected an integer >= 0, got {value}")
    return n


def build_parser(config=None):
    parser = argparse.ArgumentParser(
        description="Generate a k-ary fat-tree, print its node and link counts, "
                    "fail random links and measure connectivity, path length and path diversity.",
        epilog="Defaults come from the CONFIG block at the top of fattree.py; "
               "a flag given on the command line overrides it.",
    )
    parser.add_argument("--k", type=even_k, help="switch port count (even, >= 2); required unless --experiment")
    parser.add_argument("--failure-rate", type=percent, help="percentage of candidate links to fail, 0-100 (default 0)")
    parser.add_argument("--failure-scope", choices=SCOPES,
                        help="switch: only switch-switch links fail (default); all: host links too")
    parser.add_argument("--seed", type=int, help="RNG seed; a random one is drawn and printed if omitted")
    parser.add_argument("--trials", type=positive_int,
                        help=f"independent failure draws to average (default 1, or {EXPERIMENT_TRIALS} with --experiment)")
    parser.add_argument("--samples", type=nonneg_int,
                        help="source hosts sampled for path metrics, 0 = all hosts (default 64)")
    parser.add_argument("--output", type=Path,
                        help="export the (failed) graph of trial 0: *.json = nodes/links JSON, otherwise an edge list")
    parser.add_argument("--experiment", choices=EXPERIMENTS,
                        help="run experiments, writing CSVs to results/ and PNGs to figures/")
    parser.add_argument("--ks", type=even_k, nargs="+", help="k values for the failure experiment (default 4 8 16)")
    parser.add_argument("--rates", type=percent, nargs="+",
                        help="failure rates for the failure experiment (default 0 2 ... 30)")
    parser.set_defaults(**(CONFIG if config is None else config))
    return parser


def validate(args):
    """Check and coerce every option, including values that came from CONFIG."""
    if args.k is not None:
        args.k = even_k(args.k)
    args.failure_rate = percent(args.failure_rate)
    if args.failure_scope not in SCOPES:
        raise ValueError(f"failure scope must be one of {SCOPES}, got {args.failure_scope!r}")
    if args.seed is not None:
        args.seed = int(args.seed)
    if args.trials is not None:
        args.trials = positive_int(args.trials)
    args.samples = nonneg_int(args.samples)
    if args.output is not None:
        args.output = Path(args.output)
    if args.experiment is not None and args.experiment not in EXPERIMENTS:
        raise ValueError(f"experiment must be one of {EXPERIMENTS}, got {args.experiment!r}")
    args.ks = [even_k(k) for k in args.ks]
    args.rates = [percent(r) for r in args.rates]
    if args.experiment is None and args.k is None:
        raise ValueError("--k is required (unless --experiment is given)")


def parse_args(argv=None, config=None):
    """Parse flags on top of `config` (default: the CONFIG block)."""
    parser = build_parser(config)
    args = parser.parse_args(argv)
    try:
        validate(args)
    except (argparse.ArgumentTypeError, ValueError, TypeError) as e:
        parser.error(str(e))
    return args


def print_counts(G):
    k = G.graph["k"]
    actual, expected = count_nodes_and_links(G), expected_counts(k)
    print(f"Fat-tree k={k}")
    print(f"{'':<14}{'actual':>8}{'formula':>9}")
    for key in COUNT_KEYS:
        mark = "" if actual[key] == expected[key] else "  MISMATCH"
        print(f"{key:<14}{actual[key]:>8}{expected[key]:>9}{mark}")
    print(f"{'total links':<14}{G.number_of_edges():>8}")
    bad_degree = switches_with_wrong_degree(G)
    print(f"all switches have degree k: {not bad_degree}")
    return actual == expected and not bad_degree


def run_single(args):
    G = build_fattree(args.k)
    ok = print_counts(G)

    trials = args.trials or 1
    n_candidates = len(candidate_links(G, args.failure_scope))
    n_failed = num_failures(n_candidates, args.failure_rate)
    summary = summarize(run_trials(G, args.failure_rate, args.failure_scope, trials, args.seed, args.samples))
    ideal_paths = (args.k // 2) ** 2

    print()
    print(f"Failures: {args.failure_rate:g}% of {args.failure_scope} links -> {n_failed} of {n_candidates} "
          f"removed, {trials} trial(s), seed {args.seed}")
    print(f"{'metric':<26}{'mean':>9}{'std':>9}{'ideal':>8}")
    for label, key, ideal in (("connected host pairs (%)", "connected", 100),
                              ("inter-pod path (hops)", "path_len", 6),
                              ("inter-pod shortest paths", "ecmp", ideal_paths)):
        mean, std = summary[key]
        if key == "connected":
            mean, std = mean * 100, std * 100
        print(f"{label:<26}{mean:>9.3f}{std:>9.3f}{ideal:>8}")

    if args.output is not None:
        export_graph(fail_links(G, args.failure_rate, seed=f"{args.seed}/0", scope=args.failure_scope), args.output)
        print(f"graph written to {args.output}")
    return 0 if ok else 1


def run_experiments(args):
    results_dir, figures_dir = HERE / "results", HERE / "figures"
    print(f"seed {args.seed}")
    if args.experiment in ("hosts", "all"):
        experiment_hosts(results_dir, figures_dir)
    if args.experiment in ("failures", "all"):
        trials = args.trials or EXPERIMENT_TRIALS
        experiment_failures(args.ks, args.rates, trials, args.seed, args.samples,
                            args.failure_scope, results_dir, figures_dir)
        print(f"exp2: ks={args.ks}, {len(args.rates)} rates, {trials} trials, "
              f"{args.samples or 'all'} sources -> results/exp2_failures.csv, figures/exp2_*.png")
    return 0


def main(argv=None):
    args = parse_args(argv)
    if args.seed is None:
        args.seed = random.randrange(2**31)
    if args.experiment is not None:
        return run_experiments(args)
    return run_single(args)


if __name__ == "__main__":
    sys.exit(main())

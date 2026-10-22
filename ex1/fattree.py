"""Build a k-ary fat-tree as a networkx graph and check it against the formulas.

Usage: python fattree.py --k 4

Node names follow the addressing scheme of Al-Fares et al. [1]:
  pod switch  10.pod.switch.1   (switch 0..k/2-1 = edge, k/2..k-1 = aggregation)
  core switch 10.k.j.i          (j, i in 1..k/2)
  host        10.pod.switch.ID  (ID in 2..k/2+1, attached to edge switch `switch`)

Every node carries the attributes `layer` (core/agg/edge/host), `pod`
(None for core switches) and `index`.
"""

import argparse
import sys

import networkx as nx


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


def even_k(value):
    k = int(value)
    if k < 2 or k % 2 != 0:
        raise argparse.ArgumentTypeError(f"k must be an even integer >= 2, got {k}")
    return k


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Generate a k-ary fat-tree and print its node and link counts.")
    parser.add_argument("--k", type=even_k, required=True, help="switch port count (even, >= 2)")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    G = build_fattree(args.k)
    actual = count_nodes_and_links(G)
    expected = expected_counts(args.k)

    print(f"Fat-tree k={args.k}")
    print(f"{'':<14}{'actual':>8}{'formula':>9}")
    for key in ("hosts", "edge", "agg", "core", "switches", "switch_links", "host_links"):
        mark = "" if actual[key] == expected[key] else "  MISMATCH"
        print(f"{key:<14}{actual[key]:>8}{expected[key]:>9}{mark}")
    print(f"{'total links':<14}{G.number_of_edges():>8}")

    bad_degree = [n for n, d in G.degree if G.nodes[n]["layer"] != "host" and d != args.k]
    print(f"all switches have degree k: {not bad_degree}")

    return 0 if actual == expected and not bad_degree else 1


if __name__ == "__main__":
    sys.exit(main())

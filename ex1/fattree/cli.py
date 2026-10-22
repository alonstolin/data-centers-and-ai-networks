"""Command-line entry point: python -m fattree.cli --k 4"""

import argparse
import sys

from .topology import build_fattree, count_nodes_and_links, expected_counts


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

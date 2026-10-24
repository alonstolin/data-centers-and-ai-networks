"""Tests for fattree.py. Run from this folder: python -m pytest -q"""

import json
import math

import pytest

import fattree as ft


@pytest.mark.parametrize("k", [2, 4, 6, 8])
def test_counts_match_formulas(k):
    G = ft.build_fattree(k)
    assert ft.count_nodes_and_links(G) == ft.expected_counts(k)


@pytest.mark.parametrize("k", [2, 4, 6, 8])
def test_every_switch_has_degree_k_and_hosts_degree_1(k):
    G = ft.build_fattree(k)
    assert not ft.switches_with_wrong_degree(G)
    assert all(G.degree[h] == 1 for h in ft.hosts_of(G))


@pytest.mark.parametrize("k", [3, 5, 0, -2, 1])
def test_bad_k_rejected(k, capsys):
    with pytest.raises(SystemExit):
        ft.parse_args(["--k", str(k)])


def test_k_required_without_experiment():
    with pytest.raises(SystemExit):
        ft.parse_args([])


@pytest.mark.parametrize("rate", ["-1", "100.5"])
def test_bad_failure_rate_rejected(rate):
    with pytest.raises(SystemExit):
        ft.parse_args(["--k", "4", "--failure-rate", rate])


def test_zero_failures_leaves_graph_unchanged():
    G = ft.build_fattree(4)
    H = ft.fail_links(G, 0, seed=1)
    assert set(H.edges) == set(G.edges)


def test_full_failure_removes_all_switch_links_only():
    G = ft.build_fattree(4)
    H = ft.fail_links(G, 100, seed=1)
    assert ft.count_nodes_and_links(H)["switch_links"] == 0
    assert ft.count_nodes_and_links(H)["host_links"] == 16
    # Only hosts sharing an edge switch can still reach each other: 8 edges x 1 pair of 120 pairs.
    assert ft.connected_pair_fraction(H) == 8 / 120


def test_exact_number_of_failures_and_original_untouched():
    G = ft.build_fattree(8)  # 256 switch links
    H = ft.fail_links(G, 10, seed=3)
    assert G.number_of_edges() - H.number_of_edges() == math.floor(0.10 * 256)
    assert G.number_of_edges() == 384


def test_scope_all_can_fail_host_links():
    G = ft.build_fattree(4)
    H = ft.fail_links(G, 100, seed=1, scope="all")
    assert H.number_of_edges() == 0


def test_failures_reproducible_and_nested():
    G = ft.build_fattree(8)
    a = ft.fail_links(G, 10, seed=7).graph["failed_links"]
    b = ft.fail_links(G, 10, seed=7).graph["failed_links"]
    c = ft.fail_links(G, 20, seed=7).graph["failed_links"]
    assert a == b
    assert set(a) <= set(c)


@pytest.mark.parametrize("k", [2, 4, 6, 8])
def test_intact_metrics(k):
    G = ft.build_fattree(k)
    m = ft.evaluate(G, ft.hosts_of(G))
    assert m["connected"] == 1
    assert m["path_len"] == 6
    assert m["ecmp"] == (k // 2) ** 2
    assert m["ecmp_norm"] == 1


def test_bfs_counts_match_networkx():
    import networkx as nx

    G = ft.fail_links(ft.build_fattree(6), 20, seed=5)
    s, t = "10.0.0.2", "10.5.2.4"
    dist, sigma = ft.bfs_counts(G.adj, s)
    if nx.has_path(G, s, t):
        assert dist[t] == nx.shortest_path_length(G, s, t)
        assert sigma[t] == len(list(nx.all_shortest_paths(G, s, t)))


def config(**overrides):
    return {**ft.CONFIG, **overrides}


def test_config_block_and_cli_precedence():
    cfg = config(k=6, failure_rate=5, seed=9)
    args = ft.parse_args([], config=cfg)
    assert (args.k, args.failure_rate, args.seed) == (6, 5.0, 9)
    args = ft.parse_args(["--k", "8"], config=cfg)
    assert args.k == 8 and args.failure_rate == 5.0


@pytest.mark.parametrize("bad", [{"k": 5}, {"failure_rate": 150}, {"failure_scope": "pods"}, {"samples": -1}])
def test_config_values_are_validated(bad):
    with pytest.raises(SystemExit):
        ft.parse_args(["--k", "4"] if "k" not in bad else [], config=config(**bad))


def test_json_export(tmp_path):
    out = tmp_path / "g.json"
    assert ft.main(["--k", "4", "--failure-rate", "25", "--seed", "1", "--output", str(out)]) == 0
    data = json.loads(out.read_text())
    assert len(data["nodes"]) == 36
    assert len(data["failed_links"]) == 8
    assert len(data["links"]) == 48 - 8


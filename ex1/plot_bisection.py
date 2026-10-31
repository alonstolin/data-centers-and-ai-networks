"""Visualizes full bisection bandwidth on a k=4 fat-tree topology by coloring
all 8 communicating host pairs across the bisection and their 8 edge-disjoint
6-hop paths, with a unique color per pair.
"""

import argparse
from pathlib import Path
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import networkx as nx

import fattree as ft

HERE = Path(__file__).resolve().parent

# 8 high-contrast, colorblind-friendly vivid colors for the 8 communicating pairs
PAIR_COLORS = [
    ("#DC2626", "#991B1B", "Crimson Red"),     # Pair 1
    ("#2563EB", "#1E40AF", "Royal Blue"),      # Pair 2
    ("#16A34A", "#166534", "Emerald Green"),   # Pair 3
    ("#EA580C", "#9A3412", "Vivid Orange"),    # Pair 4
    ("#9333EA", "#6B21A8", "Electric Purple"), # Pair 5
    ("#0891B2", "#155E75", "Ocean Teal"),      # Pair 6
    ("#DB2777", "#9D174D", "Hot Magenta"),     # Pair 7
    ("#CA8A04", "#854D0E", "Golden Amber"),    # Pair 8
]


def compute_positions(k):
    """Compute hierarchical (x, y) coordinates for all nodes in a k-ary fat-tree."""
    half = k // 2
    pos = {}

    hosts_per_edge = half
    edges_per_pod = half
    hosts_per_pod = hosts_per_edge * edges_per_pod

    host_dx = 1.35
    edge_gap = 0.65
    pod_gap = 1.85

    pod_width = (hosts_per_pod - 1) * host_dx + (edges_per_pod - 1) * edge_gap
    pod_offsets = [p * (pod_width + pod_gap) for p in range(k)]
    total_width = pod_offsets[-1] + pod_width

    # 1. Hosts (y=0.0) and Edge switches (y=1.0)
    for pod in range(k):
        base_x = pod_offsets[pod]
        cur_x = base_x
        for e in range(edges_per_pod):
            edge_name = f"10.{pod}.{e}.1"
            host_xs = []
            for h in range(hosts_per_edge):
                host_name = f"10.{pod}.{e}.{h + 2}"
                pos[host_name] = (cur_x, 0.0)
                host_xs.append(cur_x)
                cur_x += host_dx
            pos[edge_name] = (sum(host_xs) / len(host_xs), 1.0)
            cur_x += edge_gap

        # 2. Aggregation switches (y=2.0)
        agg_names = [f"10.{pod}.{a}.1" for a in range(half, k)]
        if half == 1:
            agg_xs = [base_x + pod_width / 2.0]
        else:
            agg_xs = [base_x + i * (pod_width / (half - 1)) for i in range(half)]
        for name, ax in zip(agg_names, agg_xs):
            pos[name] = (ax, 2.0)

    # 3. Core switches (y=3.15)
    num_cores = half * half
    core_spacing = total_width / (num_cores + 1)
    for c in range(num_cores):
        j, i = c // half + 1, c % half + 1
        core_name = f"10.{k}.{j}.{i}"
        pos[core_name] = ((c + 1) * core_spacing, 3.15)

    return pos, pod_offsets, pod_width, total_width


def find_edge_disjoint_bisection_paths(G, pairs):
    """Find edge-disjoint 6-hop shortest paths for all communicating pairs across the bisection."""
    H = G.copy()
    paths = []
    for u, v in pairs:
        path = nx.shortest_path(H, u, v)
        paths.append(path)
        H.remove_edges_from(zip(path[:-1], path[1:]))
    return paths


def plot_bisection_graph(
    k=4,
    output_path=None,
    num_pairs=None,
):
    if output_path is None:
        output_path = HERE / "figures" / "bisection_bandwidth_k4.png"
    output_path = Path(output_path)

    G = ft.build_fattree(k)
    half = k // 2

    # Partition hosts into Left Half (Pods 0 .. k/2 - 1) and Right Half (Pods k/2 .. k - 1)
    left_hosts = [h for h in ft.hosts_of(G) if G.nodes[h]["pod"] < half]
    right_hosts = [h for h in ft.hosts_of(G) if G.nodes[h]["pod"] >= half]

    all_pairs = list(zip(left_hosts, right_hosts))
    if num_pairs is not None:
        all_pairs = all_pairs[:num_pairs]

    paths = find_edge_disjoint_bisection_paths(G, all_pairs)

    # Map each host and each edge to its pair index
    host_to_pair = {}
    edge_to_pair = {}
    for idx, ((u, v), path) in enumerate(zip(all_pairs, paths)):
        host_to_pair[u] = idx
        host_to_pair[v] = idx
        for a, b in zip(path[:-1], path[1:]):
            edge_to_pair[(a, b)] = idx
            edge_to_pair[(b, a)] = idx

    pos, pod_offsets, pod_width, total_width = compute_positions(k)

    fig, ax = plt.subplots(figsize=(18.0, 9.8), dpi=220)

    # Bisection Cut x-coordinate: midpoint between Pod (half - 1) and Pod half
    cut_x = (pod_offsets[half - 1] + pod_width + pod_offsets[half]) / 2.0

    # 1. Partition Background Containers
    p1_width = cut_x - (-0.55)
    p1_rect = patches.FancyBboxPatch(
        (-0.55, -0.72),
        p1_width - 0.18,
        3.02,
        boxstyle="round,pad=0.15,rounding_size=0.25",
        linewidth=1.5,
        edgecolor="#64748B",
        facecolor="#F1F5F9",
        alpha=0.55,
        zorder=0,
    )
    ax.add_patch(p1_rect)

    p2_rect = patches.FancyBboxPatch(
        (cut_x + 0.18, -0.72),
        total_width - cut_x + 0.37,
        3.02,
        boxstyle="round,pad=0.15,rounding_size=0.25",
        linewidth=1.5,
        edgecolor="#64748B",
        facecolor="#F1F5F9",
        alpha=0.55,
        zorder=0,
    )
    ax.add_patch(p2_rect)

    # Core Spine Zone Container
    core_rect = patches.FancyBboxPatch(
        (-0.55, 2.75),
        total_width + 1.1,
        0.80,
        boxstyle="round,pad=0.15,rounding_size=0.25",
        linewidth=1.2,
        edgecolor="#CBD5E1",
        facecolor="#F8FAFC",
        alpha=0.85,
        zorder=0,
    )
    ax.add_patch(core_rect)

    # Pod Containers
    for pod in range(k):
        px = pod_offsets[pod]
        pod_rect = patches.FancyBboxPatch(
            (px - 0.38, -0.46),
            pod_width + 0.76,
            2.64,
            boxstyle="round,pad=0.1,rounding_size=0.2",
            linewidth=1.0,
            edgecolor="#94A3B8",
            facecolor="#FFFFFF",
            alpha=0.92,
            linestyle="--",
            zorder=1,
        )
        ax.add_patch(pod_rect)
        ax.text(
            px + pod_width / 2.0,
            -0.37,
            f"Pod {pod}",
            ha="center",
            va="center",
            fontsize=9.5,
            fontweight="bold",
            color="#334155",
            zorder=2,
        )

    # Bisection Cut Line
    ax.axvline(
        x=cut_x,
        color="#0F172A",
        linestyle="--",
        linewidth=2.6,
        alpha=0.85,
        zorder=8,
    )
    ax.text(
        cut_x,
        3.78,
        f"BISECTION CUT\n({len(all_pairs)} Host Pairs Communicating Simultaneously Across Cut — 0 Link Contention)",
        ha="center",
        va="bottom",
        fontsize=9.5,
        fontweight="bold",
        color="#0F172A",
        bbox=dict(boxstyle="round,pad=0.35", facecolor="#FEF08A", edgecolor="#CA8A04", lw=1.4),
        zorder=12,
    )

    # Partition Titles placed cleanly at the bottom of each partition box
    ax.text(
        cut_x / 2.0,
        -0.66,
        f"Left Half (Partition 1): Pods 0..{half - 1} ({k**3 // 8} Hosts)",
        ha="center",
        va="center",
        fontsize=10.2,
        fontweight="bold",
        color="#0F172A",
        bbox=dict(boxstyle="round,pad=0.25", facecolor="#E2E8F0", edgecolor="#64748B", lw=1.0),
        zorder=10,
    )
    ax.text(
        cut_x + (total_width - cut_x) / 2.0,
        -0.66,
        f"Right Half (Partition 2): Pods {half}..{k - 1} ({k**3 // 8} Hosts)",
        ha="center",
        va="center",
        fontsize=10.2,
        fontweight="bold",
        color="#0F172A",
        bbox=dict(boxstyle="round,pad=0.25", facecolor="#E2E8F0", edgecolor="#64748B", lw=1.0),
        zorder=10,
    )
    ax.text(
        cut_x,
        3.50,
        "Core Switch Layer (Each Core Switch Routes 2 Disjoint Pair Flows Across the Bisection)",
        ha="center",
        va="center",
        fontsize=9,
        fontstyle="italic",
        color="#475569",
        zorder=10,
    )

    # 2. Draw Edges (Colored by Pair!)
    for u, v in G.edges:
        x1, y1 = pos[u]
        x2, y2 = pos[v]
        pair_idx = edge_to_pair.get((u, v))
        if pair_idx is not None:
            main_color, dark_color, _ = PAIR_COLORS[pair_idx % len(PAIR_COLORS)]
            # Subtle white halo so crossing lines remain easy to trace
            ax.plot([x1, x2], [y1, y2], color="#FFFFFF", linewidth=4.8, alpha=0.85, zorder=3)
            # Pair colored link
            ax.plot([x1, x2], [y1, y2], color=main_color, linewidth=3.0, alpha=0.95, zorder=4)
        else:
            ax.plot([x1, x2], [y1, y2], color="#CBD5E1", linewidth=1.0, alpha=0.45, zorder=2)

    # 3. Draw Nodes
    switch_styles = {
        "core": {"size": 460, "face": "#FFFFFF", "edge": "#1E293B", "shape": "s"},
        "agg": {"size": 340, "face": "#FFFFFF", "edge": "#475569", "shape": "o"},
        "edge": {"size": 340, "face": "#FFFFFF", "edge": "#475569", "shape": "o"},
    }

    for node, data in G.nodes(data=True):
        x, y = pos[node]
        layer = data["layer"]

        if layer == "host":
            pair_idx = host_to_pair.get(node)
            if pair_idx is not None:
                main_color, dark_color, _ = PAIR_COLORS[pair_idx % len(PAIR_COLORS)]
                facecolor = main_color
                edgecolor = dark_color
                size = 450
                lw = 2.4
                zorder = 9
                lbl = f"P{pair_idx + 1}"
                txt_color = "#FFFFFF"
            else:
                facecolor = "#E2E8F0"
                edgecolor = "#64748B"
                size = 240
                lw = 1.2
                zorder = 6
                lbl = f"H{node.split('.')[-1]}"
                txt_color = "#334155"

            ax.scatter(
                [x], [y],
                s=size,
                facecolor=facecolor,
                edgecolor=edgecolor,
                linewidth=lw,
                marker="o",
                zorder=zorder,
            )
            ax.text(
                x, y, lbl,
                ha="center", va="center",
                fontsize=8, fontweight="bold",
                color=txt_color, zorder=10,
            )
            # Host IP label below node
            ax.text(
                x, y - 0.18,
                node,
                ha="center", va="top",
                fontsize=6.5, fontweight="bold",
                color=dark_color if pair_idx is not None else "#64748B",
                zorder=10,
            )
        else:
            style = switch_styles[layer]
            ax.scatter(
                [x], [y],
                s=style["size"],
                facecolor=style["face"],
                edgecolor=style["edge"],
                linewidth=1.8,
                marker=style["shape"],
                zorder=7,
            )
            if layer == "core":
                short_id = f"{node.split('.')[-2]}.{node.split('.')[-1]}"
                lbl = f"C{short_id}"
                ax.text(x, y, lbl, ha="center", va="center", fontsize=7.8, fontweight="bold", color="#0F172A", zorder=10)
                ax.text(x, y + 0.18, node, ha="center", va="bottom", fontsize=7, color="#334155", fontweight="bold", zorder=10)
            elif layer == "agg":
                short_id = node.split(".")[-2]
                lbl = f"A{short_id}"
                ax.text(x, y, lbl, ha="center", va="center", fontsize=7.5, fontweight="bold", color="#334155", zorder=10)
            elif layer == "edge":
                short_id = node.split(".")[-2]
                lbl = f"E{short_id}"
                ax.text(x, y, lbl, ha="center", va="center", fontsize=7.5, fontweight="bold", color="#334155", zorder=10)

    # Layer labels on the left axis
    layer_labels = [
        (3.15, "Core Layer\n(4 switches, 16 links)"),
        (2.0, "Aggregation Layer\n(8 switches, 16 pod links)"),
        (1.0, "Edge Layer\n(8 switches, 16 host links)"),
        (0.0, "Host Layer\n(16 hosts = 8 pairs)"),
    ]
    for y_val, lbl_text in layer_labels:
        ax.text(
            -1.2,
            y_val,
            lbl_text,
            ha="right",
            va="center",
            fontsize=9,
            fontweight="bold",
            color="#1E293B",
            bbox=dict(boxstyle="round,pad=0.3", facecolor="#F8FAFC", edgecolor="#CBD5E1", lw=0.9),
            zorder=10,
        )

    # Right-side Information Panel (aligned cleanly outside the right partition)
    panel_x = total_width + 1.15
    info_text = (
        r"$\mathbf{Full\ Bisection\ Bandwidth\ Proof\ (k=4)}$" + "\n\n"
        f"• Total Hosts: N = {k**3 // 4} ({k**3 // 8} Left vs. {k**3 // 8} Right)\n"
        f"• Communicating Pairs: {len(all_pairs)} simultaneous pairs (P1–P{len(all_pairs)})\n"
        f"• Path Length: 6 hops (6 links) per pair\n"
        f"• Total Links Used: {len(all_pairs)} pairs × 6 links = {len(all_pairs) * 6} / {G.number_of_edges()} links\n"
        f"• Link Sharing / Contention: 0 (100% Edge-Disjoint!)\n"
        f"• Bisection Bandwidth: 8 × B (100% Non-Blocking)"
    )
    ax.text(
        panel_x,
        2.78,
        info_text,
        ha="left",
        va="center",
        fontsize=9,
        color="#0F172A",
        bbox=dict(boxstyle="round,pad=0.5", facecolor="#F8FAFC", edgecolor="#94A3B8", lw=1.2),
        zorder=10,
    )

    # Pair Legend Box anchored in data coordinates right below the info box
    legend_handles = []
    for idx, ((u, v), path) in enumerate(zip(all_pairs, paths)):
        main_color, dark_color, color_name = PAIR_COLORS[idx % len(PAIR_COLORS)]
        core_sw = path[3]
        label = f"P{idx + 1} ({color_name}):  {u}  ↔  {v}   [via Core {core_sw}]"
        legend_handles.append(
            plt.Line2D(
                [0], [0],
                color=main_color,
                lw=3.5,
                marker="o",
                markersize=8,
                markerfacecolor=main_color,
                markeredgecolor=dark_color,
                label=label,
            )
        )

    legend = ax.legend(
        handles=legend_handles,
        title="Communicating Host Pairs & Disjoint Paths\n(Same Color = Host Pair + Its Dedicated 6-Hop Path)",
        title_fontsize=9.0,
        loc="upper left",
        bbox_to_anchor=(panel_x, 1.85),
        bbox_transform=ax.transData,
        fontsize=8.3,
        frameon=True,
        facecolor="#FFFFFF",
        edgecolor="#94A3B8",
        labelspacing=0.65,
        borderpad=0.8,
    )
    legend.get_title().set_fontweight("bold")

    ax.set_title(
        f"k={k} Fat-Tree: Full Bisection Bandwidth — {len(all_pairs)} Host Pairs & Dedicated Edge-Disjoint Paths",
        fontsize=14,
        fontweight="bold",
        pad=32,
        color="#0F172A",
    )

    ax.set_xlim(-3.5, total_width + 11.2)
    ax.set_ylim(-0.95, 4.15)
    ax.axis("off")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(output_path, dpi=220, bbox_inches="tight")
    plt.close(fig)
    print(f"Graph saved successfully to {output_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Visualize full bisection bandwidth on a k=4 fat-tree with each communicating pair and its path in a unique color."
    )
    parser.add_argument("--k", type=int, default=4, help="switch port count (default 4)")
    parser.add_argument(
        "--pairs",
        type=int,
        default=None,
        help="number of host pairs to color across the bisection (default: all 8 pairs for k=4)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=str(HERE / "figures" / "bisection_bandwidth_k4.png"),
        help="output image path",
    )
    args = parser.parse_args()

    plot_bisection_graph(
        k=args.k,
        output_path=args.output,
        num_pairs=args.pairs,
    )


if __name__ == "__main__":
    main()

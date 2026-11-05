# Data Center Networks & AI

Course 361.2.2460, Semester A 2026. Covers scalable data center architectures, hyperscale Clos fabrics, lossless RDMA transports (RoCEv2, PFC, DCQCN), distributed congestion control, and network fabrics for large-scale AI/LLM clusters.

---

## Syllabus



| Unit | Topic | Papers |
|:---:|---|---|
| **1** | Foundations of Data Center vs. Internet Networking | • [Al-Fares Fat-Tree (2008)](articles/summaries.md#1-a-scalable-commodity-data-center-network-architecture-fat-tree)<br>• [VL2 (2009)](articles/summaries.md#2-vl2-a-scalable-and-flexible-data-center-network)<br>• [Traffic in the Wild (2010)](articles/summaries.md#3-network-traffic-characteristics-of-data-centers-in-the-wild) |
| **2** | AI Factories: Motivation and Challenges | • [Meta RoCEv2 at Scale (2024)](articles/summaries.md#4-rdma-over-ethernet-for-distributed-ai-training-at-meta-scale)<br>• [Alibaba HPN (2024)](articles/summaries.md#5-alibaba-hpn-a-data-center-network-for-llm-training) |
| **3** | Architecture | • [Jupiter Rising (2015)](articles/summaries.md#6-jupiter-rising-a-decade-of-clos-topologies-and-centralized-control-in-googles-datacenter-network)<br>• [RNG: Flat Datacenter Networks (2026)](articles/summaries.md#7-rng-flat-datacenter-networks-at-scale) |
| **4** | Routing in Data Centers | • [WCMP (2014)](articles/summaries.md#8-wcmp-weighted-cost-multipathing-for-improved-fairness-in-data-centers)<br>• [FlowBender (2014)](articles/summaries.md#9-flowbender-flow-level-adaptive-routing-in-datacenter-networks) |
| **5** | Load Balancing | • [CONGA (2014)](articles/summaries.md#10-conga-distributed-congestion-aware-load-balancing-for-datacenters)<br>• [Load Balancing for AI Training (2025)](articles/summaries.md#11-load-balancing-for-ai-training-workloads) |
| **6** | Congestion Control | • [Data Center TCP / DCTCP (2010)](articles/summaries.md#12-dctcp-data-center-tcp)<br>• [TIMELY (2015)](articles/summaries.md#13-timely-rtt-based-congestion-control-for-the-datacenter) |
| **7** | Lossless Networks | • [DCQCN: RDMA Congestion Control (2015)](articles/summaries.md#14-dcqcn-congestion-control-for-large-scale-rdma-deployments)<br>• [Deadlocks in Datacenter Networks (2016)](articles/summaries.md#15-deadlocks-in-datacenter-networks-why-do-they-form-and-how-to-avoid-them) |
| **8** | Collectives | • [Collective Operations in Distributed ML (Slides)](articles/summaries.md#16-collective-operations-in-distributed-machine-learning-lecture-slides) |
| **9** | Distributed ML | • [Megatron-LM: GPU Cluster Training (2021)](articles/summaries.md#17-efficient-large-scale-language-model-training-on-gpu-clusters-using-megatron-lm) |
| **10** | Extra | • [CSIG (2026)](articles/summaries.md#18-csig-congestion-signaling-for-datacenter-transports)<br>• [Harvest (2026)](articles/summaries.md#19-harvest-adaptive-photonic-switching-schedules-for-collective-communication-in-scale-up-domains) |

---

## Exercises

| # | Topic | Unit | Folder |
|:---:|---|:---:|---|
| **HW1** | **$k$-ary Fat-Tree Generation, Link Failures & Bisection Bandwidth**<br>Constructing Clos topologies, modeling link degradation, and showing that failures reduce path diversity $(1-p)^4$ well before reachability drops. | 1 | [ex1/](../exercises/ex1/README.md) |

---

## Notes

| Document | Description |
|---|---|
| [AI Factory Networking (Podcast, Hebrew)](notes/ai-factory-podcast.md) | Course background: summary of a podcast interview with Gilad Shainer (NVIDIA) covering AI factory networks, scale-up vs. scale-out, and InfiniBand vs. RoCEv2. |

---

## Studying with AI: The "Sparring Partner" Method

Using AI for ready-made answers creates an illusion of competence that breaks down during class discussions, technical interviews, and exams. Instead, use AI to challenge your own understanding:

1. **Try first:** Inspect the paper's figures and form your own explanation before opening an AI prompt.
2. **Ask AI to challenge you (Sparring):** Paste your reading of a figure or mechanism and ask the AI:
   > *"Here is my interpretation of Figure X: [...]. Do not give me the answer. Point out flaws in my reasoning and ask me 2 tough questions to test whether I truly understand it."*
3. **Verify against the paper:** AI tools frequently hallucinate units, scales, and details (e.g. confusing KB with MB). **If the AI and the paper disagree, the paper wins.** Catching these discrepancies is where real learning happens.

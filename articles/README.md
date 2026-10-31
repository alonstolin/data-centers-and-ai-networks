# Course Articles

One-paragraph summaries of the 17 research papers and presentation decks in this folder, synchronized with the 10 course units from the syllabus. Each entry outlines the core problem, technical approach, key results, and direct links to both the original **[PDF]** and audited **[MD]** conversion (featuring embedded figures and math rendering).

For the Hebrew overview of the NVIDIA AI-factory podcast, see [notes/topic1-podcast-ai-factory.md](notes/topic1-podcast-ai-factory.md).

---

**Jump to Unit:**  
[Unit 1](#unit-1) · [Unit 2](#unit-2) · [Unit 3](#unit-3) · [Unit 4](#unit-4) · [Unit 5](#unit-5) · [Unit 6](#unit-6) · [Unit 7](#unit-7) · [Unit 8](#unit-8) · [Unit 9](#unit-9) · [Unit 10](#unit-10)

---

<a id="unit-1"></a>
## Unit 1: Clos Topologies & Fat-Trees

<a id="al-fares-et-al-2008"></a>
### 1. A Scalable, Commodity Data Center Network Architecture (Fat-Tree)

Al-Fares, Loukissas, Vahdat. SIGCOMM 2008. [PDF](A%20Scalable%2C%20Commodity%20Data%20Center%20Network%20Architecture.pdf) · [MD](markdown/A%20Scalable%2C%20Commodity%20Data%20Center%20Network%20Architecture.md)

- **Problem:** Hierarchical data center trees put the most expensive switches at the top and still deliver as little as 50% of edge bisection bandwidth. Equipment costs grow super-linearly with cluster size.
- **Idea:** Build a multi-stage Clos fat-tree from identical commodity $k$-port switches. It organizes $k$ pods, each with $k/2$ edge and $k/2$ aggregation switches, plus $(k/2)^2$ core switches, supporting $k^3/4$ hosts at full 1:1 bisection bandwidth. To disperse traffic across the $(k/2)^2$ parallel equal-cost paths, switches use two-level routing tables, and large elephant flows are scheduled to prevent hash collisions.
- **Result:** Delivers full bisection bandwidth at significantly lower capital cost than proprietary chassis switches, while maintaining standard Ethernet/IP/TCP compatibility and zero host modifications.
- **Course Link:** Generates the topology analyzed in [HW1](../ex1/README.md).

---

<a id="greenberg-et-al-2009"></a>
### 2. VL2: A Scalable and Flexible Data Center Network

Greenberg et al. (Microsoft Research). SIGCOMM 2009. [PDF](VL2%20-%20A%20Scalable%20and%20Flexible%20Data%20Center%20Network.pdf) · [MD](markdown/VL2%20-%20A%20Scalable%20and%20Flexible%20Data%20Center%20Network.md)

- **Problem:** Oversubscribed hierarchical networks fragment server pools, allow neighbor traffic interference, and couple IP addresses to physical rack locations, preventing dynamic VM migration.
- **Idea:** Realize an agile "huge virtual Layer-2 switch" illusion via three mechanisms: flat addressing (separating Application Specific IPs from Location IPs through an address directory service), Valiant Load Balancing (VLB) over a Clos fabric (randomly hashing each flow to an intermediate switch), and host-agent based address encapsulation.
- **Result:** Builds on merchant silicon to route petabytes of traffic at line rate, eliminating hot spots and enabling uniform agility across multi-tenant cloud workloads.

---

<a id="singh-et-al-2015"></a>
### 3. Jupiter Rising: A Decade of Clos Topologies in Google's Datacenter Network

Singh et al. (Google). SIGCOMM 2015 / CACM 2016. [PDF](Jupiter%20Rising%20-%20Decade%20of%20Clos%20Topologies%20in%20Google%20Datacenter%20Network.pdf) · [MD](markdown/Jupiter%20Rising%20-%20Decade%20of%20Clos%20Topologies%20in%20Google%20Datacenter%20Network.md)

- **Problem:** Google's internal bandwidth requirements grew 50× over six years, outstripping the maximum scale and cost efficiency of any commercial chassis switch.
- **Idea:** Traces five generations of Google data center fabrics built on three tenets: multi-stage Clos fabrics assembled from low-cost merchant silicon chips, centralized Software-Defined Networking (SDN) routing protocols pushing pre-computed global paths, and modular physical building blocks reused across clusters and WANs.
- **Result:** Scales datacenter fabric capacity over 100× to >1.3 Pbps bisection bandwidth across tens of thousands of servers with automated operational recovery.

---

<a id="unit-2"></a>
## Unit 2: Traffic Characteristics in the Wild

<a id="kandula-et-al-2009"></a>
<a id="benson-et-al-2010"></a>
### 4. Network Traffic Characteristics of Data Centers in the Wild

Benson, Akella, Maltz. IMC 2010. [PDF](Network%20Traffic%20Characteristics%20of%20Data%20Centers%20in%20the%20Wild.pdf) · [MD](markdown/Network%20Traffic%20Characteristics%20of%20Data%20Centers%20in%20the%20Wild.md)

- **Study:** Comprehensive packet and SNMP measurement analysis across 10 diverse production datacenters (university, enterprise, and cloud/MapReduce environments).
- **Findings:**
  - Flow durations and arrivals exhibit heavy-tailed, bursty distributions; over 80% of flows complete within 10 seconds.
  - Traffic locality varies widely: cloud workloads confine ~80% of volume inside the Top-of-Rack (ToR), whereas enterprise clusters push up to 90% across aggregation and core links.
  - Core links operate at high utilization, while edge switches remain lightly loaded on average yet still experience transient buffer drops due to microbursts.
- **Implications:** Proves that oblivious centralized routing struggles with rapid flow turnover, validating the need for hardware-level multipathing and dynamic in-network load balancing.

---

<a id="unit-3"></a>
## Unit 3: Low-Latency Transport & DCTCP

<a id="alizadeh-et-al-2010"></a>
### 5. Data Center TCP (DCTCP)

Alizadeh et al. (Microsoft Research, Stanford). SIGCOMM 2010. [PDF](Data%20Center%20TCP%20%28DCTCP%29.pdf) · [MD](markdown/Data%20Center%20TCP%20%28DCTCP%29.md)

- **Problem:** Long, high-throughput background flows monopolize shallow switch buffers, increasing queueing delay and causing TCP throughput collapse (incast) for short, deadline-sensitive query flows.
- **Idea:** Leverages Explicit Congestion Notification (ECN) marking at switches based on an instantaneous queue length threshold. Instead of halving the congestion window on any mark (binary signal), the DCTCP sender calculates a running fraction $\alpha$ of marked packets and throttles its window proportionally to the actual extent of queue buildup.
- **Result:** Maintains high link utilization while reducing buffer occupancy by 90%, preventing bufferbloat, achieving low latency for short queries, and handling 10× greater burst volume.

---

<a id="unit-4"></a>
## Unit 4: Lossless Ethernet & RDMA Transport

<a id="zhu-et-al-2015"></a>
### 6. DCQCN: Congestion Control for Large-Scale RDMA Deployments

Zhu et al. (Microsoft, Mellanox, UCSB). SIGCOMM 2015. [PDF](Congestion%20Control%20for%20Large-Scale%20RDMA%20Deployments.pdf) · [MD](markdown/Congestion%20Control%20for%20Large-Scale%20RDMA%20Deployments.md)

- **Problem:** RDMA over Converged Ethernet (RoCEv2) requires a lossless network. When Priority Flow Control (PFC) pauses upstream switches to avoid packet drops, it can propagate pause frames across the fabric (PFC storm), inducing head-of-line blocking and unfairness.
- **Idea:** An end-to-end rate-based congestion control protocol combining ECN-based feedback (from switches) with hardware rate limiters implemented directly in the NIC. Senders react to Congestion Notification Packets (CNPs) by cutting their rate and recovering additively/hyperbolically via a multi-stage timer.
- **Result:** Keeps queue lengths low enough that PFC is virtually never triggered under normal operations, enabling ultra-low latency and lossless RDMA transfer at cloud scale.

---

<a id="mittal-et-al-2015"></a>
### 7. TIMELY: RTT-based Congestion Control for the Datacenter

Mittal et al. (Google, Berkeley). SIGCOMM 2015. [PDF](TIMELY%20-%20RTT-based%20Congestion%20Control%20for%20the%20Datacenter.pdf) · [MD](markdown/TIMELY%20-%20RTT-based%20Congestion%20Control%20for%20the%20Datacenter.md)

- **Problem:** Relying on switch-based ECN marking requires manual per-hop threshold tuning across heterogeneous hardware, which becomes fragile during network upgrades.
- **Idea:** Exploits modern NIC hardware timestamping to measure round-trip times (RTT) with microsecond precision. TIMELY computes the RTT gradient (rate of delay increase or decrease) to adjust flow transmission rates without requiring any switch telemetry or configuration.
- **Result:** Tested over OS-bypass NICs on a Clos topology with PFC; achieves near line-rate throughput while improving 99th-percentile completion latency by 9× compared to standard transport.

---

<a id="unit-5"></a>
## Unit 5: In-Network Load Balancing

<a id="kabbani-et-al-2014"></a>
### 8. FlowBender: Flow-level Adaptive Routing in Datacenter Networks

Kabbani, Vamanan, Hasan, Duchene. CoNEXT 2014. [PDF](FlowBender%20-%20Flow-level%20Adaptive%20Routing%20in%20Datacenter%20Networks.pdf) · [MD](markdown/FlowBender%20-%20Flow-level%20Adaptive%20Routing%20in%20Datacenter%20Networks.md)

- **Problem:** Static ECMP hashing places multiple large flows onto identical links while alternative paths remain idle. Packet spraying causes out-of-order delivery, while centralized controllers introduce latency.
- **Idea:** FlowBender retains flow-level routing (preserving TCP packet ordering). When an end-host detects congestion (via ECN marks) or link failures (via retransmit timeouts), it dynamically shifts the flow's hash key to re-route it to an alternate equal-cost path.
- **Result:** Implemented in under 50 lines of Linux kernel code; achieves superior tail latency and fault recovery without requiring switch hardware modifications.

---

<a id="zhou-et-al-2014"></a>
### 9. WCMP: Weighted Cost Multipathing for Improved Fairness in Data Centers

Zhou et al. (Google, UCSD). EuroSys 2014. [PDF](WCMP%20-%20Weighted%20Cost%20Multipathing%20for%20Improved%20Fairness%20in%20Data%20Centers.pdf) · [MD](markdown/WCMP%20-%20Weighted%20Cost%20Multipathing%20for%20Improved%20Fairness%20in%20Data%20Centers.md)

- **Problem:** ECMP splits traffic evenly over all available next hops, presuming full topology symmetry. In reality, link failures or incremental expansions leave paths asymmetric, causing severe congestion on under-provisioned links.
- **Idea:** Distributes traffic over next hops in proportion to the remaining downstream path capacity. Next-hop entries are replicated in switch forwarding tables according to integer weight allocations optimized under hardware table constraints.
- **Result:** Reduces flow completion time variability by up to 25× in OpenFlow testbeds, providing robust, fair load balancing during link degradation.

---

<a id="alizadeh-et-al-2014"></a>
### 10. CONGA: Distributed Congestion-Aware Load Balancing for Datacenters

Alizadeh et al. (Cisco). SIGCOMM 2014. [PDF](CONGA%20-%20Distributed%20Congestion-Aware%20Load%20Balancing.pdf) · [MD](markdown/CONGA%20-%20Distributed%20Congestion-Aware%20Load%20Balancing.md)

- **Problem:** Centralized load balancers are too slow for microsecond fabric decisions, while ToR-local hashing cannot detect downstream spine bottlenecks.
- **Idea:** Operates entirely within the leaf switches of a leaf-spine network. Leaf switches divide TCP flows into flowlets, measure real-time path congestion using DRE (Discounted Rate Estimator), and piggyback metric feedback on data packets. New flowlets are steered to the globally least congested path.
- **Result:** Fabricated in custom ASIC silicon; delivers 5× better flow completion time than ECMP during link failures and 2–8× higher throughput than MPTCP under severe incast.

---

<a id="unit-6"></a>
## Unit 6: AI Training Workloads & Dual-Plane Fabrics

<a id="fu-et-al-2024"></a>
### 11. Alibaba HPN: A Data Center Network for LLM Training

Qian et al. (Alibaba Cloud). SIGCOMM 2024. [PDF](Alibaba%20HPN%20-%20A%20Data%20Center%20Network%20for%20LLM%20Training.pdf) · [MD](markdown/Alibaba%20HPN%20-%20A%20Data%20Center%20Network%20for%20LLM%20Training.md)

- **Problem:** Distributed LLM training generates very few, massive (400 Gbps), synchronous flows per GPU. Standard 3-tier Clos networks suffer from severe ECMP hash polarization and ToR single-points-of-failure that stall thousands of GPUs.
- **Idea:**
  - A 2-tier, dual-plane architecture scaling to 15,000 GPUs per pod without a third switching tier, shrinking path selection search spaces.
  - Active-active non-stacked dual-ToR design eliminating ToR failovers as cluster-wide disruption events.
  - Rail-optimized cabling placing 1,000 GPUs within a single Tier-1 domain to satisfy 96.3% of training jobs locally.
- **Result:** Deployed in production for over 8 months with zero ToR outages, improving overall LLM training throughput by 14.9%.

---

<a id="load-balancing-for-ai-training-workloads-slide-deck"></a>
### 12. Load Balancing for AI Training Workloads

McClure et al. (Berkeley, Technion, NVIDIA). arXiv 2025. [PDF](Load%20Balancing%20for%20AI%20Training%20Workloads.pdf) · [MD](markdown/Load%20Balancing%20for%20AI%20Training%20Workloads.md)

- **Problem:** Existing AI cluster load balancing schemes (packet spraying, flowlet switching, host-based multipathing) have never been evaluated systematically under identical collective workloads and failure models.
- **Study:** Compares flow, flowlet, subflow, and packet-level spraying on distributed AI collectives (All-Reduce, All-to-All) decoupled from transport stacks.
- **Findings:** Fine-grained packet spraying fundamentally outperforms coarser flowlet routing. Host-based spraying outperforms switch-based spraying under link failures due to faster end-to-end feedback.
- **Contribution:** Demonstrates that a destination-based cyclic packet rotation discipline achieves bounded queue occupancy at maximum utilization, proposing the OFAN switch architecture.

---

<a id="unit-7"></a>
## Unit 7: Collective Communications

<a id="collectives-slide-deck"></a>
### 13. Collective Operations in Distributed Machine Learning (Lecture Slides)

Chen Avin. [PDF](Collectives-plain.pdf) · [MD](markdown/Collectives-plain.md)

- **Overview:** Pedagogical breakdown of communication primitives underpinning distributed model training across Data Parallelism (DP), Tensor Parallelism (TP), and Pipeline Parallelism (PP).
- **Core Primitives:** Rigorous operational analysis of seven foundational collective operations: Reduce, Gather, All-Reduce (Ring & Tree algorithms for gradient synchronization), All-Gather, Scatter, Reduce-Scatter, and All-to-All.
- **Relevance:** Establishes the mathematical bounds and network traffic matrices necessary to evaluate high-speed fabric designs (e.g. NCCL, RoCEv2, NVLink).

---

<a id="unit-8"></a>
## Unit 8: Distributed LLM Clusters & Scale

<a id="narayanan-et-al-2021"></a>
### 14. Efficient Large-Scale Language Model Training on GPU Clusters Using Megatron-LM

Narayanan et al. (NVIDIA, Stanford, Microsoft Research). SC 2021. [PDF](Efficient%20Large-Scale%20Language%20Model%20Training%20on%20GPU%20Clusters%20Using%20Megatron-LM.pdf) · [MD](markdown/Efficient%20Large-Scale%20Language%20Model%20Training%20on%20GPU%20Clusters%20Using%20Megatron-LM.md)

- **Problem:** Multi-billion and trillion parameter language models exceed single-GPU memory limits. Naive tensor or pipeline partitioning causes high network overhead and GPU bubble idle time.
- **Idea:** Composes 3D Parallelism: intra-node Tensor Parallelism (TP), inter-node Pipeline Parallelism (PP), and global Data Parallelism (DP). Introduces an interleaved 1F1B schedule that cuts pipeline bubbles with minimal memory overhead.
- **Result:** Successfully trained a 1-trillion parameter model at 502 PetaFLOP/s on 3,072 GPUs (52% of theoretical hardware peak).
- **Network Relevance:** Defines the network hierarchy: TP demands high-bandwidth NVLink within nodes, PP requires low-latency inter-node links, and DP generates periodic ring All-Reduce traffic.

---

<a id="choudhury-et-al-2024"></a>
### 15. RDMA over Ethernet for Distributed AI Training at Meta Scale

Gangidi, Choudhury et al. (Meta). SIGCOMM 2024. [PDF](RDMA%20over%20Ethernet%20for%20Distributed%20AI%20Training%20at%20Meta%20Scale.pdf) · [MD](markdown/RDMA%20over%20Ethernet%20for%20Distributed%20AI%20Training%20at%20Meta%20Scale.md)

- **Topology:** Production deployment of dedicated RoCEv2 backend fabrics supporting up to 32,000 GPUs (training Llama 3 on 16,000 GPUs across a 24,000-GPU cluster).
- **Routing & Multipathing:** Explores the evolution from standard ECMP to Queue-Pair (QP) scaling with Enhanced ECMP (E-ECMP) and centralized traffic-engineering controllers to avoid hash collisions on synchronized collective flows.
- **Transport Strategy:** Eliminates DCQCN complexity by replacing it with receiver-driven window admission control implemented directly within collective libraries (NCCL), preventing persistent PFC pauses from deep-buffer spine switches.
- **Operational Takeaways:** Detailed diagnostic methodologies, link flapping mitigations, and cross-layer tuning between NIC firmware, switch buffers, and collective communication algorithms.

---

<a id="unit-9"></a>
## Unit 9: Deadlocks in Lossless Fabrics

<a id="gupta-et-al-2021"></a>
<a id="hu-et-al-2016"></a>
### 16. Deadlocks in Datacenter Networks: Why Do They Form, and How to Avoid Them

Hu, Gupta et al. (Microsoft, HKUST). HotNets 2016 / 2021. [PDF](Deadlocks%20in%20Datacenter%20Networks%20-%20Why%20Do%20They%20Form%20and%20How%20to%20Avoid%20Them.pdf) · [MD](markdown/Deadlocks%20in%20Datacenter%20Networks%20-%20Why%20Do%20They%20Form%20and%20How%20to%20Avoid%20Them.md)

- **Problem:** Priority Flow Control (PFC) pauses can create Cyclic Buffer Dependencies (CBD), completely locking switch queues and halting traffic across the fabric. Transient routing loops during BGP reconvergence can trigger CBDs even in nominally loop-free Clos topologies.
- **Analysis:** Proves that while CBDs are a necessary condition for deadlock, they are not sufficient. Actual deadlock formation depends on packet TTLs, traffic matrix intensity, and buffer occupancy dynamics.
- **Mitigation:** Evaluates TTL expiration mechanisms, dynamic rate limiting, and restricted pause-frame propagation boundaries to break cycles without requiring wasteful static virtual channel partitioning.

---

<a id="unit-10"></a>
## Unit 10: Flat & Non-Clos Topologies

<a id="zhao-et-al-2024"></a>
<a id="bernardi-et-al-2026"></a>
### 17. RNG: Flat Datacenter Networks at Scale

Bernardi, Zhao et al. (Amazon Web Services). arXiv 2024 / 2026. [PDF](RNG%20-%20Flat%20Datacenter%20Networks%20at%20Scale.pdf) · [MD](markdown/RNG%20-%20Flat%20Datacenter%20Networks%20at%20Scale.md)

- **Problem:** Multi-tier Clos fat-trees lack capacity fungibility: a localized traffic burst within a pod cannot leverage idle capacity in remote pods without traversing expensive aggregation and core tiers.
- **Idea:** Replaces Clos tiers with a flat expander graph based on Random Regular Graphs (RNG). Implements Spraypoint distributed routing to find diverse edge-disjoint paths, alongside a passive optical ShuffleBox system to simplify cabling.
- **Result:** Achieves 9% to 45% lower total infrastructure cost than equivalent-scale fat-trees while providing equal or superior throughput across real-world transport benchmarks. Deployed as AWS's default datacenter fabric architecture.

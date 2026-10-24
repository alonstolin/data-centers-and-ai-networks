# Course articles

One-paragraph summaries of the papers and lecture material in this folder, organized by course units and themes. Each entry says what problem the paper tackles, what it proposes, and what the headline result is, so you can decide which PDF to open.

**AI usage:** the summaries were written with Claude (Anthropic) from each paper's abstract, introduction and conclusion, not from a full read. Numbers are the ones the authors report. Check the PDF before quoting one.

For the Hebrew overview of the NVIDIA AI-factory podcast, see [notes/topic1-podcast-ai-factory.md](notes/topic1-podcast-ai-factory.md).

## Contents

| # | Unit / Topic | Theme | Paper |
|---|---|---|---|
| 1 | Unit 1 | Topologies | [A Scalable, Commodity Data Center Network Architecture](#1-a-scalable-commodity-data-center-network-architecture-fat-tree) |
| 2 | Unit 1 | Topologies | [VL2: A Scalable and Flexible Data Center Network](#2-vl2-a-scalable-and-flexible-data-center-network) |
| 3 | Unit 1 | Traffic | [Network Traffic Characteristics of Data Centers in the Wild](#3-network-traffic-characteristics-of-data-centers-in-the-wild) |
| 4 | Unit 2 | AI networks | [RDMA over Ethernet for Distributed AI Training at Meta Scale](#4-rdma-over-ethernet-for-distributed-ai-training-at-meta-scale) |
| 5 | Unit 2 | AI networks | [Alibaba HPN: A Data Center Network for Large Language Model Training](#5-alibaba-hpn-a-data-center-network-for-llm-training) |
| 6 | Unit 3 | Topologies | [Jupiter Rising: A Decade of Clos Topologies and Centralized Control in Google's Datacenter Network](#6-jupiter-rising-a-decade-of-clos-topologies-and-centralized-control-in-googles-datacenter-network) |
| 7 | Unit 3 | Topologies | [RNG: Flat Datacenter Networks at Scale](#7-rng-flat-datacenter-networks-at-scale) |
| 8 | Unit 4 | Routing | [WCMP: Weighted Cost Multipathing for Improved Fairness in Data Centers](#8-wcmp-weighted-cost-multipathing-for-improved-fairness-in-data-centers) |
| 9 | Unit 4 | Routing | [FlowBender: Flow-level Adaptive Routing for Improved Latency and Throughput in Datacenter Networks](#9-flowbender-flow-level-adaptive-routing-in-datacenter-networks) |
| 10 | Unit 5 | Load balancing | [CONGA: Distributed Congestion-Aware Load Balancing for Datacenters](#10-conga-distributed-congestion-aware-load-balancing-for-datacenters) |
| 11 | Unit 5 | Load balancing | [Load Balancing for AI Training Workloads](#11-load-balancing-for-ai-training-workloads) |
| 12 | Unit 6 | Congestion control | [Data Center TCP (DCTCP)](#12-dctcp-data-center-tcp) |
| 13 | Unit 6 | Congestion control | [TIMELY: RTT-based Congestion Control for the Datacenter](#13-timely-rtt-based-congestion-control-for-the-datacenter) |
| 14 | Unit 7 | Lossless / RDMA | [Congestion Control for Large-Scale RDMA Deployments (DCQCN)](#14-dcqcn-congestion-control-for-large-scale-rdma-deployments) |
| 15 | Unit 7 | Lossless / RDMA | [Deadlocks in Datacenter Networks: Why Do They Form, and How to Avoid Them](#15-deadlocks-in-datacenter-networks-why-do-they-form-and-how-to-avoid-them) |
| 16 | Unit 8 | Collectives | [Collective Operations in Distributed Machine Learning (lecture slides)](#16-collective-operations-in-distributed-machine-learning-lecture-slides) |
| 17 | Unit 9 | Distributed ML | [Efficient Large-Scale Language Model Training on GPU Clusters Using Megatron-LM](#17-efficient-large-scale-language-model-training-on-gpu-clusters-using-megatron-lm) |

[Homework_1-2026.pdf](Homework_1-2026.pdf) is the Ex1 assignment sheet, not an article. Its solution is in [../ex1/](../ex1/README.md).

---

## Unit 1: Foundations of Data Center vs. Internet Networking

### 1. A Scalable, Commodity Data Center Network Architecture (Fat-Tree)

Al-Fares, Loukissas, Vahdat. SIGCOMM 2008. [PDF](A%20Scalable%2C%20Commodity%20Data%20Center%20Network%20Architecture.pdf)

- **Problem:** Hierarchical data center trees put the most expensive switches at the top and still deliver as little as 50% of the edge bandwidth. Cost grows non-linearly with cluster size.
- **Idea:** Build a fat-tree from identical commodity k-port switches. It has k pods, each with k/2 edge and k/2 aggregation switches, plus (k/2)² core switches, and supports k³/4 hosts at full bisection bandwidth. Every pair of hosts in different pods has many equal-cost paths. To spread traffic over them, switches use two-level (prefix/suffix) routing tables, and flows are classified and scheduled so that a few large flows do not collide.
- **Result:** Full bisection bandwidth at lower cost than hierarchical designs, with no changes to hosts and full Ethernet/IP/TCP compatibility. The authors say more validation is needed.
- **Course link:** This is the topology that [Ex1](../ex1/README.md) generates.

---

### 2. VL2: A Scalable and Flexible Data Center Network

Greenberg et al. (Microsoft Research). SIGCOMM 2009. [PDF](VL2%20-%20A%20Scalable%20and%20Flexible%20Data%20Center%20Network.pdf)

- **Problem:** Oversubscribed trees fragment the server pool, let one service's traffic hurt its neighbours, and tie IP addresses to location, which blocks VM migration. The goal is *agility*: any server can serve any service.
- **Idea:** Give each service the illusion of one big Layer-2 switch, using three mechanisms: flat addressing (application addresses are separate from location addresses and resolved through a directory service), Valiant Load Balancing over a Clos fabric (each flow takes a random intermediate switch), and address resolution done in the end-host stack instead of in the switches.
- **Result:** The design uses existing switch hardware, and a prototype shuffles terabytes of data among servers at close to the maximum possible rate. It is driven by measurements from a production cloud (see paper 3).

---

### 3. Network Traffic Characteristics of Data Centers in the Wild

Benson, Akella, Maltz. IMC 2010. [PDF](Network%20Traffic%20Characteristics%20of%20Data%20Centers%20in%20the%20Wild.pdf)

- **Study:** SNMP, topology, and packet traces from 10 data centers: 3 university, 2 enterprise, and 5 cloud (some serving web applications, some running MapReduce).
- **Findings:**
  - Packet arrivals at edge switches are ON/OFF with heavy-tailed durations.
  - Most flows are small, and many last only milliseconds.
  - Cloud data centers keep most traffic (80%) inside the rack, while campus and private enterprise data centers send 40–90% of traffic outside the rack.
  - Core links are the busiest and vary the most, while edge and aggregation links are lightly loaded.
  - Losses occur even on lightly loaded links (and are highest at the aggregation layer) because the traffic is bursty.
- **Implications:** Full bisection bandwidth is not essential for current applications. Centralized flow-by-flow routing struggles with flow arrival rates and short flow durations.

---

## Unit 2: AI Factories: Motivation and Challenges

### 4. RDMA over Ethernet for Distributed AI Training at Meta Scale

Gangidi et al. (Meta). SIGCOMM 2024. [PDF](RDMA%20over%20Ethernet%20for%20Distributed%20AI%20Training%20at%20Meta%20Scale.pdf)

- **Topology:** A dedicated RoCE "backend" network for GPU training, separate from the rest of the data center, so it can evolve with each GPU generation. Clusters hold up to 24,000–32,000 GPUs (for example, Llama 3 trained on 16,000 GPUs in a 24,000-GPU RoCE cluster). The job scheduler is made topology-aware.
- **Routing:** The paper tells a sequence of attempts. Default ECMP gave poor and inconsistent link utilization, because training traffic is bursty and has few flows. They tried path pinning, then moved to Enhanced ECMP (hashing on the RoCE destination QP with QP scaling) and a centralized traffic-engineering (TE) controller: TE is primary for ranking AI zones (with E-ECMP as backup on link failure), while E-ECMP is primary at full DC scale. They are now evaluating hardware flowlet switching.
- **Transport:** DCQCN was hard to tune for collectives. They turned it off and used receiver-driven traffic admission inside the collective library (NCCL), co-tuned with network settings. In four years, production training traffic has not persistently triggered PFC from the deep-buffer spine switches.
- **Operations:** Observability tooling and troubleshooting stories. A table links each collective (All-to-All, All-Reduce, All-Gather, Reduce-Scatter) to its traffic pattern and topology needs.

---

### 5. Alibaba HPN: A Data Center Network for LLM Training

Qian et al. (Alibaba Cloud). SIGCOMM 2024. [PDF](Alibaba%20HPN%20-%20A%20Data%20Center%20Network%20for%20LLM%20Training.pdf)

- **Problem:** LLM training produces a few periodic, very bursty flows per host, up to 400 Gbps each, instead of millions of small flows. This low entropy makes ECMP hash polarization likely, which leaves traffic uneven. Training is also synchronous, so a single ToR failure can stall a whole job.
- **Idea:**
  - A 2-tier, dual-plane architecture connects 15K GPUs in one Pod, which would normally need 3 tiers. This avoids hash polarization and shrinks the path-selection search space.
  - A non-stacked dual-ToR design removes the ToR as a single point of failure.
  - Rail-optimized wiring on 51.2 Tbps chips keeps about 1K GPUs under one tier-1 network, which covers 96.3% of their jobs.
- **Result:** Deployed for over eight months with no ToR-related single-node failure. End-to-end training throughput is 14.9% higher than in their previous network.
- **Course link:** Compare with Meta's approach to the same problem (paper 4).

---

## Unit 3: Architecture

### 6. Jupiter Rising: A Decade of Clos Topologies and Centralized Control in Google's Datacenter Network

Singh et al. (Google). SIGCOMM 2015 / CACM 2016. [PDF](Jupiter%20Rising%20-%20Decade%20of%20Clos%20Topologies%20in%20Google%20Datacenter%20Network.pdf)

- **Problem:** Google's traffic doubled roughly every year (50× since 2008), and no vendor switch could keep up at any price.
- **Idea:** Three principles across five generations of fabrics: multi-stage Clos topologies built from merchant switch silicon, a centralized control plane that pushes one global configuration to all switches (instead of distributed routing protocols), and modular hardware that is reused for inter-cluster and WAN networks.
- **Result:** 100× capacity growth to over 1 Pbps bisection bandwidth, deployed at dozens of sites. The paper also covers operational lessons: control-software failures at scale, aging hardware, and misconfiguration.
- **Why read it:** It is the industrial counterpart to the fat-tree paper, and an early example of SDN-style control.

---

### 7. RNG: Flat Datacenter Networks at Scale

Bernardi et al. (Amazon Web Services). arXiv 2026. [PDF](RNG%20-%20Flat%20Datacenter%20Networks%20at%20Scale.pdf)

- **Problem:** Fat trees lack capacity fungibility. A subtree can only reach the rest of the network through its few uplinks, so capacity is stranded even under uniform all-to-all traffic. Flat expander graphs fix this, but they have been held back by routing, cabling, and unpredictable performance.
- **Idea:** RNG wires switches into quasi-random graphs. Its Spraypoint routing algorithm is fully distributed and finds many edge-disjoint paths between endpoints. A passive optical ShuffleBox keeps cabling complexity close to that of a fat tree. Analytical models let operators size a fabric for a performance target.
- **Result:** RNG is 9–45% cheaper than a fat tree with the same oversubscription ratio and performs as well or better on transport and application benchmarks. It is now Amazon's default datacenter network for most workloads.

---

## Unit 4: Routing in Data Centers

### 8. WCMP: Weighted Cost Multipathing for Improved Fairness in Data Centers

Zhou et al. (Google, UCSD). EuroSys 2014. [PDF](WCMP%20-%20Weighted%20Cost%20Multipathing%20for%20Improved%20Fairness%20in%20Data%20Centers.pdf)

- **Problem:** ECMP splits traffic evenly across next hops. That assumes a symmetric, fault-free topology. With failures or built-in asymmetry, flows of the same size get very different bandwidth.
- **Idea:** Hash flows over next hops in proportion to the capacity behind each one. This uses information that routing protocols already distribute, and it works on today's switch silicon by replicating next-hop entries within the limited table size.
- **Result:** Up to 25× lower variation in flow bandwidth than ECMP in an OpenFlow testbed. It is complementary to dynamic schemes such as MPTCP.

---

### 9. FlowBender: Flow-level Adaptive Routing in Datacenter Networks

Kabbani, Vamanan, Hasan, Duchene. CoNEXT 2014. [PDF](FlowBender%20-%20Flow-level%20Adaptive%20Routing%20in%20Datacenter%20Networks.pdf)

- **Problem:** ECMP hashes flows to paths obliviously, so colliding long flows congest one path while others sit idle. The alternatives are costly: MPTCP burdens hosts, Hedera is too slow, and DeTail needs custom hardware.
- **Idea:** Keep routing at flow granularity, which avoids packet reordering. When a flow sees congestion, the end host triggers a rehash that moves the flow to another path. Link failures are recovered from within one retransmit timeout.
- **Result:** Fewer than 50 lines of kernel code. In simulation and on a testbed it improves average and tail latency over ECMP-class schemes without the complexity of the alternatives.

---

## Unit 5: Load Balancing

### 10. CONGA: Distributed Congestion-Aware Load Balancing for Datacenters

Alizadeh et al. (Cisco). SIGCOMM 2014. [PDF](CONGA%20-%20Distributed%20Congestion-Aware%20Load%20Balancing.pdf)

- **Problem:** Centralized schedulers are too slow, local mechanisms handle asymmetry badly, and host-based schemes are hard to deploy.
- **Idea:** Do load balancing in the leaf switches of a leaf-spine fabric. Leaf switches split TCP flows into flowlets, measure congestion on each fabric path, and exchange the measurements by piggybacking them on overlay packets. Each new flowlet is sent on the least congested path.
- **Result:** Implemented in custom ASICs. It has 5× better flow completion time than ECMP with a single link failure and 2–8× better throughput than MPTCP under incast. In leaf-spine topologies its worst-case loss against optimal routing (price of anarchy) is provably small. The paper's thesis is that fabric load balancing belongs in the network.

---

### 11. Load Balancing for AI Training Workloads

McClure et al. (Berkeley, Technion, NVIDIA). arXiv 2025. [PDF](Load%20Balancing%20for%20AI%20Training%20Workloads.pdf)

- **Problem:** NVIDIA (Spectrum-X) uses switch-based packet spraying, the Ultra Ethernet Consortium suggests host-based spraying, Google, Meta, and Alibaba each do something different, and nobody has compared them under the same conditions.
- **Study:** The authors evaluate flow, flowlet, subflow, and packet-spraying schemes, decoupled from any particular congestion-control and loss-recovery stack, on AI collective traffic.
- **Findings:**
  - Packet spraying beats all coarser granularities.
  - Switch-based and host-based spraying perform alike without failures, but host-based wins under link failure because it sees end-to-end path conditions sooner.
  - No deployed scheme keeps queues bounded at maximum utilization.
- **Contribution:** They show that a destination-based rotation discipline reaches the optimal queue bound, and they propose OFAN, a switch-based implementation.
- **Course link:** The packet-spraying side of the [AI-factory podcast](notes/topic1-podcast-ai-factory.md) (chapter 6).

---

## Unit 6: Congestion Control

### 12. DCTCP: Data Center TCP

Alizadeh et al. (Microsoft Research, Stanford). SIGCOMM 2010. [PDF](Data%20Center%20TCP%20%28DCTCP%29.pdf)

- **Problem:** Measurements on a 6,000-server production cluster show that long "background" flows fill shallow switch buffers, which delays short latency-sensitive flows and causes incast losses. Standard TCP reacts only to loss, and with a single bit of information.
- **Idea:** Switches mark packets with ECN once the queue passes a threshold. The sender estimates the fraction of marked packets and cuts its window in proportion to it, instead of halving on any mark. This gives multi-bit feedback from a single-bit signal.
- **Result:** The same or better throughput than TCP with 90% less buffer, better burst tolerance and low latency for short flows, and the ability to handle 10× more background traffic.

---

### 13. TIMELY: RTT-based Congestion Control for the Datacenter

Mittal et al. (Google, Berkeley). SIGCOMM 2015. [PDF](TIMELY%20-%20RTT-based%20Congestion%20Control%20for%20the%20Datacenter.pdf)

- **Idea:** Modern NICs can timestamp packets with microsecond accuracy, so round-trip time alone is a usable congestion signal with no switch support. TIMELY adjusts the sending rate from the RTT gradient (is delay rising or falling) to keep latency low while delivering high bandwidth. It is implemented in host software over OS-bypass NICs.
- **Result:** On a Clos testbed with PFC, it lowers 99th-percentile tail latency 9× while keeping near line-rate throughput. It beats DCTCP running in an optimized kernel by 13× on tail latency.
- **Contrast with DCTCP:** DCTCP reads queue occupancy from switches (ECN), while TIMELY infers it from end-to-end delay.

---

## Unit 7: Lossless Networks

### 14. DCQCN: Congestion Control for Large-Scale RDMA Deployments

Zhu et al. (Microsoft, Mellanox, UCSB). SIGCOMM 2015. [PDF](Congestion%20Control%20for%20Large-Scale%20RDMA%20Deployments.pdf)

- **Problem:** RDMA over Ethernet (RoCEv2) needs a drop-free network, so it relies on PFC. PFC causes head-of-line blocking and unfairness.
- **Idea:** DCQCN is an end-to-end, rate-based congestion control scheme for RoCEv2, implemented in the NIC. It reacts to ECN marks, so queues stay short and PFC is rarely triggered. The authors build a fluid model and derive guidelines for tuning switch thresholds and protocol parameters.
- **Result:** On a 3-tier Clos testbed it greatly improves throughput and fairness of RDMA traffic. It was implemented in Mellanox NICs and deployed in Microsoft's data centers.

---

### 15. Deadlocks in Datacenter Networks: Why Do They Form, and How to Avoid Them

Hu et al. (Microsoft, HKUST). HotNets 2016. [PDF](Deadlocks%20in%20Datacenter%20Networks%20-%20Why%20Do%20They%20Form%20and%20How%20to%20Avoid%20Them.pdf)

- **Problem:** PFC can deadlock when paused links form a cycle, a Cyclic Buffer Dependency (CBD). Even Clos networks are not immune: transient routing loops, for example during BGP re-routing after a link failure, can create one, and the deadlock does not clear once the loop is gone.
- **Argument:** Existing fixes remove CBD altogether through routing restrictions or many buffer classes. They are expensive and waste bandwidth. The authors show that CBD is necessary but not sufficient for deadlock. Whether a deadlock forms also depends on packet TTL, the traffic matrix, and flow rates.
- **Proposals:** TTL-based schemes, rate limiting, and limiting how far PFC pause frames propagate. This is an early position paper and admits it has no complete solution.

---

## Unit 8: Collectives

### 16. Collective Operations in Distributed Machine Learning (lecture slides)

Chen Avin. [PDF](Collectives-plain.pdf)

- **Content:** Slides on the communication primitives behind distributed training. They start from a simplified DNN as a chain of matrix multiplications and show sharding for data parallelism and tensor parallelism (row and column). Consecutive layers may need re-sharding, which is done with collectives.
- **Seven collectives**, each paired with a typical use in LLM training: Reduce, Gather, All-Reduce (gradient sync in data parallelism), All-Gather (sharing activations), Scatter, Reduce-Scatter (reduce plus distribute; All-Reduce = Reduce-Scatter + All-Gather), and All-to-All (matrix transpose, used in tensor and expert parallelism).
- **Why read it:** It gives the vocabulary needed for distributed training and AI cluster papers (such as Megatron-LM, Meta RoCE, and Alibaba HPN) and for the in-network computing parts of the podcast.

---

## Unit 9: Distributed ML

### 17. Efficient Large-Scale Language Model Training on GPU Clusters Using Megatron-LM

Narayanan et al. (NVIDIA, Stanford, Microsoft Research). SC 2021. [PDF](Efficient%20Large-Scale%20Language%20Model%20Training%20on%20GPU%20Clusters%20Using%20Megatron-LM.pdf)

- **Problem:** A model does not fit in one GPU's memory, and training it on one GPU would take years. Naive tensor or pipeline parallelism stops scaling at thousands of GPUs.
- **Idea:** Compose three forms of parallelism (PTD-P): tensor parallelism inside a server, pipeline parallelism across servers, and data parallelism on top. A new interleaved pipeline schedule improves throughput by over 10% at a similar memory footprint. Key takeaway: use tensor parallelism up to the number of GPUs per server, then pipeline parallelism to scale beyond that.
- **Result:** A 1-trillion-parameter model trains at 502 petaFLOP/s on 3,072 GPUs, 52% of theoretical peak per GPU.
- **Network relevance:** The choice of parallelism sets the traffic. Tensor parallelism needs the fast intra-server links, pipeline parallelism sends point-to-point activations, and data parallelism produces All-Reduce traffic.

# Article Summaries

Summaries of the 19 research papers and lecture decks of the course, organized to match the official syllabus on Moodle (Units 1–10). Each entry gives the problem, the core idea, the main quantitative results, and a takeaway. Every entry was checked against the paper's abstract, introduction and conclusion. The full paper table with links is in [README.md](README.md).

---

**Jump to Unit:**  
[Unit 1: Foundations](#unit-1-foundations-of-data-center-vs-internet-networking) · [Unit 2: AI Factories](#unit-2-ai-factories-motivation-and-challenges) · [Unit 3: Architecture](#unit-3-architecture) · [Unit 4: Routing](#unit-4-routing-in-data-centers) · [Unit 5: Load Balancing](#unit-5-load-balancing) · [Unit 6: Congestion Control](#unit-6-congestion-control) · [Unit 7: Lossless Networks](#unit-7-lossless-networks) · [Unit 8: Collectives](#unit-8-collectives) · [Unit 9: Distributed ML](#unit-9-distributed-ml) · [Unit 10: Extra](#unit-10-extra)

---

<a id="unit-1"></a>
## Unit 1: Foundations of Data Center vs. Internet Networking

<a id="1-a-scalable-commodity-data-center-network-architecture-fat-tree"></a>
<a id="al-fares-et-al-2008"></a>
### 1. A Scalable, Commodity Data Center Network Architecture (Fat-Tree)

Al-Fares, Loukissas, Vahdat. SIGCOMM 2008. [PDF](<A Scalable, Commodity Data Center Network Architecture.pdf>) · [MD](<markdown/A Scalable, Commodity Data Center Network Architecture.md>)

- **Problem:** Data centers are wired as trees with the most expensive switches at the top. Even with the highest-end IP switches they deliver only about 50% of the aggregate edge bandwidth (typical oversubscription is 2.5:1 to 8:1), at a cost that grows non-linearly with cluster size.
- **Idea:** Interconnect identical commodity $k$-port Ethernet switches in a fat-tree: $k$ pods, each with $k/2$ edge and $k/2$ aggregation switches, plus $(k/2)^2$ core switches. It supports $k^3/4$ hosts with $(k/2)^2$ equal-cost paths between pods. Hosts, TCP, IP and Ethernet stay unmodified. Switches get a two-level (prefix, then suffix) routing table that spreads traffic over the parallel paths, local flow classification, and a central scheduler for large flows.
- **Results:** 48-port switches support 27,648 hosts at full 1:1 bisection bandwidth. In a Click-based emulation of a $k=4$ fat-tree (16 hosts, 20 switches), random traffic reaches 75% of ideal bisection bandwidth with two-level tables, 76% with flow classification and 93% with the central scheduler, against 53% for a 3.6:1 oversubscribed tree. The paper's estimates put a 2008 fat-tree at \$0.3K per GigE port versus \$1.8K for a hierarchical design, with 56.6% less power and 56.5% less heat. The scheduler places a flow in under 0.8 ms at 27K hosts.
- **Takeaway:** Bandwidth, not compute, is the scaling bottleneck, and many cheap switches can replace a few expensive ones. The evidence is a small emulated testbed plus cost and power estimates, and the authors state that further validation is needed.
- **Course Link:** Generates the topology analyzed in [HW1](../ex1/README.md).

---

<a id="2-vl2-a-scalable-and-flexible-data-center-network"></a>
<a id="greenberg-et-al-2009"></a>
### 2. VL2: A Scalable and Flexible Data Center Network

Greenberg et al. (Microsoft Research). SIGCOMM 2009. [PDF](<VL2 - A Scalable and Flexible Data Center Network.pdf>) · [MD](<markdown/VL2 - A Scalable and Flexible Data Center Network.md>)

- **Problem:** Tree networks are oversubscribed 1:5 or more (1:80 to 1:240 at the top), which fragments the server pool. A traffic flood in one service hurts its neighbors, and topologically significant IP addresses and VLANs tie a service to a location and block VM migration. Together these prevent *agility*: assigning any server to any service.
- **Idea:** Give each service the illusion of one non-interfering Layer-2 switch. VL2 uses a Clos fabric of commodity switches running OSPF/ECMP, and adds three mechanisms: flat addressing, where a directory system maps application addresses to location addresses and a shim on each server tunnels packets; Valiant Load Balancing, where each flow bounces off a random intermediate switch; and end-system address resolution, which removes ARP broadcasts. No switch changes are needed.
- **Measurements behind the design:** In production traces, 99% of flows are under 100 MB but over 90% of bytes are in flows of 100 MB to 1 GB. Traffic matrices are highly volatile: even 50–60 representative matrices leave about 60% fitting error. Failures near the top of the hierarchy cause significant downtime.
- **Results:** On an 80-server testbed, an all-to-all shuffle of 2.7 TB among 75 servers takes 395 s, 94% of the maximum possible, with a TCP fairness index of 0.995. Flow-level VLB splits traffic within 1% of optimal fairness. OSPF reconverges in under a second after link failures, and directory updates converge within 100 ms for 70% of updates and 530 ms for 99%.
- **Takeaway:** Randomization beats traffic engineering when traffic is this unpredictable. VL2 randomizes per flow rather than per packet and relies on TCP to approximate the hose model, so it falls short of VLB theory. The experiments show this is still enough for data center traffic.

---

<a id="3-network-traffic-characteristics-of-data-centers-in-the-wild"></a>
<a id="kandula-et-al-2009"></a>
<a id="benson-et-al-2010"></a>
### 3. Network Traffic Characteristics of Data Centers in the Wild

Benson, Akella, Maltz. IMC 2010. [PDF](<Network Traffic Characteristics of Data Centers in the Wild.pdf>) · [MD](<markdown/Network Traffic Characteristics of Data Centers in the Wild.md>)

- **Study:** SNMP link statistics, topologies and packet traces from 10 data centers: 3 university, 2 private enterprise and 5 cloud (3 running Internet-facing applications, 2 running MapReduce).
- **Findings:**
  - Flows are small and short: about 80% are under 10 KB and under 11 s, although most bytes sit in the top 10% of flows. Fewer than 10,000 flows are active per second at a switch, and traffic is ON/OFF with heavy-tailed periods.
  - Locality differs by type: cloud data centers keep about 80% of server traffic inside the rack, while in university and enterprise data centers 40–90% leaves the rack.
  - Core links are the most utilized, yet at most 25% of them are hot at any time. Edge and aggregation links are lightly loaded. Losses hit links with low average utilization (microbursts), most of all at the aggregation layer.
- **Implications:** Only a fraction of the existing bisection capacity is used in any interval, even in the worst-case placement, so full bisection bandwidth is not essential for these workloads. Spreading load over the existing core links is enough to handle occasional hot spots. Centralized controllers must use parallelism and fast heuristics to keep up with flow arrival rates, which can reach millions of new flows per second.
- **Takeaway:** This is measurement evidence that pushes back on the "full bisection bandwidth for everyone" premise of the Fat-Tree and VL2 papers. The authors note that their ten data centers are not all-encompassing.

---

<a id="unit-2"></a>
## Unit 2: AI Factories: Motivation and Challenges

<a id="4-rdma-over-ethernet-for-distributed-ai-training-at-meta-scale"></a>
<a id="choudhury-et-al-2024"></a>
### 4. RDMA over Ethernet for Distributed AI Training at Meta Scale

Gangidi et al. (Meta). SIGCOMM 2024. [PDF](<RDMA over Ethernet for Distributed AI Training at Meta Scale.pdf>) · [MD](<markdown/RDMA over Ethernet for Distributed AI Training at Meta Scale.md>)

- **Problem:** AI training jobs coordinate thousands of GPUs for weeks through collectives. TCP/IP has high CPU overhead and latency, and proprietary interconnects (InfiniBand, NVSwitch, EFA) limit deployment flexibility. Training traffic has low entropy and is bursty, so default ECMP performs poorly.
- **Idea:** A dedicated RoCEv2 backend network, separate from the frontend and built on a Clos design. An AI Zone is a two-stage Clos with rack leaf switches (RTSW) and deep-buffer modular spine switches (CTSW). Zones are joined at data-center scale with topology-aware job scheduling. Routing evolved from ECMP to Enhanced ECMP with queue-pair (QP) scaling and then to centralized traffic engineering. Congestion control pivoted away from DCQCN, which was hard to tune for collectives. The 400G deployments use PFC only, plus receiver-driven traffic admission inside the collective library (NCCL) that is co-tuned with the switch configuration, with the deep spine buffers absorbing transient congestion.
- **Results:** Fragmented job placement on shared uplinks degraded training by more than 30%. E-ECMP with QP scaling improved AllReduce by up to 40% over baseline ECMP. Traffic engineering beat E-ECMP by 5–10% on AllReduce and AllToAll at 128 GPUs, and kept links evenly loaded at about 80% against 40–90% for E-ECMP. In a 16:1 incast test, receiver-driven admission produced no PFC back pressure for the Gather collective. Clusters hold thousands of GPUs; the paper cites a Llama 3 variant trained on 16,000 GPUs of a 24,000-GPU RoCE cluster, and earlier designs for up to 32,000 GPUs.
- **Takeaway:** The network must be designed around the training workload (collective patterns, flow entropy, job placement) and co-designed with the collective library. The paper is an operational experience report, so its numbers are production measurements rather than controlled comparisons.

---

<a id="5-alibaba-hpn-a-data-center-network-for-llm-training"></a>
<a id="fu-et-al-2024"></a>
### 5. Alibaba HPN: A Data Center Network for Large Language Model Training

Qian et al. (Alibaba Cloud). SIGCOMM 2024. [PDF](<Alibaba HPN - A Data Center Network for LLM Training.pdf>) · [MD](<markdown/Alibaba HPN - A Data Center Network for LLM Training.md>)

- **Problem:** LLM training produces a few periodic, bursty flows per host that can reach the 400 Gbps NIC capacity. This low entropy makes ECMP prone to hash polarization. Synchronous training is also fragile: one anomaly stalls every GPU, ToR-related single points of failure matter most, and a fault costs about 20× more than in general cloud computing.
- **Idea:** A non-stacked dual-ToR design, where each NIC connects to two ToRs that do not synchronize directly, removes the ToR single point of failure. A rail-optimized tier 1 puts 1,024 GPUs in one segment, which covers 96.3% of training jobs. A 2-tier dual-plane aggregation layer interconnects 15K GPUs per pod instead of a 3-tier Clos, which eliminates hash polarization in the aggregation layer and shrinks the path-selection search space by 1–2 orders of magnitude.
- **Results:** Deployed in production for over eight months with no ToR-related single-point failure. End-to-end training throughput is 14.9% higher than on the previous traditional network (measured on a job of 2,300+ GPUs).
- **Takeaway:** For LLM training, fewer network tiers and failure isolation matter more than raw scale-out flexibility. The 14.9% figure comes from one production comparison, not a controlled benchmark.

---

<a id="unit-3"></a>
## Unit 3: Architecture

<a id="6-jupiter-rising-a-decade-of-clos-topologies-and-centralized-control-in-googles-datacenter-network"></a>
<a id="singh-et-al-2015"></a>
### 6. Jupiter Rising: A Decade of Clos Topologies and Centralized Control in Google's Datacenter Network

Singh et al. (Google). SIGCOMM 2015 / CACM 2016. [PDF](<Jupiter Rising - Decade of Clos Topologies in Google Datacenter Network.pdf>) · [MD](<markdown/Jupiter Rising - Decade of Clos Topologies in Google Datacenter Network.md>)

- **Problem:** Server traffic grew about 50× since 2008, roughly doubling every year, while network scale was capped by the cost and capacity of the biggest commercial switches. In the authors' words, they could not buy a network at any price that met their needs.
- **Idea:** Five generations of fabrics (Firehose, Watchtower, Saturn, Jupiter) built on three principles. Multi-stage Clos topologies are assembled from merchant switch silicon and refreshed with each chip generation. Centralized control replaces complex distributed routing: a global configuration is pushed to every switch, and a dynamically elected node collects link state. Modular hardware is reused for inter-cluster and wide-area networks.
- **Results:** Fabric capacity grew about 100× in ten years, reaching more than 1 Pbps of bisection bandwidth (1.3 Pbps for Jupiter's 40G fabric) at dozens of sites worldwide.
- **Takeaway:** Single-operator, pre-planned data centers do not need general-purpose routing protocols, so centralization simplifies both control and management. This anticipated SDN. The CACM version is a condensed retrospective, and the details are in the SIGCOMM paper.

---

<a id="7-rng-flat-datacenter-networks-at-scale"></a>
<a id="zhao-et-al-2024"></a>
<a id="bernardi-et-al-2026"></a>
### 7. RNG: Flat Datacenter Networks at Scale

Bernardi, Mahajan, Seshadhri et al. (Amazon Web Services). arXiv 2026. [PDF](<RNG - Flat Datacenter Networks at Scale.pdf>) · [MD](<markdown/RNG - Flat Datacenter Networks at Scale.md>)

- **Problem:** Fat-trees lack capacity fungibility: traffic between two endpoints is confined to a small subset of links. Operators must therefore choose between expensive non-blocking fabrics and oversubscribed fabrics that congest. Flat expander topologies fix this at lower cost, but they were not practical: shortest-path routing wastes path diversity, $k$-shortest-paths needs about 10× more table memory than commodity switches have, cabling is complex and hard to expand, and performance was hard to predict.
- **Idea:** RNG is a flat quasi-random graph of commodity routers with three parts. Spraypoint is a distributed, demand-oblivious routing protocol that finds close to node-degree many edge-disjoint paths. ShuffleBox is a passive optical device that shuffles fibers internally, so cabling complexity matches that of fat-trees. Models of path length, disjoint paths and oversubscription let operators design a fabric for a performance target.
- **Results:** Two production fabrics are deployed at Amazon. Transport and storage-application benchmarks match fat-tree performance despite variable path lengths. At equal oversubscription RNG is 9–45% cheaper than fat-trees, and the saving is independent of network size and switch radix. In simulation RNG's throughput is as much as 30% higher for clique and hub traffic, with a few low-load cases where fat-trees are 5–10% better. RNG is now Amazon's default network for most workloads.
- **Takeaway:** Giving up the Clos hierarchy buys cost and fault tolerance, provided routing and cabling are redesigned to match. The throughput gain depends on the traffic pattern.

---

<a id="unit-4"></a>
## Unit 4: Routing in Data Centers

<a id="8-wcmp-weighted-cost-multipathing-for-improved-fairness-in-data-centers"></a>
<a id="zhou-et-al-2014"></a>
### 8. WCMP: Weighted Cost Multipathing for Improved Fairness in Data Centers

Zhou et al. (Google, UC San Diego). EuroSys 2014. [PDF](<WCMP - Weighted Cost Multipathing for Improved Fairness in Data Centers.pdf>) · [MD](<markdown/WCMP - Weighted Cost Multipathing for Improved Fairness in Data Centers.md>)

- **Problem:** ECMP splits traffic evenly across next hops, which assumes a symmetric, fault-free topology with equal capacity behind every next hop. Link failures and imbalanced striping (switch counts not divisible by uplink counts) break this assumption. Even same-size flows then get very different bandwidth, which hurts applications and makes the network hard to diagnose.
- **Idea:** Weighted Cost Multipathing hashes flows across next hops in proportion to the link capacity available toward the destination. The weights come from the routing protocol's view of the topology and are realized by replicating next-hop entries in the existing ECMP multipath table, with no hardware change. Weight-reduction algorithms trade a small oversubscription for far fewer table entries (a 5% allowance already helps a lot), and striping guidelines improve balance.
- **Results:** On a 10 Gb/s OpenFlow testbed with TCP, MPTCP and real data center traces, WCMP reduces the variation in flow bandwidth by up to 25× relative to ECMP.
- **Takeaway:** WCMP corrects the long-lived asymmetry caused by failures and striping, and its reaction speed is limited by the routing protocol. It complements dynamic schemes such as Hedera and MPTCP.

---

<a id="9-flowbender-flow-level-adaptive-routing-in-datacenter-networks"></a>
<a id="kabbani-et-al-2014"></a>
### 9. FlowBender: Flow-level Adaptive Routing in Datacenter Networks

Kabbani, Vamanan, Hasan, Duchene. CoNEXT 2014. [PDF](<FlowBender - Flow-level Adaptive Routing in Datacenter Networks.pdf>) · [MD](<markdown/FlowBender - Flow-level Adaptive Routing in Datacenter Networks.md>)

- **Problem:** ECMP maps each flow to a path statically. A few long flows can collide and cause lasting congestion while other paths idle. The alternatives each have a cost: MPTCP adds host complexity and slows short flows, Hedera depends on a slow central controller, DeTail needs custom switch hardware, and random packet scatter causes heavy reordering.
- **Idea:** Keep each flow on one path, which preserves packet order, and re-route it only when it is congested or its path fails. The sender detects congestion from the fraction of ECN-marked packets per RTT, and failures from TCP timeouts. To move the flow, it changes a flexible header field (such as TTL) that the switches' ECMP hash already includes, which sends the flow to a new path.
- **Results:** No switch silicon changes are needed, only about 50 lines of Linux kernel code and an ECMP hash configuration. In ns-3 simulation, FlowBender cuts tail latency by 5–20× relative to ECMP and makes partition-aggregate jobs 2–4× faster on average, close to DeTail and random packet scatter. A real implementation cuts the tail flow completion time of large flows by about 40%. It reroutes at RTT granularity and recovers from link failures within about one RTO.
- **Takeaway:** Because a few long flows account for most of the bytes, re-balancing only those flows, end-to-end, captures most of the benefit.

---

<a id="unit-5"></a>
## Unit 5: Load Balancing

<a id="10-conga-distributed-congestion-aware-load-balancing-for-datacenters"></a>
<a id="alizadeh-et-al-2014"></a>
### 10. CONGA: Distributed Congestion-Aware Load Balancing for Datacenters

Alizadeh et al. (Cisco). SIGCOMM 2014. [PDF](<CONGA - Distributed Congestion-Aware Load Balancing.pdf>) · [MD](<markdown/CONGA - Distributed Congestion-Aware Load Balancing.md>)

- **Problem:** ECMP decides locally, with no knowledge of congestion downstream, so it handles asymmetry from link failures badly (failures can cut delivered traffic by up to 40%). Centralized schemes are too slow for datacenter traffic, local congestion-aware schemes can be worse than ECMP, and host-based MPTCP is hard to deploy and hurts incast.
- **Idea:** CONGA runs in the leaf switches of a 2-tier leaf-spine fabric. Leaves split TCP flows into flowlets, measure per-link load with the Discounting Rate Estimator (DRE), and exchange per-path congestion leaf-to-leaf by piggybacking it on packets in the overlay (VXLAN) header. Each new flowlet takes the least congested path. No TCP changes are needed.
- **Results:** CONGA is implemented in custom ASICs. In testbed experiments it achieves 5× better flow completion time than ECMP even with a single link failure, and 2–8× better throughput than MPTCP under incast. The Price of Anarchy is provably small in leaf-spine topologies, so CONGA is nearly as effective as a centralized scheduler while reacting in microseconds.
- **Takeaway:** Load balancing is best done in the network, with global congestion information. Leaf-to-leaf feedback is near-optimal for 2-tier fabrics, and for larger topologies the authors leave the extension to future work.

---

<a id="11-load-balancing-for-ai-training-workloads"></a>
<a id="load-balancing-for-ai-training-workloads-slide-deck"></a>
### 11. Load Balancing for AI Training Workloads

McClure, Cohen, Shpiner, Silberstein, Shenker, Ratnasamy, Keslassy (UC Berkeley, Technion, NVIDIA). arXiv 2025. [PDF](<Load Balancing for AI Training Workloads.pdf>) · [MD](<markdown/Load Balancing for AI Training Workloads.md>)

- **Problem:** AI fabrics are moving from one path per flow (ECMP, enhanced ECMP, PLB) toward packet spraying: Nvidia Spectrum-X sprays in the switch and the Ultra Ethernet Consortium considers host-based spraying. There is no consensus on which design wins, under which conditions, or how far any of them is from optimal.
- **Study:** Packet-level simulation of flow, flowlet, subflow and per-packet load balancing, implemented in switches and in hosts, on AI collective traffic, with load balancing decoupled from the transport stack.
- **Findings:** Packet spraying dominates flow, flowlet and subflow granularities. Switch-based and host-based spraying perform alike without failures. Under link failure host-based spraying wins, unless routing converges very fast (within a few RTTs). No existing scheme achieves the optimal $O(1)$ average queue size at maximum utilization.
- **Contribution:** A destination-based rotation discipline reaches $O(1)$ queues, and OFAN is a switch implementation of it. OFAN improves completion times and makes them more predictable than the other spraying schemes.
- **Takeaway:** Convergence speed after failures is a first-order metric for switch vendors, and queue-size optimality gives a yardstick for future schemes.

---

<a id="unit-6"></a>
## Unit 6: Congestion Control

<a id="12-dctcp-data-center-tcp"></a>
<a id="alizadeh-et-al-2010"></a>
### 12. Data Center TCP (DCTCP)

Alizadeh et al. (Microsoft Research, Stanford). SIGCOMM 2010. [PDF](<Data Center TCP (DCTCP).pdf>) · [MD](<markdown/Data Center TCP (DCTCP).md>)

- **Problem:** Measurements of a production cluster of about 6,000 servers (over 150 TB of traces) show 99.91% TCP traffic and three impairments on shallow-buffered commodity switches. Incast hits synchronized partition/aggregate responses. Queue buildup lets long flows delay short flows even without loss. Buffer pressure lets long flows on other ports eat the shared buffer. Query flows have deadlines of roughly 10–100 ms.
- **Idea:** Switches mark packets with ECN whenever the instantaneous queue exceeds a single threshold $K$. Each sender keeps a running estimate $\alpha \leftarrow (1-g)\alpha + gF$ of the fraction $F$ of marked packets per window and cuts its window by $\alpha/2$, i.e. $cwnd \leftarrow cwnd(1-\alpha/2)$, instead of halving it. This extracts multi-bit congestion feedback from single-bit marks.
- **Results:** At 1 and 10 Gbps on commodity switches, DCTCP matches or beats TCP throughput with 90% less buffer space. It handles 10× the background traffic without hurting foreground traffic, and 10× more foreground traffic causes no timeouts, which largely eliminates incast.
- **Takeaway:** Persistently low buffer occupancy and high throughput can coexist if the sender reacts in proportion to the extent of congestion. DCTCP is designed for the single-operator data center only, and the authors make no claims for wide-area networks.

---

<a id="13-timely-rtt-based-congestion-control-for-the-datacenter"></a>
<a id="mittal-et-al-2015"></a>
### 13. TIMELY: RTT-based Congestion Control for the Datacenter

Mittal et al. (Google, UC Berkeley). SIGCOMM 2015. [PDF](<TIMELY - RTT-based Congestion Control for the Datacenter.pdf>) · [MD](<markdown/TIMELY - RTT-based Congestion Control for the Datacenter.md>)

- **Problem:** A good congestion signal must be fine-grained, discriminative and easy to deploy. ECN is a one-bit signal that needs switch support, while RTT was long considered too noisy at microsecond scale to use in a data center.
- **Idea:** Modern NICs provide hardware timestamps and hardware-generated ACKs, so RTTs can be measured with microsecond accuracy and track switch queueing closely. TIMELY is rate-based and reacts to the gradient of the RTT (normalized by the minimum RTT) instead of a fixed RTT threshold. It increases the rate additively when the gradient is flat or negative and decreases it proportionally to the gradient otherwise, with low and high RTT thresholds and a hyperactive-increase mode.
- **Results:** Tested on OS-bypass RDMA over hundreds of machines on a Clos network with PFC. Turning on TIMELY lowers 99th-percentile tail latency by 9× compared with the PFC-only fabric while keeping near line-rate throughput, and its tail latency is 13× lower than DCTCP running in an optimized kernel. It is, to the authors' knowledge, the first delay-based congestion control for the data center.
- **Takeaway:** Delay is a trustworthy datacenter congestion signal once the hardware measures it precisely, and it needs no switch support. The authors flag open questions about RTT's effectiveness as link speeds grow by another order of magnitude.

---

<a id="unit-7"></a>
## Unit 7: Lossless Networks

<a id="14-dcqcn-congestion-control-for-large-scale-rdma-deployments"></a>
<a id="zhu-et-al-2015"></a>
### 14. Congestion Control for Large-Scale RDMA Deployments (DCQCN)

Zhu et al. (Microsoft, Mellanox, UC Santa Barbara). SIGCOMM 2015. [PDF](<Congestion Control for Large-Scale RDMA Deployments.pdf>) · [MD](<markdown/Congestion Control for Large-Scale RDMA Deployments.md>)

- **Problem:** RoCEv2 carries RDMA over IP-routed Ethernet, which must be lossless, and PFC provides that. PFC is coarse (per port and priority), so it causes congestion spreading, head-of-line blocking and unfairness. Existing schemes do not fit: QCN does not support L3 networks, and DCTCP and iWarp use slow start and (for DCTCP) run in software with high CPU cost.
- **Idea:** DCQCN is an end-to-end, rate-based congestion control implemented entirely in the NIC. Switches use standard RED/ECN marking, the receiver NIC returns congestion notification packets (CNPs), and the sender NIC cuts its rate and then recovers it in stages through timers. It starts at line rate with no slow start. The paper derives how to set the PFC and ECN buffer thresholds and uses a fluid model to tune the parameters.
- **Results:** On a 3-tier Clos testbed, DCQCN markedly improves throughput and fairness for RoCEv2 traffic and in some scenarios handles up to 16× more user traffic. It is implemented in Mellanox NICs and is being deployed in Microsoft's data centers.
- **Takeaway:** PFC stays as a fast, blunt safety net that prevents loss just in time, while DCQCN slowly adjusts rates so that PFC is not triggered persistently. The result is both responsive in the short term and stable in the long term.

---

<a id="15-deadlocks-in-datacenter-networks-why-do-they-form-and-how-to-avoid-them"></a>
<a id="gupta-et-al-2021"></a>
<a id="hu-et-al-2016"></a>
### 15. Deadlocks in Datacenter Networks: Why Do They Form, and How to Avoid Them

Hu, Zhu, Cheng, Guo, Tan, Padhye, Chen (Microsoft, HKUST). HotNets 2016. [PDF](<Deadlocks in Datacenter Networks - Why Do They Form and How to Avoid Them.pdf>) · [MD](<markdown/Deadlocks in Datacenter Networks - Why Do They Form and How to Avoid Them.md>)

- **Problem:** PFC can deadlock a lossless network. In a cyclic buffer dependency (CBD) each switch holds the buffer its upstream neighbor needs while waiting for its downstream neighbor, and throughput drops to zero. Deadlocks persist even after the trigger is fixed. Clos networks with valley-free routing were thought safe, but transient loops during BGP re-routing after link failures, or during SDN updates, create CBDs. Existing proactive fixes eliminate CBD itself: routing restrictions waste bandwidth, and buffer-class schemes need more lossless classes than commodity switches provide (about 2).
- **Analysis:** This is a position paper that asks for the sufficient conditions of deadlock, not only the necessary one. Three case studies show that CBD is necessary but not sufficient. A looping flow deadlocks only if its rate exceeds a threshold set by the loop length, link bandwidth and TTL: $r > nB/\mathrm{TTL}$, which is 5 Gbps for a 2-hop loop on a 40 Gbps link with TTL 16, confirmed on a testbed. Whether four flows deadlock depends on the traffic matrix, as ns-3 simulations show. A rate limit can prevent a deadlock.
- **Mitigations:** Heuristic and not formally proven: lower or class-specific TTLs, rate limiting, and limiting PFC propagation.
- **Takeaway:** Avoiding CBD is too conservative a goal, but the authors say they have no complete characterization of the sufficient conditions and mainly want to re-ignite research on the problem.

---

<a id="unit-8"></a>
## Unit 8: Collectives

<a id="16-collective-operations-in-distributed-machine-learning-lecture-slides"></a>
<a id="collectives-slide-deck"></a>
### 16. Collective Operations in Distributed Machine Learning (Lecture Slides)

Chen Avin. [PDF](<Collectives-plain.pdf>) · [MD](<markdown/Collectives-plain.md>)

- **Overview:** Lecture slides on the communication primitives behind distributed LLM training, and where each arises in data, tensor, pipeline and mixture-of-experts (expert) parallelism.
- **Collectives:** Reduce, Gather, All-Reduce, All-Gather, Scatter, Reduce-Scatter and All-to-All, each with its semantics and an LLM use case. For example, All-Reduce synchronizes gradients in data parallelism, All-Gather and Reduce-Scatter appear in tensor (model) parallelism, and All-to-All routes tokens to experts in mixture-of-experts models.
- **Algorithms:** The slides compare implementations in the $\alpha$–$\beta$ (latency–bandwidth) cost model: a complete-graph model, the parameter server, the ring algorithm for All-Reduce (reduce-scatter followed by all-gather), recursive doubling and Bruck's algorithm for All-Gather and All-to-All, and recursive halving. They follow the MPICH collective optimization paper by Thakur et al.
- **Takeaway:** Collective performance depends on the algorithm and on the network under it. Current Ethernet networks are not optimized for collectives, routing, congestion control, error recovery, topology and scheduling for them are little studied, and a single failure can fail the whole collective.

---

<a id="unit-9"></a>
## Unit 9: Distributed ML

<a id="17-efficient-large-scale-language-model-training-on-gpu-clusters-using-megatron-lm"></a>
<a id="narayanan-et-al-2021"></a>
### 17. Efficient Large-Scale Language Model Training on GPU Clusters Using Megatron-LM

Narayanan et al. (NVIDIA, Stanford, Microsoft Research). SC 2021. [PDF](<Efficient Large-Scale Language Model Training on GPU Clusters Using Megatron-LM.pdf>) · [MD](<markdown/Efficient Large-Scale Language Model Training on GPU Clusters Using Megatron-LM.md>)

- **Problem:** Large models do not fit in one GPU's memory, and training them would take unrealistically long (GPT-3 would need about 288 years on one V100). Tensor parallelism alone breaks down across servers: its all-reduce crosses slower inter-server links and the matrix multiplications get small. Pipeline parallelism wastes up to 50% of the time in the pipeline flush at the end of each batch.
- **Idea:** PTD-P composes tensor parallelism inside a multi-GPU server (over NVLink), pipeline parallelism across servers, and data parallelism on top. An interleaved 1F1B schedule gives each device several model chunks, which shrinks the pipeline bubble by the interleaving factor at the price of proportionally more communication. A scatter/gather optimization recovers that cost by splitting tensors across the server's eight InfiniBand cards. The guidelines are: use tensor parallelism up to the number of GPUs per server and then pipeline parallelism; make the model-parallel size just large enough to fit memory and scale out with data parallelism; tune the microbatch size per model.
- **Results:** A 1-trillion-parameter model trains at 502 petaFLOP/s on 3,072 A100 GPUs (163 teraFLOP/s per GPU, 52% of peak), an estimated three months end to end. The interleaved schedule improves throughput by over 10%, and a poor tensor/pipeline split can halve throughput. The approach beats ZeRO-3 by 70% on 175B and 530B-parameter models because it communicates less across nodes.
- **Network Relevance:** Training is communication-intensive: at 3,072 GPUs the run used about 892 GB/s of effective bisection bandwidth for pipeline-parallel traffic and 13 TB/s for data-parallel traffic. Tensor-parallel all-reduce stays on NVLink inside a server, pipeline stages exchange point-to-point tensors across servers, and data parallelism adds periodic all-reduce across replicas.

---

<a id="unit-10"></a>
## Unit 10: Extra

<a id="18-csig-congestion-signaling-for-datacenter-transports"></a>
<a id="ravi-et-al-2026"></a>
### 18. CSIG: Congestion Signaling for Datacenter Transports

Ravi, Dukkipati, Pang, Cardwell, Karp et al. (Google). SIGCOMM 2026. [PDF](<CSIG - Congestion Signaling for Datacenter Transports.pdf>)

- **Problem:** Burst-heavy datacenter workloads, especially AI/ML, need congestion signals that are fine-grained in time (within an RTT), in resolution (multi-bit) and in space (at the bottleneck switch, not summed along the path). For two decades such in-band signaling has failed to reach production because of a fidelity versus deployability trade-off. XCP and RCP needed special L3/L4 switch processing, P4-INT and IFA use variable-length headers that clash with NIC offloads and tunneling, and ECN is easy to deploy but a single bit, which forces control loops to average it.
- **Idea:** CSIG has two parts. The CSIG tag is a fixed-length Layer-2 header (the compact variant is the size of one VLAN tag) in which every switch on the path performs a line-rate compare-and-replace, keeping only the most severe value of a chosen signal, such as minimum available bandwidth or maximum hop delay, together with the location of the bottleneck. CSIG Reflection is an L4 header in which the receiver returns the signal to the sender. Decoupling the two lets transports such as TCP, PonyExpress and Falcon evolve their control loops without touching switches. The signal comes from high-precision switch telemetry, which is native in new ASICs or software-assisted on fixed-function ASICs dating back to 2010.
- **Results:** The tag costs under 0.2% of bandwidth for 4K/9K MTUs. It is validated on five generations of switch silicon (up to 102.4 Tbps), four NIC generations and five transport stacks. Fast Ramp-Up, a congestion control primitive that uses the available-bandwidth signal to grow the window quickly and safely, cuts median RPC latency by up to 20% and unclaimed bandwidth by up to 60% in a production distributed-inference workload. Using the bottleneck location for load balancing reduces tail latency by 2.5× and unstable path switching by 3.75×. Embedding the signal in every packet lets operators map an individual RPC to the topology tier that limits it.
- **Takeaway:** Signaling only the path bottleneck, in a fixed-size L2 header, gives most of the benefit of full in-band telemetry at a deployable cost, and it improves both transports and observability. The protocol is being standardized with industry partners. The results are from Google's own production environment.

---

<a id="19-harvest-adaptive-photonic-switching-schedules-for-collective-communication-in-scale-up-domains"></a>
<a id="rahman-et-al-2026"></a>
### 19. Harvest: Adaptive Photonic Switching Schedules for Collective Communication in Scale-up Domains

Rahman, Joseph, Kodkani, Arzani, Addanki (Purdue University, Microsoft Research). SIGCOMM 2026. [PDF](<Harvest - Adaptive Photonic Switching Schedules for Collective Communication in Scale-up Domains.pdf>)

- **Problem:** Chip-to-chip silicon photonics offer more bandwidth and energy efficiency than electrical links for the GPUs of a scale-up domain, but they are circuit-switched. A static photonic topology suffers congestion from multi-hop forwarding. A topology that reconfigures to give each communicating pair a direct optical path removes congestion, but every reconfiguration costs time. Prior work either ignores that delay, avoids reconfiguring during a collective, or optimizes over an aggregate traffic matrix, which hides the step-by-step structure of collectives.
- **Idea:** Treat each step of a collective as a matching, so that the collective is a weighted sequence of matchings, and express each step's completion time through maximum concurrent flow. This yields the classic $\alpha$–$\beta$ cost model extended with congestion, propagation delay and a reconfiguration delay per topology change. Harvest then synthesizes the schedule offline with a dynamic program over contiguous ranges of steps. Each subproblem picks the best topology for a range of steps without reconfiguration, formulated as a mixed-integer second-order conic program. This applies to arbitrary collective algorithms in domains of about 8 to 64 GPUs.
- **Results:** Across Swing, Recursive Doubling, Bine butterflies, binomial trees and Bruck's algorithm, the synthesized schedules cut collective completion time by up to 2× against the best of a static topology and a reconfigure-at-every-step schedule. For Recursive Doubling AllReduce the schedule is provably optimal and computable in polylogarithmic time, within tens of microseconds even for 1,024 GPUs. A testbed with NVIDIA GPUs measures the synchronization overhead of reconfiguring mid-collective at only a few microseconds. The evaluation uses Astra-Sim, Gurobi and hardware emulation, and the artifacts are public.
- **Takeaway:** Whether reconfiguration pays off depends on when and how it is applied, and the answer depends on the reconfiguration delay of the photonic technology, which the model takes as a parameter. The evidence is simulation and emulation, not a deployed photonic fabric.

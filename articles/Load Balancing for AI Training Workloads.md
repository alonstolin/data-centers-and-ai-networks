# **Load Balancing for AI Training Workloads**

### Sarah McClure [1] Evyatar Cohen [2] Alexander Shpiner [3] Mark Silberstein [2] [,] [3] Scott Shenker [1] [,] [4] Sylvia Ratnasamy [1] Isaac Keslassy [1] [,] [2]

1 _UC Berkeley_ 2 _Technion_ 3 _NVIDIA_ 4 _ICSI_

## Abstract

The extreme bandwidth demands of AI training has made
load-balancing a critical component in AI fabrics, and a variety
of load-balancing designs have emerged in recent work from
both industry and research. However, there is currently little
consensus on which design approach dominates or the conditions under which an approach dominates. We also lack an
understanding of how far these approaches are from optimal.

We provide a technical foundation for answering these
questions by systematically evaluating leading load-balancing
designs, while decoupling them from specific congestion control and loss recovery stacks. We find that load-balancing based
on packet spraying dominates traditional approaches that
load balance traffic at flow, flowlet, or subflow granularities.
When comparing host- vs switch-based approaches to packet
spraying, we find that they perform similarly in failure-free
scenarios but that a host-based approach dominates under
link failure because of its rapid visibility into end-to-end path
conditions. We also identify that no leading approach achieves
optimal _𝑂_ (1) queue scaling at maximum utilization. We
demonstrate why a destination-based rotation (DR) discipline
can reach this optimum and introduce OFAN, a switchbased implementation of DR that we show offers valuable
performance gains over other packet spraying approaches.

## 1 Introduction

Historically, TCP’s intolerance for packet reordering has
necessitated a rigid single-path-per-flow paradigm. While the
downsides of this constraint have long been recognized and
various alternatives proposed, network solutions have continued to respect this limitation, ranging from standard ECMP to
more recent proposals like Meta’s enhanced ECMP [26] and
Google’s PLB [70]. These approaches improve performance
by shifting path assignments, but still pin a flow to a single
path at any given time. However, the extreme bandwidth
demands of AI workloads are forcing operators to abandon
this paradigm in favor of aggressive packet-level spraying.

AI workloads pose extreme requirements on the network to
limit the worst-case completion time among flows. The needs
of AI workloads (which we discuss more thoroughly in §2)
have led to active exploration, mostly in industry, of designs
that go beyond the single-path paradigm. Here we mention two

efforts in particular. The Ultra Ethernet Consortium (UEC)

[2] is considering new transport designs that include packet
spraying and packet trimming [4, 17]. Nvidia has developed
Spectrum-X which uses a switch-based packet-spraying
approach and RDMA NICs that accommodate out-of-order
delivery [60, 65]. These efforts suggest that we are finally
seeing a broad appetite in industry to consider load balancing
techniques that no longer restrict packet flows to a single path.

Still, we were surprised to find that many basic design
questions remain open. For instance, while it seems clear
that packet spraying is a robust technique for spreading load
along all suitable paths, we were not able, in our literature
search, to find answers to such key questions as: (i) How do
state-of-the-art load-balancing approaches compare when
not coupled with a particular network stack? (ii) Is it better
to implement packet spraying in switches (as in Spectrum-X
and pFabric [8]) or in hosts (as in NDP [30] and REPS [11])?
(iii) Do the benefits of (various forms of) packet spraying
remain when we introduce failures or the workload creates
incast? (iv) Is failure (and other asymmetry) best handled
in the network on in the host? (v) And how sensitive are
performance differences to the nature of the workload and
network parameters such as packet size and buffer size?

The ongoing industry efforts suggest there is a lack of
consensus on these questions. For instance, Nvidia supports
switch-based packet spraying; the UEC suggests host-based
spraying; Google’s Falcon design [49] uses host-implemented
path adaptation as in PLB [70] but does not use packet spraying; Meta uses an enhanced ECMP and traffic engineering
(TE) [26]; Alibaba uses oblivious packet spraying [53] and
a host-managed and topology-aware subflow approach [69];
and ByteDance uses switch-based, congestion-aware global
load balancing [68].

Beyond the lack of industry consensus on specific implementations, there is currently no rigorous understanding of
whether existing load-balancing contenders represent the
theoretical limit of performance for AI training. Specifically,
it remains unclear how close these current solutions are to an
optimal bound. Quantifying this gap is essential; it provides
the necessary roadmap to determine whether the community
should continue designing novel load-balancing schemes,
focus on the incremental optimization of existing ones, or
pivot toward entirely new architectural directions.

1

,

Answering such questions is challenging because it requires
decoupling load balancing from the other aspects of a transport
protocol (such as congestion control and loss recovery). Given
the competitive and evolving nature of the AI market, we
cannot expect complete agreement on all aspects of transport.
However, it would be extremely valuable for the ecosystem
if datacenter operators knew whether to implement host-based
load balancing, or require specific primitives from switch
vendors. This paper is about providing a technical foundation
for such a decision.

Our analysis yields several key findings regarding the
landscape of load balancing for AI training:

- **Performance** **hierarchy:** Among existing contenders,
packet-spraying approaches consistently dominate alternative strategies. Between in-switch _vs._ host-based
packet spraying, we find that their performance differs
primarily under failure: host-based approaches generally
dominate, although both alternatives perform similarly if
the underlying routing convergence time is very small.

- **Queueing** **delay:** We show that none of the commonly
deployed load-balancing techniques—including packet
spraying—areoptimalinthesenseofmaintainingabounded
queue size while operating at maximum network utilization.

- **Optimal scheduling:** We demonstrate that a _destination-_
_based rotation (DR)_ scheduling discipline achieves _𝑂_ (1)
queue bounds.

- **Practical realization:** We present OFAN, a novel switchbased realization of DR scheduling. We show that OFAN
is both practically deployable and theoretically optimal.

- **Sensitivity analysis:** Beyond direct performance comparisons, our results expose how key parameters—buffer size,
message size, collective type, _etc._ —impact performance
without fundamentally altering the above core findings.
The remainder of this paper is organized as follows: §§2–3
establish AI workload requirements and the load-balancing
design space; §4 details our methodology and §5 compares
existing load-balancing schemes; §6 analyzes the optimality
of different load-balancing schemes and, in §7, we describe
OFAN; §8 presents a detailed sensitivity analysis of the various
load-balancing approaches that we evaluate.

_Generative AI was used to refine text and generate code for_
_this work. This work does not raise any ethical concerns._

## 2 Background: AI Workloads

AI workloads have specific traffic patterns and performance
metrics that are quite different from traditional datacenter
workloads. More specifically, AI workloads involve rounds
of computation interspersed with rounds of communication,
where the communication is one of a few basic collectives,
such as AllReduce, AllGather, and AlltoAll (see [19, 50] for
a review). Thus, the communication workloads can be well
characterized by the traffic generated by these collectives,

McClure et al.

and the network-related performance metric is the collective
completion time (CCT) since stragglers will slow the overall
training progress. This results in workloads that are:

- **Uniform:** The nodes participating in a collective are
typically using the same communication library ( _e.g.,_

[20]) and the same lower level networking support ( _i.e.,_
transport protocol and NICs). The collectives are commonly
symmetrical, in that each participating node has the same
amount of data to send, and generates traffic with the same
traffic characteristics, with uniform packet size.

- **Synchronous:** All nodes participating in the collective
begin at roughly the same time. This is particularly relevant
to load balancing, because it synchronizes the traffic [4],
which is both good for load balancing (no need to adapt to
newly arriving flows while a collective is in progress) and
bad (creating possible incast congestion).
**Mixture-of-Experts (MoE).** Since we focus on AI _training_
workloads, we assume that traffic is well approximated
by uniform workloads (specifically, AlltoAll collectives),
even for MoE architectures. This assumption is justified
because, with a large enough number of tokens, experts will
be relatively uniformly load-balanced [82] and/or experts will
be split among GPUs [72]. Existing work in AI network-level
load balancing makes a similar assumption [4, 11].

We note that AI workloads have two characteristics that
accentuate the limitations of the single-path paradigm. First,
the vast bulk of the AI traffic is in long-lived flows that do not
have idle periods, so techniques that improve load-balancing
by rerouting flows during idle times (e.g., PLB, flowlet
switching) may be less effective. Second, the performance
goal with these workloads is to minimize the completion of _all_
flows in a communication collective collective; i.e., the CCT,
which is quite different from the traditional focus on per-flow
metrics (e.g., flow-completion time and per-flow fairness).

AI workloads above a certain scale are often deployed in
isolation [26, 44, 69]. This is the case we assume in our paper,
because it is in these large-scale isolated deployments that
achieving high performance ( _i.e.,_ low CCTs) is so critical.

## 3 Load Balancing Options

We start this section by reviewing the overall design space for
load balancing (LB), and then present the specific designs that
our evaluation focuses on.

### 3.1 Design Space

The LB design space has been outlined (at least in part) in
several papers [7, 39, 81], so here we provide a fairly brief summary. At a high level, the main dimensions of the design space
are: (1) the **granularity** of traffic that is placed on different
paths, which can vary from a packet ( _e.g.,_ [14, 30, 66]) to entire
flows ( _e.g.,_ [32]), with various intermediate granularities such
as “subflows” ( _i.e.,_ parallel streams whose union reconstitutes

2

Load Balancing for AI Training Workloads

the original connection [71]) or “flowlets” (small sets of
contiguous packets [37, 70]); (2) the **location** at which LB
decisions are made can be centered at the host ( _e.g.,_ [11, 70])
or in switches ( _e.g.,_ [8, 65]); (3) how LB **adapts** to varying
network load, with some schemes adapting to local state at
a host or switch ( _e.g.,_ [39, 70, 75]), others to global state ( _e.g.,_

[7, 8]), and yet others are not adaptive at all ( _i.e.,_ use no state
about load, _e.g.,_ [22, 30, 32]). [1]

Of course, not all combinations of points along these
dimensions lead to sensible solutions. Nonetheless, this is
clearly a large design space and there is a vast literature
exploring it. Table 1 references just a sample of such work. For
tractability, we focus our study on a key set of design choices
that are being evaluated or deployed in current practice. These
are indicated with a ✓ symbol in Table 1 and, as we can see,
span a range of our design dimensions. We call these our
_leading contenders_ and describe them in more detail next.

### 3.2 Leading Contenders

We focus on the following seven schemes and use reference
implementations (particularly from _htsim_ [1]) when possible.
**(1)** **Per-flow** **LB:** Here, packets are hashed based on their
five-tuple + flow label and placed on one path in the network.
This approach captures the behavior of ECMP and, per the
dimensions discussed above, represents LB at the granularity
of flows, that is non-adaptive ( _i.e.,_ stateless), and only requires
simple hashing at switches.
**(2) Per-subflow LB:** This scheme operates as above, except
that a host now divides a flow into _𝑛_ parallel subflows, each
with a unique flow label. This approach captures protocols
such as MPTCP [71] and represents LB at the granularity
of subflows, that is non-adaptive (stateless), and where
parallelization into subflows is controlled by hosts while
switches only implement simple hashing (as above).
**(3) Per-flowlet LB:** Modeled after PLB [70], in this scheme,
the host _may_ change the flow label if it detects congestion
above a certain threshold. Specifically, in our implementation,
a host will change the flow label at most every _𝛼_ packets if
over _𝛽_ % of recent packets carried ECN marks with _𝛼_ and _𝛽_
picked based on the test environment (§5). [2]

**(4)** **Host** **Per-Packet** **LB:** In this scheme, the host simply
changes the flow label on every packet. This represents load
balancing at the granularity of individual packets, that is
implemented at hosts, and is non-adaptive.
**(5) Switch Per-Packet LB:** In this scheme, the switch implements simple round-robin scheduling of packets across the

1We note that all designs use state about network connectivity to determine
the current set of equal cost paths, so the adaptivity we consider here is
whether/how different schemes react to state about the _load_ on the network.
2This rule differs from PLB in one aspect: in PLB, a host only changes the
flow label at RPC boundaries; since we don’t have RPC traces, we instead
allow the host to change a flow label at most every _𝛼_ packets.

,

set of next-hop ports ( _i.e.,_ ports associated with the available
equal-cost paths to a destination), where the round-robin order
is periodically reset to avoid synchronization effects. This
implementation is borrowed from the _htsim_ simulator [1].
**(6) Adaptive Host Per-Packet LB:** Based on the REPS protocol [11], the endhost in this scheme sets flow labels randomly
at first, then upon receiving ACKs, discards flow labels that
were ECN marked and reuses the uncongested flow labels.
**(7) Adaptive Switch Per-Packet LB:** Here, the switch places
the packet on the next-hop port with the shortest queue, where
the shortest queue is determined by first quantizing the queue
length into a few bins determined by some thresholds ( _e.g.,_
0-5%, 5-10%, 10-20%, and >20%) and picking randomly
among the options in the smallest queue bin [1, 61, 77].

## 4 Approach: Decoupling Components

We aim to isolate the merits of LB from the effects of two other
components of the network stack: _congestion control_ (how
hosts adapt their rate to avoid congestion), and _loss recovery_
(includes both loss detection and packet retransmission). We
now explain our methodology for doing so.
**Congestion control:** Our approach is based on the observation
that a perfect LB scheme would make the entire capacity of
the network available to hosts. Thus, if we were to assume:
(i) perfect LB, (ii) uniform collective workloads, and (iii) no
failures, then, the job of a CCA would be quite simple: every
host transmits at the same fixed rate, which is calculated by
dividing the available capacity equally across all hosts. In such
a scenario, any drops or delays can be attributed to imperfect
LB rather than an imperfect CCA ( _i.e.,_ imperfections in host
sending rates).

Hence, to isolate the impact of LB, we simulate an idealized
fixed-rate CCA in which each host simply sends at a rate
that is set to its share of the available capacity of the physical
topology. Specifically, for a full bisection bandwidth network
without failures, each host sends at its line rate. In failure
scenarios, there may not be sufficient capacity for the workload
to proceed at line rate. Thus, we calculate the maximum
possible sending rate _𝜌_ max at which all flows could send while
load-balancing equally across all valid shortest paths, and all
hosts send traffic at a rate of _𝜌_ max. The process of determining
_𝜌_ max is presented in Appendix A.

Finally, in addition to the above ideal CCA, we also later
consider **practical CCAs** . For this, we would like to compare
our LB options using Google’s Swift [43], which combines low
delays and high throughput. However, Swift is designed for single paths and experiences throughput collapse when handling
spraying. Therefore, we use MSwift [27], a recent and publiclyavailable CCA that extends Swift to operate under spraying.
**Loss recovery:** Packet loss is inevitable due to link failures.
And, some (imperfect) LB may cause sufficient queueing to
cause congestive loss. The job of loss recovery is to detect

3

,

McClure et al.

**Table 1: A survey of existing load balancing approaches based on their considered state, granularity, and implementation location. We**
**consider the design points marked with** ✓ **, and introduce the one with †. We note that some works allow splitting flows in time/packets in**
**different amounts and with different strategies, thus we use a wide definition of “flowlet” that includes any splitting in these dimensions.**
**We** **do** **not** **include** _**routing**_ _**state**_ **in** **our** **definition** **of** **global** **state** **for** **switches** **(only** **congestion/traffic** **information)** **since** **it** **is** **often**
**locally-available in the switch despite being a function of global information.**

**Location** _Host_ _Switch_

**Granularity** _Packet_ _Flowlet_ _Subflow_ _Flow_ _Packet_ _Flowlet_ _Subflow_ _Flow_

**State**

_None_ ✓[30, 66] × [31, 81] ✓[71] × ✓[8, 14, 22] × × ✓[32]
_Local_ ✓[11, 47] ✓[36, 39, 70, 86] × × ✓†[65, 85] × [37, 78] × [75] × [12]
_Global_ ✓[16, 67] × × [4] × [21] × [68] ×[7, 40, 83] × ×[6, 10]

which packets have been lost and schedule their retransmissions. Given the potential for packet-level reordering under
fine-grained LB, distinguishing loss from reordering can be
challenging.

Following the same strategy as above, we consider loss
recovery approaches representing ideal and realistic options.
To model an ideal loss recovery solution, we simulate a
mechanism based on _rateless_ _erasure_ _coding_ [54, 56, 76]
which ignores losses and just transmits packets until the file
is complete. In this case, the sender encodes the data before
sending and creates some number of recovery symbols that
can be used to recover lost data. The receiver can decode the
entire messages with high probability as long as a sufficient
number of symbols have been received. Therefore, such
a protocol comes with a constant overhead (the required
recovery symbols), but does not need to manage specific
packets/sequence numbers (all symbols are equally necessary
and can be lost). To evaluate an LB scheme without the impacts
of loss recovery, we simulate ideal erasure coding with no
overhead. For this evaluation, we unrealistically assume that
no additional decoding symbols are necessary to receive the
message ( _i.e.,_ only a number of bytes equal to the message
size must be delivered to decode). Thus, the sender simply
sends packets until the receiver has ACKed the full message
and no other mechanisms are needed to recover from loss. [3]

For our realistic options, we first consider a _SACK_ -based
protocol since this is used in many recent protocols to tolerate
out-of-order delivery [17, 24, 49, 58]. In this case, packets
have a bitmap field that can tell the sender exactly which
packets have not been received. The sender retransmits
all missing packets when the gap between the lowest and
highest acknowledged sequence numbers crosses a configured
threshold. Importantly, these retransmission triggers do not
change the pacing rate, only which packets are sent.

Our second realistic option adds the use of _MSwift_ as a CCA
so that, unlike the previous solution, we now capture the effect

3Given the delay between when the sender transmits the final _necessary_
packet and when it receives the corresponding ACK, some additional data
may be transmitted. To avoid extra transmissions that may cause unnecessary
queueing, our implementation opportunistically stops in the final BDP and
only sends more if necessary.

**Table 2: Evaluated LB leading contenders and the applicable**
**configuration. Default configurations were generally found by**
**taking standard thresholds or experimenting with values and**
**taking the best-performing.**

**Approach** **Modeled After** **Simulated Configuration**

FLOW ECMP SUBFLOW MPTCP [71] # subfows = 4
HOST FLOWLET AR PLB [70] ECN thres.: 50%,
label change thres.: 40%
HOST PKT OPS [22] SWITCH PKT Round-robin [1] Permute
every 5 wraparounds
HOST PKT AR REPS [11] ECN thres.: 10%
SWITCH PKT AR Spectrum-X [65] Quanta: 5%, 10%, 20%

of varying sender rates. MSwift also uses a SACK-based loss
recovery mechanism.

## 5 Results: Load Balancing Schemes

As discussed before, we focus our initial evaluation on 7 leading contender designs with key parameters as shown in Table 2.
We use the default parameters for existing schemes where possible and otherwise swept for well-performing configurations;
different configurations may produce different results.
**Simulator.** We compare different load balancing schemes
with simulations on _htsim_ [1], which we chose due to
its ability to scale to large datacenter networks and its
existing implementation of many design points in this space.
Specifically, unless stated otherwise, we simulate a 128-node
3-tier fat-tree network with 800Gbps links, 0 _._ 5 _𝜇_ s link latency,
800KB per-port buffers, [4] RoCE-v2-sized packets with 4 _,_ 096B
payloads and 62B headers, 64B ACKs, and 20B gaps between
frames (12B inter-frame gap and 8B preamble and start frame
delimiter). We perform a sensitivity analysis for many of these
parameters in §8. We run all considered scenarios 10 times to
determine the level of variability in the measured performance.
**Workloads.** In our evaluation of load balancing schemes,
we consider an all-to-all (ATA) traffic matrix and a random

4This value roughly follows the per-port per-Gbps buffer size of modern
switches [12, 65], is above a BDP, and resulted in no loss in most evaluated
cases.

4

Load Balancing for AI Training Workloads

Flow

Subflows

Host Flt AR

Host Pkt

Switch Pkt

Host Pkt AR

Switch Pkt AR

Flow

Subflows

Host Flt AR

Host Pkt

Switch Pkt

Host Pkt AR

Switch Pkt AR

~~39~~

~~4~~

~~15~~

~~9~~

~~0.~~

~~0.5~~

~~5~~

~~3~~

~~1~~

~~2~~

~~6~~

~~7~~

~~99~~

~~0.1~~

~~7.~~

~~74~~

~~6.~~

1 10 100
CCT Increase (%)

**(a) All-to-All**

1 10 100
CCT Increase (%)

**(b) Permutation**

**Figure 1: Completion times (increase over ideal) for different**
**load** **balancing** **schemes** **with** **a** **perfect** **loss** **recovery** **protocol.**
**Adaptive techniques are denoted with “AR” (adaptive routing).**

permutation matrix. In the permutation traffic, each node is
sending traffic to exactly one other node, and receiving traffic
from exactly one other node. Rather than modeling specific
implementations of every collective, we select these two traffic
matrices since they are representative of many collective
algorithms. Permutation matrices are often used to implement
collectives such as AllGather and AllReduce [15, 26, 80, 84]
and can be used to iteratively perform an AlltoAll ( _𝑛_ - 1
permutation matrices iteratively). Similarly, an all-to-all traffic
matrix may implement AllGathers or a one-shot AllReduce,
as well as an AlltoAll. Notably, in most training jobs, multiple
forms of parallelism will be used and thus no one collective
will span the whole network. We explore this more in §8 and
for now make the simplifying assumption of one collective at a
time across all nodes. We expect smaller slices of the network
( _e.g.,_ a pod) to exhibit similar behavior.
**Metric.** For any given LB scheme, we report the percentage
increase in completion time relative to the lowest possible
completion time given the host-ToR link rate and propagation
delay of the network ( _i.e.,_ with no loss or queueing delay). For
example, in the all-to-all traffic matrix, the minimum possible
completion time in our setup is ∼ 1 _._ 3ms. Thus an increase
of (say) 10% in our normalized completion time metric is a
difference of 130us in which a GPU could perform billions of
FLOPs [18]. Such differences could have a noticeable impact
on training time as the communication time compounds over
iterations. Our all-to-all CCT lower bound is computed as
the simple sum of propagation and host transmission delays.
The permutation CCT lower bound is computed similarly but
additionally accounts for the symmetric dynamics of data and
ACK packets, as detailed in Appendix B.

### 5.1 Performance without failures

Figure 1 shows the performance of our leading contenders
in our default scenario in the absence of failures. As one
might expect, we see that load balancing at finer granularity
offers significant benefits with per-packet LB outperforming
flowlet-, subflows-, or flow-based LB. We see little difference

,

Inter-pod Routes Routes for Pod 1
Inter-pod Weights Weights for Pod 1

Pod 1 Pod 2 Pod 3 Pod 4

**Figure** **2:** **Switches** **that** **must** **update** **routing** **and/or** **load**
**balancing state based on a link failure. The pod with the failure**
**must update state for all routes, and many nodes in other pods**
**must update routes and weights for traffic destined to Pod 1.**

across the various packet spraying approaches which, again,
is perhaps to be expected in the absence of failure.

Comparing performance across collectives (Fig. 1(a) _vs._
(b)), we see that the normalized differences are larger for the
permutation matrix since the minimum completion time is
much smaller with fewer flows competing for bandwidth. As
we explore more in §8, the relative gap decreases with larger
message sizes and increases with larger networks. Notably,
in the ATA, packet-based schemes achieve within 1% of the
lower bound. We also see that adding subflows in hopes of
increasing the entropy helps more in the permutation matrix
as the ATA already has many flows. Finally, performance of
HOST FLOWLET AR varies greatly across the two collectives:
it achieves within 16% of optimal in ATA, but does worse than
SUBFLOW in the permutation matrix. This is, in part, because
in the permutation matrix, most of the flow is sent in the first
BDP and thus the feedback to move paths comes quite late.

### 5.2 Performance with failures

We now look at whether our previous findings hold in the face
of link failures. Failure cases pose a particular challenge to
the LB schemes as the network is no longer symmetric ( _i.e.,_
not all links should carry the same amount of traffic).

In general, we find that the gap between packet _vs._ coarser
(flow, subflows, flowlet) granularities of LB only increases
under failures and hence we focus our evaluation on the four
different forms of packet spraying designs. In particular,
we want to understand the differences between host- _vs._
switch-based spraying approaches: if they continue to perform
similarly, operators might prefer host-based approaches since
that allows them to be vendor agnostic.
**Failure** **models.** We consider randomized link failures in
which we fail each edge-aggregation and aggregation-core
link with a given probability. We initially set the probability
to 1% [28] and explore more values later in the section.
**Modeling** **routing** **convergence.** While routing and loadbalancing can be viewed as orthogonal, the performance of
the routing layer impacts the performance of load balancing
under failure. I.e., performance under failure will depend on

5

,

Host Pkt

Switch Pkt

Host Pkt AR

Switch Pkt AR

~~4.6~~

~~5~~

~~.5~~

~~3.1~~

~~4~~
~~29.~~

~~.6~~

~~4~~

~~.1~~

|12.5<br>(%)<br>10.0<br>Increase<br>7.5<br>5.0<br>2.5 CCT<br>0.0<br>0 25 50 75<br>Convergence Time, G (# RTTs)|Col2|Col3|Col4|Col5|Col6|Col7|Col8|Col9|Col10|
|---|---|---|---|---|---|---|---|---|---|
|0.0<br>2.5<br>5.0<br>7.5<br>10.0<br>12.5<br>0<br>25<br>50<br>75<br>Convergence Time, G (# RTTs)<br>CCT Increase (%)||||||||||
|0.0<br>2.5<br>5.0<br>7.5<br>10.0<br>12.5<br>0<br>25<br>50<br>75<br>Convergence Time, G (# RTTs)<br>CCT Increase (%)||||||||||
|0.0<br>2.5<br>5.0<br>7.5<br>10.0<br>12.5<br>0<br>25<br>50<br>75<br>Convergence Time, G (# RTTs)<br>CCT Increase (%)||||||||||
|0.0<br>2.5<br>5.0<br>7.5<br>10.0<br>12.5<br>0<br>25<br>50<br>75<br>Convergence Time, G (# RTTs)<br>CCT Increase (%)||||||||||
|0.0<br>2.5<br>5.0<br>7.5<br>10.0<br>12.5<br>0<br>25<br>50<br>75<br>Convergence Time, G (# RTTs)<br>CCT Increase (%)||||||||||

**(a) All-to-All**

McClure et al.

|50<br>(%)<br>40<br>Increase<br>30<br>20<br>10 CCT<br>0 1 2 3 4<br>Convergence Time, G (# RTTs)|Col2|Col3|Col4|Col5|Col6|Col7|Col8|Col9|Col10|Col11|
|---|---|---|---|---|---|---|---|---|---|---|
|10<br>20<br>30<br>40<br>50<br>0<br>1<br>2<br>3<br>4<br>Convergence Time, G (# RTTs)<br>CCT Increase (%)|||||||||||
|10<br>20<br>30<br>40<br>50<br>0<br>1<br>2<br>3<br>4<br>Convergence Time, G (# RTTs)<br>CCT Increase (%)|||||||||||
|10<br>20<br>30<br>40<br>50<br>0<br>1<br>2<br>3<br>4<br>Convergence Time, G (# RTTs)<br>CCT Increase (%)|||||||||||
|10<br>20<br>30<br>40<br>50<br>0<br>1<br>2<br>3<br>4<br>Convergence Time, G (# RTTs)<br>CCT Increase (%)|||||||||||
|10<br>20<br>30<br>40<br>50<br>0<br>1<br>2<br>3<br>4<br>Convergence Time, G (# RTTs)<br>CCT Increase (%)|||||||||||

**(b) Permutation**

Host Pkt

Switch Pkt

Host Pkt AR

Switch Pkt AR

1 10 100
CCT Increase (%)

**(a) All-to-All**

1 10 100
CCT Increase (%)

**(b) Permutation**

**Figure 3: CCT increase for randomized failures with a per-link**
**failure rate of 1%, with** _𝑮_ = **∞** **(** _**i.e.,**_ **convergence time** _>_ **CCT).**

the delay from when a failure occurs to when switches update
their routes/weights to reflect the failure.

In a datacenter, when a link _𝑙_ at a switch _𝑆_ fails, recovery
involves two key steps. First, _𝑆_ must detect the failure and
remove _𝑙_ as a next-hop option from its relevant port groups.
This in itself can take some time (estimates range from 10s
of microseconds [68] to 10s of milliseconds [4, 11] depending
on the underlying system) and during this period, packets
transmitted over the failed link are silently dropped.

In addition, all _other_ switches in the network must be
notified of the failure so that they can update their routes and
weighted ECMP (W-ECMP) configuration accordingly. An
example of this process is shown in Fig. 2 in which route
updates are propagated to all aggregation switches connected
to the same core router and all ToRs update how they weight
each of their aggregation switches for Pod 1. Datacenters
commonly run a routing protocol ( _e.g.,_ BGP [3, 45]) whose
convergence time will determine how quickly switches
update their routes and weights. As above, a wide range of
cross-switch convergence times have been reported from 100s
of microseconds [68] to 100s of milliseconds [3].

Given the range of reported convergence times, we are
interested in how this impacts LB performance. For example,
REPS [11] motivates its host-based approach with potentially
long convergence time. Accordingly, if the convergence
time could be decreased with other in-switch systems [68],
would host-based AR still be important for performance under
failure? Thus, in our simulations, we introduce a parameter
_𝐺_ to denote this global convergence time. We make the
simplifying assumption that this convergence time is the
same across all switches, including (pessimistically) the local
switch _𝑆_ . We measure the impact on CCT as we vary _𝐺_, under
our randomized link failure model.
_𝑮_ = **∞.** This represents scenarios in which routing state
remains broken during the entire collective runtime. This
scenario is relevant to practice, given reports of convergence
time that can extend into several 100s of milliseconds, on par
with expected CCTs.

Our results in Fig. 3 now show a clear winner: HOST PKT
AR. This is because, on the timescale of a small number of
RTTs, HOST PKT AR is able to detect the failure (via timeouts

**Figure 4: CCT increase over best possible under random link**
**failures** **(1%** **fail** **rate)** **for** **host** **adaptive** **(dashed** **and** **shaded)**
**compared to an in-network rebalancing approach with different**
**delays (x-axis). The CCT lower bound accounts for the failure**
**(uses** _𝜌_ **max).**

on a particular path label) and avoid that path in future transmissions. Notably, SWITCH PKT AR, even though it is adaptive,
does not see this benefit because the queue length on the failed
link may be short and thus continues to be chosen. Intuitively,
this performance difference arises because HOST PKT AR
enjoys an end-to-end view of a path’s performance (and can
react accordingly) while SWITCH PKT AR is limited to its local
view of switch state. Further, with SWITCH PKT AR, even if
the switch with the failed link had reacted quickly to avoid
the failed link locally, it would still receive traffic from other
switches as if the link was up, thus causing inevitable overload.

Finally, we note that the performance degradation due to
slow convergence can be substantial, even in the best case
of adaptive host-based solutions; _e.g.,_ 20% higher than the
baseline for the permutation matrix.
**Varying** _𝐺_ **.** Figure 4 shows the performance for different convergence times _𝐺_, focusing only on the adaptive schemes
(SWITCH PKT AR and HOST PKT AR) for simplicity. We set _𝐺_ to
be a (varying) multiple of the minimum network RTT. Hence,
as we increase _𝐺_, a growing fraction of the collective runtime
overlaps the network’s convergence period. For calibration,
the minimum CCT (with no failure) for the ATA is about 220
RTTs, while the permutation matrix is between 2-3 RTTs. We
include the performance of HOST PKT AR _with no convergence_
( _𝐺_ = ∞) for reference. In general, we see that at very low _𝐺_,
switch-based and host-based approaches perform very similarly, but host-based solutions perform best as G grows. While
routing convergence may re-hash flow labels previously categorized as ’good’ or ’bad’ by the host LB algorithm onto new
paths, performance is maintained because W-ECMP weights
now correctly distribute traffic across all available capacity; the
only residual effect is that the host-based approach continues to
exclude the specific label it identified with the failure. With the
ATA, the purely switch-based approach eventually performs
worse than Host AR with _𝐺_ =∞. Meanwhile, because the CCT
for the permutation matrix is smaller, we require very fast convergence times (1 RTT) to limit performance degradation. For

6

Load Balancing for AI Training Workloads

**Figure** **5:** **Impact** **of** **randomized** **link** **failure** **rates** **with** _𝐺_ = 0 **.**
**CCT is normalized to best-case** _**without**_ **failures.**

large message sizes on a permutation matrix, the acceptable
convergence time is longer, similar to the ATA.
_𝑮_ = 0 **.** As shown in Figure 4, when _𝐺_ = 0 ( _i.e.,_ routes are
converged before the collective even begins) both approaches
perform similarly. Thus, in-switch and end-host based packet
spraying are similar in the no-failure case and under failures
if the routes have converged.
**Varying failure rate;** _𝑮_ = 0 **.** Finally, Fig. 5 plots performance
under increasing link failure rates when routing state has
converged ( _𝐺_ = 0). We see that, as expected, performance
degrades with increasing failure rate but the performance gap
(or lack thereof) across different schemes remains unchanged.

### 5.3 Takeaways

Overall, our comparison of leading LB approaches yielded a
few key insights. First, per-packet techniques dominate coarsegrained LB schemes, and, in failure-free scenarios, most
existing per-packet techniques achieve similar performance.
While per-packet approaches near optimal performance for
ATA, all versions incur a larger overhead under our permutation traffic matrix. Second, we find that the speed of route
and (W-ECMP) weight convergence is a critical performance
determinant under failure. Under very fast convergence times
( _e.g., <_ 10 RTTs for our ATA and _<_ 2 RTTs for permutation),

SWITCH PKT AR and HOST PKT AR perform similarly but,
otherwise, HOST PKT AR outperforms. Finally, SWITCH PKT
AR and HOST PKT AR perform similarly once all routes have
converged. More generally, we see that rapid convergence
significantly improves performance in all cases and hence is
an important metric for switch vendors to optimize.

## 6 Optimality in Load Balancing

Our results in the previous section revealed that even the
best-performing packet spraying approaches can suffer from
non-trivial performance overheads, suggesting that there is
room for further optimization. In this section, we present theoretical analysis that gives us a more rigorous understanding
of optimality in load balancing approaches, and leads us to
propose Ofan, a new and provably optimal approach, in §7.

,

### 6.1 Theoretical Results

We define optimality in terms of the average queue length
that results from a load balancing scheme when running the
network at maximum utilization. Specifically, for a message
size _𝑚_, we focus on _𝑞_ ( _𝑚_ ), the average queue size across _all_
switch queues over the time it takes for _all_ hosts to finish
sending their messages. With this definition, an optimal load
balancing algorithm is one that achieves an _𝑂_ (1) queue size,
independent of _𝑚_ .

We focus on queue size for a few different reasons. First,
queue size is strongly correlated to CCT: queue size is the
dominant variable component of the CCT given a fixed
propagation delay and our simplifying assumptions of uniform
traffic, ideal sending rates, and zero-overhead loss recovery.
We further validate this in simulation in §6.2. In addition,
achieving an _𝑂_ (1) queue is a valuable goal in itself since it
ensures predictable performance, simplifying downstream
tasks such as congestion or loss detection, _etc._ Nonetheless,
we note that our focus on queue size is largely to build intuition
in designing load balancing schemes, and we return later to
comparing designs in terms of their CCT.

We present the details of our theoretical analysis in
Appendices C–E and only provide a high level summary
here. Our model considers _𝑛_ hosts implementing a random
permutation collective over a three-level _𝑘_ -ary fat tree. We
focus on packet-based load balancing and analyze simplified
versions of the contender schemes presented in §5. These
simplifications were necessary because our leading contender
algorithms include multiple parameters that complicate formal
analysis. Specifically, we analyze:
**(i) Simple RR:** We model our switch-based packet spraying
algorithm using a simple round-robin model in which the
switch load-balances packets across a set of next-hop ports
in round-robin order. Thus, the simplification relative to
our earlier SWITCH PKT scheme is that SIMPLE RR does not
periodically reset the round-robin order.
**(ii) JSQ:** We model our adaptive switch-based packet spraying
algorithm using a Join Shortest Queue (JSQ) model in which
the switch selects the next-hop port with the shortest queue,
with random tie-breaking between equal-length queues. This
simplifies the adaptive switch-based spraying (SWITCH PKT
AR) from §5 by removing the quantization of queues. Or,
viewed differently, JSQ represents adaptive switch spraying
in which the quantization is extremely fine-grained.
**(iii)** **RSQ:** In Randomized Switch Queueing (RSQ), the
switch selects among possible next-hop ports at random.
Hence, RSQ captures the opposite extreme of JSQ: it captures
our adaptive switch-based spraying scheme but now with
extremely coarse-grained quantization.
**(iv)** **Host** **Pkt** : We model non-adaptive host-based packet
spraying with full fidelity: the host randomly sprays packets

7

,

**Table 3: Modeled algorithms for analysis.**

**Approach** _𝑞_ ( _𝑚_ ) **Simplification of** **Simplification**

SIMPLE RR Θ( _𝑚_ ) SWITCH PKT No permute
JSQ Θ( _𝑚_ ) SWITCH PKT AR No quantization
RSQ Ω  ~~[√]~~ _𝑚_  SWITCH PKT AR One quantum
HOST PKT Ω  ~~[√]~~ _𝑚_  - HOST DR (DRB) Θ(1)  -  OFAN Θ(1) - 

(by picking random flow IDs for each subsequent packet),
hence this scheme is identical to our HOST PKT scheme in §5.

With the above, we can prove the following results.

**Theorem 1.** SIMPLE RR _and_ JSQ _suffer from a linear growth_
_of the queue size with the message size:_

_𝑞_ ( _𝑚_ ) =Θ( _𝑚_ ) (1)

**Theorem 2.** RSQ _and_ HOST PKT _, that are based on random_
_spraying, see the queue grow at least as the square root of the_
_message size:_

McClure et al.

later contribute a new switch-based DR scheme. Since DRB
runs at hosts (and to contrast it from the switch-based scheme
we propose), we henceforth refer to DRB as HOST DR.
**Host DR.** HOST DR is typically implemented by maintaining
a set of round-robin pointers at each source host, one per
(destination host, quantized packet size) pair; HOST DR uses
two quanta bins to triage data and ACK packets. For each pair,
the algorithm first determines the lowest common layer in the
topology to the source and destination, and performs roundrobin among the common switches in this layer using a single
pointer. For example, if two hosts are in different pods in Fig. 2,
they will send their data packets to the four cores in round-robin
order. This is done using encapsulation. When there are failures, HOST DR assumes that all hosts have full knowledge of
the topology and only performs round-robin among switches
that are reachable to both the source and destination hosts.
**Bounded** **queues.** We analyze HOST DR and show the
following results (proved in Appendix E). Between source and
destination hosts, HOST DR flows are load-balanced equally
and periodically across all allowed paths. As a result, any given
path sees a sum of many periodic flows with random phases.
Thus, we find that we can model the HOST DR queues using
the _𝑁𝐷_ / _𝐷_ /1 queueing model [55, 74]. This is significant:
unlike most queueing models, _the 𝑁𝐷_ / _𝐷_ /1 _queueing model_
_has_ _bounded_ _average_ _queue_ _sizes_ _even_ _when_ _arrival_ _rates_
_equal service rates_ .

**Theorem 3.** _The modeled average queue size for_ HOST DR
_is bounded:_

_𝑞_ ( _𝑚_ ) ≈ Θ(1) _._ (3)

Given its optimal queue length, we would like to explore
a DR-based load balancing solution. Unfortunately, as we
discuss in the next section, HOST DR suffers from certain
complexities and overheads. This leads us to propose a new
variant of DR that we call OFAN which runs in switches and
achieves superior performance to HOST DR.

### 6.2 Validation via Simulation

Since our theoretical analysis makes a number of simplifying
assumptions, we present simulation results showing both
the CCT and the max queue size for the various algorithms
discussed above. We include both our simplified models and
our packet-based leading contenders. For completeness, we
also show the performance of HOST DR and OFAN (discussed
in the next section).

Figure 6 shows that max queue size correlates well with the
CCT metric from our earlier sections. We also see the general
trends revealed by our theoretical analysis. Specifically,
algorithms cluster in three groups: (1) SIMPLE RR and JSQ
form a first group with near-linear growth of the max queue
size; (2) The second group includes HOST PKT, RSQ, HOST
PKT AR, and SWITCH PKT AR whose queue growth is closer

_𝑞_ ( _𝑚_ ) =Ω

√ _𝑚_ (2)

The above results suggest that none of our leading contender
algorithms achieve our goal of _𝑂_ (1) queue size. In particular,
the linear growth of SIMPLE RR and JSQ was surprising, especially as the latter is often presented as a near-optimal solution

[23, 29, 61, 62]. Examination reveals that the linear scaling
of SIMPLE RR and JSQ are a result of _synchronization_ effects
that arise due to the uniform nature of collective workloads;
_i.e.,_ that all senders transmit the same message and packet size,
paced at identical rates. This uniformity leads to per-sender
“stickiness” in which subsequent packets from the same sender

are forwarded along the same outgoing port to the same
aggregation switch. Given the nature of a fat tree topology,
such packets necessarily arrive at the same aggregation switch
in the destination pod, and then “stick” to the same path all the
way down to the host destination. They then collide with other
_sticky_ flows. We discuss these synchronization effects in detail
in Appendix C and further validate them in simulation below.

Table 3 summarizes our models and findings.
Given these results on the non-optimality and/or fragility
of our leading contenders, we expanded our horizons to the
broader scheduling literature in search of approaches that lead
to our goal of O(1) queueing. We find inspiration in the DRB
scheduler by Cao _et al_ [16]. The key idea in DRB is that each
source host load balances packets in a round-robin fashion on
a _per destination_ basis. We generalize DRB’s idea to define
a new scheduling discipline that we term _Destination-Based_
_Rotation_ _(DR)_ . [5] We observe that DRB can be viewed as a
specific host-based implementation of DR scheduling, and we

5DR has roots in _load-balanced_ _router_ algorithms like UFS, FOFF and
Padded Frames [35, 41, 42].

8

Load Balancing for AI Training Workloads

Simple RR

JSQ

Host Pkt/RSQ

Host Pkt AR

Switch Pkt AR

Host DR

~~9.3~~

~~11.~~

~~10.~~

~~2.3~~

~~.67~~

CCT Increase (%)

**(a) CCT increase** **(b) Max queue size**

**Figure 6: Comparison of packet-based LB algorithms.**

to the square-root of the message size, and (3) HOST DR and
SWITCH DR (OFAN) appear to reach an optimal _𝑂_ (1) queue
size. Finally, we repeated our tests under the failure scenarios
from the previous section and confirmed that OFAN and Host
DR retain their performance advantage over the other LB
schemes even under failure (results omitted for brevity).

Given these results, we next take a closer look at practically
realizing DR-based LB.

## 7 OFAN

In this section, we first provide intuition for why DR achieves
optimality, then discuss the limitations of HOST DR and finally
the detailed design of OFAN.
**The** **reason** **behind** **DR’s** **optimality.** Why is destinationbased rotation (DR) optimal, while a scheme based on simple
round-robin is not? In a nutshell, this is because, by balancing
load on a per destination basis, DR ensures a uniform load on
both uplinks _and downlinks_ . [6] In a scheme such as SIMPLE RR,
the switch uses the packet’s destination to determine the group
of next-hop links, but the destination does not influence _which_
of these links is selected. Instead, the switch simply schedules
all packets bound for that next-hop group in round-robin order.
Or, stated in terms of pointers: the switch only maintains one
pointer for each next-hop group. Thus, with SIMPLE RR on
a fat-tree, a switch will round-robin all northbound traffic
over its uplinks in a destination-agnostic manner. This does
a good job of balancing traffic across uplinks but can result in
imbalances in how _a particular destination’s_ traffic is spread
across the core switches. This in turn can lead to imbalanced
traffic on the downlinks because, on a fat-tree, there is only
one southbound path from core to destination and hence no
further opportunity to load balance traffic.

By contrast, because DR explicitly balances load on a
per-destination basis, it ensures that _any particular destina-_
_tion_ ’s traffic is well-balanced across core switches and hence
along downlinks, leading to DR’s guarantee of optimality and

6Uplinks refers to the links traversed on a packet’s “northbound” path from
source to a core switch, and downlinks refers to the links traversed on the
“southbound” path from core to destination.

,

resilience to cross-flow synchronization effects. The tradeoff,
of course, is that DR requires per-destination pointers and this
is the challenge that any DR-based scheduler must address
as we discuss next.
**Limitations** **of** **HOST** **DR.** HOST DR implements DR at
hosts, where maintaining per-destination state is reasonable.
However, as mentioned before, HOST DR suffers from two
fundamental limitations. First, hosts must know the complete
set of currently reachable switches, which is not information
they have available today. While one might contemplate
exposing routing/link updates to hosts, doing so would violate
traditional network layering abstractions, exposing hosts to
the internal complexity of the network fabric and requiring
them to manage global topology state. Second, as we discuss
next, running DR at hosts fundamentally limits the volume
of traffic that can be serviced by a single pointer, which in turn
limits its performance.
**Overview of** **OFAN.** OFAN [7] is a switch-based realization of
DR scheduling. To address the challenge of maintaining perdestination pointers, OFAN exploits the structured nature of
a fat-tree topology to _consolidate_ destinations based on their
location in the tree, such that a switch only maintains a single pointer for groups of destinations that share a common
edge or aggregation switch. Specifically, an edge switch _𝐸_ will
maintain one pointer for each group of destinations that share
an edge switch _𝐹_ ( _𝐹_ ≠ _𝐸_ ). Similarly, an aggregation switch _𝐴_
maintains one pointer for each group of destinations that share
an aggregation switch _𝐵_ ( _𝐵_ ≠ _𝐴_ ). Hence, an edge switch on the
northbound path will round-robin all traffic bound for the same
destination edge switch, and an aggregation switch will roundrobin traffic bound for the same destination aggregation switch.

OFAN’s consolidation of destinations retains DR’s property
of balancing traffic on both uplinks and downlinks. To see this,
consider two flows that originate at source hosts under source
edge switch _𝐸_, and are destined to destination hosts under destination edge switch _𝐹_ . Then _𝐸_ and _𝐹_ are _mandatory waypoints_
in their path and hence _𝐸_ can maintain a single pointer that
(effectively) consolidates both flows. Consolidation is even
more effective at the aggregation layer due to the properties of
three-level fat-trees. In a fat-tree, all packets destined for a pod,
that come through a source aggregation switch in their uplink
path can only go through a single aggregation switch in their
downlink path. [8] This aggregation switch is again a mandatory
waypoint and hence a source aggregation switch can consolidate its scheduling of all packets destined to this pod.

Thus, an edge switch maintains O(# edge switches) pointers,
and an aggregation switch maintains O(# pods) pointers.

7OFAN’s name is based on Ezekiel’s vision of wheels within wheels, fitting
the many pointer rotations.
8To see this, notice that any packets leaving the black aggregation switch in
Figure 2 can only traverse the red (and not white) aggregation switches on
their southbound path.

9

,

**(a)** 1MB **message** **(b)** 32KB **message**

**Figure 7: Worst-case link overload at each stage as a function**
**of packet size for** 1MB **and small** 32KB **messages.**

While greater than the number of pointers maintained with

SIMPLE RR, our discussions with switch vendors suggest that
this is a very reasonable number of pointers for switches to
maintain. For example, in a fat-tree of parameter _𝑘_ =64 with
65 _𝐾_ GPUs [13, 25, 48, 64], each edge switch would maintain
2 _𝐾_ pointers and each aggregation switch 63 pointers.
**Properties.** We prove in Appendix F that OFAN’s consolidation
achieves the dual goals of uplink and downlink LB. We get:

**Theorem** **4.** _The_ _modeled_ _average_ _queue_ _size_ _for_ OFAN _is_
_bounded:_

_𝑞_ ( _𝑚_ ) ≈ Θ(1) _._ (4)

**Implementation.** Implementing OFAN only requires modifying the core scheduling algorithm in a switch. No change
is required at endhosts and OFAN can continue to use existing
routing protocols such as BGP W-ECMP [9, 33, 34, 46, 51, 57,
59, 63] to propagate information about failures _etc._ To implement the OFAN scheduling algorithm, an edge switch maintains
a pointer for each (destination edge switch, quantized packet
size) tuple and an aggregation switch maintains the same for
each destination pod. In our simulations, we use two quantization groups for packet sizes—one for data packets and another
for ACKs. Other datacenters and workloads might require
more fine-grained quantization. At start up, each pointer is
initialized to a random uplink port and a random round-robin
traversal order (to avoid synchronization across pointers). At
each packet arrival for this pointer, it is incremented (modulo
the number of uplink ports). Unlike HOST DR, OFAN does not
require any tunneling or encapsulation of traffic.
**Experimental Validation.** Figure 7 provides experimental
evidence for why DR-based LB performs better. We plot
the maximum load increase beyond ideal at each of the four
inter-switch link layers: (i) edge to aggregation ( _𝐸_ → _𝐴_ ),
(ii) aggregation to core ( _𝐴_ → _𝐶_ ), (iii) core to aggregation
( _𝐶_ → _𝐴_ ), and (iv) aggregation to edge ( _𝐴_ → _𝐸_ ), using a random
permutation with inter-pod traffic only. The results confirm
our intuition. SIMPLE RR and JSQ achieve perfect local LB
at uplinks, but since they are not destination-based, they suffer
at downlinks. The other non-DR algorithms suffer at both. Interestingly, we see that HOST DR exhibits perfect LB for large
messages, but suffers for small ones. This is because HOST

McClure et al.

Number of Nodes

**(b) Permutation**

10.0

7.5

5.0

2.5

|0.8 (%)<br>Increase<br>0.6<br>CCT<br>0.4<br>50 100 150 200 25<br>Number of Nodes|Col2|Col3|Col4|Col5|Col6|Col7|Col8|Col9|
|---|---|---|---|---|---|---|---|---|
|0.4<br>0.6<br>0.8<br>50<br>100<br>150<br>200<br>25<br>Number of Nodes<br>CCT Increase (%)|||||||||
|0.4<br>0.6<br>0.8<br>50<br>100<br>150<br>200<br>25<br>Number of Nodes<br>CCT Increase (%)|||||||||
|0.4<br>0.6<br>0.8<br>50<br>100<br>150<br>200<br>25<br>Number of Nodes<br>CCT Increase (%)|||||||||
|0.4<br>0.6<br>0.8<br>50<br>100<br>150<br>200<br>25<br>Number of Nodes<br>CCT Increase (%)|||||||||
|0.4<br>0.6<br>0.8<br>50<br>100<br>150<br>200<br>25<br>Number of Nodes<br>CCT Increase (%)|||||||||

**(a) All-to-All**

**Figure 8: CCT increase as the network size increases.**

|Host Pkt AR 6.04<br>Switch Pkt AR 6.52<br>Ofan 4.62<br>0 5 10<br>CCT Increase (%)|Host Pkt AR 13.5<br>Switch Pkt AR 6.34<br>Ofan 0.96<br>1 10<br>CCT Increase (%)|Col3|Col4|Col5|Col6|13.5|
|---|---|---|---|---|---|---|
|~~4.62~~<br>~~6.52~~<br>~~6.04~~<br>Ofan<br>Switch Pkt AR<br>Host Pkt AR<br>0<br>5<br>10<br>CCT Increase (%)|~~0.96~~<br>~~6.34~~<br>~~13.5~~<br>Ofan<br>Switch Pkt AR<br>Host Pkt AR<br>1<br>10<br>CCT Increase (%)||||~~.34~~<br>||
|~~4.62~~<br>~~6.52~~<br>~~6.04~~<br>Ofan<br>Switch Pkt AR<br>Host Pkt AR<br>0<br>5<br>10<br>CCT Increase (%)|~~0.96~~<br>~~6.34~~<br>~~13.5~~<br>Ofan<br>Switch Pkt AR<br>Host Pkt AR<br>1<br>10<br>CCT Increase (%)||~~0.~~|~~6~~<br>|||
|~~4.62~~<br>~~6.52~~<br>~~6.04~~<br>Ofan<br>Switch Pkt AR<br>Host Pkt AR<br>0<br>5<br>10<br>CCT Increase (%)|~~0.96~~<br>~~6.34~~<br>~~13.5~~<br>Ofan<br>Switch Pkt AR<br>Host Pkt AR<br>1<br>10<br>CCT Increase (%)||||||

~~6.~~

~~2~~

~~.6~~

**(a) All-to-All**

**(b) Permutation**

**Figure 9: CCT increase with short (20 pkt) buffers.**

DR maintains many per-flow pointers that can cause traffic to
be “spread too thin”, especially with small messages. OFAN’s
consolidation mitigates this, leading to improved performance.
In Appendix F, we show that this performance gap widens as
the network size grows, following the widening disparity in
the number of pointers maintained by each scheme.

## 8 Sensitivity Analysis

We now determine the robustness of our results when varying
several scaling parameters (§8.1), approaches to loss recovery
(§8.2), and congestion control (§8.3). Finally, we present
results measuring CCT in a scenario simulating the training
of Llama [52] models with up to 405B parameters parallelized
using FSDP [73, 88] and running a full stack of CCA, loss
recovery, and load balancing (§8.4).

We ran tests with the entire set of our leading contenders
from §3 as well as HOST DR and OFAN. Across our tests, we
find that the _relative_ ranking and broad assessment of different
schemes that we have made so far remains unchanged. For
legibility, in this section, we show results for SWITCH PKT AR,
HOST PKT AR, and OFAN since these are our best performers
representing both practice and theory.

### 8.1 Scaling

**Network** **Size.** Figure 8 shows the impact of scaling the
number of nodes in the network (and thus participating in
the collective). We see that both the relative ordering of our
schemes and the magnitude of their performance differences
holds as the network size grows.
**Buffer Size.** In Figure 9, we show performance with short
buffers, set at the size of 20 data packets (1/10th of the
default in §5). We see that, for permutation matrices, the
performance of SWITCH PKT AR starts to dominate Host Pkt
AR, presumably because of its ability to more directly control

10

Load Balancing for AI Training Workloads

**(a) All-to-All**

**(b) Permutation**

**Figure 10: CCT increase as the message size increases.**

queue length. As before, OFAN consistently performs better
than the other approaches.
**Message Size.** Figure 10 plots performance under increasing
message size. We see that the relative ordering of our
approaches does not significantly change, though the gap
between them decreases. This is because, as the message size
increases, the minimum CCT increases and hence the relative
differences get smaller. Interestingly, we see that HOST PKT AR
gets notably worse at very large message size. We conjecture
that this is due to the “freezing mode” in REPS triggering as
queues become long enough to cause a timeout [11].
**Packet** **Size.** Figure 11 repeats our default test, now with
varying packet size and two different message sizes. The
impact of packet size as a parameter in AI training is one that,
to our knowledge, has not been extensively explored in the
networking literature. Yet, as we see, the choice of packet size
can have a significant impact, varying CCT by up to 10%. The
graph also shows a clear “sweet spot” in packet size at which
performance is maximized. Intuitively, this is because sending
_𝐷_ bytes with a packet size _𝑃_ and header _𝐻_, involves a trade-off:
large packets increase queue size and hence CCT, while small
packets incur higher header overheads. We find that we can
model the optimal packet size for some of our LB approaches.
For DR schemes such as OFAN, if we model the _𝑂_ (1) network
queueing as a constant of _𝛼_ packets (independent of the number
of sent packets), then we obtain the following (Appendix G):

,

**(a)** 0 _._ 5MB **message** **(b)** 16MB **message**

**Figure 11: CCT increase as packet size increases, for two message**
**sizes in bytes.**

Host Pkt AR

Switch Pkt AR

Ofan

Host Pkt AR

Switch Pkt AR

Ofan

~~0.~~

~~5~~

CCT Increase (%)

**(a) All-to-All**

~~.6~~

~~0~~

~~87~~

CCT Increase (%)

**(b) Permutation**

**Figure 12: CCT increase for each LB scheme with SACK-based**
**loss recovery protocol.**

Host Pkt AR

Host Pkt AR

~~1~~

~~.~~

~~1.~~

~~4~~

CCT Increase (%)
**(a)** 1MB **: CCT**

~~9.~~

~~0~~

~~15~~

CCT Increase (%)
**(b)** 16MB **: CCT**

**Figure 13: Packet-based LB algorithms with MSwift CCA.**

                               -                               
optimal packet size only grows as Θ  _𝐷_ [1][/][3] rather than Θ _𝐷_ .

Also note that we neglect second-order factors, _e.g.,_ the CRC
may need to be a bit longer to protect longer packets. This
result suggests many avenues for future work on optimizing
performance through dynamically tuning packet size, and
exploring standardization support for larger Ethernet MTUs.

optimal packet size only grows as Θ  _𝐷_ [1][/][3] rather than Θ

√
_𝐷_

**Theorem** **5.** _To_ _minimize_ _the_ _CCT,_ _the_ _optimal_ _packet_ _size_

√

_should carry a payload that scales with_ _𝐷:_

√

_𝐷:_

~~√~~

_𝐻_

(5)
_𝛼_ [·] _[𝐷]_

### 8.2 Loss Recovery

We next evaluate the impact of a realistic loss recovery
mechanism on CCT, using a retransmission threshold _𝑥_ to
distinguish expected reordering from actual loss. Analytically,
the maximum reordering degree – the packets arriving while
one is delayed – is 5 _𝑞𝑟_ / _𝑏_ for a 3-level fat-tree with queue size
_𝑞_, bandwidth _𝑏_, and flow rate _𝑟_ ( _i.e.,_ the maximum possible
queueing delay divided by the pacing time between packets).
In our setup, this worst-case threshold ranges from 8 packets
for ATA to 1,000 for the permutation matrix.

Empirical sweeps identified optimal thresholds of _𝑥_ = 6
for ATA and _𝑥_ = 32 for the permutation matrix (avoiding
spurious retransmissions due to reordering, but not relying
entirely on timeouts to detect loss). As shown in Fig. 12,
incorporating realistic loss recovery does not alter our core
findings: existing spraying approaches perform similarly,
while OFAN consistently provides the best performance across
both traffic matrices.

_𝑃_ - _𝐻_ =

Interestingly, the constant _𝐻_ / _𝛼_ reflects the battle between
the two types of CCT overhead: _headers_ and _queueing_ . We
illustrate with a red dot in Fig. 11 the optimal size and modeled
CCT increase _vs._ our best constructed lower bound (§5).
We can see how the model roughly predicts the packet-size
sweet spot observed in simulation and its CCT increase.
Fig. 11(b) shows how the shorter queue sizes of OFAN also
encourage larger packets: We can derive that when using
spraying algorithms with square-root queue-size growth,

11

,

McClure et al.

|Host Pkt AR 21<br>Switch Pkt AR 16.5<br>Ofan 0.32<br>1 10 100<br>CCT Increase (%)|Col2|Col3|Col4|Col5|Col6|21|
|---|---|---|---|---|---|---|
|~~21~~<br>~~16.5~~<br>~~0.32~~<br>Ofan<br>Switch Pkt AR<br>Host Pkt AR<br>1<br>10<br>100<br>CCT Increase (%)||||||~~6.5~~|
|~~21~~<br>~~16.5~~<br>~~0.32~~<br>Ofan<br>Switch Pkt AR<br>Host Pkt AR<br>1<br>10<br>100<br>CCT Increase (%)||~~0.3~~|||||
|~~21~~<br>~~16.5~~<br>~~0.32~~<br>Ofan<br>Switch Pkt AR<br>Host Pkt AR<br>1<br>10<br>100<br>CCT Increase (%)|||||||

**(c) 405B: CCT increase** **(d) 405B: Utilization** **(e) 405B: Max queue size**

|Host Pkt AR 18.6<br>Switch Pkt AR 13.1<br>Ofan 2.2<br>1 10 10<br>CCT Increase (%)|Col2|Col3|1|8.6|
|---|---|---|---|---|
|~~18.6~~<br>~~13.1~~<br>~~2.2~~<br>Ofan<br>Switch Pkt AR<br>Host Pkt AR<br>1<br>10<br>10<br>CCT Increase (%)|||~~13.~~||
|~~18.6~~<br>~~13.1~~<br>~~2.2~~<br>Ofan<br>Switch Pkt AR<br>Host Pkt AR<br>1<br>10<br>10<br>CCT Increase (%)||~~.2~~|||
|~~18.6~~<br>~~13.1~~<br>~~2.2~~<br>Ofan<br>Switch Pkt AR<br>Host Pkt AR<br>1<br>10<br>10<br>CCT Increase (%)|||||

**(a) 7B: CCT increase**

|Host Pkt AR 15.3<br>Switch Pkt AR 12.6<br>Ofan 0.99<br>1 3 10 30<br>CCT Increase (%)|Col2|Col3|Col4|Col5|Col6|Col7|15|.3|Col10|
|---|---|---|---|---|---|---|---|---|---|
|~~15.3~~<br>~~12.6~~<br>~~0.99~~<br>Ofan<br>Switch Pkt AR<br>Host Pkt AR<br>1<br>3<br>10<br>30<br>CCT Increase (%)|||||||~~12~~|~~6~~||
|~~15.3~~<br>~~12.6~~<br>~~0.99~~<br>Ofan<br>Switch Pkt AR<br>Host Pkt AR<br>1<br>3<br>10<br>30<br>CCT Increase (%)|||~~0~~|~~9~~||||||
|~~15.3~~<br>~~12.6~~<br>~~0.99~~<br>Ofan<br>Switch Pkt AR<br>Host Pkt AR<br>1<br>3<br>10<br>30<br>CCT Increase (%)||||||||||

**(b) 70B: CCT increase**

**Figure 14: FSDP with Llama 7B, 70B and 405B parameters.**

### 8.3 Congestion Control

We now compare per-packet spraying algorithms with CCA.
As mentioned previously, we would like to compare them
using Google’s Swift [43], but Swift is designed for single
paths and experiences throughput collapse when handling
spraying [27]. Therefore, we use MSwift [27], a recent and
publicly available CCA that extends Swift to operate under
spraying. MSwift’s key changes include: (i) an LTCP-based
mechanism [87] to handle out-of-order packets that can
trigger duplicate ACKs, and (ii) a new mechanism (based
on observing recent ACKs) that avoids Swift’s throughput
collapse scenario. We use MSwift’s default parameter values
adjusted for our network setting (Appendix H).

Figure 13 illustrates the impact of congestion control. It
evaluates a permutation traffic using the same settings as
without CCA, both with a short 1 MB message to compare
with Fig. 6, and with a longer 16MB one to see the influence of
the CCA over several RTTs. For a short message, starting with
congestion windows reflecting full line rates, Figure 13(a)
predictably shows largely similar CCT results. Figure 13(b)
shows that with longer messages, the CCA needs to rein down
the flow rates, and therefore the CCT inflation can worsen by
some 10% for HOST PKT AR and SWITCH PKT AR. By contrast,
OFAN does not need to be slowed down, reducing its CCT by an
order of magnitude. Intuitively, the CCT inflation is the ratio of
a variable queueing delay by a CCT lower bound. The numerator stays near constant because of the Θ(1) queues, while the
denominator grows by an order of magnitude with the message
size ( _i.e.,_ a bit less than 16× because of the fixed RTT tax).

### 8.4 Training Scenario

Finally, we evaluate the performance of each LB scheme
on a realistic AI training scenario. Specifically, we simulate
training Llama-3 [52] (7B, 70B, and 405B) parallelized using
Fully Sharded Data Parallelization (FSDP) [73, 88] on a
1,024-GPU cluster. The cluster is organized as 128 servers of 8
GPUs, and we assume random server placement. We evaluate
the main network bottleneck in FSDP training by focusing on
the backward pass, as it combines a ReduceScatter of gradients
and an AllGather of weights. FSDP traffic is implemented as
a hierarchical ring, where intra-server communications are
performed in the high-bandwidth domain, while our fat-tree
network implements inter-server communications using 8

parallel rings: each logical GPU _𝑖_ is connected to logical GPU
_𝑖_ +8 (mod 1 _,_ 024). We assume FP8 precision and 4KB packet
payload, translating to 104 packets per flow in Llama 7B (32
layers), 418 in Llama 70B (80 layers) and 1570 in Llama 405B
(126 layers). We enable the MSwift CCA with loss recovery,
and measure the CCT of each collective phase.

As shown in Figure 14, while HOST PKT AR and SWITCH
PKT AR overheads remain constant, the relative CCT increase
for OFAN drops as model size scales. At 405B parameters,
OFAN reduces the CCT increase by 52× over baselines. This
improvement stems from superior utilization (Fig. 14(d)):
Since the CCA must throttle HOST PKT AR and SWITCH PKT
AR to maintain stable queue sizes (Fig. 14(e)), OFAN achieves
significantly higher effective throughput.

## 9 Related Work

There is a vast literature on load balancing in datacenters, and
we cannot hope to summarize it in any depth. The citations in
Table 1 provide a subset that covers the space along the dimensions we described in §3. Many of the individual papers evaluate specific designs (that make choices for each of the components), but we are not aware of work that tries to systematically
evaluate each component in designing a solution. This is especially true for the unique setting of large AI training workloads.
In addition, many of these proposed systems [26, 37, 70, 81]
do not seriously consider packet spraying given its potential adverse effects on the transport due to reordering. Some systems
do include spraying in their design [8, 14, 30, 66], but often
introduce specialized mechanisms to make spraying work ( _e.g.,_
proposing an entirely new transport). Two exceptions are [22]
and [11], where packet spraying is evaluated against ECMP
and some other load balancing granularities, but one transport
is assumed and the distance from optimality is unclear. We note
that there are a few works that use topology-aware (sub)flowbased load balancing [4, 69] implemented in the collective
communication library (CCL), in which subflows are placed
on specific paths. This contrasts with our evaluated subflow
setup as we do not model topology-awareness managed at the
host. We categorize these into an approach similar to traffic
engineering (rather than transparent network or transport-level
LB), a space that we leave to exploration in future work.

12

Load Balancing for AI Training Workloads

## 10 Conclusion

As AI training demands push network fabrics toward
packet-level spraying, load-balancing architecture becomes
critical. We systematically evaluated host and switch-based
schemes, finding they perform comparably except when
routing convergence is slow. However, no leading algorithm
achieves optimal _𝑂_ (1) queue scaling at full utilization.
To close this gap, we introduced OFAN, a switch-based
implementation of destination-based rotation that reaches
theoretical queue length optimality. Our evaluations show
OFAN significantly improves completion times and ensures
predictable performance for next-generation AI workloads.

## Acknowledgments

We thank Nandita Dukkipati, Ziming Mao and David
Tennenhouse for their helpful comments. This work was
partly supported by the Louis and Miriam Benjamin Chair in
Computer-Communication Networks.

## References

[1] 2023. csg-htsim. [https://github.com/Broadcom/csg-htsim.](https://github.com/Broadcom/csg-htsim)

[2] 2026. Ultra Ethernet Consortium. [https://ultraethernet.org/.](https://ultraethernet.org/)

[3] Anubhavnidhi Abhashkumar, Kausik Subramanian, Alexey Andreyev,

Hyojeong Kim, Nanda Kishore Salem, Jingyi Yang, Petr Lapukhov,
Aditya Akella, and Hongyi Zeng. 2021. Running BGP in Data
Centers at Scale. In _18th USENIX Symposium on Networked Systems_
_Design and Implementation (NSDI 21)_ . USENIX Association, 65–81.
[https://www.usenix.org/conference/nsdi21/presentation/abhashkumar](https://www.usenix.org/conference/nsdi21/presentation/abhashkumar)

[4] Vamsi Addanki, Prateesh Goyal, Ilias Marinos, and Stefan Schmid.

2025. Ethereal: Divide and Conquer Network Load Balancing
in Large-Scale Distributed Training. [arXiv:2407.00550](http://arxiv.org/abs/2407.00550) [cs.NI]
[https://arxiv.org/abs/2407.00550](https://arxiv.org/abs/2407.00550)

[5] Ronald G Addie and Moshe Zukerman. 2002. An approximation
for performance evaluation of stationary single server queues. _IEEE_
_Transactions on Communications_ 42, 12 (2002), 3150–3160.

[6] Mohammad Al-Fares, Sivasankar Radhakrishnan, Barath Raghavan, Nel
son Huang, Amin Vahdat, et al. 2010. Hedera: dynamic flow scheduling
for data center networks.. In _Nsdi_, Vol. 10. San Jose, USA, 89–92.

[7] Mohammad Alizadeh, Tom Edsall, Sarang Dharmapurikar, Ramanan

Vaidyanathan, Kevin Chu, Andy Fingerhut, Vinh The Lam, Francis
Matus, Rong Pan, Navindra Yadav, et al. 2014. CONGA: Distributed
congestion-aware load balancing for datacenters. In _Proceedings of the_
_2014 ACM conference on SIGCOMM_ . 503–514.

[8] Mohammad Alizadeh, Shuang Yang, Milad Sharif, Sachin Katti,

Nick McKeown, Balaji Prabhakar, and Scott Shenker. 2013. pFabric:
Minimal near-optimal datacenter transport. _ACM SIGCOMM Computer_
_Communication Review_ 43, 4 (2013), 435–446.

[9] Arista. 2026. UCMP. [https://www.arista.com/en/support/toi/tag/ucmp.](https://www.arista.com/en/support/toi/tag/ucmp)

[10] Theophilus Benson, Ashok Anand, Aditya Akella, and Ming Zhang.

2011. MicroTE: Fine grained traffic engineering for data centers.
In _Proceedings_ _of_ _the_ _seventh_ _conference_ _on_ _emerging_ _networking_
_experiments and technologies_ . 1–12.

[11] Tommaso Bonato, Abdul Kabbani, Ahmad Ghalayini, Michael

Papamichael, Mohammad Dohadwala, Lukas Gianinazzi, Mikhail
Khalilov, Elias Achermann, Daniele De Sensi, and Torsten Hoefler.
2026. REPS: Recycled Entropy Packet Spraying for Adaptive Load
Balancing and Failure Mitigation. In _EuroSys_ .

,

[12] Broadcom. [n. d.]. Tomahawk3 / BCM56980 Series. [https:](https://www.broadcom.com/products/ethernet-connectivity/switching/strataxgs/bcm56980-series)
[//www.broadcom.com/products/ethernet-connectivity/switching/st](https://www.broadcom.com/products/ethernet-connectivity/switching/strataxgs/bcm56980-series)
[rataxgs/bcm56980-series.](https://www.broadcom.com/products/ethernet-connectivity/switching/strataxgs/bcm56980-series)

[13] Broadcom. 2026. Tomahawk4 / BCM56990 Series. [https:](https://www.broadcom.com/products/ethernet-connectivity/switching/strataxgs/bcm56990-series)
[//www.broadcom.com/products/ethernet-connectivity/switching/st](https://www.broadcom.com/products/ethernet-connectivity/switching/strataxgs/bcm56990-series)
[rataxgs/bcm56990-series.](https://www.broadcom.com/products/ethernet-connectivity/switching/strataxgs/bcm56990-series)

[14] Qizhe Cai, Mina Tahmasbi Arashloo, and Rachit Agarwal. 2022. dcPIM:

Near-optimal proactive datacenter transport. In _Proceedings of the ACM_
_SIGCOMM 2022 Conference_ . 53–65.

[15] Zixian Cai, Zhengyang Liu, Saeed Maleki, Madanlal Musuvathi, Todd

Mytkowicz, Jacob Nelson, and Olli Saarikivi. 2021. Synthesizing
optimal collective algorithms. In _Proceedings of the 26th ACM SIGPLAN_
_Symposium on Principles and Practice of Parallel Programming_ (Virtual
Event, Republic of Korea) _(PPoPP ’21)_ . Association for Computing
Machinery, New York, NY, USA, 62–75. [doi:10.1145/3437801.3441620](https://doi.org/10.1145/3437801.3441620)

[16] Jiaxin Cao, Rui Xia, Pengkun Yang, Chuanxiong Guo, Guohan Lu,

Lihua Yuan, Yixin Zheng, Haitao Wu, Yongqiang Xiong, and Dave
Maltz. 2013. Per-packet load-balanced, low-latency routing for
Clos-based data center networks. In _ACM CoNEXT_ . 49–60.

[17] Ultra Ethernet Consortium. 2026. Ultra Ethernet Specification v1.0.2.

[https://ultraethernet.org/wp-content/uploads/sites/20/2026/01/UE-S](https://ultraethernet.org/wp-content/uploads/sites/20/2026/01/UE-Specification-1.0.2-1.pdf)
[pecification-1.0.2-1.pdf.](https://ultraethernet.org/wp-content/uploads/sites/20/2026/01/UE-Specification-1.0.2-1.pdf)

[18] NVIDIA Corporation. [n. d.]. NVIDIA H100 Tensor Core GPU.
[https://www.nvidia.com/en-us/data-center/h100/.](https://www.nvidia.com/en-us/data-center/h100/)

[19] NVIDIA Corporation. 2020. Collective Operations. [https://docs.nvi](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html)

[dia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html.](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html)

[20] NVIDIA Corporation. 2025. NVIDIA Collective Communications

Library (NCCL). [https://developer.nvidia.com/nccl.](https://developer.nvidia.com/nccl)

[21] Andrew R Curtis, Wonho Kim, and Praveen Yalagandula. 2011. Mahout:

Low-overhead datacenter traffic management using end-host-based
elephant detection. In _2011_ _Proceedings_ _IEEE_ _INFOCOM_ . IEEE,
1629–1637.

[22] Advait Dixit, Pawan Prakash, Y Charlie Hu, and Ramana Rao Kompella.

2013. On the impact of packet spraying in data center networks. In _2013_
_Proceedings IEEE INFOCOM_ . IEEE, 2130–2138.

[23] Jose Duato, Sudhakar Yalamanchili, and Ni Lionel. [n. d.]. _Intercon-_

_nection Networks: An Engineering Approach. 2002_ . Morgan Kaufmann
Publishers Inc.

[24] Sally Floyd, Jamshid Mahdavi, Matt Mathis, and Dr. Allyn Ro
manow. 1996. TCP Selective Acknowledgment Options. RFC 2018.
[doi:10.17487/RFC2018](https://doi.org/10.17487/RFC2018)

[25] FS. 2026. NVIDIA® 64-Port NDR 400G InfiniBand Data Center
Switch. [https://www.fs.com/products/194710.html.](https://www.fs.com/products/194710.html)

[26] Adithya Gangidi, Rui Miao, Shengbao Zheng, Sai Jayesh Bondu,

Guilherme Goes, Hany Morsy, Rohit Puri, Mohammad Riftadi,
Ashmitha Jeevaraj Shetty, Jingyi Yang, et al. 2024. RDMA over Ethernet
for distributed training at MEta scale. In _Proceedings_ _of_ _the_ _ACM_
_SIGCOMM 2024 Conference_ . 57–70.

[27] Barak Gerstein, Mark Silberstein, and Isaac Keslassy. 2025. Making

congestion control robust to per-packet load balancing in datacenters.
_arXiv preprint arXiv:2509.07907_ (2025).

[28] Phillipa Gill, Navendu Jain, and Nachiappan Nagappan. 2011. Under
standing network failures in data centers: measurement, analysis, and
implications. In _Proceedings of the ACM SIGCOMM 2011 Conference_ .
350–361.

[29] Crispín Gomez, Francisco Gilabert, María Engracia Gomez, Pedro

López, and José Duato. 2007. Deterministic versus adaptive routing
in fat-trees. In _2007_ _IEEE_ _International_ _Parallel_ _and_ _Distributed_
_Processing Symposium_ . IEEE, 1–8.

[30] Mark Handley, Costin Raiciu, Alexandru Agache, Andrei Voinescu,

Andrew W Moore, Gianni Antichi, and Marcin Wójcik. 2017. Rearchitecting datacenter networks and stacks for low latency and high

13

,

performance. In _Proceedings_ _of_ _the_ _Conference_ _of_ _the_ _ACM_ _Special_
_Interest Group on Data Communication_ . 29–42.

[31] Keqiang He, Eric Rozner, Kanak Agarwal, Wes Felter, John Carter,

and Aditya Akella. 2015. Presto: Edge-based load balancing for fast
datacenter networks. _ACM_ _SIGCOMM_ _Computer_ _Communication_
_Review_ 45, 4 (2015), 465–478.

[32] Christian Hopps. 2000. Analysis of an Equal-Cost Multi-Path Algorithm.

RFC 2992. [doi:10.17487/RFC2992](https://doi.org/10.17487/RFC2992)

[33] HPE Juniper. 2026. BGP Link-Bandwidth Community.
[https://www.juniper.net/documentation/us/en/software/junos](https://www.juniper.net/documentation/us/en/software/junos/ai-ml-evo/bgp/topics/topic-map/bgp-link-bandwidth.html)
[/ai-ml-evo/bgp/topics/topic-map/bgp-link-bandwidth.html.](https://www.juniper.net/documentation/us/en/software/junos/ai-ml-evo/bgp/topics/topic-map/bgp-link-bandwidth.html)

[34] Huawei. 2026. CloudEngine 9800, 8800, and 6800
V300R024C10, C11 Configuration Guide   - IP Routing.
[https://info.support.huawei.com/hedex/api/pages/EDOC11](https://info.support.huawei.com/hedex/api/pages/EDOC1100277644/AEM10221/04/resources/vrp/dc_vrp_bgp_cfg_4094.html)
[00277644/AEM10221/04/resources/vrp/dc_vrp_bgp_cfg_4094.html.](https://info.support.huawei.com/hedex/api/pages/EDOC1100277644/AEM10221/04/resources/vrp/dc_vrp_bgp_cfg_4094.html)

[35] J.J. Jaramillo, F. Milan, and R. Srikant. 2008. Padded frames: A novel

algorithm for stable scheduling in load-balanced switches. _IEEE/ACM_
_Transactions on Networking_ 16, 5 (2008), 1212–1225.

[36] Abdul Kabbani, Balajee Vamanan, Jahangir Hasan, and Fabien Duchene.

2014. Flowbender: Flow-level adaptive routing for improved latency
and throughput in datacenter networks. In _Proceedings of the 10th ACM_
_International on Conference on emerging Networking Experiments and_
_Technologies_ . 149–160.

[37] Srikanth Kandula, Dina Katabi, Shantanu Sinha, and Arthur Berger.

2007. Dynamic load balancing without packet reordering. _ACM_
_SIGCOMM Computer Communication Review_ 37, 2 (2007), 51–62.

[38] Manolis Katevenis, Stefanos Sidiropoulos, and Costas Courcoubetis.

1991. Weighted round-robin cell multiplexing in a general-purpose
ATM switch chip. _IEEE Journal on selected Areas in Communications_
9, 8 (1991), 1265–1279.

[39] Naga Katta, Aditi Ghag, Mukesh Hira, Isaac Keslassy, Aran Bergman,

Changhoon Kim, and Jennifer Rexford. 2017. Clove: Congestionaware load balancing at the virtual edge. In _Proceedings of the 13th_
_International Conference on emerging Networking EXperiments and_
_Technologies_ . 323–335.

[40] Naga Katta, Mukesh Hira, Changhoon Kim, Anirudh Sivaraman, and Jen
nifer Rexford. 2016. Hula: Scalable load balancing using programmable
data planes. In _Proceedings of the Symposium on SDN Research_ . 1–12.

[41] Isaac Keslassy. 2004. _The load-balanced router_ . Stanford University.

[42] Isaac Keslassy, Shang-Tse Chuang, Kyoungsik Yu, David Miller, Mark

Horowitz, Olav Solgaard, and Nick McKeown. 2003. Scaling internet
routers using optics. _ACM SIGCOMM_ 33, 4 (2003), 189–200.

[43] Gautam Kumar, Nandita Dukkipati, Keon Jang, Hassan MG Wassel,

Xian Wu, Behnam Montazeri, Yaogong Wang, Kevin Springborn,
Christopher Alfeld, Michael Ryan, et al. 2020. Swift: Delay is simple
and effective for congestion control in the datacenter. In _Proceedings_
_of the Annual conference of the ACM Special Interest Group on Data_
_Communication on the applications, technologies, architectures, and_
_protocols for computer communication_ . 514–528.

[44] Jennifer Langston. 2020. Microsoft announces new supercomputer, lays

out vision for future AI work. [https://news.microsoft.com/source/fe](https://news.microsoft.com/source/features/ai/openai-azure-supercomputer/)
[atures/ai/openai-azure-supercomputer/.](https://news.microsoft.com/source/features/ai/openai-azure-supercomputer/)

[45] Petr Lapukhov, Ariff Premji, and Jon Mitchell. 2016. Use of
BGP for Routing in Large-Scale Data Centers. RFC 7938.
[doi:10.17487/RFC7938](https://doi.org/10.17487/RFC7938)

[46] Petr Lapukhov, Ariff Premji, and Jon Mitchell. 2016. Use of
BGP for Routing in Large-Scale Data Centers. RFC 7938.
[doi:10.17487/RFC7938](https://doi.org/10.17487/RFC7938)

[47] Yanfang Le, Rong Pan, Peter Newman, Jeremias Blendin, Ab
dul Kabbani, Vipin Jain, Raghava Sivaramu, and Francis Matus.
2024. STrack: A Reliable Multipath Transport for AI/ML Clusters.
[arXiv:2407.15266 [cs.NI]](http://arxiv.org/abs/2407.15266) [https://arxiv.org/abs/2407.15266](https://arxiv.org/abs/2407.15266)

McClure et al.

[48] Lee, Kevin and Gangidi, Adi and Oldham, Mathew. 2024. Building

Meta’s GenAI Infrastructure. [https://engineering.fb.com/2024/03/1](https://engineering.fb.com/2024/03/12/data-center-engineering/building-metas-genai-infrastructure/)
[2/data-center-engineering/building-metas-genai-infrastructure/.](https://engineering.fb.com/2024/03/12/data-center-engineering/building-metas-genai-infrastructure/)

[49] Dan Lenoski and Nandita Dukkipati. 2023. Google opens Falcon, a reliable low-latency hardware transport, to the ecosystem.
[https://cloud.google.com/blog/topics/systems/introducing-falcon-a](https://cloud.google.com/blog/topics/systems/introducing-falcon-a-reliable-low-latency-hardware-transport)
[-reliable-low-latency-hardware-transport.](https://cloud.google.com/blog/topics/systems/introducing-falcon-a-reliable-low-latency-hardware-transport)

[50] Shenggui Li and Siqi Mai. [n. d.]. Paradigms of Parallelism.
[https://colossalai.org/docs/concepts/paradigms_of_parallelism/.](https://colossalai.org/docs/concepts/paradigms_of_parallelism/)

[51] Stephane Litkowski, Satya R Mohanty, Arie Vayner, Akshay Gattani,

Ajay Kini, Jeff Tantsura, and Reshma Das. 2025. _BGP link bandwidth_
_extended community use cases_ . Internet-Draft draft-ietf-bess-ebgp-dmz08. Internet Engineering Task Force. [https://datatracker.ietf.org/doc](https://datatracker.ietf.org/doc/draft-ietf-bess-ebgp-dmz/08/)
[/draft-ietf-bess-ebgp-dmz/08/](https://datatracker.ietf.org/doc/draft-ietf-bess-ebgp-dmz/08/) Work in Progress.

[52] AI @ Meta Llama Team. 2024. The Llama 3 Herd of Models. _arXiv_

_preprint arXiv:2407.21783_ (2024).

[53] Jie Lu, Jiaqi Gao, Fei Feng, Zhiqiang He, Menglei Zheng, Kun Liu,

Jun He, Binbin Liao, Suwei Xu, Ke Sun, Yongjia Mo, Qinghua Peng,
Jilie Luo, Qingxu Li, Gang Lu, Zishu Wang, Jianbo Dong, Kunling
He, Sheng Cheng, Jiamin Cao, Hairong Jiao, Pengcheng Zhang,
Shu Ma, Lingjun Zhu, Chao Shi, Yangming Zhang, Yiquan Chen,
Wei Wang, Shuhong Zhu, Xingru Li, Qiang Wang, Jiang Liu, Chao
Wang, Wei Lin, Ennan Zhai, Jiesheng Wu, Qiang Liu, Binzhang Fu,
and Dennis Cai. 2025. Alibaba Stellar: A New Generation RDMA
Network for Cloud AI. In _Proceedings of the ACM SIGCOMM 2025_
_Conference_ (São Francisco Convent, Coimbra, Portugal) _(SIGCOMM_
_’25)_ . Association for Computing Machinery, New York, NY, USA,

453–466. [doi:10.1145/3718958.3750539](https://doi.org/10.1145/3718958.3750539)

[54] Michael Luby. 2002. LT Codes . In _2013 IEEE 54th Annual Symposium_

_on_ _Foundations_ _of_ _Computer_ _Science_ . IEEE Computer Society, Los
Alamitos, CA, USA, 271. [doi:10.1109/SFCS.2002.1181950](https://doi.org/10.1109/SFCS.2002.1181950)

[55] Michael Menth and Stefan Muehleck. 2010. Packet waiting time for

multiplexed periodic on/off streams in the presence of overbooking.
_International_ _Journal_ _of_ _Communication_ _Networks_ _and_ _Distributed_
_Systems_ 4, 2 (2010), 207–229.

[56] Lorenz Minder, Amin Shokrollahi, Mark Watson, Michael Luby, and

Thomas Stockhammer. 2011. RaptorQ Forward Error Correction
Scheme for Object Delivery. RFC 6330. [doi:10.17487/RFC6330](https://doi.org/10.17487/RFC6330)

[57] Prodosh Mohapatra, Reshma Das, SATYA R MOHANTY, Serge Krier,

Rafal Jan Szarecki, and Akshay Gattani. 2026. _BGP Link Bandwidth_
_Extended Community_ . Internet-Draft draft-ietf-idr-link-bandwidth-24.
Internet Engineering Task Force. [https://datatracker.ietf.org/doc/dra](https://datatracker.ietf.org/doc/draft-ietf-idr-link-bandwidth/24/)
[ft-ietf-idr-link-bandwidth/24/](https://datatracker.ietf.org/doc/draft-ietf-idr-link-bandwidth/24/) Work in Progress.

[58] Yang Nie, Zheng Shi, Xinyi Chen, and Liguo Qian. 2022. An
Out-of-Order Packet Processing Algorithm of RoCE Based on
Improved SACK. In _2022 IEEE 6th Advanced Information Technology,_
_Electronic and Automation Control Conference (IAEAC )_ . 1402–1408.
[doi:10.1109/IAEAC54830.2022.9929858](https://doi.org/10.1109/IAEAC54830.2022.9929858)

[59] NOKIA. 2026. BGP. [https://documentation.nokia.com/srlinux/25-7](https://documentation.nokia.com/srlinux/25-7/books/routing-protocols/bgp.html)

[/books/routing-protocols/bgp.html.](https://documentation.nokia.com/srlinux/25-7/books/routing-protocols/bgp.html)

[60] NVIDIA. [n. d.]. Out-of-order Data Placement. [https://docs.nvidia.co](https://docs.nvidia.com/doca/archive/2-9-4/out-of-order-data-placement/index.html)

[m/doca/archive/2-9-4/out-of-order-data-placement/index.html.](https://docs.nvidia.com/doca/archive/2-9-4/out-of-order-data-placement/index.html)

[61] NVIDIA. 2023. NVIDIA InfiniBand Adaptive Routing Technology Accelerating HPC and AI Applications.
[https://www.amax.com/content/files/2023/12/NVIDIA_Infin](https://www.amax.com/content/files/2023/12/NVIDIA_InfiniBand_Adaptive_Routing_Technology_Insights_Whitepaper.pdf)
[iBand_Adaptive_Routing_Technology_Insights_Whitepaper.pdf.](https://www.amax.com/content/files/2023/12/NVIDIA_InfiniBand_Adaptive_Routing_Technology_Insights_Whitepaper.pdf)

[62] NVIDIA. 2024. NVIDIA Spectrum-X Network Platform Architecture.

[https://resources.nvidia.com/en-us-networking-ai/nvidia-spectrum-x.](https://resources.nvidia.com/en-us-networking-ai/nvidia-spectrum-x)

[63] NVIDIA. 2026. BGP Weighted Equal Cost Multipath.
[https://docs.nvidia.com/networking-ethernet-software/cumulus-lin](https://docs.nvidia.com/networking-ethernet-software/cumulus-linux-515/Layer-3/Routing/BGP-Weighted-Equal-Cost-Multipath/)
[ux-515/Layer-3/Routing/BGP-Weighted-Equal-Cost-Multipath/.](https://docs.nvidia.com/networking-ethernet-software/cumulus-linux-515/Layer-3/Routing/BGP-Weighted-Equal-Cost-Multipath/)

14

Load Balancing for AI Training Workloads

[64] NVIDIA. 2026. NVIDIA DGX SuperPOD: Next Generation Scalable

Infrastructure for AI Leadership Reference Architecture Featuring
NVDIA DGX H100 . [https://docs.nvidia.com/dgx-superpod/referenc](https://docs.nvidia.com/dgx-superpod/reference-architecture-scalable-infrastructure-h100/latest/components.html)
[e-architecture-scalable-infrastructure-h100/latest/components.html.](https://docs.nvidia.com/dgx-superpod/reference-architecture-scalable-infrastructure-h100/latest/components.html)

[65] NVIDIA Corporation. [n. d.]. NVIDIA Spectrum SN5000 Series
Switches. [https://nvdam.widen.net/s/mmvbnpk8qk/networking-eth](https://nvdam.widen.net/s/mmvbnpk8qk/networking-ethernet-switches-sn5000-datasheet-us)
[ernet-switches-sn5000-datasheet-us.](https://nvdam.widen.net/s/mmvbnpk8qk/networking-ethernet-switches-sn5000-datasheet-us)

[66] Vladimir Olteanu, Haggai Eran, Dragos Dumitrescu, Adrian Popa,

Cristi Baciu, Mark Silberstein, Georgios Nikolaidis, Mark Handley,
and Costin Raiciu. 2022. An edge-queued datagram service for all
datacenter traffic. In _19th USENIX Symposium on Networked Systems_
_Design and Implementation (NSDI 22)_ . 761–777.

[67] Jonathan Perry, Amy Ousterhout, Hari Balakrishnan, Devavrat Shah,

and Hans Fugal. 2014. Fastpass: A centralized" zero-queue" datacenter
network. In _Proceedings of the 2014 ACM conference on SIGCOMM_ .
307–318.

[68] Chenchen Qi, Wenfei Wu, Yongcan Wang, Keqiang He, Yu
Hsiang (Sean) Kao, Zongying He, Chen-Yu Yen, Zhuo Jiang, Feng
Luo, Surendra Anubolu, Yanjin Gao, Bingfeng Lin, Wenda Ni,
Yiming Yang, Donglin Wei, Boyang Zhou, Jian Wang, and Shan
Ding. 2025. SGLB: Scalable and Robust Global Load Balancing in
Commodity AI Clusters. In _Proceedings of the ACM SIGCOMM 2025_
_Conference_ (São Francisco Convent, Coimbra, Portugal) _(SIGCOMM_
_’25)_ . Association for Computing Machinery, New York, NY, USA,

626–644. [doi:10.1145/3718958.3750527](https://doi.org/10.1145/3718958.3750527)

[69] Kun Qian, Yongqing Xi, Jiamin Cao, Jiaqi Gao, Yichi Xu, Yu Guan,

Binzhang Fu, Xuemei Shi, Fangbo Zhu, Rui Miao, et al. 2024. Alibaba
hpn: A data center network for large language model training. In
_Proceedings of the ACM SIGCOMM 2024 Conference_ . 691–706.

[70] Mubashir Adnan Qureshi, Yuchung Cheng, Qianwen Yin, Qiaobin Fu,

Gautam Kumar, Masoud Moshref, Junhua Yan, Van Jacobson, David
Wetherall, and Abdul Kabbani. 2022. PLB: congestion signals are
simple and effective for network load balancing. In _Proceedings of the_
_ACM SIGCOMM 2022 Conference_ . 207–218.

[71] Costin Raiciu, Dragos Niculescu, Marcelo Bagnulo, and Mark James

Handley. 2011. Opportunistic mobility with multipath TCP. In
_Proceedings of the sixth international workshop on MobiArch_ . 7–12.

[72] Samyam Rajbhandari, Conglong Li, Zhewei Yao, Minjia Zhang,

Reza Yazdani Aminabadi, Ammar Ahmad Awan, Jeff Rasley, and
Yuxiong He. 2022. DeepSpeed-MoE: Advancing Mixture-ofExperts Inference and Training to Power Next-Generation AI Scale.
[arXiv:2201.05596 [cs.LG]](http://arxiv.org/abs/2201.05596) [https://arxiv.org/abs/2201.05596](https://arxiv.org/abs/2201.05596)

[73] Samyam Rajbhandari, Jeff Rasley, Olatunji Ruwase, and Yuxiong He.

2020. ZeRO: Memory optimizations toward training trillion parameter
models. In _SC20:_ _International_ _Conference_ _for_ _High_ _Performance_
_Computing, Networking, Storage and Analysis_ . IEEE, 1–16.

[74] James Roberts, Ugo Mocci, and Jorma Virtamo. 1996. _Broadband_

_network_ _traffic:_ _Performance_ _evaluation_ _and_ _design_ _of_ _broadband_
_multiservice networks_ . Springer.

[75] Siddhartha Sen, David Shue, Sunghwan Ihm, and Michael J Freedman.

2013. Scalable, optimal flow routing in datacenters via local link
balancing. In _Proceedings of the ninth ACM conference on Emerging_
_networking experiments and technologies_ . 151–162.

[76] A. Shokrollahi. 2006. Raptor codes. _IEEE Transactions on Information_

_Theory_ 52, 6 (2006), 2551–2567. [doi:10.1109/TIT.2006.874390](https://doi.org/10.1109/TIT.2006.874390)

[77] Alexander Shpiner, Zachy Haramaty, Saar Eliad, Vladimir Zdornov,

Barak Gafni, and Eitan Zahavi. 2017. Dragonfly+: Low Cost Topology
for Scaling Datacenters. In _2017_ _IEEE_ _3rd_ _International_ _Workshop_
_on High-Performance Interconnection Networks in the Exascale and_
_Big-Data Era (HiPINEB)_ . 1–8. [doi:10.1109/HiPINEB.2017.11](https://doi.org/10.1109/HiPINEB.2017.11)

[78] Cha Hwan Song, Xin Zhe Khooi, Raj Joshi, Inho Choi, Jialin Li, and

Mun Choon Chan. 2023. Network Load Balancing with In-network

,

Reordering Support for RDMA. In _Proceedings of the ACM SIGCOMM_
_2023_ _Conference_ (New York, NY, USA) _(ACM_ _SIGCOMM_ _’23)_ .
Association for Computing Machinery, New York, NY, USA, 816–831.
[doi:10.1145/3603269.3604849](https://doi.org/10.1145/3603269.3604849)

[79] Seyed Mohammadhossein Tabatabaee, Jean-Yves Le Boudec, and Marc

Boyer. 2021. Interleaved weighted round-robin: A network calculus
analysis. _IEICE_ _Transactions_ _on_ _Communications_ 104, 12 (2021),
1479–1493.

[80] Rajeev Thakur and William D. Gropp. 2003. Improving the Performance

of Collective Operations in MPICH. In _Recent Advances in Parallel_
_Virtual_ _Machine_ _and_ _Message_ _Passing_ _Interface_, Jack Dongarra,
Domenico Laforenza, and Salvatore Orlando (Eds.). Springer Berlin
Heidelberg, Berlin, Heidelberg, 257–267.

[81] Erico Vanini, Rong Pan, Mohammad Alizadeh, Parvin Taheri, and Tom

Edsall. 2017. Let it flow: Resilient asymmetric load balancing with
flowlet switching. In _14th USENIX Symposium on Networked Systems_
_Design and Implementation (NSDI 17)_ . 407–420.

[82] Lean Wang, Huazuo Gao, Chenggang Zhao, Xu Sun, and Damai Dai.

2024. Auxiliary-Loss-Free Load Balancing Strategy for Mixture-ofExperts. [arXiv:2408.15664 [cs.LG]](http://arxiv.org/abs/2408.15664) [https://arxiv.org/abs/2408.15664](https://arxiv.org/abs/2408.15664)

[83] Peng Wang, Hong Xu, Zhixiong Niu, Dongsu Han, and Yongqiang

Xiong. 2016. Expeditus: Congestion-aware load balancing in clos data
center networks. In _Proceedings of the Seventh ACM Symposium on_
_Cloud Computing_ . 442–455.

[84] Cliff Woolley. [n. d.]. NCCL: Accelerated multi-GPU collective
communications. [https://images.nvidia.com/events/sc15/pdfs/NCC](https://images.nvidia.com/events/sc15/pdfs/NCCL-Woolley.pdf)
[L-Woolley.pdf.](https://images.nvidia.com/events/sc15/pdfs/NCCL-Woolley.pdf)

[85] David Zats, Tathagata Das, Prashanth Mohan, Dhruba Borthakur, and

Randy Katz. 2012. DeTail: Reducing the flow completion time tail
in datacenter networks. In _Proceedings of the ACM SIGCOMM 2012_
_conference on Applications, technologies, architectures, and protocols_
_for computer communication_ . 139–150.

[86] Hong Zhang, Junxue Zhang, Wei Bai, Kai Chen, and Mosharaf

Chowdhury. 2017. Resilient datacenter load balancing in the wild. In
_Proceedings of the Conference of the ACM Special Interest Group on_
_Data Communication_ . 253–266.

[87] Jie Zhang, Dafang Zhang, and Kun Huang. 2015. Improving datacenter

throughput and robustness with Lazy TCP over packet spraying.
_Computer Communications_ 62 (2015), 23–33.

[88] Yanli Zhao, Andrew Gu, Rohan Varma, Liang Luo, Chien-Chin Huang,

Min Xu, Less Wright, Hamid Shojanazeri, Myle Ott, Sam Shleifer, et al.
2023. PyTorch FSDP: Experiences on scaling fully sharded data parallel.
_Proceedings of the VLDB Endowment_ 16, 12 (2023), 3848–3860.

15

,

**A** **Sending Rate for Randomized Failures**

As mentioned in §5, we randomly fail links with a configured
probability. Given the random process, we cannot ensure that
there is sufficient capacity in the network to serve the demand.
Further, even if there is sufficient capacity for a given rate
(even line rate), it is not clear that any load balancing scheme
will be able to manage the demand.

With failures, there may be a possible routing of flows
that can serve the traffic at some optimal rate _𝜌𝑜𝑝𝑡_ . However,
this may only be achievable with some traffic engineering
approach that can route flows according to the solution of a
multi-commodity maximum concurrent flow problem (MCFP)

- _i.e.,_ simply load balancing across available paths will not

reach the solution that allows _𝜌𝑜𝑝𝑡_ . For example, some flows
may only be able to traverse one path, and therefore other
flows should specifically not use that path.

Thus, we instead use a more realistic model of what
load-balancing schemes do: attempt to spread load equally
across all available paths. Accordingly, we define _𝜌_ max as
the maximum possible rate the network can serve under the
assumption that all flows will be split evenly among their available paths. The value of _𝜌_ max can be rather easily calculated
by counting the units of flow on each link for each flow and
finding the maximally loaded link in the network. Assume that
this bottleneck link has total flow _𝐹_ on it and every link in the
network has bandwidth _𝐵_ . Then the per-flow rate, _𝜌_ max = _[𝐵]_ _𝐹_ [.]

We note that this is a rather pessimistic rate (there may be
wasted capacity in the network), but it ensures that the demand
will not congest the network with failures. Further, we find
that despite being a lower bound, different load-balancing
schemes are still differentiated by it.

**B** **Permutation CCT Lower-Bound**

**Outline.** Figure 15 illustrates how permutation collectives in
fat trees exhibit interesting interactions between data and ACK
packets, as each host is at the same time a sender and a receiver.
When computing the CCT, we find that there are in fact
three successive modes of communication: (1) Data packets
only, then (2) interleaved data and ACK packets, and finally
(3) ACK packets only. In order to provide a lower bound for
the CCT, we need to take these three modes into account.
**Assumptions.** In the remainder, we focus on a node that
receives a flow of data packets going through _𝐻_ = 6 hops,
and sends another flow of ACK packets traversing _𝐻_ hops
as well. Let _𝑇𝑑_, _𝑇𝑎_, _𝑇𝑔_ and _𝑇𝑝_ respectively denote the data and
ACK packet serialization times, the gap time between packets,
and the one-way propagation time. Also, let _𝑇𝑑_ [′] [=] _[𝑇][𝑑]_ [+] _[𝑇][𝑔]_ [and]

_𝑇𝑎_ [′] [=] _[𝑇][𝑎]_ [+] _[𝑇][𝑔]_ [.]

**Mode** **1:** **only** **data.** The last bit of the first data packet of
each message goes through at least a propagation time of _𝑇𝑝_

_𝑡𝑖_ 1 = _𝑇_ 1 +( _𝑖_ 1 −1) _𝑇𝑑_ [. The first ACK for packet 1 arrives just after,]

at _𝑡_ 1 [ACK] = _𝑇𝑖_ 1 + _𝑇𝑎_ [′][.]

Afterwards, all packets are sent in an interleaved way,
data-ACK-data-ACK-etc. Therefore, the ACK for packet _𝑖_
arrives at _𝑡𝑖_ [ACK] = _𝑡_ 1 [ACK] +( _𝑖_ −1)( _𝑇𝑑_ [′] [+] _[𝑇]_ _𝑎_ [′][)][.]

**Mode** **3:** **only** **ACKs.** At the end, the hosts send the _𝑚_ [th]

message, and don’t need to interleave data and ACKs anymore.
This is a symmetric case from _𝑖_ 1: it happens as they send ACK
_𝑖_ 2, with _𝑖_ 2 = _𝑚_ - _𝑖_ 1 +1. For example, with _𝑚_ = 256 and _𝑖_ 1 = 78,
it happens at the ACK for packet 179.

Beyond index _𝑖_ 2, we have two constraints. First, ACKs
should have time to be transmitted. We get a first lower-bound
time _𝑡𝑖_ [ACK] (1) = _𝑡𝑖_ [ACK] 2 +( _𝑖_ - _𝑖_ 2)( _𝑇𝑎_ [′][)][. Second, ACK packets can]

obviously only be sent if they acknowledge a data packet that

McClure et al.

**Figure** **15:** **Illustration** **of** **the** **symmetric** **dynamics** **of** **the**
**permutation collective.**

and _𝐻_ serialization delays of _𝑇𝑑_, thus packet 1 arrives at time
_𝑡_ 1 = _𝑇𝑝_ + _𝐻_ - _𝑇𝑑_ .

When it gets to the receiver, this receiver is in the middle
of sending data packet indexed _𝑖_ 1. It needs _𝑇𝑑_ +( _𝑖_ 1 −1) · _𝑇𝑑_ [′] [to]

send these _𝑖_ 1 data packets. Therefore, putting both equations
together yields _𝑖_ 1:

_𝑖_ 1 =

- _𝑇𝑝_ +( _𝐻_ −1)· _𝑇𝑑_
_𝑇_ [′]

_𝑑_

+1 (6)

**Example.** With the paper’s settings, _𝑖_ 1 = 78 data packets. In
other words, each sender sends at least 78 consecutive data
packets before it sends ACKs. OF course, if _𝑚_ _<𝑖_ 1, then it only
sends _𝑚_ data packets.
**Mode 2: interleaved data and ACK packets.** Once the host
starts interleaving data and ACK packets, we assume that the
host policy performs round-robin between the two, as long
as there is data left.

Let’s study when the first ACK arrives. Before, we saw
that _𝑖_ 1 data packets are sent. We also saw that packet 1 arrives
at time _𝑡_ 1 = _𝑇𝑝_ + _𝐻_ - _𝑇𝑑_ . Therefore, packet _𝑖_ 1 arrives at time
_𝑡𝑖_ 1 = _𝑇_ 1 +( _𝑖_ 1 −1) _𝑇𝑑_ [′][. The first ACK for packet 1 arrives just after,]

1 [ACK] = _𝑇𝑖_ 1 + _𝑇𝑎_ [′]

1 [ACK] +( _𝑖_ −1)( _𝑇𝑑_ [′]

_𝑖_ [ACK] = _𝑡_ [ACK]

_𝑑_ [′] [+] _[𝑇]_ _𝑎_ [′]

_𝑖_ [ACK] 2 +( _𝑖_ - _𝑖_ 2)( _𝑇𝑎_ [′]

_𝑖_ [ACK] (1) = _𝑡𝑖_ [ACK]

16

Load Balancing for AI Training Workloads

has arrived. Just like packet _𝑖_ 1 arrived just before ACK 1, so
does packet _𝑖_ arrive just before ACK _𝑖_ −( _𝑖_ 1 − 1). Thus, we
obtain a second lower-bound time: _𝑡𝑖_ [ACK] (2) = _𝑡𝑖_ [ACK] −( _𝑖_ 1 −1) [+(] _[𝐻]_ [−]

1)( _𝑇𝑎_ [′][)+] _[𝑇][𝑝]_ [. Finally, the lower bound is the maximum of both]
constraints: for _𝑖_ 2 +1 ≤ _𝑖_ ≤ _𝑚_, _𝑡𝑖_ [ACK] =max  _𝑡𝑖_ [ACK] (1) _,𝑡𝑖_ [ACK] (2)  .

_𝑖_ [ACK] (2) = _𝑡_ [ACK]

_𝑖_ [ACK] =max  _𝑡𝑖_ [ACK]

_𝑖_ [ACK] (1) _,𝑡𝑖_ [ACK]

constraints: for _𝑖_ 2 +1 ≤ _𝑖_ ≤ _𝑚_, _𝑡𝑖_ [ACK] =max  _𝑡𝑖_ [ACK] (1) _,𝑡𝑖_ [ACK] (2)  .

**Example.** With our default assumptions, we get a lower bound
of 17 _._ 05694 _𝜇_ s for a message size _𝑚_ =256 _._ We want to compare
that to smallest value that we can get. We only send a flow
from the first host to the last and back in a small network
( _𝑘_ = 4), using all algorithms, iterate 1000 times, and take the
minimum over all possibilities, we measure in practice a value
of 17 _._ 0587 _𝜇_ s (with _𝑘_ = 8, we get 17 _._ 0609 _𝜇_ s, which is less
tight). That is, the difference is 10 [−][4] of the CCT, less than a
packet time, showing the tightness of the lower bound.

**C** **Proof of Theorem 1: Synchronization**

**C.1** **Proof Overview**

We now prove the synchronization properties of SIMPLE RR
and JSQ. The synchronization derives from three properties:
**1. Perfect match for first packets.** Consider an edge switch
without internal traffic. Assume that flow 1 sends the first
packet, which is forwarded to uplink port _𝑖_ . Each of the other
flows then sends one packet that is forwarded to a distinct
uplink port: (i) In RR, because of the round-robin rotation;
and (ii) in AR, because the queues of these ports are initially
empty, then any port that is assigned a packet gets a queue size
of 1 and is removed from consideration for a duration _𝑇_ . At the
end, there is a perfect 1-to-1 match of packets to uplink ports.
**2. Sticky flows.** When the second packet of flow 1 arrives after
a period _𝑇_ : (i) in _𝑅𝑅_, it will be sent again to port _𝑖_ due to the
round-robin periodic rotation, and (ii) in _𝐴𝑅_, the first packet of
flow 1 will have just left, since it takes _𝐿_ PKT/ _𝐶_ _<𝑇_ to service
it. Thus port _𝑖_ is the only empty port and the second picks it.
In both cases, port _𝑖_ is a sticky port for flow 1. Likewise, each
other flow will have its own sticky port.
**3. Aggregation switch layout.** Now we understand how flows
can be stuck onto specific edge-aggregation links. In addition,
in a fat tree, a flow stuck to aggregation switch _𝑖_ of a source
pod will also be stuck to aggregation switch _𝑖_ of a destination
pod (black and red circles in Fig. 2). Thus, two flows from
different source pods but destined to the same edge switch
may have picked the same aggregation switch _𝑖_, leading to
contention at the link from the destination aggregation switch
to the destination edge switch and to linear growth of its queue.
**Proof outline.** We focus on the synchronization of (at least)
two flows that end up sharing a single aggregation-edge
link. When this happens, the queue growth is linear. The
probability of such a synchronization yields a lower bound
on the general synchronization probability. We show that as
switches becomes larger, this probability goes to 1.

,

**C.2** **Proof**

PROOF OF THEOREM 1. More specifically, we show that
SIMPLE RR exhibits such a core-aggregation link synchronization whenever at least two flows satisfy three specific
properties; and JSQ exhibits it whenever four properties are
satisfied. We will first list the four properties, then show that
the general probability goes to 1 for larger switches.
**Property 1: Red flows.** For the sake of discussion, we will
denote _red_ _flows_ as flows originating at a _red_ _edge_ _switch_,
which is an edge switch that satisfies two properties: (i) It
has no internal traffic, _i.e.,_ all its flows are northbound; and
(ii) not all its flows are destined to the exact same destination
edge switch. The goal of the first condition is to ensure
that the number of northbound flows equals the number of
northbound ports, which facilitates synchronization. The goal
of the second condition is to avoid a rare case where all of the
flows to the same destination effectively come from source
aggregation switches with different pod indices, and therefore
from distinct destination aggregation switches because of the
fat-tree properties, which prevents the synchronization.

The probability for the first condition that all traffic is
northbound is the probability that the first flow is northbound,
times the probability for the second flow, _etc._

Let _𝐴_ denote the event that all flows are northbound, and
_𝐵_ that all flows target the exact same outside hotspot. An
edge switch is red (event _𝐶_ ) if _𝐴_ happens but _𝐵_ doesn’t. So
_𝑃_ ( _𝐶_ ) = _𝑃_ ( _𝐴_ )− _𝑃_ ( _𝐴_ ∩ _𝐵_ ) = _𝑃_ ( _𝐴_ )− _𝑃_ ( _𝐵_ ) _,_ thus

_𝑃𝑅𝑒𝑑_ = _𝑃_ northbound         - _𝑃_ hotspot _._ (10)

**Property** **2:** **Safe** **flows.** To prove synchronization in JSQ
aggregation-edge links, we require that when a packet needs
to select an uplink port, there exists _exactly one port with the_
_strictly shortest queue_ . Furthermore, this specific port must
be identical to the one used by the previous packet of the same
flow.

To ensure this continuity, we focus on a flow, and define
strict timing constraints regarding the service completion
of competing flows relative to the service completion of our
flow’s previous packet:

_𝑃_ northbound = _[𝑛]_ [−] _[𝑘]_ [/][2]

[−] _[𝑘]_ [/][2]

_𝑛_ −1 [·] _[𝑛]_ [−] _𝑛_ _[𝑘]_ - [/][2] 2 [−][1]

_[𝑘]_ [/][2][−][1]

····· _[𝑛]_ [−] _[𝑘]_ [+][1] (7)
_𝑛_ −2 _𝑛_ - _𝑘_ /2

=

_𝑘_ /2−1

_𝑖_ =0

_𝑛_ - _𝑘_ /2− _𝑖_

(8)
_𝑛_ −1− _𝑖_

The probability for the second condition that all traffic
targets the same outside hotspot edge switch is the product
of the probability that the first host picks any such edge, times
the probability that other hosts follow:

_𝑃_ hotspot = _[𝑛]_ [−] _[𝑘]_ [/][2]

_𝑛_ −1 [·]

_𝑃_ hotspot = _[𝑛]_ [−] _[𝑘]_ [/][2]

_𝑘_ /2−1

_𝑖_ =1

_𝑘_ /2− _𝑖_
(9)
_𝑛_ −1− _𝑖_

17

,

(i) No packets in other queues completed transmission

within the the inter-arrival gap duration _𝑇𝐼𝑃𝐺_ _before_ the
service completion of the flow’s packet. The reason is
that if a packet from a competing flow were to finish
within this window, its queue would become empty.
When the next packet of that competing flow arrives,
it will observe two empty queues (its own and the target
flow’s). Consequently, it may select the target flow’s
port with equal probability, which we want to avoid.
(ii) No packets in other queues completed transmission

within the duration _𝑇𝐼𝑃𝐺_ _after_ the service completion of
the flow’s packet. The reason is that if a competing flow
finishes within this window, its queue also becomes
empty. The next packet of our target flow arrives exactly
_𝑇𝐼𝑃𝐺_ after the service completion of the last packet

from our considered flow. Thus, it will encounter two
empty queues (its original port and the competitor’s).
It may therefore select the competitor’s port instead of
preserving its path.

Combined, these conditions imply that no other flows initiated
their transmission time within the critical window of _𝑇𝐼𝑃𝐺_
before and after the requested flow.

**Explanation:** Since no other packets completed service
during the critical window, we encounter a state where there
are exactly _𝑘_ /2 - 1 packets distributed across the _𝑘_ /2 uplink
queues. Under the JSQ policy, this implies that every queue
holds exactly one packet, except for a single empty queue.
We know that no state change has occurred since the previous
packet from our flow departed this specific queue. Therefore,
the AR algorithm will deterministically select this exact same
port again. This mechanism ensures that all packets from a
specific flow are directed to the same Aggregation switch,
effectively mimicking static routing.

**Probability Calculations:** We define the total packet cycle
time as _𝑇𝑆𝐸𝑅𝑉𝐼𝐶𝐸_ = _𝑇𝐷𝐴𝑇𝐴_ + _𝑇𝐼𝑃𝐺_ . First, consider the interaction
between our flow and a _single_ neighboring host. The probability that this neighbor transmits a packet that temporally
overlaps with the critical inter-arrival gap ( _𝑇𝐼𝑃𝐺_ ) is proportional
to the ratio of the vulnerable window size to the total cycle time:

connected to the same leaf. therefore:

McClure et al.

- _[𝑘]_ 2 [−][1]
(13)

_𝑃_ safe =

1− [2][·] _[𝑇][𝐼𝑃𝐺]_
_𝑇𝑆𝐸𝑅𝑉𝐼𝐶𝐸_

**Property 3: Same aggregation switch index.** In a Fat-Tree
topology, the routing structure is symmetric. If a packet
ascends from the _𝑖_ -th Aggregation switch in the source pod
to the Core layer, it is structurally forced to descend to the _𝑖_ -th
Aggregation switch in the destination pod.

Therefore, for two flows to converge at the same specific
Destination Aggregation switch (and subsequently compete
for the downlink), they must select the exact same Aggregation
switch index when traffic ascends from the Edge switch to the
Aggregation layer.

Since there are _𝑘_ /2 available aggregation switches for the
upstream path, the probability that two independent flows
select the same index is:

_𝑃_ same agg. = [1]

[1] [2]

_𝑘_ /2 [=] _𝐾_

(14)
_𝐾_

**Property** **4:** **Same** **destination** **edge** **switch.** Both flows
are destined for different hosts that reside under the _same_
_Destination edge switch_ .
**Probability calculation (given a red flow).** We calculate the
ratio between the valid targets in the specific destination leaf
and the total pool of valid targets outside the source leaf:

- **Numerator:** The number of potential hosts in the specific
target leaf (excluding the one already chosen by the first
flow).

- **Denominator:** The total number of valid destination hosts
in the network, excluding all hosts in the source leaf (since
the flow is Red) and the host taken by the first flow.

=

_[𝑘]_

2

_𝑘_

_𝑃_ same dest edge =

_𝑛_ −1− _[𝑘]_

_𝑘_ 2 [−][1]

_𝑘_ 4 [3] [−][1][−] _[𝑘]_ 2 (15)

_𝑘_ 2 [−][1]

_𝑘_ [3]

**Total collision probability.** A collision occurs when two hosts
meet all four categories simultaneously.

_𝑃_ collision = _𝑃_ [2]

[2]

_𝑆𝑎𝑓𝑒_ [·] _[𝑃]_ [2]

_𝑅𝑒𝑑_ [·] _[𝑃]_ [Same aggregation] [·] _[𝑃]_ [Same Dest edge] (16)

Substituting the terms:

- [2]
_𝑘_ [·]

- _[𝑘]_ 2 [−][1] [2]

_𝑘_ 4 [3] [−][1][−] _[𝑘]_ 2 (17)

_𝑘_

_𝑘_ 2 [−][1]

_𝑃_ single_overlap = [2][·] _[𝑇][𝐼𝑃𝐺]_

_𝑇𝑆𝐸𝑅𝑉𝐼𝐶𝐸_

1− [2][·] _[𝑇][𝐼𝑃𝐺]_
_𝑇𝑆𝐸𝑅𝑉𝐼𝐶𝐸_

_𝑘_ [3]

(11)

_𝑃_ collision = ( _𝑃𝑅𝑒𝑑_ ) [2] 

Therefore, the probability that this specific neighbor
remains "silent" during the critical window (does not interfere)
is the complement:

The expected number of collisions:

_𝑃_ collision = _[𝑛]_ [(] _[𝑛]_ [−][1][)] - _𝑃_ collision (18)

2

_𝐸_ collision =

- _𝑛_

2

_𝑃_ safe_pair =1− _𝑃_ single_overlap =1− [2][·] _[𝑇][𝐼𝑃𝐺]_

_𝑇𝑆𝐸𝑅𝑉𝐼𝐶𝐸_

(12)

**Note on Independence Assumption.** The derivation above
assumes statistical independence between the four categories,
effectively treating the joint probability as the product of
individual probabilities:

_𝑃_ ( _𝐴_ ∩ _𝐵_ ∩ _𝐶_ ∩ _𝐷_ ) ≈ _𝑃_ ( _𝐴_ )· _𝑃_ ( _𝐵_ )· _𝑃_ ( _𝐶_ )· _𝑃_ ( _𝐷_ )

The edge switch connects _𝑚_ = _[𝑘]_

The edge switch connects _𝑚_ = _[𝑘]_ 2 [hosts.] [For] [our] [flow] [to]

be safe, it must not overlap with _any_ of the other _[𝑘]_ [−] [1][ hosts]

_[𝑘]_ 2 [−] [1][ hosts]

18

Load Balancing for AI Training Workloads

**(a) Synchronized pairs** **(b) Aggregation-edge synchro-**
**nization**

**Figure 16: Synchronization mode for aggregation-edge links**

Strictly speaking, slight dependencies exist between these
events (particularly due to the _sampling without replacement_
nature of the Red and Destination edge logic). However, as the
network size ( _𝑛_ ) increases, the statistical dependence between
any two specific flows weakens significantly. Consequently,
this approximation becomes asymptotically accurate for large
_𝑛_, yielding analytical results that closely match the empirical
data observed in simulations.
**Simple** **Round** **Robin** **Synchronization.** For the Simple
Round Robin routing algorithm, the calculation remains
identical to the Adaptive Routing (AR) model described above,
with one key exception: the second requirement, _"Safe Flows"_,
is not applicable.

Since RR distributes packets deterministically and is not
influenced by momentary queue occupancy (unlike AR, which
relies on queue states), the temporal constraint regarding _𝑇𝐼𝑃𝐺_
and _𝑇𝑆𝐸𝑅𝑉𝐼𝐶𝐸_ is irrelevant. Consequently, we are left with only
three conditions:

(1) Red Flows
(2) Same aggregation
(3) Same Destination edge

Mathematically, this implies that for RR, the probability
of being "Safe" is effectively 1 ( _𝑃𝑆𝑎𝑓𝑒_ = 1). The collision
probability equation for RR becomes:

_𝑃_ collision, RR = _𝑃𝑅𝑒𝑑_ [2] [·] _[𝑃]_ [Same aggregation] [·] _[𝑃]_ [Same Dest edge] (19)

Since _𝑃𝑆𝑎𝑓𝑒_ _<_ 1 in the AR model, removing this term results
in a higher overall probability for collision pair formation:

_𝑃_ collision, RR _>_ _𝑃_ collision, AR (20)

This theoretical conclusion aligns with the simulation
results, which consistently show a higher frequency of
collisions for Simple Round Robin compared to JSQ.

                   

**D** **Proof of Theorem 2: Square-Root Scaling**

PROOF OF THEOREM 2. We focus again on the queue of an
uplink port at an edge switch without internal traffic. The edge
switch receives the sum of _𝑘_ /2 northbound periodic flows of
period _𝑇_,andeachpacketentersourqueueofinterestwithprobability 1/( _𝑘_ /2), assuming uniform hashing. Thus, the arrival

,

rate equals the service rate, and arrivals are the sum of independent thinned periodic processes. We are at a critical loading,
where the queue size behaves as a random walk with zero drift
that can be modeled by a reflected Brownian motion. Specifically, within each period _𝑇_, the number of arrived packets followsasumof _𝑘_ /2 Bernoullivariables,anditsvarianceis 1− _𝑘_ [1] /2 [.]

The queue size growth at each uplink port can be modeled as

Each such flow has a period of _𝑘_ /2 - _𝑇_, where _𝑇_ is the packet
transmission time (including inter-frame gap). We model this

√︂

_𝑄_ ( _𝑚_ ) ≈

~~√~~

1− [1]
_𝑘_ /2 [·]

2
(21)
_𝜋_ [·] _[𝑚,]_

where the first part goes to 1 as the switch size increases, and
the second part shows the square-root scaling property of the
random walk.

We showed that if an edge switch does not have internal
traffic, then the queue size growth at its uplink ports satisfies
_𝑄_ ( _𝑚_ ) = Ω [√] _𝑚_  as the _𝑚_ [th] packet arrives. We now need to
show that the probability that an edge switch will not have
internal traffic is bounded below by a constant.

To do so, we use Eq. (8). By the Weierstrass product inequality, which states that for 0 ≤ _𝑥𝑖_ _<_ 1,  _𝑖_ [(][1][−] _[𝑥]_ _𝑖_ [) ≥] [1][−] _𝑖_ _[𝑥]_ _𝑖_ [, we get]

_𝑖_ [(][1][−] _[𝑥]_ _𝑖_ [) ≥] [1][−]

_𝑖_ _[𝑥]_ _𝑖_ [, we get]

_𝑘_ /2−1
∑︁ _𝑘_ /2−1

(22)

_𝑖_ =0 _𝑛_ −1− _𝑖_

≥ 1−

_𝑃_ northbound =

_𝑘_ /2−1

_𝑖_ =0

1− _[𝑘]_ [/][2][−][1]
_𝑛_ −1− _𝑖_

The denominator is minimized at the last index, thus

_𝑘_ /2−1
∑︁

_𝑖_ =0

_𝑘_

_𝑘_ 2 [(] _[𝑘]_ 2 [−][1][)]

_𝑛_ - _[𝑘]_

(23)

_[𝑘]_

2

_𝑃_ northbound ≥ 1−

Substituting _𝑛_ = _𝑘_ [3] /4:

_𝑘_ /2−1
_𝑛_ - _𝑘_ /2 [=][1][−]

_𝑘_ [2]

(24)
_𝑘_ [2] −2 _[.]_

_𝑃_ northbound ≥ 1−

_𝑘_ 4 [−] _[𝑘]_ 2

_𝑘_ [3] _[𝑘]_

_𝑘_ 44 [3] [−][−] _[𝑘]_ 22 =1− _𝑘_ _[𝑘]_ [2][−] - [2]

For any fat tree with _𝑘_ ≥ 4 _,_ this last expression is larger than
a constant (specifically its value of 6/7 for _𝑘_ = 4). Therefore
the result follows. 

**E** **Proof of HOST DR Queueing Model (Theorem 3)**

PROOF OF THEOREM 3. We want to model the queueing
behavior of HOST DR when using a random permutation.
First, at the edge switch uplinks, we saw that we get a sum
of periodic flows with random phases. However, since the
permutation is random, not all of the flows are necessarily
northbound. Thus, the load _𝜌_ may be arbitrary. Instead, we
model it using its expected value. Any of the _𝑘_ /2 source hosts
under an edge switch sends to another flow internal to the
same edge switch with probability ( _𝑘_ /2−1)/( _𝑛_ −1), therefore
the average number of northbound flows is

_𝑘_ 
1− _[𝑘]_ [/][2][−][1]
2 [·] _𝑛_ −1

(25)

19

,

**Figure** **17:** **Queue** **models** **for** **HOST** **DR.** **The** **average** **queue**
**size at each of the 5 switch layers is compared against queueing**
**models (dotted and dashed horizontal lined).**

system as _𝑁_ - _𝐷_ / _𝐷_ /1 with _𝜌_ _<_ 1. We model the superposition
of periodic arrivals as a Gaussian process as _𝑘_ increases [5],
together with a negative drift since _𝜌_ _<_ 1. Since the queue size
cannot be negative, we use a truncated normal distribution.

In the same way, for aggregation-to-core links, we neglect
intra-pod traffic, and get the following expected number of
inter-pod flows per source pod:

- _𝑘_

2

- 2
·

  

1−

- _𝑘_ 2 - 2 −1

_𝑛_ −1

(26)

McClure et al.

load-balances traffic as equally as possible across the links in
the destination pods. We want to formulate a target ideal invariant that this load balancing should satisfy. However, we need to
be careful in the formulation. The traffic that _𝐸_ load-balances
depends on the destinations of the flows that cross _𝐸_ . These
destinations depend on the arbitrary permutation pattern, and
are therefore not uniform. For example, _𝐸_ cannot send the
same amount of traffic to all edge switches in the network.
Instead, we condition the invariant on the destination switch.

**Invariant 1 (Load-balancing invariant).** _Given any source_
_switch 𝑆_ _in a source pod and any destination switch 𝐷_ _in a_
_destination pod, 𝑆_ _should send traffic at the same rate through_
_all of the southbound links to 𝐷_ _that are reachable from 𝑆._

The invariant implies a perfect load balancing at downlinks:

**Property 1.** _If Inv. 1 holds, then all southbound links to any_
_switch have equal load._

PROOF. The load on each down link is the sum of the rates
of all possible source edge switches, for example. Therefore,
the sums will be equal for all down links to a given switch,
since their components from each source edge are equal. 

**Consolidation.** To achieve the above target invariant, we
use _consolidation into virtual flows_ . The key idea is that each
source switch consolidates into a single shared virtual flow
all of its northbound packets destined to a shared destination
_𝐷_ . Then, it load balances these packets across all of its uplink
ports. However, we still need to carefully define the level at
which to consolidate flows.
**Mandatory waypoints.** Consider a source aggregation switch
_𝐴𝑆_ . A destination host _𝐻𝐷_ that is reachable through its uplinks
is necessarily in a different pod. Moreover, a property of the
three-level fat tree is that when sending traffic from _𝐴𝑆_ to _𝐻𝐷_,
any packet _must_ reach a given destination edge _𝐸𝐷_ and a given
destination aggregation switch _𝐴𝐷_ in the destination pod, and
cannot reach other edge or aggregation switches. For example,
the third aggregation switch of the source pod can only send
traffic destined to _𝐻𝐷_ through the third aggregation switch _𝐴𝐷_
of the destination pod, then through the edge switch _𝐸𝐷_ that
is connected to _𝐻𝐷_ . We can think of _𝐴𝐷_ and _𝐸𝐷_ as _mandatory_
_waypoints_ . They stand in contrast with the many possible core
switch waypoints that could be used to reach _𝐻𝐷_ .

As a consequence, all of the traffic going through _𝐴𝑆_ and
destined to _𝐻𝐷_ could be consolidated into a single virtual
flow using several consolidation levels: (i) per destination
host _𝐻𝐷_, (ii) per destination edge _𝐸𝐷_, and (iii) per destination
aggregation _𝐴𝐷_ . The following result shows that they can all
provide a first performance guarantee.

**Theorem** **6.** _Source_ _aggregation_ _switch_ _𝐴𝑆_ _satisfies_ _Inv._ _1_
_whether it consolidates traffic per destination host, edge or_
_aggregation switch._

We then apply the same model. Note that the fit is not exact anymore, as traffic coming from the edge switches loses its periodicity and therefore it is important to emphasize that _the ND/D/1_
_model is only an approximation_ . Downlinks are an even coarser
approximation,sinceeachlayermakestrafficlessperiodic. 

Fig. 17 uses _𝑛_ =1 _,_ 024 hosts with a 4MB message to show the
behavior of HOST DR at scale. It shows the average queue sizes
at each of the 5 switch queueing layers: (i) edge to aggregation
( _𝐸_ → _𝐴_ ), (ii) aggregation to core ( _𝐴_ → _𝐶_ ), (iii) core to
aggregation ( _𝐶_ → _𝐴_ ), (iv) aggregation to edge ( _𝐴_ → _𝐸_ ) and
(i) edge to host ( _𝐸_ → _𝐻_ ), It illustrates that the approximation
is very close for the first E→A layer. The model then is a bit
pessimistic for the two core layers. It has three main sources
of errors: (i) the traffic periodicity is broken by queueing at
successive switches, (ii) the load varies and is different at each
pod, and (iii) we only use a fluid approximation. Finally, the
two downlink edge layers are relatively close to the model as
well despite the loss of periodicity.

**F** **Proofs and Details of OFAN’s Properties**

**F.1** **Correctness of Consolidation**

**Load-balancing invariant.** We start by formally formulating
the goal of a switch DR in a network without link failures. It
is clear that we want a perfect LB locally among uplink ports.
But we also want to make sure that any source edge switch _𝐸_

20

Load Balancing for AI Training Workloads

PROOF. No matter the aggregation level, for any destination
belonging to this aggregation level in the destination pod,
_𝑆𝑆_ always sends traffic at the same rate to all cores that it
is connected to. Thus _𝑆𝐷_, the symmetric aggregation in the
destination pod that is also connected to all these cores, also
receives the same rate from all these cores. Therefore, it
satisfies the invariant. In addition, _𝑆𝑆_ can only reach the links
_𝑆𝐷_ → _𝐿𝐷_ and _𝐿𝐷_ → _𝐿𝐷_, and no other down links to _𝐿𝐷_ or _𝐻𝐷_ .
Thus, they trivially satisfy the invariant. 

Consider now a source edge switch _𝐸𝑆_ . Its mandatory
waypoints for a given destination host _𝐻𝐷_ are only _𝐻𝐷_ and
_𝐸𝐷_ . Since it can reach _𝐻𝐷_ using several aggregation switches,
none is mandatory. Thus, _𝐸𝑆_ can consolidate traffic (1) per
destination host _𝐻𝐷_ and (2) per destination edge _𝐸𝐷_ . We find
that both work out:

**Theorem** **7.** _No_ _matter_ _the_ _consolidation_ _level,_ _if_ _both_ _the_
_source edge switch 𝐸𝑆_ _and the source aggregation switch 𝐴𝑆_
_consolidate traffic, then both satisfy Inv. 1._

PROOF. We structure the proof based on the destination
type.

(1) For any destination aggregation _𝑆𝐷_, source edge _𝐿𝑆_
only has a single source aggregation waypoint _𝑆𝑆_ ( _𝑆𝑆_ = _𝑆𝐷_
if the destination is in the same pod, and it is the symmetric
aggregation of _𝑆𝐷_ in the source pod if they are in distinct pods).
Therefore, all of its traffic will be sent to _𝑆𝑆_, which satisfies
the invariant for _𝑆𝐷_ by Thm. 6.

(2) For any destination edge _𝐿𝐷_, source edge _𝐿𝑆_ equally
splits all of its traffic across all of the aggregations in its pod,
sending the same rate _𝑅_ to each. In turn, the rate from any
source aggregation _𝑆𝑆_ is directly transferred to the symmetric
destination aggregation _𝑆𝐷_ (whether _𝑆𝐷_ is in a different pod,
or in the same pod with _𝑆𝐷_ = _𝑆𝑆_ ). Thus destination edge _𝐿𝐷_
will receive the same rate _𝑅_ from all its uplink aggregations.

(3) Finally, destination host _𝐻𝐷_ is only connected through
a single link to the network, so the invariant holds trivially. 

Since it is clear that pointers also load-balance perfectly
locally among upling ports, the above theorem means that LB
achieves its dual goals both at uplinks and at downlinks.
**Minimizing pointers.** We saw that each switch can consolidate using several consolidation levels. However, _the higher_
_the_ _consolidation_ _level,_ _the_ _smoother_ _the_ _load_ _balancing_,
as the source switch needs to hold fewer pointers and can
coordinate information across more flows. Therefore, OFAN
always chooses the highest and largest consolidation level.

**F.2** **Scaling Impact** _**vs.**_ **HOST DR**

**Scaling** **impact** **on** **pointer** **numbers.** Let’s illustrate how
consolidation improves SWITCH DR (OFAN) _vs._ HOST DR. Consider a random permutation with inter-pod traffic only. In OFAN,

,

**Figure** **18:** **Ratio** **of** **the** **maximum** **queue** **size** **of** **SWITCH** **DR**
**(Ofan) by that of HOST DR as a function of the number of hosts.**

aggregation switches consolidate traffic per destination aggregation switch. Thus, a destination aggregation switch can only
receive up to _𝑘_ −1 different virtual flows, since there are _𝑘_ −1
different aggregation switches. However, in HOST DR, they virtually consolidate traffic per destination host, hence there are
_𝑘_ [2] /4 flows, corresponding to the _𝑘_ [2] /4 hosts in the destination
pod. Thus, the consolidation gain in the number of pointers is
at least _𝑘_ [2] /(4( _𝑘_ −1)) _>𝑘_ /4 _,_ increasing with the network size.
**Scaling** **impact** **on** **queue** **sizes.** To illustrate how consolidation improves SWITCH DR (OFAN) _vs._ HOST DR, consider
a random permutation with inter-pod traffic only. Figure 18
plots the ratio of the maximum queue size of OFAN by that
of HOST DR as a function of network size, with 30 runs per
size. The ratio increases with the network size, _i.e.,_ OFAN
outperforms even more as we scale the network.

**F.3** **Model with Bounded Average Queue Sizes**

**Proof of Theorem 4.** We are finally able to build a model for
the queue size under OFAN.

PROOF OF THEOREM 4. The model follows similar lines
for OFAN as for HOST DR. However, since we consolidate
pointers, we evaluate the number of distinct pointers, and
model as if all pointers carried the same number of periodic
flows, which tends to underestimate the final queue length.

We start with the edge model. We want to determine the
expected number of pointers at the edge switch. A single
source edge switch comprises _𝑘_ /2 flows (balls), and these
flows can be destined to _𝑘_ [2] /2 edge switches (bins). The
expected number of distinct destination edge switches is:

Using Taylor expansion, we find that this is about _𝑘_ /2−1/4 _._

Likewise, at each aggregation switch, the number of northbound pointers is at most _𝑘_ −1, as there are _𝑘_ −1 other pods and
therefore other aggregation switches that can be destinations.
The expected number of pointers also converges to _𝑘_ - 1 as
_𝑘_ grows. Thus, we obtain a new model, which neglects many
aspects of the algorithm that can be too complex to capture,
and in particular the variability in the periods of each virtual
flow. Again, _the ND/D/1 model is only an approximation_ . 

  - 1
1− 1−
_𝑘_ [2] /2

_𝑘_ [2]

2 [·]

- _𝑘_ /2 

_._

21

,

**Figure 19: Queue models for SWITCH DR (OFAN). The average**
**queue** **size** **at** **each** **of** **the** **5** **switch** **layers** **is** **compared** **against**
**queueing models (dotted and dashed horizontal lined).**

Figure 19 illustrates the model for OFAN under the same
conditions. We can see that the edge model holds well (dotted
line). However, as expected, the models beyond have a slightly
poorer fit. In particular, the downlink queues are harder to
model exactly.

**F.4** **Advanced Implementation Considerations**

**W-ECMP.** We want to make OFAN handle link failures, once
the information has propagated at steady state. We leverage
W-ECMP, which is already used in current switches. For
each destination switch, we obtain the raw weights associated
at the source switch with each port. Then, we divide by the
greatest common divisor to obtain simplified weights. Next,
we randomly shuffle the port order, as described above. Finally,
we extract an Interleaved Weighted Round-Robin (IWRR)
schedule [38, 79] that the pointers can go through in an efficient
manner, either using direct increment or a schedule table.
**Schedule** **example** **in** **asymmetric** **network.** Assume that
an edge switch has 4 uplink ports { _𝑃_ 1 _,𝑃_ 2 _,𝑃_ 3 _,𝑃_ 4} of W-ECMP
weights {1600 _,_ 1600 _,_ 1600 _,_ 800} Gbps. It first simplifies them
into {2 _,_ 2 _,_ 2 _,_ 1} (by dividing by the greatest common divisor).
Then the port order can be reshuffled into { _𝑃_ 3 _,𝑃_ 2 _,𝑃_ 4 _,𝑃_ 1},
yielding for example IWRR schedule { _𝑃_ 3 _,𝑃_ 2 _,𝑃_ 4 _,𝑃_ 1 _,𝑃_ 3 _,𝑃_ 2 _,𝑃_ 1},
where _𝑃_ 4 appears twice less often than the other ports.
**Scalability.** Assume _𝑘_ = 64 and _𝑛_ ≈ 65 k hosts. Each source
edge switch needs to keep schedules for all of its destination
edge switches, _i.e.,_ up to 2 _,_ 047 schedules. This can get complex
to implement and cache. We exploit a property intrinsic to a
3-level fat-tree: in a datacenter network with single links between switches of uniform capacity _𝐶_, whenever both weights
are non-zero ( _i.e.,_ there is reachability), then (i) the W-ECMP
weight between port _𝑖_ of source edge switch, _𝐸𝑆_, and destination edge switch, _𝐸𝐷_, is proportional to (ii) the number of
distinct paths between the _𝑖_ [th] aggregation switch, _𝐴𝑆_, of the
source pod and the _𝑖_ [th] aggregation switch, _𝐴𝐷_, of the destination pod [51]. Thus, we can define a weight _per destination pod_,

McClure et al.

such that the weight per destination edge switch equals this perpod weight if it’s reachable, and zero otherwise. As a result, we
can only keep _𝑘_ shared per-destination-pod schedules, a _𝑘_ /2×
reduction (32× for our _𝑘_ =64 example), and the many pointers
per (destination switch, packet type) will rotate through these
shared schedules, simply double-checking FIB reachability
information each time they increment and pick a new port.
**All-to-All** **with** **failure.** We found a corner case in our
simulations of OFAN, when testing traffic with all of the
following characteristics: (i) all-to-all, (ii) without link failure
in the network, (iii) sending at full link rate without congestion
control, and (iv) having a sudden link failure in the core. In
such traffic, the number of source hosts per pod equals the
number of cores, so each flow that exits the pod becomes
anchored to a unique core in the round-robin rotation. If a link
to the core suddenly fails, then all of its packets will get lost.
In practice, we expect the CCA to catch this and slow down
some rate within a few RTTs, losing the synchronization, as
it affects a single flow and not all flows.
**Implementation variants.** We also implemented two variants
to OFAN. First, in a network without link failures, we found
that if (i) the first pointer is not picked at random, but rather
chooses the shortest queue at the arrival of the first packet,
then (ii) cycles in an unshuffled round-robin order, then
performance is slightly improved. However, we lose the
randomization property.

Second, in a network with link failures, if we only use
FIB reachability information without the W-ECMP weights,
we found that performance slightly worsens, but it still
outperforms existing algorithms. This FIB-based version can
be a simpler alternative to implement.

**G** **Proof of Theorem 5: Optimal Packet Size**

PROOF OF THEOREM 5. The CCT can be modeled as the
sum of (i) the time to send the message, (ii) the time to go
through the queues, and (iii) the zero-load RTT. Only the first
two components depend on the packet size _𝑃_, so let’s focus
on them.

(i) The time to send the message is

_𝐷_ _[𝑃]_ (27)
_𝑃_           - _𝐻_ [·] _𝐶_ _[,]_

since we need _𝑃_ - _𝐷𝐻_ [packets to send a message of] _[ 𝐷]_ [bytes using]
_𝑃_ - _𝐻_ payload per packet, and each packet of size _𝑃_ that is sent
at rate _𝐶_ takes time _𝐶_ _[𝑃]_ [.]

(ii) The time to go through the queues is

_𝛼_ ·· _[𝑃]_ (28)

_𝐶_ _[.]_

by assumption.

22

,

Load Balancing for AI Training Workloads

Adding the two components and dividing by constant _𝐶_, we
want to find:

- _𝐷_
_𝑃_ - _𝐻_ [+] _[𝛼]_

_._ (29)

min

_𝑃_ 

Differentiating with respect to _𝑃_, we get

_𝐷_         - _𝐻_
( _𝑃_               - _𝐻_ ) [2] [+] _[𝛼.]_ (30)

Zeroing the derivative yields the result. 

Note that Fig. 11 assumes as a first approximation _𝐻_ =82B,
accounting for the header and inter-frame gap components,
and _𝛼_ =10 data packets.

**H** **Swift’s Settings**

In our evaluations with the MSwift CCA, we use LTCP’s and
MSwift’s default settings. However, Swift needs tuning.

Swift’s target delay parameters allow the maximum congestion window to adapt to the sum of a fixed bandwidth-delay
product (BDP) component and a small variable queueing
component. They assume a maximum of 100 packets, given
50 Gbps and 100 Gbps links. These numbers need to be
adjusted to our network with 800Gbps links links and a 6 _._ 25us
zero-delay RTT (including propagation and serialization
delays). The high line rates mean that the BDP alone already
reaches 150 packets on the line. In the original paper [43],
Swift uses target delays of

- 25 _𝜇_ s for 50Gbps links, translating to a queueing component
of (25−6 _._ 25)·50·10 [9] /8 =117KB; and

- 50 _𝜇_ s for 100Gbps links, translating to 109KB.
We use the average of 113KB. The target is proportional to the
number of hops through Swift’s _ℎ_ parameter. When sending
at line rate, the initial congestion window is set to this target.

23

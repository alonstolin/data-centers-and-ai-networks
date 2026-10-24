# **RNG: Flat Datacenter Networks at Scale**

Giacomo Bernardi Ratul Mahajan [†] C. Seshadhri [‡]

Enrico Carlesso Chinchu Merine Joseph Saurabh Kumar Pavan Manikonda

Luiza Popa Randy Ram Steven Robinson Elizabeth Tennent

Amazon Web Services

## ABSTRACT

We design and deploy in production the first flat datacenter
networks. Our design, called RNG, is based on quasi-random
graphs. While the cost and fault-tolerance benefits of such
topologies have been long known, their practical realization
has been hampered by a lack of scalable routing and cabling
approaches. RNG has a new distributed routing protocol
that exploits the properties of random graphs to find a large
number of edge disjoint paths between pairs of endpoints.
It uses a novel passive optical device that internally shuffles
cables, which makes its cabling complexity similar to that
of fat trees. We show that RNG matches or exceeds the performance of fat trees for a range of traffic patterns, despite
being up to 45% cheaper. RNG is now the default datacenter
network for most workloads at Amazon.

## 1 INTRODUCTION

The simplicity of fat tree topologies has made them the
workhorse of datacenter networks. But they offer a stark
trade-off between cost and performance. Operators either
build non-blocking fabrics in which any endpoint can transmit/receive at its full capacity; or they build oversubscribed
fabrics that congest when a small, unfavorable set of endpoints transmit/receive at a high rate. Non-blocking fabrics
are prohibitively expensive at scale, so organizations tend
to build oversubscribed fabrics and risk congestion even for
performance-sensitive workloads [16, 40, 43].

The root problem is that fat trees lack _capacity fungibility_ .
The strict hierarchical structure means traffic between pairs
of endpoints is limited to small subsets of links in the topology. These links can congest while most others lie idle. The
lack of capacity fungibility increases the cost of providing a
consistent, congestion-free experience. One must provision
ample capacity everywhere even if a small subset of endpoint
pairs need high capacity at any given time.

Researchers have proposed reconfigurable topologies for
this problem [11, 17, 21, 22, 30–32, 51, 60]. These designs use

†Also affiliated with the University of Washington
‡Also affiliated with the University of California, Santa Cruz

hardware such as optical switches, steerable wireless antennas, and free-space optical devices to dynamically change capacity between endpoints. Such hardware is not (yet) proven
at scale. Most designs also use a centralized control plane
to infer fabric-wide demand and configure the hardware.
Such control planes are difficult to realize at scale for bursty,
latency-sensitive workloads such as Web services.

A promising alternative that provides capacity fungibility
is a flat topology with commodity routers connected as an
expander graph [25, 26, 37, 45, 49]. In addition to their lower
cost, such topologies are fault tolerant because the blast
radius of any failure is small, unlike upper-layer failures in
fat trees. These benefits of expander network topologies have
been known for over a decade [45], but these topologies are
not a reality because of three unsolved challenges [33, 43].
**1. Routing** . Shortest-path routing, commonly used for fat
trees, is a poor fit for expanders because it cannot exploit the
diversity of paths that exist. Some pairs of nodes have only
one shortest path between them, so shortest path routing
can cause congestion. Prior works recommend _𝑘_ -shortest
paths routing which spreads traffic between the source and
destination across _𝑘_ shortest paths [45, 49]. But _𝑘_ -shortest
paths routing cannot be realized for large networks using
commodity switches. It needs an order of magnitude more
(fast, expensive) memory than what is available today (§3).
**2. Cabling** . Expanders connect pairs of devices that can be
far away in the physical space. Such cabling is complex and
expensive [33]. Worse, when more racks land, the process of
incrementally adding new routers requires breaking existing
connections. If routers have _𝑑_ links to other routers, each
time a router lands, we need to break _𝑑_ /2 existing links
whose endpoints are physically spread over the datacenter.
This type of work risks collateral damage and slows down
rack installs, a key concern for datacenter operators.
**3. Performance predictability** . Prior work on benchmarking expanders focus on concrete topologies with fixed parameters. It is unclear how a fabric might perform for other
parameters, which makes it difficult for operators to design topologies that meet specific performance targets. They
would need to search the combinatorial parameter space
using simulations, which is infeasible for large networks.

1

In contrast, fat tree designs can be automatically generated
based on performance targets [2, 36, 41].

We solve these challenges and deploy (to our knowledge)
the first production datacenter fabrics based on expanders.
Our design, called RNG, connects routers using a mix of randomized and deterministic cabling segments. This construction yields quasi-random graphs that mimic the statistical
properties of truly random graphs [8]. Our routing algorithm
called _Spraypoint_ is purpose-built for random graphs and
permits a fully distributed implementation on commodity
hardware. It finds a large number—close to the node degree—
of edge disjoint paths between endpoint pairs and these paths
minimally overlap across different pairs. These properties
lead to capacity fungibility and high throughput.

We develop a cabling approach based on a new passive
optical device called a _ShuffleBox_ that mixes connections
between routers internally. We place shuffle ShuffleBoxes at
a small number of planned locations in the datacenter. This
allows the number of physically-connected location pairs, a
key driver of cabling complexity, to match that of fat trees.

The concentration properties of random graphs and the
decorrelation of Spraypoint routing enable accurate modeling of RNG fabric performance as a function of topology
parameters (e.g., graph size, node degree, etc.). We develop
models for path length, number of edge disjoint paths, and
oversubscription. The models make the impact of various
parameters and design trade-offs (e.g., path length versus
oversubscription) transparent. Operators can use them to
design topologies that meet their performance targets.

We deploy two RNG-based production fabrics. Transport
and application layer benchmarks confirm that RNG’s performance is on par with fat trees, unimpacted by the peculiarities of expanders such as variable path lengths between
endpoint pairs. Such end-to-end validation is a first for expander topologies.

Our analysis reveals that RNG topologies are 9–45% cheaper
than fat trees with equivalent oversubscription ratio. The
extent of cost reduction depends on the oversubscription
ratio and is independent of network size and the number of
switch ports. We also find that, for the same oversubscription
ratio, RNG offers higher throughput than fat trees across a
range of traffic patterns.

## 2 THE POTENTIAL OF FLAT EXPANDERS

The salient property of expander graphs is edge expansion [53].
For every minority subset _𝑆_ of nodes, the set of edges that
lead out of _𝑆_, called the cut, is large. Edge expansion provides
capacity fungibility because every _𝑆_ has large bandwidth toward other nodes. In contrast, in hierarchical topologies such
as fat trees, the cut of a subtree only leads to parents, so the
expansion is poor. We illustrate with an example.

**Figure 1: Example fat tree (a) and expander topologies**

**(b). Each switch has four ports. Two ports of each ToR**

**(T1–T12) connect to servers (not shown).**

Figure 1a shows a generalized fat tree [38]. T1–T12 are ToR
(top-of-rack) switches, connected via aggregation (middle)
and spine (top) layers. The oversubscription ratio of this
network is 3:1 since the capacity of the ToR-aggregation
layer is thrice that of the aggregation-spine layer. The cut for
subset of nodes with T1–T3 and their two parents is two links
connecting to the spines. These nodes cannot send more than
two units of traffic to T4-T12 even though most other links
in the fabric are unused. Thus, capacity is stranded.

While skewed traffic patterns with a few heavy transmitters have received the most attention [25, 26], fat trees can
strand capacity with uniform traffic as well. Consider an allto-all pattern where each ToR wants to send the same data to
each other ToR. The transmission rate between pairs of ToRs
will be 128×9 [of link capacity. This calculation follows from]
the 12 × 9 flows crossing the 8 aggregation-spine links. Given
two units of per-ToR capacity, this traffic pattern strands
roughly 60% (2 − 11 128×9 [) of the ToR uplink capacity.]
Expanders, such as the random graph between T1–T12 in
Figure 1b, can do significantly better. If T1–T3 are the only
senders, they will be limited largely by their local capacity
when other nodes are silent. Because of the expansion property, there is no small cut that constrains traffic. Even for the
all-to-all traffic pattern, given a capable routing algorithm,
we can effectively use all links in the topology.

Capacity fungibility lowers cost because the deployed capacity is more efficiently used, allowing smaller deployments.
A simplistic view of the lower cost of flat expanders is that
all upper-layer routers are removed. But an expander that
is performance-equivalent to a fat tree may need more ToR
uplinks (fabric-facing ports) because some uplink capacity is
consumed by traffic relayed for other ToRs. It may thus need
more ToRs to support the same number of servers, given a
fixed number of ports per ToR. Despite this effect, expanders
can reduce cost by up to 45% (§9.4).

Expander topologies are also more fault-tolerant. Edge
expansion makes it difficult to partition the network, and flat

**(a)**

**(b)**

2

structure lowers the impact of failures. In a fat tree, upperlayer router failures have a large impact because they carry
traffic for many endpoint pairs. Even a single spine router
failure in Figure 1a halves the available capacity for most
ToR pairs. In Figure 1b, there are no such special routers.

We focus on multi-tenant datacenters with heterogeneous
workloads. In the future, we will investigate using expanders
for specialized workloads such as large-scale AI training.
These workloads may demand specific topologies such as
Rail-optimized fat trees and may want local capacity islands
such as those at the aggregation layer in Figure 1a [27, 59].
Flat, random topologies do not have aggregation islands. [1]

## 3 REQUIREMENTS AND CHALLENGES

Expander topologies are theoretically promising. But to be
practical at scale at Amazon and supplant fat trees, they must
meet several requirements. Prior expander-based designs [4,
45, 49] do not meet these requirements.
**Realizable using commodity switches** . The network should
be realizable using commodity switches and forwarding
ASICs which have limited memory. While custom hardware
can be developed, it increases cost and poses substantial
technical and supply-chain risks.

Prior designs cannot be realized for large networks using
commodity switches. To counter the limitations of shortest
paths in expander graphs, they usually propose _𝑘_ -shortest
paths routing. Its typical implementation requires tunnels
(e.g., MPLS, VLAN [35]) or forwarding based on source (in
addition to destination) addresses. Suppose we want to build
a network with _𝑛_ =10K routers and use the recommended
value of _𝑘_ =8 [45, 49]. If each path traverses 4 routers, we
need 320K forwarding entries per router on average (4 _𝑘𝑛_ [2]

entries spread across _𝑛_ routers). Current switches support
only 4-16K such entries, [2] which is 20–80x lower. State reduction techniques [47, 48] cannot bridge this gap and adding
so much memory is prohibitively expensive. Harsh et al.
cleverly use VRFs (virtual routing and forwarding) to create
non-shortest paths, but this proposal too does not scale given
limits on the number of VRFs in commodity switches [23].
**Deployment** **and** **operational** **simplicity** . Deployment
and operational simplicity are critical for network reliability.
Simplicity is multi-faceted; we focus on control plane and
physical operations to deploy and incrementally expand the
network. For the control plane, we prefer demand-oblivious,

1RNG does have rack-level islands like fat trees. The lack of aggregation
islands is not a problem for general workloads in multi-tenant datacenters.
Coordinated application deployment across topologically related racks is
hard to realize here; tenants come and go continuously, with each needing
different server counts and types. That is why hyperscalers aim for fabricwide, uniform capacity pools [18].
2This table is different from the much larger table for destination-based
lookup which uses longest-prefix matching.

fully distributed routing (like today). For deployment and
expansion, we want the number of cabling steps to be small
and fast to minimize risk and expand faster.

Physical cabling is challenging for expanders because they
need to connect pairs of devices uncorrelated to physical
space. Jellyfish, which is based on truly random graphs, proposes to simplify cabling by removing routers (ToRs) from
server racks and placing them centrally [45], but this approach increases latency between servers that share a rack,
an important consideration for some applications. It also increases cabling cost because cheap, copper-based intra-rack
connectivity would need to be replaced with expensive, optical connectivity. All current approaches also require changing many existing connections each time a new rack lands,
a frequent operation in datacenters.
**Predictable performance** . Amazon operators deploy network fabrics to meet specific capacity (number of servers)
and performance (e.g., oversubscription) targets. For expanders
to be acceptable, they must be able to easily and confidently
create topologies that meet their targets. Prior work benchmarks topologies with specific parameters and does not show
how to create topologies for specific performance targets.

RNG meets these three requirements via: (1) A new routing algorithm called _Spraypoint_ that finds a large number
of edge-disjoint paths. Like OSPF and BGP, it is demandoblivious and permits a fully-distributed operation on commodity hardware. (2) A cabling approach based on a passive
optical device called a _ShuffleBoxes_ . It limits the number of
endpoints that are physically cabled/re-cabled when the datacenter expands. (3) High-fidelity models for key performance
measures such as throughput and path length. We describe
these elements in more detail below.

## 4 RNG OVERVIEW

RNG is based on a flat graph where routers interconnect
through a mix of deterministic and randomized choices.
Given their controlled randomness, our graphs are not truly
random; they are quasi-random graphs that behave like truly
random graphs and are optimal expanders [8, 12, 39] [3] . RNG
routers connect to each other and to external devices (e.g.,
servers, other fabrics). We break out each fabric-facing physical port into individual lanes (e.g., a 400 Gbps port into
4x100 Gbps lanes), each of which uses a separate fiber pair
and can establish adjacency with a different remote router.
Breakouts increase graph degree, lowering hop count and
oversubscription. In the rest of the paper, a router uplink
refers to a breakout lane.

3Further, unlike structured constructions like Xpander [49] and Slim fly

[4], random graphs can support routers with different degrees [45]. RNG
supports such routers, but we omit this discussion for lack of space.

3

**Graph** _𝑛_, _𝑑_ # of routers, router uplinks
**Spraypoint** _𝑝_, _ℎ_ # of waypoints, next hops
_ℓ_ # of levels
**ShuffleBoxes** _𝑑𝑟_, _𝑑𝑐_ # of r-ports, c-ports
_𝑓𝑟_, _𝑓𝑐_ # of fiber pairs in r-port, c-port

**Figure 2: Key design parameters of** **RNG**

The control plane and load balancing in RNG follows today’s common paradigm. The routing protocol, Spraypoint,
computes next hops at each router for all destinations; and
routers use ECMP (equal cost multipath) to spread traffic
across all next hops for the destination. Figure 2 summarizes
the key design parameters of RNG.

## 5 SPRAYPOINT ROUTING

Spraypoint constructs a large number of edge disjoint paths
between endpoint pairs, which increases network throughput by offering more independent options to load balancing mechanisms like ECMP. While we analyze and deploy
it on random graphs, Spraypoint works on any expander
graph. It is based on the observation that high fan-out at the
source and high fan-in at the destination suffice for creating
many edge-disjoint paths in an expander. The middle has
many edges because of the expansion property. Spraypoint
achieves high fan-out by _spraying_ packets at the source—all
neighbors are eligible next hops and one is selected based on
ECMP hashing. It achieves high fan-in by channeling traffic
via _waypoints_ that are spread all around the destination.
**Forwarding paths** . Spraypoint has two parameters _𝑝_ and
_ℎ_ which control the number of waypoints per destination
and the number of eligible next hops after the spraying step.
These parameters offer a trade-off between path length and
the number of edge disjoint paths. There is an auxiliary parameter _ℓ_ which depends on these parameters and the graph
size ( _𝑛_ ). To compute paths to a destination _𝑡_, Spraypoint
partitions all nodes into the following _levels_ .

(1) _𝑊𝑃_ 0 ( _𝑡_ ): Base waypoint level with all neighbors of _𝑡_ .
(2) _𝑊𝑃𝑙_ ∈[1 _,ℓ_ ] ( _𝑡_ ): Higher-level waypoints. _𝑊𝑃𝑙_ ( _𝑡_ ) has _𝑝_
randomly-selected neighbors of each node in _𝑊𝑃𝑙_ −1( _𝑡_ ). Neighbors in earlier waypoint levels and _𝑡_ itself are not eligible for
selection.

(3) _𝐼𝑅_ ( _𝑡_ ): _Inner ring_ with all neighbors of _𝑊𝑃_ _ℓ_ ( _𝑡_ ) not in
previous levels.

(4) _𝑂𝑅_ ( _𝑡_ ): _Outer ring_ with all nodes not in any level above.

Figure 3 shows an example graph for _ℓ_ =1 and _𝑝_ =2. _𝑊𝑃_ 0( _𝑡_ )
has all neighbors of _𝑡_ : { _𝑣_ 1 _, 𝑣_ 2 _, 𝑣_ 3 _, 𝑣_ 4}. _𝑊𝑃_ 1( _𝑡_ ) has two randomly selected neighbors of each _𝑣𝑖_ . In the example, _𝑤_ 1 _,𝑤_ 2
are selected from _𝑣_ 1, _𝑤_ 3 _,𝑤_ 4 are selected from _𝑣_ 2, and so on.
Node _𝑣_ 1 ends up with three neighbors in _𝑊𝑃_ 1( _𝑡_ ), because

**Figure 3: Example graph with Spraypoint levels for** _𝑡_ **.**

an additional neighbor ( _𝑤_ 8) was selected via _𝑣_ 4. The neighbors of _𝑣𝑖_ that are not selected in _𝑊𝑃_ 1( _𝑡_ ) drop into the rings,
along with neighbors of _𝑊𝑃_ 1( _𝑡_ ).

The levels control traffic flow between any source _𝑠_ to _𝑡_ .
The first step is _spraying_, where _𝑠_ forwards to a randomly
chosen neighbor (i.e., ECMP). Spraying is independent of
_𝑡_ and happens even if _𝑠_ and _𝑡_ are adjacent. [4] Post spraying,
each intermediate node _𝑢_ follows the "pointing" rules.

(1) If _𝑢_ ∈ _𝑊𝑃_ 0( _𝑡_ ), forward to _𝑡_ .
(2) If _𝑢_ ∈ _𝑊𝑃𝑙_ ∈[1 _,ℓ_ ] ( _𝑡_ ), forward (ECMP) to one of _ℎ_ neighbors randomly selected from _𝑊𝑃𝑙_ −1( _𝑡_ ).

(3) If _𝑢_ ∈ _𝐼𝑅_ ( _𝑡_ ), forward to one of _ℎ_ neighbors randomly
selected from _𝑊𝑃_ _ℓ_ ( _𝑡_ ).

(4) If _𝑢_ ∈ _𝑂𝑅_ ( _𝑡_ ), forward to one of _ℎ_ neighbors randomly
selected from those with shortest paths to _𝐼𝑅_ ( _𝑡_ ) nodes.

Let us see Spraypoint forwarding in action for a packet
from _𝑣_ 2 to _𝑡_ in Figure 3. Assume _ℎ_ = 1. First, _𝑣_ 2 sprays to
one of _𝑡_, _𝑤_ 3, _𝑤_ 4, or _𝑜_ 1. If the packet is sent to _𝑡_, its journey
is complete. If it is sent to _𝑤_ 3 or _𝑤_ 4, it will go back to _𝑣_ 2 per
the second rule above, and then to _𝑡_ . Spraying happens only
at the source; if a packet happens to return to the source, it
follows the pointing rules. If the packet was sprayed to _𝑜_ 1, it
reaches _𝑡_ via _𝑟_ 6, _𝑤_ 5, and _𝑣_ 3.
**Why spraying** . Spraying exploits the expansion property

to generate many paths between source-destination pairs.
In general, there may be only a few _shortest_ paths from a
source _𝑠_ to a destination _𝑡_ . But in an expander, there are
many edge disjoint _short_ paths between all pairs. A simple
heuristic to use these paths is to follow shortest paths to _𝑡_
from all neighbors of _𝑠_ . Spraying implements this heuristic.

4Spraying is reminiscent of Valiant Load Balancing [50]. But unlike VLB,
which uses arbitrary nodes as intermediaries, it uses only neighboring nodes.
Its primary goal is high fan-out at the source, not load balancing, though
high fan-out does aid load balancing.

4

**Why waypoints** . Spraying alone fails in some cases. Sup
pose _𝑠_ is a neighbor of _𝑡_ . After _𝑠_ sprays, its neighbors use
shortest paths to _𝑡_ . Unfortunately, unless a neighbor is directly connected to _𝑡_, which will be rare in a large graph,
the shortest paths go via _𝑠_ . So almost all neighbors route the
traffic back to _𝑠_, and the _𝑠_ → _𝑡_ link will congest. Higher-level
waypoints ( _𝑊𝑃𝑙_ ∈[1 _,ℓ_ ] ( _𝑡_ )) draw out traffic further, preventing a collapse on this link. Further, selecting _𝑝_ of _𝑑_ nodes
builds a _𝑝_ -ary forwarding graph rooted at each neighbor of _𝑡_,
which helps spread traffic across all neighbors (high fan-in).
Otherwise, some neighbors may not be used.
**Setting** _ℓ_ . To achieve the goals of spraying and waypointing,
we set _ℓ_ =max(1 _,_ ⌈log _𝑝_ ( _𝑛_ /2 _𝑑_ [2] )⌉). The size of the set _𝑊𝑃_ _ℓ_ ( _𝑡_ )∪
_𝐼𝑅_ ( _𝑡_ ) will be at least _𝑛_ /2 for this choice of _ℓ_ (§7), which reduces path lengths because each node in _𝑂𝑅_ ( _𝑡_ ) will connect
directly to this set with high probability.
**Path length variability** . Like other proposals for routing
in expander graphs [23, 45, 49], Spraypoint computes paths
of different lengths between a pair of endpoints. This variability will not impact single-path transport protocols like
TCP which sample only one path (based on ECMP), but it
could confuse multipath protocols [42, 44, 57] that spread
traffic across multiple paths (by varying packet headers used
by ECMP) if they use latency differential as a congestion
or load balancing signal. In a datacenter that spans 300 meters and uses 100 Gbps links, a 2-hop path length difference
creates a maximum latency difference of 4.4 _𝜇𝑠_ (0.7 _𝜇𝑠_ transmission time for a 9 KB packet, 1.5 _𝜇𝑠_ propagation delay per
hop). This differential is low compared to endhost latencies
and a small amount of queuing (6 packets) will wipe it out.
Benchmarking on production fabrics confirms the absence
of performance issues for multipath protocols (§8).
**Distributed implementation** . Spraypoint permits a fully
distributed implementation as a link-state protocol, where
every node has a full view of the topology. Nodes can compute levels for each destination and then compute local next
hops by applying the pointing rules. All nodes make identical
waypoint selections, via deterministic hashing of a shared
key, ensuring that all pointing graphs are loop free.

We implement spraying using VRFs (virtual routing and
forwarding), which enable different routing logic for different
interfaces. Unlike prior work that uses VRFs to create nonshortest paths [23] (which does not scale), we need only
two VRFs. All server-facing interfaces of a router use a VRF
that sprays incoming traffic to all fabric-facing interfaces.
(One exception is traffic destined to servers connected to the
same router, which is forwarded directly to those servers.)
All fabric-facing interfaces use a second VRF that follows
the pointing rules. This setup allows a packet to revisit its
source (at most once) without looping indefinitely.

_f_ r FPs each

|d<br>f<br>. . . .|Col2|Col3|Col4|
|---|---|---|---|
|||||

**Figure 4: A ShuffleBox.**

**Resource** **requirements** . Spraypoint uses two types of
router memory. The first is longest-prefix matching (LPM)
memory, which maps the destination address of an incoming
packet to an ECMP group id. LPM memory use depends on
the number of network prefixes and is similar to fat trees. [5]

The second type of memory is to map ECMP group id to
next hop set. Its required size depends on how ECMP groups
are setup. The two possibilities are: (1) a separate ECMP
group for each destination node, which consumes _𝑂_ ( _𝑛ℎ_ )
memory; and (2) pre-define all possible _𝑑_ _[ℎ]_ groups and use
the corresponding one for each destination, which consumes
_𝑂_ ( _ℎ𝑑_ _[ℎ]_ ) memory. Based on _𝑛_ and _𝑑_, we pick the method that
supports the larger _ℎ_ while fitting in the memory. For 128port switches, the value of _𝑑_ is around 64, so a minimum of
_ℎ_ =2 is always feasible independent of fabric size ( _ℎ𝑑_ _[ℎ]_ ≈ 8 _𝐾_ ).

The computational complexity of Spraypoint is _𝑂_ ( _𝑛_ [2] _𝑑_ ) per
node because each node inspects _𝑛𝑑_ edges per destination to
compute levels. The CPUs of modern commodity switches
can handle such complexity [29]. For comparison, the complexity of k-shortest-paths routing is _𝑂_ ( _𝑘𝑛_ [2] ( _𝑑_ + log _𝑛_ )) [54].

## 6 CABLING QUASI-RANDOM GRAPHS

We explain how quasi-random graphs are realized in RNG
after a brief background on datacenter cabling.
**Datacenter** **cabling** . Datacenter space is typically partitioned into O(10) _rooms_ (not necessarily with dividing walls).
Each room hosts some number of racks. Before server racks
land, the room is _prepared_ by installing power, cooling, and
basic cabling infrastructure including patch panels and interroom trunk cables. When server racks land, additional cables
are installed to connect them.

The cost and complexity of cabling stems from three main
factors: (1) the number of connectors and endpoint pairs,
where a patch panel is an endpoint and so is a ToR; (2) the
length of cables and the fraction that are intra- versus interroom—inter-room cabling is more expensive because it needs
extra infrastructure; and (3) the amount of cabling that can be
done during room preparation versus when racks land—later
cabling is riskier and slower.

5An exception is when hierarchy is leveraged to aggregate some prefixes.
Such aggregation is not feasible in flat expanders. Because LPM memory is
huge, it can support even the largest Amazon DCs without aggregation.

5

**Figure** **5:** **Cabling** **in** **a** **datacenter** **with** **three** **rooms.**

**Routers connect to r-ports of ShuffleBoxes in the room,**

**and ShuffleBoxes inter-connect via c-ports.**

**Physical connectivity in RNG** . We build a quasi-random
graph using ShuffleBoxes (Figure 4). Each ShuffleBox has
_𝑑𝑟_ _r-ports_ that connect to routers and _𝑑𝑐_ _c-ports_ that connect to other ShuffleBoxes. R-ports and c-ports terminate,
respectively, _𝑓𝑟_ and _𝑓𝑐_ fiber pairs (FPs) each. An FP enables duplex communication between routers. ShuffleBoxes connect
FPs between r-ports and c-ports ( _𝑑𝑟_ × _𝑓𝑟_ = _𝑑𝑐_ × _𝑓𝑐_ ). We describe
these parameter values later.

To connect routers via ShuffleBox, we deploy a set of ShuffleBox, called a _shuffle panel_, in each room (Figure 5). Router
uplinks connect to randomly selected r-ports in the panel.
The c-ports of panels in different rooms are also randomly
connected. If there are _𝑅_ panels, each with _𝐶_ ShuffleBoxes,
we connect approximately [(] _[𝑅]_ [−][1] _𝑅_ [)] _[𝐶𝑑][𝑐]_ c-ports of each panel to

other panels, essentially building a random graph between
panels. Unconnected c-ports of a panel have a _ShuffleBack_, a
special connector that bridges pairs of FPs coming into the
c-port (from r-ports). It bridges FP1 to FP2, FP3 to FP4, and
so on. Panel r-ports that are not connected to routers also
have a ShuffleBack that bridges c-port FP pairs. Routers connect only to the ShuffleBoxes (never directly), and topology
modifications are achieved by changing only connections
between the ShuffleBoxes (as explained below).

Figure 6 shows three ways in which two routers can logically connect: (a) routers in the same room connect to the
same ShuffleBoxe and their FPs are shuffled to a c-port with
a ShuffleBack; [6] (b) routers in different rooms whose FPs are
shuffled to connected c-ports; (c) routers whose FPs end up
at the same ShuffleBacked r-port in another room. In the
final pattern, the two ToRs may be in the same room.

Connecting via ShuffleBoxes has higher optical loss than
direct connectivity, but this loss is within the margins of
commodity transceivers. Our construction can produce even
longer end-to-end paths, e.g., if the right r-port in Figure 6c
had a ShuffleBack instead of connecting to a router, the path

6With random mapping of router uplinks to ShuffleBox r-ports, there is a
chance that two uplinks of the same router land on the same ShuffleBox
and are bridged via a c-port ShuffleBack. For realistic router counts, the
probability of self-edges is negligible since each ShuffleBox is small.

(c)

**Figure** **6:** **Physical** **connectivity** **patterns** **that** **enable**

**logical connectivity. The hats denote ShuffleBacks.**

will extend and go back out via a c-port. We disable paths
with over seven connectors to maintain optical signal quality.
**Incrementally deploying rooms and racks** . RNG’s physical connectivity can be done incrementally. §A describes
the process. To summarize the key steps: (1) install a new
shuffle panel when a new room is prepared; (2) if it is not the
first room, rebalance inter-panel connectivity by removing
some existing (randomly selected) c-port connections and
ShuffleBacks and using the opened c-ports to connect to the
new panel; and (3) when racks land in the room, connect
router uplinks to randomly selected r-ports.
**ShuffleBox** **configuration** . We use _𝑓𝑟_ =4, the number of
breakout lanes for a 400 Gbps physical port. So that each
FP coming into an r-port from a router can reach different
places via different c-ports, _𝑑𝑐_ = _𝑓𝑟_ =4. We use _𝑓𝑐_ =32 to balance
availability of commodity connectors (larger values are less
common) and effort to rebalance inter-panel connectivity
(small values increase effort). Finally, since _𝑑𝑟_ × _𝑓𝑟_ = _𝑑𝑐_ × _𝑓𝑐_, we
get _𝑑𝑟_ =32. With this configuration, the shuffling pattern of
ShuffleBoxes is simple: each c-port FP goes to a different
r-port, and each r-port FP goes to a different c-port (full
bipartite).
**Cabling** **complexity** . RNG’s cabling has low complexity
per the three factors outlined earlier. With _𝑛_ routers and _𝑅_
rooms, the number of physically-connected endpoint pairs
is _𝑛_ + _[𝑅]_ [(] _[𝑅]_ 2 [−][1][)] as opposed to _𝑛_ [2] logically-connected pairs. We

count each shuffle panel as one endpoint because after the
trunk cables reach the panel, the intra-panel distribution
is simple. Inter-room cables are limited to _[𝑅]_ [(] _[𝑅]_ 2 [−][1][)] trunks

between shuffle panels. Other than router to r-port connectivity, all cabling can be done before racks land. Along these
factors, cabling complexity of RNG is on par with fat trees.
Rebalancing inter-panel connectivity is a unique activity in
RNG, but it is needed only a small number of times, when
new rooms are prepared.
**Cost** . ShuffleBoxes and ShuffleBacks are novel passive optical
components that RNG uses to simplify cabling. Being passive,
their cost is low relative to switches and transceivers and

6

RNG, p=2
Model, p=2
RNG, p=16
Model, p=16

0 1 2 3 4 5
Path length

**Figure 7: Path length distribution.**

similar to traditional patch panels [14] and loopbacks [15]
that are often used to simplify fat tree cabling.
**Resulting graphs** . The logical graph built using our physical construction is an optimal expander despite using deterministic router-to-ShuffleBox connections and constraining
randomness (since c-port edges are balanced between rooms
and bundle edges between multiple router pairs. Because
each bundle has random routers and c-port connections are
random, our analysis confirms that RNG topologies have the
same spectral gap [53], a measure of expansion, as unconstrained random graphs.

## 7 MODELING PERFORMANCE

Following the standard practice for quasi-random graphs, our
analysis assumes that the graphs are truly random. The combination of random graphs and spraying-induced decorrelation enables modeling of RNG’s performance. Our models
inevitably make simplifying assumptions but predict performance quite accurately (§9). We summarize the key results in
this section and include details in the appendix. Our models
give approximate formulas that give accurate predictions
of the actual quantities. For convenience, we do not give
formal statements here, and defer all precise mathematical
statements and proofs to the appendix.

We consider operating regimes in which ( _𝑖_ ) 2(ln( _𝑛_ ) + 5) ≤
_𝑑_ ≪ _𝑛_, ( _𝑖𝑖_ ) _𝑝_ ≥( _𝑛_ / _𝑑_ [2] ) [1][/] _[ℓ]_, and ( _𝑖𝑖𝑖_ ) _ℎ_ ≪ _𝑑_, where _ℓ_ is the
number of waypoint levels in Spraypoint. (We used the second criterion in §5 for setting _ℓ_ ). Performance is predictable
in this regime because distributional tails due to randomness
are trimmed. At the same time, this regime is broad. Since
commodity switches support at least 128 breakout lanes [5, 6],
we can easily pick values of _𝑑_ that exceed the stated lower
bound (≈ 28 for _𝑛_ =10K) for even large fabrics, and we can
pick compliant values of _𝑝_ and _ℎ_ . Further, _ℓ_ =1 suffices for
_𝑛_ =10K and typical values of _𝑑_ and _𝑝_ . Our oversubscription
model focuses on that regime for simplicity.

### 7.1 Edge disjoint paths

Spraypoint exploits the expansion property to compute many
edge disjoint paths. The formal statement and proof are given
in §F.

Model 7.1. _With_ _high_ _probability,_ _the_ _number_ _of_ _edge-_
_disjoint paths between 𝑠_ _and 𝑡_ _are approximated by:_

 _𝑑_ (1 − exp(− _ℎ_ )) _if 𝑠_ ∉ _𝑊𝑃_ 0( _𝑡_ )
min[ _𝑑_  - _𝑝,𝑑_ (1 − exp(−(1 − _𝑝_ / _𝑑_ ) _ℎ_ ))] _if 𝑠_ ∈ _𝑊𝑃_ 0( _𝑡_ )

A detailed explanation of this model is in §F, but we summarize here. Consider _𝑠_ ∉ _𝑊𝑃_ 0 ( _𝑡_ ) (i.e., s is not a neighbor
of _𝑡_ ), and spraying a single packet to every neighbor of _𝑠_ .
The number of edge disjoint paths is closely related to the

§E has the proof, but Figure 7 compares the model to a
simulated fabric. It considers two values of _𝑝_, with _𝑛_ =1K and
_𝑑_ =64. The model matches the simulation well, especially for
_𝑝_ = 2. When _𝑝𝑑_ _>_ _𝑛_, as for _𝑝_ =16, lower-order terms that
determine level sizes begin to matter. We ignore them for
simplicity, but our analysis can be extended if needed.
**Takeaways** . (1) When _ℓ_ = 1 (practical regime), the maximum
path length is 5, and 5-hop paths are a negligible fraction
(e.g., exp(− _𝑝𝑑_ [2] / _𝑛_ ) ≈ 0 _._ 0003 for _𝑛_ =1K, _𝑑_ =64, _𝑝_ =2). (2) In this
regime, the average path length of RNG is less than that

1.0

0.8

0.6

0.4

0.2

0.0

number of neighbors of _𝑡_ reached by these packets. Modeling
this process as a balls and bins calculation [52], where each
ball is thrown _ℎ_ times, leads to the formula above.

When _𝑠_ ∈ _𝑊𝑃_ 0( _𝑡_ ), _𝑝_ neighbors of _𝑠_ are in _𝑊𝑃_ 1( _𝑡_ ). When
traffic is sprayed by _𝑠_, the traffic to these waypoints potentially comes back to _𝑠_ . For the other _𝑑_ - _𝑝_ neighbors, we get
a version of the balls and bins game.
**Takeaways** . (1) For both types of sources, the reduction in
the number of edge disjoint paths compared to the maximum
possible value of _𝑑_ is proportional to exp(− _ℎ_ ). Thus, a low
value of _ℎ_ _>_ 1 suffices for good performance. The change in
exp(− _ℎ_ ) from _ℎ_ =1 (0.37) to _ℎ_ =2 (0.13) is large, but it tapers
off rapidly as _ℎ_ increases. (2) For neighboring sources, high
values of _𝑝_ reduce the number of edge disjoint paths.

### 7.2 Path length

Path lengths in RNG depend on the sizes of various Spraypoint levels. A packet is sprayed to a random node, and the
number of pointing hops depends on the node’s level. We
can bound the resulting path length distribution.

Model 7.2. _With high probability, the fraction of paths of_
_length 𝑖_ _is approximated by:_

⎧⎪⎪⎪⎪⎪⎨
⎪⎪⎪⎪⎪⎩

1/ _𝑛_ _𝑖_ = 1
_𝑝_ _[𝑖]_ [−][2] _𝑑_ / _𝑛_ 2 ≤ _𝑖_ ≤ _ℓ_ + 2
exp(− _𝑝_ _[ℓ]_ _𝑑_ [2] / _𝑛_ ) _𝑖_ = _ℓ_ + 4

_rest_ _𝑖_ = _ℓ_ + 3

7

of 3-tier fat trees, where the vast majority of ToR-to-ToR
paths have 4 hops. (3) RNG paths have variable lengths even
across the _same_ endpoint pair, unlike fat trees where all paths
between two endpoints are equal. (4) _ℎ_ does not impact path
length.

### 7.3 Throughput (oversubscription ratio)

A key measure of a network’s throughput is oversubscription ratio. It is the minimum fraction of traffic that the network can deliver, without exceeding link capacities, across
all possible traffic matrices. Unlike for fat trees, one cannot
determine oversubscription for expander topologies through
a simple analysis of the graph structure.

Our oversubscription model uses two observations. First,
the worst case traffic matrix is a _matching_ where every
node sends at full rate to exactly one other node and receives at full rate from exactly one other (possibly different)
node [37]. We consider a matching with randomly selected
source-destination pairs, which can be viewed as modeling
_stochastic_ oversubscription. This random traffic matrix might
not be the worst case. While matchings with long paths can
help find worse traffic matrices [25, 28], spraying in RNG
decorrelates path lengths.

The stochastic analysis is common in random graph theory—
argue that worst case for graph properties (e.g., cuts, expansion, matchings) is close to the random case, using a union
bound argument [13, 34]. Second, the network throughput is
maximized for a given traffic matrix, or the oversubscription
ratio is minimized, when traffic takes the shortest possible
paths (Lemma G.2).

We estimate oversubscription by estimating _𝜇𝑖_ for each
flow in a random matching, where _𝜇𝑖_ is the maximum fraction of flow carried by _𝑖_ -hop paths. The details are in §G.2;
we summarize below.

We consider _𝑖_ ∈[2 _,_ 5] because the probability of length 1
paths is negligible and the maximum path length is 5 when
_ℓ_ = 1 (practical regime). We approximate _𝜇_ 2 as _𝑑_ / _𝑛_ because
each flow has _𝑑_ / _𝑛_ fraction of 2-hop paths (Model 7.2). With
an assumption that paths do not overlap, we can show that
almost every such path carries a single unit of flow.

Estimating _𝜇_ 3 is more challenging because we cannot assume that paths do not overlap. We first estimate _𝜙_ 3, the
fraction of a source _𝑠_ ’s capacity along 3-hop paths after removing the _𝑑_ / _𝑛_ edges used by 2-hop paths, using the facts
that 3-hop paths are of the form _𝑠_ → _𝑊𝑃_ 1( _𝑡_ ) → _𝑁𝑏𝑟_ ( _𝑡_ ) → _𝑡_
and there are _𝑝𝑑_ waypoints. We then estimate _𝜅_ 3, the amount
of source-destination flow that such a path can carry, using
the distribution of path overlaps.

_𝜙_ 3 = min( _𝑝𝑑_ / _𝑛,_ 1 − _𝑑_ / _𝑛_ ) · (1 − _𝑑_ / _𝑛_ ) · (1 −(4 _𝑑_ / _𝑛_ ) _[ℎ]_ )

_𝜅_ 3 = (1 − _𝜙_ 3) [6] /2 + (1 − _𝜙_ 3 [2][)][3][/][6][ +][ 1][/][3]

After similar polynomial calculations for _𝜇_ 4, _𝜇_ 5, we get:

Model 7.3. _The oversubscription ratio is approximated by_
( _𝜇_ 2 + _𝜇_ 3 + _𝜇_ 4 + _𝜇_ 5) [−][1] _._

_𝜇_ 2 = _𝑑_ / _𝑛_

_𝜇_ 3 = _𝜙_ 3 _𝜅_ 3 _(see above)_

_𝜇_ 4 = [1 −( _𝑝_ + 1) _𝑑_ / _𝑛_    - exp(− _𝑝𝑑_ [2] / _𝑛_ )]

         
             - 1 −[1 −(1 − 2 _𝑑_ / _𝑛_ )(1 −(4 _𝑑_ / _𝑛_ ) _[ℎ]_ )] _[ℎ]_ 

·(1 − _𝜇_ 2 − 2 _𝜇_ 3)/4

_𝜇_ 5 = exp(− _𝑝𝑑_ [2] / _𝑛_ )(1 − _𝜇_ 2 − 2 _𝜇_ 3 − 3 _𝜇_ 4)/5

This model characterizes the mesh-layer (between routers)
oversubscription. For an end-to-end (server-to-server) analysis, oversubscription at the ToRs must also be factored (§7.4).
**Takeaways** . Fabric oversubscription is a complex interplay
of all parameters. By capturing it for a wide range of parameter values, [7] our model enables fabric design for specific
performance targets, which we discuss next.

### 7.4 Designing fabrics

While the exact procedure for determining the topology and
routing parameters ( _𝑛_, _𝑑_, _𝑝_, and _ℎ_ ) depends on desired tradeoffs (e.g., between oversubscription and path length), we
illustrate for a common target: minimize cost (fewest ToRs)
of connecting _𝑠_ servers with an end-to-end oversubscription ratio below _𝑟𝑒_ and ToR-layer oversubscription below _𝑟𝑡_
(1≤ _𝑟𝑡_ ≤ _𝑟𝑒_ ). Since ToRs are a localized congestion risk, operators usually want to control their oversubscription [40].

To meet the target above, we binary search for the minimal
viable value of _𝑑_ such that _𝑑_ ≥⌈ _𝑟𝑡𝑃_ +1 [⌉][,] _[ 𝑑]_ [≥] [2] _[𝑙𝑛]_ [(⌈] _𝑃_ - _𝑠_ _𝑑_ [⌉) +][ 5][)][,]
and _𝑑_ _< 𝑃_, where _𝑃_ is the number of router ports. The first
constraint ensures that ToR layer oversubscription, which
is _[𝑃]_ _𝑑_ [−] _[𝑑]_ [:1, is below] _[ 𝑟][𝑡]_ [; the second ensures that the design is]

within the modeled operating regime; and the third ensures
that at least one port is available for servers. Minimizing _𝑑_
subject to these constraints minimizes ToR count because it
maximizes _𝑃_ - _𝑑_, the ports that connect to servers.

The viability of a value of _𝑑_ is determined as follows. Based
on _𝑑_, we compute the number of required ToRs _𝑛_ as ⌈ _𝑃_ - _𝑠_ _𝑑_ [⌉][.]
We then determine the maximum value of _ℎ_ that ToRs can
support based on _𝑛_, _𝑑_, and the ECMP memory size (§5). For
a given _𝑑_, _𝑛_, and _ℎ_, the valid range of _𝑝_ is [ _𝑛_ / _𝑑_ [2] _,𝑑_ ], and
different values yield different oversubscription ratios. We
compute the range of oversubscription ratios using Model 7.3
for extreme values of _𝑝_, and deem _𝑑_ as viable if _𝑟𝑒_ / _𝑟𝑡_, which
is the desired mesh-layer oversubscription, falls in this range.

7The formulas can be simplified for specific regimes, e.g., when a parameter
is fixed. For _ℎ_ =2, log _𝑑_ ( _𝑛_ / _𝑝_ ) + 2 approximates Model 7.3 well.

8

**Figure** **8:** **(a)** **One** **of** **the** **racks** **hosting** **the** **emulated**

**ShuffleBoxes. (b) Rows of emulated ShuffleBoxes. (c)**

**A ShuffleBack dongle with 4-FPs MPO connector.**

Once we have the minimal viable _𝑑_, and corresponding _𝑛_,
_ℎ_, we use the maximum _𝑝_ ∈[ _𝑛_ / _𝑑_ [2] _,𝑑_ ] with oversubscription
less than _𝑟𝑒_ / _𝑟𝑡_ . Maximizing _𝑝_ minimizes oversubscription.

## 8 PRODUCTION FABRICS

We have deployed the RNG design in two fabrics that carry
production workloads. The first, called the "server mesh",
connects ToRs as an expander. The second, called the "edge
mesh," connects to the server mesh and to remote datacenters,
and it provides transit between these networks. Ports that
interconnect the two RNG fabrics are spread across their
routers. We build separate fabrics because they have different
oversubscription targets. The edge mesh is non-blocking and
server mesh has the same oversubscription ratio as Amazon’s
latest fat tree fabrics. We elide the oversubscription level and
mesh sizes for confidentiality.

At the time of deploying these fabrics, we did not have
manufactured ShuffleBoxes. We emulated shuffling with a
traditional patch panel that bridges individual FPs and custom ShuffleBacks. See Figure 8.
**Spraypoint performance** . We implemented Spraypoint by
extending Amazon’s shortest-paths based link-state protocol.
We reused the topology dissemination component and modified next hop computation. For similarly-sized topologies,
Spraypoint performs similarly to the current protocol along
key metrics such as convergence time after a failure.
**Cabling experience** . Cabling RNG using the scheme in §6
was relatively smooth. One challenge was ensuring enough

ShuffleBoxes are installed in each room. The exact number
of racks, and thus router uplinks, that can land in a room
varies, depending on their power consumption. We used an
estimated upper bound on the number of router uplinks per
room. [8]

Due to a lack of structure and physically identifiable patterns, a concern with random graphs has been operators
connecting ports not intended to be connected [45, 49]. The
incidence of such miscabling in RNG was below 1.5%.
**Operational challenges** . We give a short preview of these
challenges, even though it is not a focus of this paper. Operationalizing random graphs required upgrading many software tools that manage Amazon’s networks. The hierarchy
of fat trees was embedded deeply into these tools, starting
from device names itself to managing redundancy during
maintenance. For instance, ToRs in fat trees do not rely on
each other and can be upgraded based on concerns local to
the rack, but in RNG we need to account for inter-ToR dependencies and cannot simultaneously upgrade too many neighbors of any given ToR. We ensured that fault localization
functions properly and built new tools to easily determine
the paths between ToRs for troubleshooting.
**Application performance** . A majority of traffic in hyperscale datacenters is moving toward multipath transport protocols [42, 44, 57]. The sender splits data across tens of
"flowlets" that use different paths in the network (based on
flowlet hash). The receiver assembles and orders the data,
transparent to the applications. The sender uses latency as
one of the signals when picking which flowlet to use.

Our main benchmarking goal is to validate that latency differential across sender-receiver paths (§7.2) does not impact
performance. We study this by observing the raw throughput
of the transport protocol and the performance of a latencyand throughput-sensitive block-storage application that uses
the protocol. We compare RNG against a production fat tree
fabric with identical oversubscription and identical server
specs. We normalized results by the mean values observed
for the fat tree to preserve confidentiality.

Figure 9 shows the throughput distribution based on an
experiment with 127 concurrent flows with infinite demand
between pairs of random servers. The results are identical
for RNG and fat tree. Any differences in path latencies of the
two networks are immaterial for application performance.

Figure 10 (left) compares the packets per second (PPS)
for small, 64-byte packets between pairs of servers. RNG is
slightly higher because it has less background traffic. Figure 10 (right) shows I/O operations per second (IOPS) for

8If this bound were breached, we plan to treat the remaining racks as belonging to a new logical room and perform the room-addition activity. Analogous
provisioning challenges arise also for fat trees in large datacenters.

9

1.0

0.8

0.6

0.4

0.2

0.0

~~Fat~~

~~ tr~~

~~ e~~

~~RN~~

0.0 0.5 1.0 1.5 2.0 2.5
Normalized flow throughput (Gbps)

**Figure 9: Per-flow throughput of multipath transport**

**(normalized by the fat tree mean).**

2.0

1.5

1.0

0.5

0.0
RNG Fat tree

2.0

1.5

1.0

0.5

0.0
RNG Fat tree

**Figure 10: PPS of 64B packets (left) and IOPS of storage**

**reads (right). The error bars are standard deviations.**

storage reads from clients to multiple servers. RNG’s performance matches fat trees for this workload as well.

These benchmarks, and the absence of user-reported performance issues, confirm that RNG matches fat tree performance (at lower cost and higher fault tolerance).

## 9 BROADER EVALUATION

Production fabric benchmarks can validate the performance
of real applications but we need simulations to evaluate a
broad range of design parameters and workloads. We benchmark RNG’s oversubscription ratio and the number of edge
disjoint paths that Spraypoint produces. We also compare
its throughput and cost relative to fat trees.

### 9.1 Oversubscription

Oversubscription ratio characterizes worst-case throughput
of a network and helps quantify congestion risk. Namyar et
al. [37] prove that worst-case throughput occurs for a perfect unidirectional matching, where each node sends at full
rate to its counterpart. The authors do not suggest a way
to generate the worst matching among the many choices.
We randomly generate 100 matchings and estimate oversubscription using the worst value, though we will see that the
distribution is narrow because the topology and routing are

random [13, 34]. Similar to our oversubscription model, this
process characterizes stochastic oversubscription.

For a given matching, the oversubscription ratio is _𝑟_ if
each transmitter can send at least 1/ _𝑟_ fraction of its full rate
without congesting any link. This measure is determined by
the smallest blocked flow, irrespective of whether others can
send more. We compute _𝑟_ by solving a linear program (LP)
that encodes a multi-commodity flow problem [56]. Traffic
for each flow is spread across Spraypoint paths, and the LP
minimizes _𝑟_ under link capacity constraints. These LPs are
huge and each takes multiple hours to solve, which limits
the largest fabrics we can practically study.

Figure 11 shows the results of simulations ("RNG") and
our model (§7.3). The line denotes the minimum value of
_𝑟_ for each setting. There is a shadow for the max but it is
barely visible because the variance is near zero. To study a
broad range of settings, we vary one parameter while the
others are set to default values ( _𝑛_ =1000, _𝑑_ =64, _𝑝_ =4, _ℎ_ =2).
This default can support 64K servers with 100 Gbps uplinks
and offers an oversubscription ratio of 3.25. We see that the
oversubscription ratio changes gracefully as we vary the
parameters, highlighting the ability of random graphs to
support fine-grained oversubscription levels. We also see
that the impact of _ℎ_ and _𝑝_ flattens out beyond a point.

The model matches empirical results well, enabling performance predictability. It allows operators to plan RNG fabrics
like they plan fat trees today, with the added advantage
of lower cost, higher fault tolerance, and finer-grained performance tuning. Some settings in Figure 11 are technically
outside the modeled regime, e.g., _𝑑_ = 20 ≱ 2(ln( _𝑛_ = 1 _𝐾_ ) + 5).
We have defined the regime conservatively to get high probability results, and the models degrade gracefully outside the
regime.

### 9.2 Edge disjoint paths

Spraypoint aims to find many edge disjoint paths. We evaluate this ability by computing the min cut across paths between endpoint pairs, which equals the number of edge
disjoint paths [55]. Figure 12 shows the CDF of min cut
across endpoint pairs for the same default fabric parameters
as above ( _𝑛_ =1000, _𝑑_ =64, _𝑝_ =4, _ℎ_ =2). For comparison, it also
shows _𝑘_ -shortest-path routing (which is not implementable
at scale with commodity switches). We consider _𝑘_ =8 [45, 49]
and _𝑘_ =64, a high value that equals the node degree (and
needs 8x more resources).

For almost all endpoint pairs, Spraypoint finds over 50
edge disjoint paths. For half the pairs, it finds over 60 such
paths out of the maximum possible 64. In contrast, the median for 8-shortest-paths is 5 and for 64-shortest paths is
35. This difference impacts oversubscription directly. The
oversubscription for the two k-shortest-paths configurations

10

M

od

el

0 8 16 24 32
Value of p

4.5

4.0

3.5

3.0

2.5

1000 2000 3000 4000
Value of n

16 32 48 64 80 96
Value of d

4.5

0 4 8 12 16
Value of h

3.5

3.0

2.5

4.5

4.0

3.5

3.0

2.5

4.5

4.0

3.5

3.0

2.5

**Figure 11: Oversubscription for different topology parameters. The defaults are** _𝑛_ **=1000,** _𝑑_ **=64,** _𝑝_ **=4,** _ℎ_ **=2.**

1.00

0.75

0.50

0.25

0.00

8-shortest
64-shortest
Spraypoint

0 10 20 30 40 50 60
# of edge disjoint paths

**Figure 12: Edge disjoint path count.**

are 21.3 and 4.7, while that for Spraypoint is 3.25. Spraypoint
is easier to implement _and_ finds a greater diversity of paths.
It offers higher peak throughput between endpoint pairs,
and offers higher network-wide throughput.

### 9.3 Throughput relative to fat trees

Beyond worst-case traffic patterns that help characterize
oversubscription, operators want to also validate performance for other traffic patterns. This validation is hard because there are many possible traffic patterns. Our evaluation
is based on the observation that any traffic pattern may be
viewed as a combination of three basic types, and we can get
insight into the performance of RNG for a range of traffic
patterns by studying these types. The three types are:

 - _Clique:_ A group of nodes exchanges traffic amongst
themselves (e.g., collective communication like all-reduce,
replication traffic among storage servers).

 - _Hubs:_ Some nodes (e.g., Web or storage servers) send to
and receive from all other nodes.

 - _Matchings:_ Nodes send all traffic to exactly one other
node, as we studied earlier.

The nodes in the traffic patterns are ToRs, not individual
servers, because that stresses the fabric more [37].

Each pattern type is parameterized by active fraction _𝑓_ ∈

[0 _,_ 1] to capture the skew. Clique( _𝑓_ =0.2) means that the
clique size is 20% of the nodes (randomly selected); hubs( _𝑓_ =0.2)
means that 20% of the nodes in the network are hubs; and

matchings( _𝑓_ =0.2) means that 20% of the nodes are involved
in the matching. For each pattern type and _𝑓_, all flows in the
traffic matrix (between a sender-receiver pair) are equal and
sum of rows and columns equal the local capacity of nodes.
Thus, each matrix is routable in a non-blocking fabric.

For each value of _𝑓_, we generated 100 random traffic matrices. We quantify performance for a matrix using the fraction
_𝑟_ as before—the network can carry at least 1/ _𝑟_ fraction of
each flow. Thus, we are computing the oversubscription ratio
of each matrix, instead of worst-case oversubscription ratio.

Figure 13 shows the results for RNG and fat tree. The lines
denote the mean and the shaded area denotes the min and
max. Both topologies are designed to support 61.4K servers
across 960 ToRs, with a worst-case oversubscription of 3:1.
In this configuration, RNG uses 45% fewer switches.

We see that RNG performs better by as much as 30% across
a wide regime for clique and hubs. The exceptions are cases
with _𝑓_ <0.1, where fat tree is 5-10% better. For these cases,
shortest path routing on fat trees finds edge disjoint paths
that equal the ToR degree. The equivalent number is 10%
lower in RNG for _ℎ_ =2 (see §9.2). The number of edge disjoint
paths matters most when there are few senders in the network. For matchings, fat tree is better when _𝑓_ <0.4 and RNG
is better otherwise.

Amazon operators prefer the broadly better performance
of RNG, especially given its lower cost and higher fault
tolerance. The regimes with low values of _𝑓_, where fat tree
performs better, are acceptable because they will materialize
only when all servers in the rack act in unison, a rarity for
multi-tenant datacenters.

### 9.4 Cost relative to fat trees

Prior works report a range of values on the cost of expander
topologies relative to fat trees. These values are difficult to
compare because they use different performance measures
and network sizes. It is also difficult to get a holistic view

11

Traffic pattern: matchings

~~F~~

~~t tr~~

~~ ee~~

~~R~~

~~NG~~

0.0 0.2 0.4 0.6 0.8 1.0
Active fraction (f)

4

3

2

1

Traffic pattern: clique

0

0.0 0.2 0.4 0.6 0.8 1.0
Active fraction (f)

Traffic pattern: hubs

0.0 0.2 0.4 0.6 0.8 1.0
Active fraction (f)

**Figure 13: Oversubscription ratio (lower is better) for different traffic matrices. Both fat tree and RNG topologies**

**are configured for worst-case oversubscription ratio of 3:1. RNG topologies use 45% fewer switches.**

128 ports

131K 262K 524K
Num. servers

50

40

30

20

10

0

32 ports

2048 4096 8192
Num. servers

Oversub.

1:1
2:1
3:1
7:1
15:1

**Figure 14: Reduction in number of switches in RNG**

**relative to a 3-tier fat tree for two different port counts.**

because of their experimental methodology. Our models enable systematic analysis of the relative cost as a function of
oversubscription ratios and network sizes.

We use the ratio of the number of switches used by the
two topologies as the measure of relative cost. This measure
automatically includes transceivers, whose count is proportional to switch count. It ignores passive optical components
like cables, connectors, and patch panels; the cost of these
components is in the minority and varies based on specific
cabling methods (e.g., if cables are trunked) in the datacenter.
Switch count is a general, reproducible measure.

We compute the number of switches needed for RNG
using the procedure in §7.4 and compare it to generalized
3-tier fat tree with the same oversubscription level. ToRs
are not oversubscribed in either RNG or fat trees. Figure 14
shows the results for different oversubscription levels and
two possible values of switch port counts. The highest server
count for each port count is the maximum supported by a
non-blocking fat tree [36], and the other two are 50% and 25%
of the servers. Oversubscription of 2:1 cannot be precisely
supported in fat trees with 32 or 128 port switches, but we
assume each port is 3-way splittable for this experiment.

The cost reduction varies by 5x, between 9 and 45%. It has
a similar pattern across port counts and network sizes, and
oversubscription ratio is the key determiner. The reduction is
low for the 1:1 oversub case because non-blocking fat trees do
not strand capacity; the reduction here primarily comes from
shorter paths in RNG. After increasing from oversubscription
of 1:1 to 3:1, the cost advantage starts decreasing slowly. For
high oversubscription, a fat tree has fewer switches at the
aggregation and spine tiers, which lowers the potential of
reducing cost by removing those tiers.

Our analysis makes it clear when expander topologies like
RNG bring the most or least value, allowing operators to
make informed choices about the type of topology to use.

## 10 RELATED WORK

We build on the foundations laid by a long line of prior research. The notion of an expander, or an "optimal" graph for
routing purposes, was defined in the early 90s [24], and it
has been long known that random graphs are nearly-optimal
expanders [12]). Several researchers have proposed expander
topologies for datacenters and provided insights into their
performance [4, 25, 26, 37, 45, 49]. Particularly influential
works for us include Jellyfish [45], which proposed (truly)
random graphs for datacenters; Xpander [49], which made
the connection that random graphs do well for data center workloads because they are expanders; and Namyar et
al. [37], who outlined throughput bounds of expander topologies. We extend this body of work by addressing unsolved
challenges related to routing, cabling, and performance predictability. We also deploy the first expander-based networks
in production.

Researchers have also proposed non-expander topologies
that tackle some of the challenges of the fat trees (e.g., cost),
such as HyperX [1], DCell [20], and BCube [19]. We choose
random graphs because they have significantly shorter path
lengths. Further, cabling these other topologies for large,
multi-room datacenters is still an open challenge.

12

Capacity fungibility, a key goal of the RNG design, can
be achieved using reconfigurable hardware as well. We use
expander topologies because they need neither a (logically)
centralized control plane nor non-standard hardware. Most
designs with reconfigurable hardware require a control plane
that predicts global traffic demands and dynamically reconfigures the topology [11, 17, 21, 22, 51]. The scale of our datacenters, presence of large amounts of bursty traffic (common
for Web workloads), and reconfiguration delays complicate
the development and operation of such control planes.

There are "demand-oblivious" designs that do not require
a centralized control plane [3, 31, 32]. They use novel optical
devices that rapidly cycle through a fixed schedule. All-toall connectivity is not available at any given time, and the
systems use forwarding via intermediate nodes based on
Birkhoff-von Neumann traffic matrix decomposition [7]. In
addition to relying on non-commodity hardware, these designs bring a host of software risks such as time synchronization, packet reordering within a TCP flow, some throughput
degradation [32], and switch-level congestion control [3].

## 11 CONCLUSIONS

Flat expander topologies based on quasi-random graphs
can be practically realized using the routing and cabling
approaches we developed. They can be designed for the desired level of performance and cost using the models we
developed.

## REFERENCES

[1] Jung Ho Ahn, Nathan Binkert, Al Davis, Moray McLaren, and Robert S

Schreiber. 2009. HyperX: topology, routing, and packaging of efficient large-scale networks. In _Proceedings of the Conference on High_
_Performance Computing Networking, Storage and Analysis_ . 1–11.

[2] Mohammad Al-Fares, Alexander Loukissas, and Amin Vahdat. 2008.

A scalable, commodity data center network architecture. In _Proc. ACM_
_SIGCOMM Conference on Data Communication_ . 63–74. [doi:10](https://doi.org/10.1145/1402958.1402967) _._ 1145/
1402958 _[.](https://doi.org/10.1145/1402958.1402967)_ 1402967

[3] Hitesh Ballani, Paolo Costa, Raphael Behrendt, Daniel Cletheroe, Istvan

Haller, Krzysztof Jozwik, Fotini Karinou, Sophie Lange, Kai Shi, Benn
Thomsen, and Hugh Williams. 2020. Sirius: A Flat Datacenter Network
with Nanosecond Optical Switching. In _Proc. ACM SIGCOMM Confer-_
_ence on Data Communication_ . 782–797. doi:10 _._ [1145/3387514](https://doi.org/10.1145/3387514.3406221) _._ 3406221

[4] Maciej Besta and Torsten Hoefler. 2014. Slim fly: a cost effective

low-diameter network topology. In _Proceedings_ _of_ _the_ _International_
_Conference for High Performance Computing, Networking, Storage and_
_Analysis_ . 348–359. doi:10 _._ [1109/SC](https://doi.org/10.1109/SC.2014.34) _._ 2014 _._ 34

[5] Broadcom. 2026. Tomahawk 5 / BCM78900 series. [https:](https://www.broadcom.com/products/ethernet-connectivity/switching/strataxgs/bcm78900-series)
//www _._ broadcom _._ [com/products/ethernet-connectivity/switching/](https://www.broadcom.com/products/ethernet-connectivity/switching/strataxgs/bcm78900-series)
[strataxgs/bcm78900-series](https://www.broadcom.com/products/ethernet-connectivity/switching/strataxgs/bcm78900-series) [Retrieved 6-Feb-2026].

[6] Broadcom. 2026. Tomahawk3 / BCM56980 Series. [https:](https://www.broadcom.com/products/ethernet-connectivity/switching/strataxgs/bcm56980-series)
//www _._ broadcom _._ [com/products/ethernet-connectivity/switching/](https://www.broadcom.com/products/ethernet-connectivity/switching/strataxgs/bcm56980-series)
[strataxgs/bcm56980-series](https://www.broadcom.com/products/ethernet-connectivity/switching/strataxgs/bcm56980-series) [Retrieved 6-Feb-2026].

[7] Cheng-Shang Chang, Duan-Shin Lee, and Yi-Shean Jou. 2002. Load

balanced Birkhoff–von Neumann switches, part I: One-stage buffering.
_Computer Communications_ 25, 6 (2002), 611–622.

[8] F. R. K. Chung, R. L. Graham, and R. M. Wilson. 1989. Quasi-Random

Graphs. _Combinatorica_ 9, 4 (1989), 345–362.

[9] Devdutt Dubhashi and Alessandro Panconesi. 2009. _Concentration of_

_Measure for the Analysis of Randomized Algorithms_ . Cambridge.

[10] Facebook. 2014. Introducing data center fabric, the next-generation

Facebook data center network. [https://engineering](https://engineering.fb.com/2014/11/14/production-engineering/introducing-data-center-fabric-the-next-generation-facebook-data-center-network/) _._ fb _._ com/2014/
[11/14/production-engineering/introducing-data-center-fabric-](https://engineering.fb.com/2014/11/14/production-engineering/introducing-data-center-fabric-the-next-generation-facebook-data-center-network/)
[the-next-generation-facebook-data-center-network/](https://engineering.fb.com/2014/11/14/production-engineering/introducing-data-center-fabric-the-next-generation-facebook-data-center-network/) [Retrieved
6-Feb-2026].

[11] Nathan Farrington, George Porter, Sivasankar Radhakrishnan,

Hamid Hajabdolali Bazzaz, Vikram Subramanya, Yeshaiahu Fainman,
George Papen, and Amin Vahdat. 2010. Helios: a hybrid electrical/optical switch architecture for modular data centers. In _Proc. ACM SIG-_
_COMM Conference on Data Communication_ . 339–350.

[12] Joel Friedman. 2008. A proof of Alon’s second eigenvalue conjecture

and related problems. _J. of the American Mathematical Society_ 195, 910
(2008).

[13] Alan M. Frieze and Páll Melsted. 2012. Maximum matchings in ran
dom bipartite graphs and the space utilization of Cuckoo Hash tables.
_Random Struct. Algorithms_ 41, 3 (2012), 334–364.

[14] fs.com. 2019. Fiber Distribution Panel Wiki, Types and Buying
Tips. https://community _._ fs _._ [com/article/fiber-distribution-panel-wiki-](https://community.fs.com/article/fiber-distribution-panel-wiki-buying-tips.html)
[buying-tips](https://community.fs.com/article/fiber-distribution-panel-wiki-buying-tips.html) _._ html [Retrieved: 2026-02-06].

[15] fs.com. 2026. 8 Fibers MTP Female Type 1 OM4 50/125 Multimode Fiber Loopback Module. https://www _._ [fs](https://www.fs.com/products/35796.html?now_cid=2686) _._ com/products/
35796 _._ [html?now_cid=2686](https://www.fs.com/products/35796.html?now_cid=2686) [Retrieved: 6-Feb-2026].

[16] Adithya Gangidi, Rui Miao, Shengbao Zheng, Sai Jayesh Bondu,

Guilherme Goes, Hany Morsy, Rohit Puri, Mohammad Riftadi,
Ashmitha Jeevaraj Shetty, Jingyi Yang, Shuqiang Zhang, Mikel Jimenez
Fernandez, Shashidhar Gandham, and Hongyi Zeng. 2024. RDMA
over Ethernet for Distributed Training at Meta Scale. In _Proc. ACM_
_SIGCOMM Conference on Data Communication_ . 57–70. [doi:10](https://doi.org/10.1145/3651890.3672233) _._ 1145/
3651890 _[.](https://doi.org/10.1145/3651890.3672233)_ 3672233

[17] Monia Ghobadi, Ratul Mahajan, Amar Phanishayee, Nikhil Devanur, Ja
nardhan Kulkarni, Gireeja Ranade, Pierre-Alexandre Blanche, Houman
Rastegarfar, Madeleine Glick, and Daniel Kilper. 2016. Projector: Agile reconfigurable data center interconnect. In _Proc. ACM SIGCOMM_
_Conference on Data Communication_ . 216–229.

[18] Albert Greenberg, James R. Hamilton, Navendu Jain, Srikanth Kan
dula, Changhoon Kim, Parantap Lahiri, David A. Maltz, Parveen Patel,
and Sudipta Sengupta. 2009. VL2: a scalable and flexible data center
network. In _Proc. ACM SIGCOMM Conference on Data Communication_ .
51–62. doi:10 _._ [1145/1592568](https://doi.org/10.1145/1592568.1592576) _._ 1592576

[19] Chuanxiong Guo, Guohan Lu, Dan Li, Haitao Wu, Xuan Zhang, Yun
feng Shi, Chen Tian, Yongguang Zhang, and Songwu Lu. 2009. BCube:
a high performance, server-centric network architecture for modular
data centers. In _Proc. ACM SIGCOMM Conference on Data Communica-_
_tion_ . 63–74.

[20] Chuanxiong Guo, Haitao Wu, Kun Tan, Lei Shi, Yongguang Zhang,

and Songwu Lu. 2008. Dcell: a scalable and fault-tolerant network
structure for data centers. In _Proc. ACM SIGCOMM Conference on Data_
_Communication_ . 75–86.

[21] Daniel Halperin, Srikanth Kandula, Jitendra Padhye, Paramvir Bahl,

and David Wetherall. 2011. Augmenting data center networks with
multi-gigabit wireless links. In _Proc. ACM SIGCOMM Conference on_
_Data Communication_ . 38–49.

[22] Navid Hamedazimi, Zafar Qazi, Himanshu Gupta, Vyas Sekar, Samir R

Das, Jon P Longtin, Himanshu Shah, and Ashish Tanwer. 2014. Firefly:
A reconfigurable wireless data center fabric using free-space optics. In
_Proc. ACM SIGCOMM Conference on Data Communication_ . 319–330.

13

[23] Vipul Harsh, Sangeetha Abdu Jyothi, and P. Brighten Godfrey. 2020.

Spineless Data Centers. In _Proc. ACM Workshop on Hot Topics in Net-_
_works (HotNets)_ . 67–73. doi:10 _._ [1145/3422604](https://doi.org/10.1145/3422604.3425945) _._ 3425945

[24] Shlomo Hoory, Nathan Linial, and Avi Wigderson. 2007. Expander

graphs and their applications. _Bulletin of the AMS_ 43 (2007), 439–561.

[25] Sangeetha Abdu Jyothi, Ankit Singla, P Brighten Godfrey, and Alexan
dra Kolla. 2016. Measuring and understanding throughput of network
topologies. In _Proceedings of the International Conference for High Per-_
_formance Computing, Networking, Storage and Analysis (SC)_ . 761–772.

[26] Simon Kassing, Asaf Valadarsky, Gal Shahaf, Michael Schapira, and

Ankit Singla. 2017. Beyond fat-trees without antennae, mirrors, and
disco-balls. In _Proc. ACM SIGCOMM Conference on Data Communica-_
_tion_ . 281–294. doi:10 _._ [1145/3098822](https://doi.org/10.1145/3098822.3098836) _._ 3098836

[27] Allan Kaye. 2025. Rail-Optimised Networking: How NVIDIA
is Rethinking AI Network Design in the Data Centre.
https://vespertec _._ [com/news/rail-optimised-networking-how-](https://vespertec.com/news/rail-optimised-networking-how-nvidia-is-rethinking-ai-network-design-data-centre/)
[nvidia-is-rethinking-ai-network-design-data-centre/](https://vespertec.com/news/rail-optimised-networking-how-nvidia-is-rethinking-ai-network-design-data-centre/) [Retrieved
3-Feb-2026].

[28] Murali Kodialam, TV Lakshman, and Sudipta Sengupta. 2011. Traffic
oblivious routing in the hose model. _IEEE/ACM Transactions on Net-_
_working_ 19, 3 (2011), 774–787.

[29] Alexander Krentsel, Nitika Saran, Bikash Koley, Subhasree Mandal,

Ashok Narayanan, Sylvia Ratnasamy, Ali Al-Shabibi, Anees Shaikh,
Rob Shakir, Ankit Singla, and Hakim Weatherspoon. 2024. A Decentralized SDN Architecture for the WAN. In _Proc. ACM SIGCOMM Confer-_
_ence on Data Communication_ . 938–953. doi:10 _._ [1145/3651890](https://doi.org/10.1145/3651890.3672257) _._ 3672257

[30] Hong Liu, Ryohei Urata, Kevin Yasumura, Xiang Zhou, Roy Bannon, Jill

Berger, Pedram Dashti, Norm Jouppi, Cedric Lam, Sheng Li, Erji Mao,
Daniel Nelson, George Papen, Mukarram Tariq, and Amin Vahdat. 2023.
Lightwave Fabrics: At-Scale Optical Circuit Switching for Datacenter
and Machine Learning Systems. In _Proc. ACM SIGCOMM Conference_
_on Data Communication_ . 499–515. doi:10 _._ [1145/3603269](https://doi.org/10.1145/3603269.3604836) _._ 3604836

[31] William M Mellette, Rajdeep Das, Yibo Guo, Rob McGuinness, Alex C

Snoeren, and George Porter. 2020. Expanding across time to deliver
bandwidth efficiency and low latency. In _USENIX Symposium on Net-_
_worked Systems Design and Implementation (NSDI)_ . 1–18.

[32] William M. Mellette, Alex Forencich, Rukshani Athapathu, Alex C.

Snoeren, George Papen, and George Porter. 2024. Realizing RotorNet:
Toward Practical Microsecond Scale Optical Networking. In _Proc. ACM_
_SIGCOMM Conference on Data Communication_ . 392–414. [doi:10](https://doi.org/10.1145/3651890.3672273) _._ 1145/
3651890 _[.](https://doi.org/10.1145/3651890.3672273)_ 3672273

[33] Jeffrey C. Mogul and John Wilkes. 2023. Physical Deployability Matters.

In _Proc._ _ACM_ _Workshop_ _on_ _Hot_ _Topics_ _in_ _Networks_ _(HotNets)_ . 9–17.
doi:10 _._ [1145/3626111](https://doi.org/10.1145/3626111.3628190) _._ 3628190

[34] Rajeev Motwani and Prabhakar Raghavan. 2001. _Randomized Algo-_

_rithms_ . Cambridge University Press.

[35] Jayaram Mudigonda, Praveen Yalagandula, Mohammad Al-Fares, and

Jeffrey C. Mogul. 2010. SPAIN: COTS data-center Ethernet for multipathing over arbitrary topologies. In _USENIX Symposium on Networked_
_Systems Design and Implementation (NSDI)_ . 18.

[36] Jayaram Mudigonda, Praveen Yalagandula, and Jeffrey C. Mogul. 2011.

Taming the Flying Cable Monster: A Topology Design and Optimization Framework for Data-Center Networks. In _USENIX Annual Techni-_
_cal Conference_ . https://api _._ [semanticscholar](https://api.semanticscholar.org/CorpusID:2989246) _._ org/CorpusID:2989246

[37] Pooria Namyar, Sucha Supittayapornpong, Mingyang Zhang, Minlan

Yu, and Ramesh Govindan. 2021. A throughput-centric view of the performance of datacenter topologies. In _Proc. ACM SIGCOMM Conference_
_on Data Communication_ . 349–369. doi:10 _._ [1145/3452296](https://doi.org/10.1145/3452296.3472913) _._ 3472913

[38] Sabine R Ohring, Maximilian Ibel, Sajal K Das, and Mohan J Kumar.

1995. On generalized fat trees. In _Proc. International Parallel Processing_
_Symposium_ . 37–44.

[39] Doron Puder. 2014. Expansion of random graphs: new proofs,
new results. _Inventiones_ _mathematicae_ 201, 3 (Dec. 2014), 845–908.
doi:10 _._ [1007/s00222-014-0560-x](https://doi.org/10.1007/s00222-014-0560-x)

[40] Kun Qian, Yongqing Xi, Jiamin Cao, Jiaqi Gao, Yichi Xu, Yu Guan,

Binzhang Fu, Xuemei Shi, Fangbo Zhu, Rui Miao, Chao Wang, Peng
Wang, Pengcheng Zhang, Xianlong Zeng, Eddie Ruan, Zhiping Yao, Ennan Zhai, and Dennis Cai. 2024. Alibaba HPN: A Data Center Network
for Large Language Model Training. In _Proc. ACM SIGCOMM Confer-_
_ence on Data Communication_ . 691–706. doi:10 _._ [1145/3651890](https://doi.org/10.1145/3651890.3672265) _._ 3672265

[41] Brandon Schlinker, Radhika Niranjan Mysore, Sean Smith, Jef
frey C. Mogul, Amin Vahdat, Minlan Yu, Ethan Katz-Bassett, and
Michael Rubin. 2015. Condor: Better Topologies Through Declarative Design.. In _Proc._ _ACM_ _SIGCOMM_ _Conference_ _on_ _Data_ _Com-_
_munication_ . 449–463. http://dblp _._ uni-trier _._ [de/db/conf/sigcomm/](http://dblp.uni-trier.de/db/conf/sigcomm/sigcomm2015.html#SchlinkerMSMVYK15)
sigcomm2015 _._ [html#SchlinkerMSMVYK15](http://dblp.uni-trier.de/db/conf/sigcomm/sigcomm2015.html#SchlinkerMSMVYK15)

[42] Leah Shalev, Hani Ayoub, Nafea Bshara, and Erez Sabbag. 2020. A

Cloud-Optimized Transport Protocol for Elastic and Scalable HPC.
_IEEE Micro_ 40, 6 (2020), 67–73. doi:10 _._ [1109/MM](https://doi.org/10.1109/MM.2020.3016891) _._ 2020 _._ 3016891

[43] Arjun Singh, Joon Ong, Amit Agarwal, Glen Anderson, Ashby Armis
tead, Roy Bannon, Seb Boving, Gaurav Desai, Bob Felderman, Paulie
Germano, Anand Kanagala, Jeff Provost, Jason Simmons, Eiichi Tanda,
Jim Wanderer, Urs Hölzle, Stephen Stuart, and Amin Vahdat. 2015.
Jupiter Rising: A Decade of Clos Topologies and Centralized Control
in Google’s Datacenter Network. In _Proc. ACM SIGCOMM Conference_
_on Data Communication_ . 183–197. doi:10 _._ [1145/2785956](https://doi.org/10.1145/2785956.2787508) _._ 2787508

[44] Arjun Singhvi, Nandita Dukkipati, Prashant Chandra, Hassan M. G.

Wassel, Naveen Kr. Sharma, Anthony Rebello, Henry Schuh, Praveen
Kumar, Behnam Montazeri, Neelesh Bansod, Sarin Thomas, Inho
Cho, Hyojeong Lee Seibert, Baijun Wu, Rui Yang, Yuliang Li, Kai
Huang, Qianwen Yin, Abhishek Agarwal, Srinivas Vaduvatha, Weihuang Wang, Masoud Moshref, Tao Ji, David Wetherall, and Amin Vahdat. 2025. Falcon: A Reliable, Low Latency Hardware Transport. In _Proc._
_ACM SIGCOMM Conference on Data Communication_ (São Francisco
Convent, Coimbra, Portugal). 248–263. doi:10 _._ [1145/3718958](https://doi.org/10.1145/3718958.3754353) _._ 3754353

[45] Ankit Singla, Chi-Yao Hong, Lucian Popa, and Philip Brighten Godfrey.

2012. Jellyfish: Networking Data Centers Randomly. In _Proceedings_
_of the 9th USENIX Symposium on Networked Systems Design and Im-_
_plementation (NSDI)_ . 225–238. https://www _._ [usenix](https://www.usenix.org/conference/nsdi12/technical-sessions/presentation/singla) _._ org/conference/
[nsdi12/technical-sessions/presentation/singla](https://www.usenix.org/conference/nsdi12/technical-sessions/presentation/singla)

[46] snaketray.com. 2026. The Essential Guide to Data Center Cabling.

https://www _._ snaketray _._ [com/data-center-cabling-guide/](https://www.snaketray.com/data-center-cabling-guide/) [Retrieved
6-Feb-2026].

[47] F. Solano, R. Fabregat, Y. Donoso, and J.L. Marzo. 2005. Asymmetric

tunnels in P2MP LSPs as a label space reduction method. In _IEEE_
_International Conference on Communications (ICC)_, Vol. 1. 43–47 Vol. 1.
doi:10 _._ [1109/ICC](https://doi.org/10.1109/ICC.2005.1494318) _._ 2005 _._ 1494318

[48] F. Solano, R. Fabregat, and J.L. Marzo. 2005. Full label space reduction in

MPLS networks: asymmetric merged tunneling. _IEEE Communications_
_Letters_ 9, 11 (2005), 1021–1023. doi:10 _._ [1109/LCOMM](https://doi.org/10.1109/LCOMM.2005.11016) _._ 2005 _._ 11016

[49] Asaf Valadarsky, Gal Shahaf, Michael Dinitz, and Michael Schapira.

2016. Xpander: Towards Optimal-Performance Datacenters. In _Proc._
_International_ _on_ _Conference_ _on_ _emerging_ _Networking_ _EXperiments_
_and Technologies (CoNEXT)_ (Irvine, California, USA). Association for
Computing Machinery, New York, NY, USA, 205–219. [doi:10](https://doi.org/10.1145/2999572.2999580) _._ 1145/
2999572 _[.](https://doi.org/10.1145/2999572.2999580)_ 2999580

[50] Leslie G Valiant and Gordon J Brebner. 1981. Universal schemes for par
allel communication. In _Proc. ACM Symposium on Theory of Computing_
_(STOC)_ . 263–277.

[51] Guohui Wang, David G. Andersen, Michael Kaminsky, Konstantina

Papagiannaki, T.S. Eugene Ng, Michael Kozuch, and Michael Ryan.
2010. c-Through: part-time optics in data centers. In _Proc. ACM SIG-_
_COMM_ _Conference_ _on_ _Data_ _Communication_ . 327–338. [doi:10](https://doi.org/10.1145/1851182.1851222) _._ 1145/

[14](https://doi.org/10.1145/1851182.1851222)

1851182 _[.](https://doi.org/10.1145/1851182.1851222)_ 1851222

[52] Wikipedia. 2026. Balls into bins problem. https://en _._ [wikipedia](https://en.wikipedia.org/wiki/Balls_into_bins_problem) _._ org/

[wiki/Balls_into_bins_problem](https://en.wikipedia.org/wiki/Balls_into_bins_problem) [Retrieved 6-Feb-2026].

[53] Wikipedia. 2026. Expander graph. https://en _._ [wikipedia](https://en.wikipedia.org/wiki/Expander_graph) _._ org/wiki/
[Expander_graph](https://en.wikipedia.org/wiki/Expander_graph) [Retrieved 6-Feb-2026].

[54] Wikipedia. 2026. k-shortest path routing. https://en _._ [wikipedia](https://en.wikipedia.org/wiki/K_shortest_path_routing) _._ org/

[wiki/K_shortest_path_routing](https://en.wikipedia.org/wiki/K_shortest_path_routing) [Retrieved: 6-Feb-2026].

[55] Wikipedia. 2026. Menger’s Theorem. https://en _._ [wikipedia](https://en.wikipedia.org/wiki/Menger%27s_theorem) _._ org/wiki/

[Menger%27s_theorem](https://en.wikipedia.org/wiki/Menger%27s_theorem) [Retrieved: 6-Feb-2026].

[56] Wikipedia. 2026. Multi-commodity flow problem. [https://](https://en.wikipedia.org/wiki/Multi-commodity_flow_problem)
en _._ wikipedia _._ [org/wiki/Multi-commodity_flow_problem](https://en.wikipedia.org/wiki/Multi-commodity_flow_problem) [Retrieved:
6-Feb-2026].

[57] Damon Wischik, Costin Raiciu, Adam Greenhalgh, and Mark

Handley. 2011. Design, Implementation and Evaluation of
Congestion Control for Multipath TCP. In _USENIX_ _Sympo-_
_sium_ _on_ _Networked_ _Systems_ _Design_ _and_ _Implementation_ _(NSDI)_ .
https://www _._ usenix _._ [org/conference/nsdi11/design-implementation-](https://www.usenix.org/conference/nsdi11/design-implementation-and-evaluation-congestion-control-multipath-tcp)
[and-evaluation-congestion-control-multipath-tcp](https://www.usenix.org/conference/nsdi11/design-implementation-and-evaluation-congestion-control-multipath-tcp)

[58] Nicholas Wormald. 1999. _Models of Random Regular Graphs_ . Cam
bridge. https://web _._ williams _._ [edu/Mathematics/sjmiller/public_html/](https://web.williams.edu/Mathematics/sjmiller/public_html/ntprob19/handouts/graphs/Womald_ModelsRandomGraphs.pdf)
[ntprob19/handouts/graphs/Womald_ModelsRandomGraphs](https://web.williams.edu/Mathematics/sjmiller/public_html/ntprob19/handouts/graphs/Womald_ModelsRandomGraphs.pdf) _._ pdf

[59] Eitan Zahavi. 2012. Fat-tree routing and node ordering providing

contention free traffic for MPI global collectives. _J. Parallel and Dis-_
_trib. Comput._ 72, 11 (2012), 1423–1432. doi:10 _._ 1016/j _._ [jpdc](https://doi.org/10.1016/j.jpdc.2012.01.018) _._ 2012 _._ 01 _._ 018
Communication Architectures for Scalable Systems.

[60] Xia Zhou, Zengbin Zhang, Yibo Zhu, Yubo Li, Saipriya Kumar, Amin

Vahdat, Ben Y Zhao, and Haitao Zheng. 2012. Mirror mirror on the ceiling: Flexible wireless links for data centers. _ACM SIGCOMM Computer_
_Communication Review_ 42, 4 (2012), 443–454.

**A** **INCREMENTAL CABLING**

The physical connectivity of RNG described in §6 can be
achieved incrementally. While the first room of the datacenter is being prepared, we deploy its patching panel. The
number of ShuffleBoxes in the panel is based on the number
of ToR uplinks expected in the room. Initially, all r-ports
and c-ports have ShuffleBacks in them. When racks land in
the room, ToRs are connected to random r-ports, as part of
which the ShuffleBacks of selected r-ports are removed. The
ToRs start forming a random graph via c-port ShuffleBacks,
as in Figure 6(a). Not all ToR uplinks may find a match during
this process (more on this below).

While the second room is being prepared, we land its
shuffle panel and connect those c-ports to the panel in the
first room. If panels are equal-sized, half of the c-ports in
each must connect to the other panel; otherwise, we adjust
proportionally. The ports are picked randomly. The c-port
connections are enabled by the trunk cables between the two
rooms. Making these connections requires removing ShuffleBacks from c-ports, as a result of which the connectivity
pattern for some ToRs may go from Figure 6(a) to Figure 6(c),
except that both ToRs are in the same room.

When racks can land in the second room, those ToRs
connect to random r-ports in the second room’s panel. Some
of these ToR uplinks will connect to ToRs in the first room
via c-port connections, as in Figure 6(b); some will connect

1.00

0.75

0.50

0.25

0.00

m 1
Roo

m 2

Roo

m 3

m 4

m 5

0.0 0.1 0.2 0.3 0.4 0.5
Fraction of ToRs deployed

**Figure 15: Matched uplinks as the datacenter grows.**

to other ToRs in the same room via c-port ShuffleBacks; and,
at least initially, some will fail to find a match.

When the third room starts, we land its panel and rebalance c-port connectivity. When there were two rooms, half
of the first room’s c-ports connected to the second room.
When the third room starts, a third must go to the second
room and a third to the third room (and a third have ShuffleBacks). To rebalance c-port connectivity, we break some
existing c-port connections (selected randomly) between the
first two rooms and use the freed up c-ports to connect to the
third room. We follow the same process of landing panels
and rebalancing connectivity for all subsequent rooms.

Rebalancing connectivity breaks logical links that carry
live traffic. We thus drain impacted links to minimize impact.
Strictly speaking, logical connectivity changes when racks
land and r-port ShuffleBacks are removed, but the blast radius
of that operation is much smaller ( _𝑓𝑟_ =4 versus _𝑓𝑐_ =32).

**A.1** **Growing pains**

An artifact of our incremental construction is that early in
the growth of the datacenter, not all ToR uplinks form valid
adjacencies. For an uplink in room 1 to form an adjacency, it
must connect to an r-port FP that is bridged (by the ShuffleBox’s c-port ShuffleBack) to an r-port connected to another
uplink. When only a small fraction of r-ports are populated,
this probability is low. A similar effect occurs for the second
room but is less severe because half of ToR uplinks connect
to r-port FPs that are connected to the first room via c-ports
and find matches there.

Figure 15 plots the fraction of deployed uplinks with valid
adjacencies as we deploy more ToRs. This simulated datacenter has 10 rooms with 100 ToRs each. We see the fraction
of uplinks in room 1 that find a match increases linearly.
After room 2 opens, there is an initial dip in the fraction of
matched uplinks because room 2 ToRs have fewer matched
uplinks and their ratio in the population is growing. But
the lowest point in the dip is still above 90%. The impact is
negligible beyond room 2.

15

15

10

5

0

~~/o~~

~~ has~~

~~ s~~

~~ith~~

~~ pha~~

~~ es~~

Roo

m 1

m 2

m 3

m 4

m 5

Fraction of ToRs deployed

**Figure 16: Oversubscription as the datacenter grows.**

We present a model of datacenter expansion that accurately predicts the average degree at each point in the datacenter growth. Operators can use the model to predict the
average degree during expansion and plan accordingly.

As the "W/o phases" curve of Figure 16 shows, these growing pains lead to poor early throughput for room 1 (and room
1 only). Amazon operators view this behavior as acceptable
for fast-growing datacenters. The window of poor performance is short and they can delay on-boarding applications.

But the poor early performance can be problematic for
slow-growing datacenters. For these cases, we propose a
modified cabling scheme. We partition the ShuffleBoxes of
the first room’s shuffle panel into two or more phases. Initial
ToRs connect only to phase 1 ShuffleBoxes. When these
ShuffleBoxes are full, we connect the c-ports of phase 1 and
phase 2 ShuffleBoxes and start mapping future ToRs to phase
2 ShuffleBoxes. This process is repeated for future phases.
It essentially divides a room into smaller, logical rooms and
shrinks the poor performance window.

The "With phases" curve of Figure 16 shows the impact of
phased cabling. We partitioned room 1 into two phases, and
the size of the first phase was 30% of the room. This configuration is optimal when operators want average degree of
the datacenter to always stay above 0.8 as soon as 25% of the
racks in room 1 are deployed. Next, we show how to derive
optimal phase sizes for user-defined performance criteria.

**A.2** **Modeling expansion**

We present a model of datacenter expansion that predicts
the average degree of the fabric at each point in time. The
expansion occurs in _stages_, where each stage corresponds
to the landing of new panels of ShuffleBoxes and associated
re-cabling. Routers of a stage only connect to ShuffleBoxes of
that stage. A stage could be a room or a phase within a room,
and the analysis makes no assumption about the number or
relative sizes of various stages.

We model datacenter expansion using “time" _𝑡_ as the primary variable, where _𝑡_ ∈[0 _,_ 1] is the fraction (relative to the
full DC) of routers currently landed. We denote a stage that

begins at _𝑡_ 1 and ends at _𝑡_ 2 as [ _𝑡_ 1 _,𝑡_ 2]. Abusing notation, we
will simply denote a router by its timestamp of arrival. Each
router has _𝑑_ uplinks.

During the first stage, when there are no routers from
previous stages, the probability of a ToR uplink finding a
match increases linearly because the probability depends on
bridging to an occupied r-port which grows linearly with _𝑡_ .
The average degree of the fabric at time _𝑡_ is d _𝑇_ _[𝑡]_ 0 [, where] _[ 𝑇]_ [0] [is]

the size of the first stage.

For subsequent stages, the following invariants hold about
RNG’s datacenter expansion:

(1) At the end of any stage, the graph degree is _𝑑_ because

all routers would have found a match.
(2) During a stage, all routers from previous stages main
tain their degree of _𝑑_ .
(3) When a router on a stage lands, only some of its up
links find a match. On expectation, that fraction is the
fraction of routers present. Formally, for stage [ _𝑡_ 1 _,𝑡_ 2],
there are _𝑡_ 1 routers from previous stages, and we will
land routers _𝑡_ 1 + 1 _,𝑡_ 1 + 2 _, . . .,𝑡_ 2. The _𝑖_ -th router in
this stage will make (on expectation) a _[𝑡]_ [1] _𝑡_ [+] 2 _[𝑖]_ [fraction of]

connections when it lands.

Based on these invariants, we can prove:

Figure 17 compares Model A.1 with a simulated fabric
from Figure 16. We see that the model matches simulations
well, and the curves are virtually indistinguishable.

**A.3** **Computing optimal phases**

The expansion model enables us to find optimal phases. We
formulate the problem as: Find the minimum number of
phases and their sizes such that the average degree is at least
_𝛼𝑑_ when at least a _𝛽_ -fraction of the first room is deployed.
The parameters _𝛼_ and _𝛽_ are operator-provided inputs.

We solve the problem by applying Model A.1 to the first
room, treating each phase as a stage. We know that the
average degree increases linearly in the first stage. So, if

Model A.1. _The_ _average_ _degree_ _during_ _the_ _stage_ [ _𝑡_ 1 _,𝑡_ 2]
_(𝑡_ 1 _>_ 0 _) is 𝑑_ - _𝑡𝑡_ 1 [+] _[𝑡]_ [−] _𝑡_ _[𝑡]_ [1] 

- _𝑡_ 1

_𝑡_ 1 _[𝑡]_ [−] _[𝑡]_ [1]

_𝑡_ [+] _𝑡_

_𝑡_ 2

Proof. The stage [ _𝑡_ 1 _,𝑡_ 2] begins with a _𝑡_ 1 fraction of routers
connected (with degree _𝑑_ ) and ends with a _𝑡_ 2 fraction of
routers. At time _𝑡_ ∈[ _𝑡_ 1 _,𝑡_ 2], all routers with timestamp at
most _𝑡_ 1 always have a degree of _𝑑_, and the routers of the
current stage will have, on average, a degree of _𝑑𝑡_ / _𝑡_ 2. The
fraction of routers with timestamp at most _𝑡_ 1 is _𝑡_ 1/ _𝑡_, and the
fraction of routers of the current stage is ( _𝑡_ - _𝑡_ 1)/ _𝑡_ .

Thus, the average degree at time _𝑡_ is:

_𝑡_ 1 _[𝑡]_ [−] _[𝑡]_ [1]

_𝑡_ [·] _[ 𝑑]_ [+] _𝑡_

(1)

    

_𝑡_ 1

_[𝑡]_ [1]   - _[𝑑𝑡]_

_𝑡_ _𝑡_ 2

= _𝑑_

- _𝑡_ 1 _[𝑡]_ [−] _[𝑡]_ [1]
_𝑡_ [+] _𝑡_ 2

16

1.00

0.75

0.50

0.25

0.00

~~RN~~

~~: W/~~

~~  ph~~

~~  ses~~

~~Mo~~

~~el:~~

~~ /o~~

~~  has~~

~~  s~~

~~ ith~~

~~  es~~

m 1
Roo

m 2

Roo

m 3

m 4

m 5

0.0 0.1 0.2 0.3 0.4 0.5
Fraction of ToRs deployed

**Figure 17: Comparison of fraction of uplinks that find**

**a match based on simulation of Figure 15 versus what**

**is predicted by the model.**

_𝛼_ ≤ _𝛽_, we only require a single phase (i.e., not using phases
at all). If _𝛼_ _>_ _𝛽_, our aim is to maximize _𝛼_ for a given _𝛽_, or
equivalently, minimize _𝛽_ for a given choice of _𝛼_ .

Let us now consider the case of two phases in a room.

Theorem A.1. _With two phases in a room, for a given 𝛼, the_

~~√~~

_minimum possible 𝛽_ _is 𝛼_ (1 − 1 − _𝛼_ ) [2] _. Further, the minimum_

1.0

0.8

0.6

0.4

0.2

0.0
0.0 0.2 0.4 0.6 0.8 1.0

**Figure 18: The minimum** _𝛽_ **achievable, for a given** _𝛼_ **in**

**a two-phase deployment**

1.0

~~√~~

_minimum possible 𝛽_ _is 𝛼_ (1 − 1 − _𝛼_ ) [2] _. Further, the minimum_

_occurs when the size of the first phase is 𝛽_ / _𝛼._

Proof. Let us first observe that the formula in Model A.1
is a hyperbola ( _𝑡_ 1/ _𝑡_ + _𝑡_ / _𝑡_ 2). Its minimum is at the geometric
mean [√] _𝑡_ 1 _𝑡_ 2, so the minimum average degree is:

0.8

0.6

0.4

0.2

0.0

Estimated
Measured

√︁

_𝑑_ (2

_𝑡_ 1/ _𝑡_ 2 − _𝑡_ 1/ _𝑡_ 2) (2)

Let us now denote the minimum possible _𝛽_ as _𝛽_ [∗] . In the
first phase, the average degree increase linearly. At time _𝛽_ [∗],
it needs to be at least _𝛼𝑑_ . This phase ends when the average
degree is _𝑑_, which happens when time is _𝛽_ [∗] / _𝛼_, which we
denote using _𝑥_ for convenience. At this point, the next phase
begins and continues to the end of the room.

If the end of room deployment as _𝑡_ = 1, we have the stage
being [ _𝑥,_ 1]. Applying Equation 2, the minimum average
degree is _𝑑_ (2 [√] _𝑥_ - _𝑥_ ). Since we require the average degree
to be _𝛼𝑑_ at all times, 2 [√] _𝑥_ - _𝑥_ ≥ _𝛼_ .

Consider the quadratic _𝑓_ ( _𝑥_ ) = _𝑥_  - 2 [√] _𝑥_ + _𝛼_ . We need to
choose _𝑥_ so that _𝑓_ ( _𝑥_ ) ≤ 0, which happens after the first root
of the quadratic. The roots of _𝑓_ ( _𝑥_ ) are

√
2 ±

1 − _𝛼_

4 − 4 _𝛼_
= 1 ±
2

√

√

The smaller root is 1  - 1 − _𝛼_, and we need _𝑥_ to be at least

this value. Plugging in the expression for _𝑥_,

The smaller root is 1 

√︂

_𝛽_ [∗]

_𝛼_ [≥] [1][ −]

1 − _𝛼_ =⇒ _𝛽_ [∗] ≥ _𝛼_ (1 −

√

~~√~~

1 − _𝛼_ ) [2]

                   

For a better understanding of the formula in Theorem A.1,
Figure 18 plots the optimal _𝛽_ versus _𝛼_ . We see if we want the
degree to be at least 0 _._ 8 _𝑑_, we can get that as soon as _𝛽_ ≈ 25%

**Figure** **19:** **Comparison** **between** **estimated** **latency**

**based on datacenter layout and measurements on the**

**production fabric. Units omitted for confidentiality.**

of the room is deployed. This performance can be obtained
if the first phase is ≈30% of the first room.

If the _𝛽_ [∗] of the two-phase deployment does not meet the
operator criterion, we can perform a similar analysis for successively higher number of phases until we find the number
of phases where the criterion is met. These iterations are
guaranteed to terminate. In the extreme, each router is its
own phase and the graph degree is always _𝑑_ .

**B** **LATENCY REDUCTION**

While expander topologies have fewer hops than fat trees, we
find that when deployed in a large datacenter their latency
can be worse because hops can be long (half the datacenter
length on average). The higher propagation delay exceeds
what is saved in switching costs due to fewer hops.

To demonstrate this challenge, we simulate a datacenter
with a span of 300 meters and 4K ToRs spread across 10
equally-sized rooms. For RNG, the patching panels are located in the center of each room. The fat tree has 4 tiers.
ToRs connect to aggregation pods with two tiers of switches,

17

1.0

0.8

0.6

0.4

0.2

0.0

4 6 8 10
Latency ( s)

Fat tree
RNG (baseline)
RNG (biased
waypoints)
RNG (biased
waypoints, cabling)

**Figure 20: Latency distribution of ToR-to-ToR paths**

where the bottom tier connects to ToRs and the top tier to
spine routers. Aggregation pods are located in the center
of each room to serve the ToRs in the room, and all spine
routers are in one room in the middle of the datacenter [10].
For both topologies, the link speed is 100 Gbps and cables
travel along cable trays [46]. Figure 19 validates the accuracy of our latency estimation methodology by comparing
what it estimates for the production server mesh (§8) with
measurements on the fabric.

While the fat tree has 6 hops and RNG has 4 hops for
the vast majority of ToR pairs in the simulated datacenter,
Figure 20 shows that the median one-way latency of ("RNG
(baseline)") is 15% higher (8.4 vs. 7.1 _𝜇𝑠_ ). This difference may
seem small, but it compounds over round trips for applications and so datacenter operators are sensitive to it.

Simple modifications to routing and cabling reduce the
latency of RNG without compromising performance.
**Biased** **waypoint** **selection** . When selecting waypoints,
instead of picking _𝑝_ random neighbors of _𝑣_ ∈ _𝑁𝑏𝑟_ ( _𝑡_ ), prefer waypoints closer to _𝑡_ . We implement this preference by
ranking each candidate waypoint _𝑤_ using _𝑟𝑜𝑜𝑚_ _ _𝑑𝑖𝑠𝑡_ ( _𝑤, 𝑣_ ) +
_𝑟𝑜𝑜𝑚_ _ _𝑑𝑖𝑠𝑡_ ( _𝑣,𝑡_ ), where _𝑟𝑜𝑜𝑚_ _ _𝑑𝑖𝑠𝑡_ () is the distance between
rooms of the two nodes. Using coarse, room-level distances,
instead of actual fiber runs, avoids systematically preferring
advantageously-located waypoints (e.g., close to cable trays).
**Biased cabling** . We lower the number of inter-room connections, which are longer than intra-room ones. Specifically,
a patching panel makes _𝛼_ × _𝑅_ [1] [×] _[ 𝐶]_ [×] _[ 𝑑][𝑐]_ [c-port connections]

to another panel, where _𝐶_, _𝑅_, _𝑑𝑐_ are the number of ShuffleBoxes, rooms, and c-ports per ShuffleBoxes, and _𝛼_ ∈[0 _,_ 1] is
a parameter that controls the amount of inter-room connections. For the baseline construction, _𝛼_ = 1. We use _𝛼_ = 0 _._ 5,
which reduces number of inter-room connections by half. It
reduces latency without hurting throughput because there is
still enough inter-room capacity. Another positive side-effect
of this optimization is that it reduces (by 1− _𝛼_ ) the number of
inter-room cables, an important factor behind cabling costs.

Figure 20 shows that the combination of these modifications makes the median latency of RNG similar to that of

the fat tree. Biased waypoint selection reduces the median
latency by 0.3 _𝜇𝑠_ and biased cabling by a further 1 _𝜇𝑠_ .

Latency can be further reduced by limiting spraying to a
subset of neighbors that have shorter paths to the destination
and by selecting the _ℎ_ next hops in a distance-aware manner.
But, unlike the two modifications above, these modifications
reduce, respectively, the number of edge disjoint paths and
throughput for some traffic matrices. They must thus be used
only in settings where reduced performance is acceptable.

We experimented with a few other ideas, such as spraying
to only a subset of close neighbors and biasing the selection
of _ℎ_ random next hops, but they either reduced throughput
or did not bring substantial benefit.

**C** **MODELING OVERVIEW**

Our modeling of RNG prioritizes simpler formulas over mathematical precision. It makes numerous modeling assumptions and performs asymptotic analysis (as _𝑛_ gets large) that
ignores lower order terms in some situations. We constrain
the operating regime to where the inaccuracy of these assumptions and asymptotics is minimal. Recall from §7 that
this regime is (i) 2(ln( _𝑛_ ) + 5) ≤ _𝑑_ ≪ _𝑛_, (ii) _𝑝_ ≥( _𝑛_ / _𝑑_ [2] ) [1][/] _[ℓ]_,
and (iii) _ℎ_ ≪ _𝑑_, where _𝑛_ and _𝑑_ are the node count and degree.
Further, given random topology and routing, the analysis is
inherently probabilistic, i.e., results hold with high probability and can fail with low probability.

The following sections derive the performance models in
§7 in a stepwise manner.

**Random graph preliminaries (§D):** The first step of the
modeling is to define a probabilistic process that generates
the random network topology. We give a precise formulation,
since this forms the foundation of the analysis. We prove
some basic theorems about the graph construction. This
section is purely using random graph theory, and does not
involve any asymptotics or modeling of Spraypoint/routing.

**Modeling path length (§E):** We begin the actual analysis
by giving formulas for the sizes of various Spraypoint levels.
The random graph theorems from §D are used to determine
the structure of the Spraypoint levels and their sizes. The
path length distributions follow quite directly from these
formulas. These formulas use asymptotics to get convenient
expressions. This yields Model 7.2.

**Modeling** **edge** **disjoint** **paths** **(§F):** Armed with the
tools from the previous sections, we can analyze the mincut
properties between a source-destination pair. For this analysis, we make some minor modeling assumptions, to represent
the flow as a tractable balls and bins problem. A detailed,
tight analysis of these problems has been done before [13],
but we observe that a simpler upper bound formula is close
enough. This bound is given in Model 7.1.

18

**Modeling oversubscription (§G):** The most difficult part
of our analysis is bounding the oversubscription ratio. For
this analysis, we use many modeling assumptions (detailed
in §G.1). The oversubscription ratio is the output of a multicommodity flow linear program, so it is much harder to get
a simple formula. Moreover, the mathematics of interacting
flows is complex and we resort to various simplifications
based on intuitions on random graphs. Our final formula is
given by a collection of polynomial equations in the various
parameters, as given in §7.3.

**D** **RANDOM GRAPH PRELIMINARIES**

The router graph _𝐺_ = ( _𝑉, 𝐸_ ) has _𝑛_ nodes and degree _𝑑_ .
We model its construction as a random configuration graph
(Chap. 2 of [58]). There are various ways to construct graphs
in the configuration model, all of which are statistically equivalent and provide convenient analytical tools.

 - The standard method: consider each node as incident
to _𝑑_ “half-edges". Paired half-edges result in a proper edge.
We generate a pairing with a uniform random permutation
of all half-edges, and matching the first to the second, the
third to the fourth, and so on.

 - Getting the neighborhood of a set _𝑆_ : Condition on some
edges within _𝑆_ . Each remaining half-edge in _𝑆_ picks _inde-_
_pendently_ another uar (uniformly at random) half-edge in
graph to pair with. If multiple _𝑆_ half-edges pick the same
partner to pair with, only one them (picked randomly) will
pair up. The others remain unpaired. At this stage, some of
the half-edges in _𝑆_ have paired up. Now, we simply pair up all
remaining half-edges in the graph using the standard method
(which has dependencies). The first part makes a collection
of independent decisions, allowing for easier analysis.

**D.1** **Probability preliminaries**

We list some probability theory definitions and theorems
used in the analysis. In what follows, capital letters _𝑋,𝑌,𝑍_
denote non-negative integer-valued random variables; E[ _𝑋_ ]
denotes the expectation of _𝑋_ . script letters E _,_ F _, . . ._ denote
events; and Pr[E] denotes the probability of event E.

The first theorem will help us derive expected values of
a collection of random variables. It makes no independence
assumption on the random variables.

Theorem D.1. _[Linearity_ _of_ _Expectation]_ _For_ _any_ _finite_
_collection_ _of_ _random_ _variables 𝑋_ 1 _,𝑋_ 2 _, . . .,𝑋𝑘_ _,_ E[  _𝑖_ ≤ _𝑘_ _[𝑋]_ _𝑖_ []] [=]

- _𝑖_ ≤ _𝑘_ [E][[] _[𝑋]_ _𝑖_ []] _[.]_

The next theorem is convenient for dealing with “error
bounds" and bounding the probability of bad events.

Theorem D.2. _[Union bound] Given a finite collection of_
_events_ E1 _,_ E2 _, . . .,_ E _𝑘_ _,_ Pr[  _𝑖_ ≤ _𝑘_ [E] _𝑖_ []] [≤]  _𝑖_ ≤ _𝑘_ [Pr][[E] _𝑖_ []] _[.]_

The following states classic _concentration inequalities_ that
upper bound the probability of a random variable deviating
significantly from its expectation.

Theorem D.3. _[The Chernoff bound] (Theorem 1.1 of [9])_
_Let_ _𝑋_ =  _𝑖_ ≤ _𝑘_ _[𝑋]_ _𝑖_ _[,]_ _[where]_ _[the]_ _[𝑋]_ _𝑖_ _[’s]_ _[are]_ _[independent]_ _[random]_

_variables in_ [0 _,_ 1] _. Then,_

 - _For_ _all 𝜀_ ∈(0 _,_ 1) _,_ Pr[ _𝑋_ _<_ (1 − _𝜀_ )E[ _𝑋_ ]] _,_ Pr[ _𝑋_ _>_ (1 +
_𝜀_ )E[ _𝑋_ ]] ≤ exp(− _𝜀_ [2] E[ _𝑋_ ]/3) _._

 - _For_ _all_ _𝑡,_ Pr[ _𝑋_ _>_ E[ _𝑋_ ] + _𝑡_ ] _,_ Pr[ _𝑋_ _<_ E[ _𝑋_ ]  - _𝑡_ ] ≤
exp(−2 _𝑡_ [2] / _𝑘_ ) _._

 - _If 𝑡_ _>_ 2 _𝑒_ E[ _𝑋_ ] _, then_ Pr[ _𝑋_ _> 𝑡_ ] ≤ 2 [−] _[𝑡]_ _._

We use the phrase _with high probability_ to denote probability at least 1 − _𝑜_ (1), with asymptotics over increasing
_𝑛_ .

**D.2** **Random graph tools**

We state and prove some probabilistic graph theorems that
will be useful in the analysis.

Claim D.4. _Consider a node set_ _𝑆. Condition on any choice of_
_edges within_ _𝑆_ _that leave_ _𝑘_ _half-edges unpaired. The probability_
_that a vertex 𝑣_ ∉ _𝑆_ _is a neighbor of 𝑆_ _is at least_ 1 − exp(− _𝑘_ / _𝑛_ ) _._

Proof. Conditioned on the current choice of edges in _𝑆_,
let us consider the process of building the neighbors of _𝑆_ . As
described above, in the first step of this process, each of the
_𝑘_ half-edges incident to _𝑆_ picks a uar unpaired half-edge to
pair with. Fix _𝑣_ ∉ _𝑆_ . Let us look at the probability that a single
iteration connects with one of the _𝑑_ half-edges incident to _𝑣_ .
This probability is at least _𝑑_ / _𝑛𝑑_ = 1/ _𝑛_ .

Since there are _𝑘_ independent iterations, one for each
unpaired half-edge incident to _𝑆_, the probability that no
iteration connects with _𝑣_ is at most (1 − 1/ _𝑛_ ) _[𝑘]_ . Applying the
inequality 1 − _𝑥_ ≤ exp(− _𝑥_ ), we upper bound by exp(− _𝑘_ / _𝑛_ ).
Thus, the probability of _𝑣_ connecting to _𝑆_ is at least 1 exp(− _𝑘_ / _𝑛_ ). 

Let us unpack this expression. Using the approximation
(for small _𝑥_ ), exp(− _𝑥_ ) ≈ 1 − _𝑥_, roughly speaking, we can
approximate as 1 −(1 − _𝑘_ / _𝑛_ ) = _𝑘_ / _𝑛_ .

The following claim shows that all sets of sufficiently large
size connect with every other node. It is a special case of the
proof that the configuration model generates expanders.

Claim D.5. _Fix subset 𝑆_ ⊆ _𝑉_ _and condition on any choice_
_of edges within 𝑆_ _that leaves at least 𝑛𝑑_ /4 _unpaired half-edges_
_incident to 𝑆. With probability at least_ 1 − _𝑛_ [−][4] _, every 𝑣_ ∈ _𝑉_ \ _𝑆_
_has an edge to 𝑆._

Proof. By Claim D.4, the probability that _𝑣_ ∉ _𝑆_ is _not_ a
neighbor of _𝑆_ is at most exp(− _𝑘_ / _𝑛_ ) ≤ exp(− _𝑑_ /4). Let event
E _𝑣_ occur when _𝑣_ does not connect to _𝑆_ . By the union bound
Pr[  _𝑣_ ∉ _𝑆_ [E] _𝑣_ []] [≤]  _𝑣_ ∉ _𝑆_ [Pr][[E] _𝑣_ []] [≤] _[𝑛]_ [exp][(−] _[𝑑]_ [/][4][)] [≤] _[𝑛]_ [−][4] [(since]

_𝑣_ ∉ _𝑆_ [E] _𝑣_ []] [≤] 

_𝑖_ ≤ _𝑘_ [E] _𝑖_ []] [≤] 

_𝑣_ ∉ _𝑆_ [Pr][[E] _𝑣_ []] [≤] _[𝑛]_ [exp][(−] _[𝑑]_ [/][4][)] [≤] _[𝑛]_ [−][4] [(since]

_𝑖_ ≤ _𝑘_ [Pr][[E] _𝑖_ []] _[.]_

19

_𝑑_ ≫ ln _𝑛_ ). The event  _𝑣_ ∉ _𝑆_ [E] _𝑣_ [occurs] [precisely] [when] [all]

vertices outside _𝑆_ have an edge to _𝑆_ . 

**E** **MODELING PATH LENGTH**

This section models the path lengths in the RNG fabrics. We
begin by bounding the sizes of Spraypoint levels.

**E.1** **Level sizes**

Let us fix a destination _𝑡_, and for convenience, denote _𝑊𝑃𝑖_ ( _𝑡_ )
as _𝑊𝑃𝑖_ . We imagine constructing the levels incrementally, together with the graph. So _𝑊𝑃_ ≤ _𝑖_ :=  _𝑗_ ≤ _𝑖_ _[𝑊𝑃]_ _𝑗_ [is constructed,]

and then we choose the randomness to construct _𝑊𝑃𝑖_ +1.
Conditioning on _𝑊𝑃_ ≤ _𝑖_ implies fixing the graph _inside 𝑊𝑃_ ≤ _𝑖_ .
So we have fixed all the edges between the waypoints up to
this level. Then _𝑊𝑃𝑖_ chooses some of its edges to determine
_𝑊𝑃𝑖_ +1. It is convenient to set _𝑊𝑃_ 0 to be _𝑁𝑏𝑟_ ( _𝑡_ ).

We state and prove our main theorem about level sizes.
Recall that _ℓ_ := max(1 _,_ ⌈log _𝑝_ ( _𝑛_ /2 _𝑑_ [2] )⌉).

Theorem E.1. _Fix destination 𝑡. The following bounds hold_
_with probability_ ≥ 1 − _𝑜_ (1) _. We set 𝜆_ := _𝑝_ _[ℓ]_ _𝑑_ [2] / _𝑛._

 - _For_ 0 ≤ _𝑖_ ≤ _ℓ,_ | _𝑊𝑃𝑖_ ( _𝑡_ )| = (1 ± _𝑜_ (1)) _𝑑𝑝_ _[𝑖]_ _._

 - | _𝑂𝑅_ ( _𝑡_ )| ≤(exp(− _𝜆_ ) + _𝑜_ (1)) _𝑛._

 - _All nodes in 𝑂𝑅_ ( _𝑡_ ) _have an edge to a node in 𝐼𝑅_ ( _𝑡_ ) _._

The proof has a few moving parts, so we separate them
out. For any set of nodes _𝑆_, we use _𝑁_ ( _𝑆_ ) to denote the neighborhood of _𝑆_ (which may include nodes in _𝑆_ ).

Claim E.2. _For_ _any_ _𝑖,_ _condition_ _on_ | _𝑊𝑃_ ≤ _𝑖_ | ≤ _𝑛_ / _𝑑._ _The_
_probability that any node 𝑣_ _has more than 𝑑_ /2 _edges to 𝑊𝑃_ ≤ _𝑖_
_is at most_ 1/ _𝑛._

Proof. The node _𝑣_ makes _𝑑_ connections. Consider choosing these randomly as follows. First, each half-edge incident
to _𝑣_ chooses to connect with a node in _𝑊𝑃_ ≤ _𝑖_ with probability | _𝑊𝑃_ ≤ _𝑖_ |/ _𝑛_ ≤ 1/ _𝑑_ . Once these choices are made, then
the half-edges are paired to a random half-edge in _𝑊𝑃_ ≤ _𝑖_ or
_𝑊𝑃_ ≤ _𝑖_ respectively. Each of these choices can be represented

as a Bernoulli _𝑋𝑖_, and the sum _𝑋_ =  _𝑖_ ≤ _𝑑_ _[𝑋]_ _𝑖_ [is the number of]

edges _𝑣_ has into _𝑊𝑃_ ≤ _𝑖_ .

We note that E[ _𝑋_ ] ≤ 1. By the Chernoff bound Theorem D.3, Pr[ _𝑋_ ≥ _𝑑_ /2] ≤ 2 [−] _[𝑑]_ [/][2] . By a union bound over all
nodes, the probability that any node has more than _𝑑_ /2 edges
is at most _𝑛_ 2 [−] _[𝑑]_ [/][2] . Since _𝑑_ ≥ 2(ln _𝑛_ + 5), _𝑛_ 2 [−] _[𝑑]_ [/][2] ≤ _𝑛_ [−][5] . 

The following lemma encapsulates a key calculation.

Lemma E.3. _Condition on a set 𝑆_ _of nodes with at least half_
_of_ _its_ _incident_ _half-edges_ _unpaired._ _Let_ | _𝑆_ | ≥ _𝑑_ /2 _._ _Consider_
_pairing all the half-edges incident to 𝑆. Then, with probability_
_at_ _least_ 1 - _𝑛_ [−][10] _,_ | _𝑁_ ( _𝑆_ )| ≥ min( _𝑛_ /4 _,_ | _𝑆_ | _𝑑_ /4) _._ _Moreover,_ _if_
| _𝑆_ | ≤ _𝑛_ / _𝑑, at least_ ( _𝑑_ - 4)| _𝑁_ ( _𝑆_ )| _half-edges incident to 𝑁_ ( _𝑆_ )
_are left unpaired._

Proof. We will perform a coupling of the random variable
| _𝑁_ ( _𝑆_ )| as follows. We initially mark an arbitrary set of _𝑛_ /4
nodes. We pair the half-edges incident to _𝑆_ iteratively. If a
pairing connects to an unmarked node _and_ the number of
current neighbors of _𝑆_ is _<_ _𝑛_ /4: we pick an marked nonneighbor of _𝑆_, unmark it, and marked the (new) unmarked
neighbor. (Otherwise, we do not change the marking.) Thus,
if there are fewer than _𝑛_ /4 neighbors of _𝑆_, then all neighbors
of _𝑆_ are marked.

For the _𝑟_ th half-edge paired, let _𝑋𝑟_ be the indicator of the
_𝑟_ th half-edge pairing with an unmarked node. Since the number of marked nodes is exactly _𝑛_ /4, the number of unmarked
nodes is also exactly 3 _𝑛_ /4. Hence, Pr[ _𝑋𝑟_ = 1] = 3/4. Recall
that there are at least _𝑘_ ≥| _𝑆_ | _𝑑_ /2 unpaired half-edges incident to _𝑆_ Let _𝑋_ =  _𝑟_ ≤ _𝑘_ _[𝑋]_ _𝑟_ [, so][ E][[] _[𝑋]_ []] [=][ 3] _[𝑘]_ [/][4. By the Chernoff]

bound of Theorem D.3, Pr[  _𝑟_ _[𝑋]_ _𝑟_ [≤] _[𝑘]_ [/][2][]] [≤] [exp][(−][E][[] _[𝑋]_ []/(][3][ ·]

3 [2] )) ≤ exp(−| _𝑆_ | _𝑑_ /54) ≤ exp(− _𝑑_ [2] /108). Since _𝑑_ ≥ ln _𝑛_, this
probability can be bounded by _𝑛_ [−][10] (for sufficiently large _𝑛_ ).

So, with high probability, _𝑋_ ≥ _𝑘_ /2 ≥| _𝑆_ |( _𝑑_ /4). This means
that either each iteration connected to an unmarked node
(thereby creating a new neighbor) or the number of neighbors was at least _𝑛_ /4. Thus, | _𝑁_ ( _𝑆_ )| ≥ min( _𝑛_ /4 _,_ | _𝑆_ | _𝑑_ /4).

If | _𝑆_ | ≤ _𝑛_ / _𝑑_, then | _𝑆_ |/| _𝑁_ ( _𝑆_ )| ≤ 4/ _𝑑_ . We paired up at most
| _𝑆_ | _𝑑_ half-edges in the above random process. Hence, there are
at least | _𝑁_ ( _𝑆_ )| _𝑑_ −| _𝑆_ | _𝑑_ = | _𝑁_ ( _𝑆_ )| _𝑑_ - 4| _𝑁_ ( _𝑆_ )| ≥( _𝑑_ - 4)| _𝑁_ ( _𝑆_ )| _𝑑_
half-edges incident to _𝑁_ ( _𝑆_ ) that are unpaired. 

_E.1.1_ _The first bullet point of Theorem E.1._ We prove the
first bullet point by an induction over _𝑖_ . We require a stronger
induction hypothesis. We will prove that, conditioned on a
choice of _𝑊𝑃𝑖_ that leaves at least _𝑑_ | _𝑊𝑃𝑖_ |/2 half-edges unpaired, with high probability, the construction of _𝑊𝑃𝑖_ +1 ensures that | _𝑊𝑃𝑖_ +1| ≥(1 - _𝑜_ (1)) _𝑝𝑑_ _[𝑖]_ [+][1] and at least _𝑑_ | _𝑊𝑃𝑖_ +1|/2
half-edges of _𝑊𝑃𝑖_ +1 are unpaired.

We now perform the induction. We first deal with the
base case _𝑊𝑃_ 0, the neighbor set. Consider the pairing the _𝑑_
half-edges incident to _𝑡_, one by one. Take the _𝑟_ th half-edge
being paired. There are at most _𝑑_ neighbors of _𝑡_ already constructed, by the pairing of previous half-edges. The probability that the _𝑟_ th half-edge connects to one of these neighbors
is at most _𝑑_ / _𝑛_, regardless of all the previous choices. Let _𝑍_
be the random variable denoting the number of half-edges
connecting to an existing neighbor. The upper tail probabilities of _𝑍_ is dominated by the corresponding tail of _𝐵_ ( _𝑑_ / _𝑛,𝑑_ ).
(Here, _𝐵_ ( _𝑘, 𝛼_ ) denotes the binomial of _𝑘_ independent trials with success probability _𝛼_ .) We can apply the Chernoff
bound to _𝐵_ ( _𝑑_ / _𝑛,𝑑_ ). Let _𝑌_ ∼ _𝐵_ ( _𝑑_ / _𝑛,𝑑_ ). Note that E[ _𝑌_ ] =
( _𝑑_ / _𝑛_ ) - _𝑑_ = _𝑑_ [2] / _𝑛_ . Since _𝑑_ ≪ _𝑛_, for sufficiently small _𝜀_ _>_ 0,
_𝜀𝑑_ ≥ 2 _𝑒𝑑_ [2] / _𝑛_ . By Theorem D.3, Pr[ _𝑌_ ≥ _𝜀𝑑_ ] _<_ 2 [−] _[𝜀𝑑]_ = _𝑜_ (1).
Thus, Pr[ _𝑍_ ≥ _𝜀𝑑_ ] ≤ Pr[ _𝑌_ ≥ _𝜀𝑑_ ] = _𝑜_ (1). In words, the overall probability of the half-edges connecting to _𝜀𝑑_ existing

20

neighbors is _𝑜_ (1). So, with probability 1 − _𝑜_ (1), the size of
the neighbor set _𝑊𝑃_ 0 is at least (1 − _𝑜_ (1)) _𝑑_ .

At this stage, there are ( _𝑑_  - 1)| _𝑊𝑃_ 0| unpaired half-edges
incident to _𝑊𝑃_ 0. The only paired half-edges (formed edges)
are those incident to _𝑡_, so each neighbor in _𝑊𝑃_ 0 is incident
to ( _𝑑_ - 1) unpaired half-edges.

We split into two cases, depending on _ℓ_ .
**C** ase 1, _ℓ_ = 1: In this case, there is just _𝑊𝑃_ 1 to consider. As
argued above, with high probability, | _𝑊𝑃_ 0| = _𝑑_ - _𝑜_ (1) and it
is incident to | _𝑊𝑃_ 0|( _𝑑_ - 1) unpaired edges. Apply Lemma E.3
with _𝑆_ = _𝑊𝑃_ 0 = _𝑁𝑏𝑟_ ( _𝑡_ ). So probability _>_ _𝑛_ [−][10], | _𝑁_ ( _𝑆_ )| ≥
min( _𝑛_ /4 _,_ | _𝑆_ | _𝑑_ /4). Observe that _𝑝𝑑_ ≤ _𝑛_ /4 and _𝑝_ ≤ _𝑑_ /4. So,
_𝑝𝑑_ ≤| _𝑁_ ( _𝑆_ )|. There are enough candidates to construct _𝑊𝑃_ 1
as desired. There is no induction necessary, since this is the
last waypoint level. This ends the proof for this case.

**C** ase 2, _ℓ_ _>_ 1: Note that _ℓ_ = ⌈log _𝑝_ ( _𝑛_ /2 _𝑑_ [2] )⌉. Pick some
_𝑖_ _<_ _ℓ_ . We inductively assume that for all _𝑗_ ≤ _𝑖_, | _𝑊𝑃_ _𝑗_ | =

(1 − _𝑜_ (1)) _𝑝𝑑_ _[𝑗]_ and that there are at least | _𝑊𝑃𝑖_ | _𝑑_ /2 unpaired
edges in the construction thus far. We just proved this for
the base case. At each step of the induction, there is a small
probability of error ( _<_ 1/ _𝑛_ [5] ). We will simply union bound
all these errors over the at most _ℓ_ = Θ(ln _𝑛_ ) levels.

Observe that | _𝑊𝑃𝑖_ | ≤ _𝑑𝑝_ _[𝑖]_ ≤ _𝑑𝑝_ [log] _[𝑝]_ [(] _[𝑛]_ [/][2] _[𝑑]_ [2] [)] ≤ _𝑛_ /2 _𝑑_ . Also,
| _𝑊𝑃_ ≤ _𝑖_ | ≤  _𝑗_ ≤ _𝑖_ _[𝑑𝑝]_ _[𝑗]_ [=] _[𝑑]_ [(] _[𝑝][𝑖]_ [+][1] [−] [1][)/(] _[𝑝]_ [−] [1][)][.] [Since] _[𝑝]_ [≥] [2,]

| _𝑊𝑃_ ≤ _𝑖_ | ≤  _𝑗_ ≤ _𝑖_ _[𝑑𝑝]_ _[𝑗]_ [=] _[𝑑]_ [(] _[𝑝][𝑖]_ [+][1] [−] [1][)/(] _[𝑝]_ [−] [1][)][.] [Since] _[𝑝]_ [≥] [2,]

_𝑝_ - 1 ≥ _𝑝_ /2. Hence,  _𝑗_ ≤ _𝑖_ [|] _[𝑊𝑃]_ _𝑖_ [|] [≤] _[𝑑𝑝][𝑖]_ [+][1][/(] _[𝑝]_ [/][2][)] [≤] [2] _[𝑑𝑝][𝑖]_ [≤]

_𝑝_ - 1 ≥ _𝑝_ /2. Hence,  _𝑗_ ≤ _𝑖_ [|] _[𝑊𝑃]_ _𝑖_ [|] [≤] _[𝑑𝑝][𝑖]_ [+][1][/(] _[𝑝]_ [/][2][)] [≤] [2] _[𝑑𝑝][𝑖]_ [≤]

(2 + _𝑜_ (1))| _𝑊𝑃𝑖_ |.

We apply Lemma E.3 with _𝑆_ = _𝑊𝑃𝑖_ . Note that | _𝑆_ | ≥ _𝑑_
and | _𝑆_ | ≤ _𝑛_ /2 _𝑑_ . At least half of the incident half-edges are
unpaired. Hence, with probability _>_ 1 − _𝑛_ [−][10], | _𝑁_ ( _𝑊𝑃𝑖_ )| ≥
| _𝑊𝑃𝑖_ | _𝑑_ /4. Since | _𝑊𝑃_ ≤ _𝑖_ | ≤ 2| _𝑊𝑃𝑖_ |, there are at least ( _𝑑_ /4 −
2)| _𝑊𝑃𝑖_ | ≥| _𝑊𝑃𝑖_ | _𝑝_ (since _𝑝_ + 2 ≤ _𝑑_ /4) nodes that are neighbors of _𝑊𝑃𝑖_ and _not_ in _𝑊𝑃_ ≤ _𝑖_ . These are all candidates for
_𝑊𝑃𝑖_ +1. Thus, we can construct _𝑊𝑃𝑖_ +1 as desired. We get that

| _𝑊𝑃𝑖_ +1| = _𝑝_ | _𝑊𝑃𝑖_ | = (1 ± _𝑜_ (1)) _𝑑𝑝_ _[𝑖]_ [+][1] .

We apply Lemma E.3 with _𝑆_ = _𝑊𝑃𝑖_ . Note that | _𝑆_ | ≥ _𝑑_
and | _𝑆_ | ≤ _𝑛_ /2 _𝑑_ . At least half of the incident half-edges are
unpaired. Hence, with probability _>_ 1 − _𝑛_ [−][10], | _𝑁_ ( _𝑊𝑃𝑖_ )| ≥
| _𝑊𝑃𝑖_ | _𝑑_ /4. Since | _𝑊𝑃_ ≤ _𝑖_ | ≤ 2| _𝑊𝑃𝑖_ |, there are at least ( _𝑑_ /4 −
2)| _𝑊𝑃𝑖_ | ≥| _𝑊𝑃𝑖_ | _𝑝_ (since _𝑝_ + 2 ≤ _𝑑_ /4) nodes that are neighbors of _𝑊𝑃𝑖_ and _not_ in _𝑊𝑃_ ≤ _𝑖_ . These are all candidates for
_𝑊𝑃𝑖_ +1. Thus, we can construct _𝑊𝑃𝑖_ +1 as desired. We get that

At least ( _𝑑_  - 4)| _𝑁_ ( _𝑊𝑃𝑖_ )| half-edges incident to _𝑁_ ( _𝑊𝑃𝑖_ )
are unpaired. It remains the bound the number of unpaired
half-edges incident to _𝑊𝑃𝑖_ +1. Observe that a uniform random
node of _𝑁_ ( _𝑊𝑃𝑖_ ) has at least ( _𝑑_ - 4) unpaired half-edges. Let
_𝑍𝑟_ be the random variable denoting the fraction of unpaired
edges on the _𝑟_ th node of _𝑊𝑃𝑖_ +1. We have E[ _𝑍𝑟_ ] ≥ 1 − _𝑑_ /4.
Setting _𝑍_ =  _𝑟_ _[𝑍]_ _𝑟_ [,][ E][[] _𝑟_ _[𝑍]_ _𝑟_ []] [≥(][1] [−] _[𝑑]_ [/][4][)|] _[𝑊𝑃]_ _𝑖_ +1 [|][ by linearity]

_𝑟_ _[𝑍]_ _𝑟_ [,][ E][[]

Setting _𝑍_ =  _𝑟_ _[𝑍]_ _𝑟_ [,][ E][[] _𝑟_ _[𝑍]_ _𝑟_ []] [≥(][1] [−] _[𝑑]_ [/][4][)|] _[𝑊𝑃]_ _𝑖_ +1 [|][ by linearity]

of expectation. Applying Theorem D.3, Pr[ _𝑍_ _<_ E[ _𝑍_ ]/2] ≤
exp(−(1/3 · 2 [2] ) - (1 − _𝑑_ /4)| _𝑊𝑃𝑖_ +1|). Since | _𝑊𝑃𝑖_ +1| ≥(1 −
_𝑜_ (1)) _𝑝𝑑_ _[𝑖]_ [+][1] and _𝑖_ ≥ 0, the probability is exp(−Θ( _𝑑_ )) ≤ _𝑛_ [−][4] .
Thus, we have at least _𝑑_ | _𝑊𝑃𝑖_ +1|/2 unpaired half-edges incident to _𝑊𝑃𝑖_ +1. We union bound over all the errors. This
completes the induction, and the proof of the first bullet.

_E.1.2_ _The other bullets of Theorem E.1._ With high probability, | _𝑊𝑃𝑖_ | = (1 ± _𝑜_ (1)) _𝑑𝑝_ _[𝑖]_ . We will simply assume this
property, and union bound the errors. Hence, the set _𝑊𝑃_ _ℓ_ is
incident to at least (1 − _𝑜_ (1)) _𝑑_ [2] _𝑝_ _[ℓ]_ half-edges. By Claim D.4,

the probability that a node is _not_ a neighbor of _𝑊𝑃_ _ℓ_ is
at most exp(−(1 - _𝑜_ (1)) _𝑑_ [2] _𝑝_ _[ℓ]_ / _𝑛_ ) = exp(− _𝜆_ (1 - _𝑜_ (1))) =
(1 + _𝑜_ (1)) exp(− _𝜆_ ). For node _𝑣_, let _𝑋𝑣_ be the indicator random variable that _𝑣_ is not a neighbor of _𝑊𝑃_ _ℓ_ . Note that
E[ _𝑋𝑣_ ] ≤(1 + _𝑜_ (1)) exp(− _𝜆_ ).

Consider the graph construction process where each _𝑣_ first
independently chooses to connect to _𝑊𝑃_ _ℓ_ . Then, if possible,
the graph is formed conditioned on these choices. Setting
_𝑋_ = _𝑣_ _[𝑋]_ _𝑣_ [, we can apply the Chernoff bound of Theorem D.3.]

So Pr[| _𝑋_ - E[ _𝑋_ ]| _> 𝑛_ /ln _𝑛_ ] ≤ 2 exp(−2 _𝑛_ /ln [2] _𝑛_ ), which is a
tiny probability. Therefore, with high probability, the number
of neighbors of _𝑊𝑃_ _ℓ_ is close to the expectation, and hence,
the graph can be feasibly formed conditioned on the the
choices of _𝑋𝑣_ .

Thus, with high probability, the graph construction process is feasible, and the number of non-neighbors of _𝑊𝑃_ _ℓ_
is at most (1 + _𝑜_ (1)) exp(− _𝜆_ ) _𝑛_ + _𝑛_ /ln _𝑛_ = exp(− _𝜆_ ) _𝑛_ + _𝑜_ ( _𝑛_ ).
Observe that all nodes in _𝑂𝑅_ ( _𝑡_ ) are non-neighbors of _𝑊𝑃_ _ℓ_,
so this completes the proof of the second bullet.

Now for the third bullet. We can bound

_𝜆_ ≥ _𝑝_ [⌈][log] _[𝑝]_ [(] _[𝑛]_ [/][2] _[𝑑]_ [2] [)⌉] _𝑑_ [2] / _𝑛_ ≥ 1/2

As shown earlier, with high probability, | _𝑂𝑅_ ( _𝑡_ )| ≤(exp(− _𝜆_ )+
_𝑜_ (1)) _𝑛_ ≤ 0 _._ 7 _𝑛_ . Hence, at least 0 _._ 3 _𝑛_ ≥ _𝑛_ /4 nodes lie in the
remaining levels, waypoints or _𝐼𝑅_ ( _𝑡_ ). Claim D.5 asserts that
every node is a neighbor of these remaining levels with high
probability. So every node is either a neighbor of a waypoint
or _𝐼𝑅_ ( _𝑡_ ). Nodes in _𝑂𝑅_ ( _𝑡_ ) are by definition not neighbors of
waypoints, and hence must be neighbors of _𝐼𝑅_ ( _𝑡_ ). We union
bound over all the errors, each of which was _< 𝑛_ [−][5] . We perform the union bound at most _𝑛_ [2] log _𝑛_ times (once for each
source, once for each destination, and once for each level).
That bounds the error probability as _𝑛_ [−][3] log _𝑛_ _< 𝑛_ [−][2] .

**E.2** **Path length distribution**

We now compute the distribution of Spraypoint path lengths.

Theorem E.4. _Fix a destination 𝑡. Consider the distribution_
_of path lengths seen by a packet sprayed uniformly at random_
_from a uniform random source 𝑠. With high probability, the_
_distribution of Spraypoint paths to a destination 𝑡_ _is as follows:_

 - _There are 𝑑_ _paths of length_ 1 _._

 - _For every_ 2 ≤ _𝑖_ ≤ _ℓ_ + 2 _, there are_ (1 ± _𝑜_ (1)) _𝑝_ _[𝑖]_ [−][2] _𝑑_ [2] _paths_
_of length 𝑖._

 - _There are at most_ (1 + _𝑜_ (1)) exp(− _𝜆_ ) _𝑛𝑑_ _paths of length_
_ℓ_ + 4 _._

 - _All other paths have length ℓ_ + 3 _._

Proof. Consider the pointing structure. Theorem E.1 gives
the sizes of each level in this structure. We will assume the

21

bounds and statements of Theorem E.1. Imagine routing traffic from every possible source to the destination _𝑡_ . The spraying step would send traffic along all edges. For each edge, let
us track the length to the destination.

Any edge incident to _𝑡_ leads to a path of just length 1,
which gives _𝑑_ paths of length 1. If an edge incident to _𝑊𝑃𝑖_ ( _𝑡_ ),
the path to the destination has length _𝑖_ + 2 (one step for
spraying and ( _𝑖_ + 1) steps along the waypoints leading to _𝑡_ ).
Edges incident to _𝐼𝑅_ ( _𝑡_ ) lead to paths of length _ℓ_ + 3. Finally,
by Theorem E.1, observe that all nodes in _𝑂𝑅_ ( _𝑡_ ) have an edge
to _𝐼𝑅_ ( _𝑡_ ) but not to any waypoints. Hence, edges incident to
_𝑂𝑅_ ( _𝑡_ ) give Spraypoint paths of length _ℓ_ + 4. We can use the
level size bounds of Theorem E.1 to complete the proof. 

The bounds in Model 7.2 are expressed as fractions. For
a destination _𝑡_, there are _𝑛𝑑_ possible paths to consider, one
per source and spray operation. So we divide all the bounds
in Theorem E.4 by _𝑛𝑑_ to get the fractions in Model 7.2.

**F** **MODELING EDGE DISJOINT PATHS**

In this section, we estimate the number of edge disjoint paths
between a source _𝑠_ and destination _𝑡_ by estimating the min
cut of Spraypoint paths between _𝑠_ and _𝑡_ . We first set up some
notation.

_Definition F.1._ For every _𝑣_ ≠ _𝑡_, we define the _𝑡_ -parent as:

 - For _𝑣_ ∈ _𝑁𝑏𝑟_ ( _𝑡_ ), the parent is _𝑡_ .

 - For _𝑣_ ∈ _𝑊𝑃𝑖_ ( _𝑡_ ) ( _𝑖_ ≥ 1): we pick _ℎ_ uar neighbors in
_𝑊𝑃𝑖_ −1( _𝑡_ ) as the parents.

 - For _𝑣_ ∈ _𝐼𝑅_ ( _𝑡_ ): we pick up to _ℎ_ uar neighbors of _𝑣_ that
are waypoints (excluding { _𝑡_ } ∪ _𝑁𝑏𝑟_ ( _𝑡_ )).

 - For _𝑣_ ∈ _𝑂𝑅_ ( _𝑡_ ): we pick _ℎ_ random neighbors in _𝐼𝑅_ ( _𝑡_ ).
(If _ℎ_ selections cannot be made, we make the largest possible.)

Recall that the routing algorithm is simple. The first step
is Spraying. After that, as part of pointing, a packet is forwarded to a uar parent. Eventually, the packet reaches _𝑡_ . This
leads to some natural definitions of Spraypoint paths, from
which we can define the graph between the endpoints.

_Definition F.2._ Fix a destination _𝑡_ . For any _𝑣_, the Spraypoint
path to _𝑡_ is any path obtained by repeatedly taking _𝑡_ -parents
until ending at _𝑡_ .

 - The **pointing graph** P _𝑡_ has all edges that forward traffic to _𝑡_ .

 - For a source-destination pair ( _𝑠,𝑡_ ), the **Spraypoint**
**graph** S _𝑠,𝑡_ has all incident edges to _𝑠_ and the union of Spraypoint paths from _𝑁_ ( _𝑠_ ) to _𝑡_ .

We work with _ℓ_ = 1 setting. We make some asymptotic assumptions consistent with our parameters. The assumptions
allow for simpler formulas. We assume:

 - _𝑝𝑑_ / _𝑛_ ≪ 1

 - _𝜆_ = _𝑝𝑑_ [2] / _𝑛_ ≫ 1

 - _𝑑_ ≫ ln [2] _𝑛_

 - _ℎ_ ≪ _𝜆_

Claim F.3. _Assume that_ ( _𝑝_ + 1) _𝑑_ _<_ _𝑛_ /ln [2] _𝑛. With proba-_
_bility >_ 1 − _𝑛_ [−][2] _, all nodes pick at most 𝑜_ ( _𝑑_ ) _neighbors outside_
_𝐼𝑅_ ( _𝑡_ ) _._

Proof. Fix a node _𝑣_ . We will treat each of the at most _𝑑_
neighbors that _𝑣_ has to pick as independent choices among
_𝑁𝑏𝑟_ ( _𝑡_ ) ∪ _𝑊𝑃_ 1( _𝑡_ ) ∪ _𝑅_ 1( _𝑡_ ). The probability that a neighbor
lies in _𝑁𝑏𝑟_ ( _𝑡_ ) ∪ _𝑊𝑃_ 1( _𝑡_ ) is at most | _𝑁𝑏𝑟_ ( _𝑡_ ) ∪ _𝑊𝑃_ 1( _𝑡_ )|/ _𝑛_ ≤
_𝑑_ ( _𝑝_ +1)/ _𝑛_ ≤ 1/ln [2] _𝑛_ . Let _𝑋𝑣_ be the random variable denoting
the number of neighbors of _𝑣_ in _𝑁𝑏𝑟_ ( _𝑡_ ) ∪ _𝑊𝑃_ 1( _𝑡_ ), which
is a sum of iid Bernoullis. Note that E[ _𝑋𝑣_ ] ≤ _𝑑_ /ln [2] _𝑛_ . By
Theorem D.3, Pr[ _𝑋𝑣_ _> 𝑑_ /ln _𝑛_ ] ≤ 2 [−] _[𝑑]_ [/][ln] _[𝑛]_ . By a union bound
over all vertices, the probability that any _𝑋𝑣_ _> 𝑑_ /ln _𝑛_ is at
most _𝑛_ 2 [−] _[𝑑]_ [/][ln] _[𝑛]_ ≤ _𝑛_ [−][2] .

By Theorem E.4, with probability _>_ 1 − _𝑛_ [−][4], the size of
_𝑂𝑅_ ( _𝑡_ ) is at most (exp(− _𝜆_ ) + _𝑜_ (1)) _𝑛_ . The probability that _𝑣_
has a single neighbor in this set is _𝑜_ (1). Using a Chernoff
bound identical to the one above, the probability that _𝑣_ has
more than _𝛿𝑛_ neighbors (for any constant _𝛿_ _>_ 0) is _𝑛_ [−][Θ][(][1][)] .

Take a union bound, with high probability, all nodes pick
at most _𝑜_ ( _𝑑_ ) neighbors outside _𝐼𝑅_ ( _𝑡_ ). 

**F.1** **The matching connection**

For any subset _𝑆_ ⊆ _𝐼𝑅_ ( _𝑡_ ), let us construct the bipartite graph
_𝐷𝑆_ = ( _𝑆, 𝑁𝑏𝑟_ ( _𝑡_ ) _, 𝐸_ ) as follows. We connect _𝑠_ ∈ _𝑆_ to _𝑣_ ∈
_𝑁𝑏𝑟_ ( _𝑡_ ) if _𝑠_ is a descendant of _𝑣_ in the pointing graph P _𝑡_ .

Claim F.4. _For_ _any_ _𝑆_ ⊆ _𝐼𝑅_ ( _𝑡_ ) _:_ _connect_ _a_ _source 𝑠_ _to_ _all_
_nodes in 𝑆_ _and consider the resulting pointing graph. The size_
_of the 𝑠-𝑡_ _mincut is the size of the largest matching in 𝐷𝑆_ _._

Proof. We first prove that the largest matching in _𝐷𝑆_
is at least the mincut size (say _𝑟_ ). By the maxflow-mincut
theorem, there is a flow of value _𝑟_ from _𝑆_ to _𝑡_, with unit edge
capacities. By the integrality of flow, this flow consists of
_𝑟_ edge disjoint paths from _𝑠_ to _𝑡_ . Note that each node in _𝑆_
has a single edge to _𝑠_, and every node in _𝑁𝑏𝑟_ ( _𝑡_ ) has a single
edge to _𝑡_ . So a node in _𝑆_ ∪ _𝑁𝑏𝑟_ ( _𝑡_ ) participates in at most one
flow path. Thus, the _𝑟_ flow paths provide edge disjoint paths
from _𝑆_ to _𝑁𝑏𝑟_ ( _𝑡_ ) in the pointing graph P _𝑡_, which constitute
a matching in _𝐷𝑆_ .

Now, we prove that the mincut is at least the size of the
largest matching in _𝐷𝑆_ . Consider a matching given by _𝜙_ :
_𝑆_ → _𝑁𝑏𝑟_ ( _𝑡_ ). For each _𝑠_ [′] ∈ _𝑆_, follow a parent to _𝑊𝑃_ 1( _𝑡_ ), and
then a parent to get to _𝜙_ ( _𝑠_ ) ∈ _𝑁𝑏𝑟_ ( _𝑡_ ). For two nodes _𝑠_ [′] ≠ _𝑠_ [′′]

in _𝑆_, _𝜙_ ( _𝑠_ [′] ) ≠ _𝜙_ ( _𝑠_ [′′] ). So the corresponding paths are edge
disjoint. Hence, we can send one unit of flow on each such
path, and get a flow with value at least the matching size.
The maxflow value (and hence the mincut value) is at least
the matching size. 

22

We can now connect the _𝑠_  - _𝑡_ mincut of the Spraypoint
graph S _𝑠,𝑡_ to matching sizes. Note that S _𝑠,𝑡_ is formed by
adding the edges connecting _𝑠_ to its neighborhood to P _𝑡_ .
For convenience, we will only add the edges connecting _𝑠_ to
_𝐼𝑅_ ( _𝑡_ ). By Claim F.3, this reduces the mincut by at most _𝑜_ ( _𝑑_ ).

To bound the matching sizes, we use the following notation, based on random matching sizes.

_Definition F.5._ For positive integers _ℓ,𝑟,ℎ_, consider the random bipartite graph _𝐻_ ( _𝐿, 𝑅, 𝐸_ ) formed as follows. We have
| _𝐿_ | = _ℓ_, | _𝑅_ | = _𝑟_, and each node in _𝐿_ picks _ℎ_ uar neighbors in
_𝑅_ with replacement. We use _𝜇_ ( _ℓ,𝑟_ ; _ℎ_ ) to denote the expected
maximum matching in _𝐻_ .

We now state our main theorem relating _𝑠_  - _𝑡_ mincuts in
S _𝑠,𝑡_ to matching sizes.

Theorem F.6. _Assume ℎ_ = _𝑜_ ( _𝑑_ ) _. The expected 𝑠-𝑡_ _mincut_
_size of_ S _𝑠,𝑡_ _has the following values:_

 - _If 𝑠_ ∈ _𝑁𝑏𝑟_ ( _𝑡_ ) _: the size is at least 𝜇_ ( _𝑑_  - _𝑝,𝑑_ ; _ℎ_ ) ± _𝑜_ ( _𝑑_ ) _._

 - _If 𝑠_ ∉ _𝑁𝑏𝑟_ ( _𝑡_ ) _: the size is at least 𝜇_ ( _𝑑,𝑑_ ; _ℎ_ ) ± _𝑜_ ( _𝑑_ ) _._

Proof. Consider _𝑠_ ∈ _𝑁𝑏𝑟_ ( _𝑡_ ). As discussed earlier, it picks
_𝑑_ - _𝑝_ −1 random neighbors after conditioning on the pointing
structure. By Claim F.3, at most _𝑜_ ( _𝑑_ ) of these neighbors lie
outside _𝐼𝑅_ ( _𝑡_ ). So, it picks _𝑑_ - _𝑝_ - 1 − _𝑜_ ( _𝑑_ ) = _𝑑_ - _𝑝_ - _𝑜_ ( _𝑑_ )
neighbors in _𝐼𝑅_ ( _𝑡_ ). Call this set _𝑆_ . By Claim F.4, the _𝑠_ - _𝑡_ mincut
size is the size of the largest matching in _𝐷𝑆_ . Each node _𝑠_ [′]

in _𝑆_ (which is in _𝐼𝑅_ ( _𝑡_ )) picks _ℎ_ random parents in _𝑊𝑃_ 1( _𝑡_ ),
each of which has a parent in _𝑁𝑏𝑟_ ( _𝑡_ ). (We ignore the fact
that nodes in _𝑊𝑃_ 1( _𝑡_ ) might have multiple parents.) Thus,
each _𝑠_ [′] effectively picks _ℎ_ random ancestors in _𝑁𝑏𝑟_ ( _𝑡_ ). So
_𝐷𝑆_ is distributed exactly as the random bipartite graph in
Definition F.5, and the expected matching size is _𝜇_ ( _𝑑_ - _𝑝_ _𝑜_ ( _𝑑_ ) _,𝑑_ ; _ℎ_ ). We can express this quantity as _𝜇_ ( _𝑑_ - _𝑝,𝑑_ ; _ℎ_ )± _𝑜_ ( _𝑑_ ),
since changing any of the sets (in a bipartite graph) by _𝑜_ ( _𝑑_ )
can affect the matching size by at most _𝑜_ ( _𝑑_ ).

Consider _𝑠_ ∈ _𝑊𝑃_ 1( _𝑡_ ). It picks _𝑑_  - _𝑜_ ( _𝑑_ ) random neighbors
in _𝐼𝑅_ ( _𝑡_ ). Applying the same logic as above, the expected
mincut has value _𝜇_ ( _𝑑,𝑑_ ; _ℎ_ ) ± _𝑜_ (1). For _𝑠_ ∈ _𝐼𝑅_ ( _𝑡_ ), it picks
_𝑑_ - _ℎ_ - _𝑜_ ( _𝑑_ ) random neighbors in _𝐼𝑅_ ( _𝑡_ ). Since _ℎ_ = _𝑜_ ( _𝑑_ ), _𝑠_
basically picks _𝑑_ - _𝑜_ ( _𝑑_ ) random neighbors, and the value is
the same as for _𝑠_ ∈ _𝑊𝑃_ 1( _𝑡_ ). 

This theorem gives a lower bound on the size of the mincut.
As mentioned in the proof, we ignore the fact that _𝑊𝑃_ 1( _𝑡_ )
has potentially _ℎ_ neighbors into _𝑁𝑏𝑟_ ( _𝑡_ ), and only use one
of the neighbors for routing. We believe this only loses a
lower order term, and so we ignore it for the sake of cleaner
expressions.

For _ℎ_ = 1, these bounds are tight. For larger _ℎ_, there
are only upper bounds. Nevertheless, they match up quite
accurately with experiments. The exact lower bound is a
more complex expression given by Frieze-Mellsted [13], as
explained later.

We show the _upper_ bound in the next lemma, and then give
the complicated exact expression. (The proof for _𝜇_ ( _𝛼𝑑,𝑑_ ; _ℎ_ )
is analogous and omitted.)

Lemma F.7. _For all ℎ, 𝜇_ ( _𝑑,𝑑_ ; _ℎ_ ) ≤ _𝑑_ (1 − exp(− _ℎ_ )) − _𝑜_ ( _𝑑_ ) _._
_Also, 𝜇_ ( _𝑑,𝑑_ ; 1) = _𝑑_ (1 − 1/ _𝑒_ ) − _𝑜_ ( _𝑑_ ) _._

Proof. Recall that _𝜇_ ( _𝑑,𝑑_ ; _ℎ_ ) is the expected maximum
matching in the following random bipartite graph. There
are two sets _𝐿, 𝑅_ of size _𝑑_ . Each node in _𝐿_ makes _ℎ_ random
connections with _𝑅_ .

Consider a vertex _𝑟_ ∈ _𝑅_ . The probability that an edge does
not connect with _𝑟_ is (1 − 1/ _𝑑_ ). The probability that no edge
makes a connection is (1 - 1/ _𝑑_ ) _[𝑑ℎ]_, since there are _𝑑ℎ_ random
(multi)edges in the graph. Since 1 − _𝑥_ ≥ exp(− _𝑥_ - _𝑥_ [2] ), we
lower bound this probability by exp(−(1/ _𝑑_ + 1/ _𝑑_ [2] ) · _𝑑ℎ_ ) =
exp(− _ℎ_ )(1 − Θ( _ℎ_ / _𝑑_ )).

Consider indicator random variable _𝑋𝑟_ for _𝑟_ having degree
zero. By linearity of expectation and the calculation above,
E[  _𝑟_ ∈ _𝑅_ _[𝑋]_ _𝑟_ []] [=] _𝑟_ ∈ _𝑅_ [E][[] _[𝑋]_ _𝑟_ []] [≥] _[𝑑]_ [exp][(−] _[ℎ]_ [) −] _[𝑜]_ [(] _[𝑑]_ [)][. We can also]

upper bound (1−1/ _𝑑_ ) ≤ _𝑒𝑥𝑝_ (−1/ _𝑑_ ), and get the lower bound
_𝑑_ exp(− _ℎ_ ). Thus, the expected number of degree zero nodes
in _𝑅_ is _𝑑_ exp(− _ℎ_ ) ± _𝑜_ ( _𝑑_ ). These nodes cannot be matched,
and hence the matching size is at most _𝑑_ (1 - exp(− _ℎ_ )) ± _𝑜_ ( _𝑑_ ).

When _ℎ_ = 1, we can match this bound. Take the iterative
process that picks an arbitrary node in _𝑅_ with non-zero degree, and matches it arbitrarily to some neighbor in _𝐿_ . Then,
we delete this node and its neighbors from the graph, and
iterate. When _𝑟_ ∈ _𝑅_ is removed, it removes its neighbors in _𝐿_ .
Since they all have degree 1, all edges removed are incident
to _𝑟_ . Hence, degrees of other nodes in _𝑅_ are unaffected. All
in all, every node of non-zero degree in _𝑅_ gets matched. 

**The Frieze-Mellsted bound:** The optimal value of lim _𝑑_ →∞
_𝜇_ ( _𝑑,𝑑_ ; _ℎ_ )/ _𝑑_ was computed in [13]. We state the bound here,
and show that it is fairly close to the simpler expression of
Lemma F.7.

(Refer to Thm. 3 of [13].) Let _𝑧_ [∗] be the largest non-negative
solution of ( _𝑧_ / _ℎ_ ) [1][/(] _[ℎ]_ [−][1][)] + exp(− _𝑧_ ) + 1 = 0. Then,

lim = 2 −(1 − exp(− _𝑧_ [∗] )) _[ℎ]_
_𝑑_ →∞ _[𝜇]_ [(] _[𝑑,𝑑]_ [;] _[ℎ]_ [)/] _[𝑑]_

−(1 + _𝑧_ [∗] ) exp(− _𝑧_ [∗] ) (4)

≈ 1 −(1 + _𝑧_ [∗]         - _ℎ_ ) exp(− _𝑧_ [∗] ) (5)

**F.2** **Expressions for random matching sizes**

A good rule of thumb is that _𝜇_ ( _𝑑,𝑑_ ; _ℎ_ ) ≈ _𝑑_ (1 − exp(− _ℎ_ )). If
_𝑑_ - _𝑝_ = _𝛼𝑑_, then:

(3)

_𝜇_ ( _𝑑_ - _𝑝,𝑑_ ; _ℎ_ ) = _𝜇_ ( _𝛼𝑑,𝑑_ ; _ℎ_ ) = min

_𝛼𝑑,𝑑_ [1−exp(− _𝛼ℎ_ )]

23

For _ℎ_ = 2, the bound is ≈ 0 _._ 838, while the bound of Lemma F.7
is ≈ 0 _._ 865. For _ℎ_ = 4, the bound is ≈ 0 _._ 979, while the bound
of Lemma F.7 is ≈ 0 _._ 982. As _ℎ_ becomes larger, _𝑧_ [∗] tends to _ℎ_,
and the bound above tends to 1 − exp(− _ℎ_ ).

**F.3** **The mincut bound, summarized**

We summarize the bounds in this section. Fix a destination _𝑡_ .
The _𝑠_ - _𝑡_ mincut value of the Spraypoint graph S _𝑠,𝑡_ is given
by the following formulas:

  - For most _𝑠_, the average mincut is _𝑑_ (1 − exp(− _ℎ_ )).

  - The lowest (expected) mincut occurs for _𝑠_ ∈ _𝑁𝑏𝑟_ ( _𝑡_ ). In

Our first lemma connects the oversub to the fraction of
optimal flow along different lengths.

Lemma G.2. _Consider the traffic matrix 𝑀_ _that achieves the_
_oversub bound. For the corresponding optimal flow, let 𝛿𝑖_ _be the_
_fraction of the flow that takes length 𝑖_ _paths. Then, the oversub_
_is at least_  _𝑖_ _[𝑖𝛿]_ _𝑖_ _[.]_

Proof. The proof goes via a simple “total capacity" argument. Suppose the oversub is _𝜔_ . This means that the corresponding demand multiplier is _𝑑_ / _𝜔_, which is the total flow
that each node sends/receives. The total flow in the network
is _𝑛𝑑_ / _𝜔_, since each node is a source.

Let us bound the sum _𝐹_ :=  arc _𝑒_ _[𝑓]_ _𝑒_ [, where] _[𝑓]_ _𝑒_ [is the total]

flow on the arc _𝑒_ . By definition, the amount of flow along
length _𝑖_ paths is _𝛿𝑖𝑛𝑑_ / _𝜔_ . Observe that this flow takes up
_𝑖𝛿𝑖𝑛𝑑_ / _𝜔_ capacity. Thus, the contribution of this flow to the
sum _𝐹_ is _𝑖𝛿𝑖𝑛𝑑_ / _𝜔_, and we bound _𝐹_ =  _𝑖_ _[𝑖𝛿]_ _𝑖_ _[𝑛𝑑]_ [/] _[𝜔]_ [.]

Let us bound the sum _𝐹_ := 

that case, setting _𝑑_ - _𝑝_ = _𝛼𝑑_, the bound is min

_𝛼𝑑,𝑑_ [1−

          
exp(− _𝛼ℎ_ )] . When _𝛼_ is close to 1, the bound is close

to _𝑑_ (1 − exp(− _ℎ_ )).

To get a sense of the benefits of _ℎ_, we plug in different values.
The best possible mincut is _𝑑_ . Let us see what fraction of _𝑑_
is achieved. For _ℎ_ = 1, we get a 1 − 1/ _𝑒_ ≈ 0 _._ 63 fraction. For
_ℎ_ = 2, we get a 1 - exp(−2) ≈ 0 _._ 86 fraction. For _ℎ_ = 4, we get
a 1 − exp(−4) ≈ 0 _._ 98 fraction. At this point, the statistical
variation of the mincut value is bigger than any potential
improvements.

The following table gives the various fractions. Note that
_𝑝_ = 0 gives the bound for most _𝑠_ .

|𝑝|ℎ = 1|ℎ = 2|ℎ = 4|
|---|---|---|---|
|0|0_._63|0_._86|0_._98|
|_𝑑_/4|0_._53|0_._75|0_._75|
|_𝑑_/3|0_._49|0_._66|0_._66|
|_𝑑_/2|0_._39|0_._5|0_._5|

**G** **MODELING OVERSUBSCRIPTION**

To help us characterize stochastic oversubscription, we set up
some notation and definitions. We set up a multicommodity
flow problem. Each edge of the graph _𝐺_ = ( _𝑉, 𝐸_ ) is treated
as two directed arcs, one in each direction. The capacity of
each arc is one. There is a doubly stochastic demand matrix
_𝑀_ that specifies that amount of flow that each source needs
to send to each destination. So _𝑀𝑠,𝑡_ is the amount of flow
that _𝑠_ needs to send to _𝑡_ . The total flow in or out of any node
is at most one since _𝑀_ is doubly stochastic.

_Definition G.1._ (1) A demand matrix _𝑁_ is a **feasible ma-**
**trix** if the multicommodity flow specified by _𝑁_ can be routed
while honoring link capacity constraints. (2) The **demand**
**multiplier** of a doubly stochastic demand matrix _𝑀_, denoted _𝑐_ ( _𝑀_ ), is the largest _𝑐_ such that _𝑐𝑀_ can be satisfied.
(3) The **oversubscription ratio (oversub)** is the value of
max _𝑀_ _𝑑_ / _𝑐_ ( _𝑀_ ).

Thus, the oversub is the scaled reciprocal of the lowest
possible demand multiplier.

sum _𝐹_ is _𝑖𝛿𝑖𝑛𝑑_ / _𝜔_, and we bound _𝐹_ =  _𝑖_ _[𝑖𝛿]_ _𝑖_ _[𝑛𝑑]_ [/] _[𝜔]_ [.]

Since each arc has unit capacity and there are _𝑛𝑑_ arcs,
_𝐹_ ≤ _𝑛𝑑_ . So  _𝑖_ _[𝛿]_ _𝑖_ _[𝑛𝑑]_ [/] _[𝜔]_ [≤] _[𝑛𝑑]_ [and] _[ 𝜔]_ [≥] _[𝑖]_  _𝑖_ _[𝛿]_ _𝑖_ [.] 

_𝑖_ _[𝛿]_ _𝑖_ _[𝑛𝑑]_ [/] _[𝜔]_ [≤] _[𝑛𝑑]_ [and] _[ 𝜔]_ [≥] _[𝑖]_ 

_𝑖_ _[𝛿]_ _𝑖_ [.] 

**G.1** **Principles underlying the model**

Based on Lemma G.2, we will devise a model for oversub in
the next section as a function of system parameters, _𝑛,𝑑, 𝑝,ℎ_ .
The model is based on a number of principles.

**The greedy shorter path principle:** The oversub lower
bound of Lemma G.2 is  _𝑖_ _[𝑖𝛿]_ _𝑖_ [,] [so] [it] [is] [preferable] [to] [have]

larger values of _𝛿𝑖_ for small _𝑖_, rather than the other way
around. Based on this intuition, we construct the demand
multipliers for a demand matrix by greedily maximizing the
amount of flow on shorter paths first. For the _ℓ_ = 1 setting,
all flows paths have length between 1 to 5 (Theorem E.4). We
can ignore path length 1, which form a neglible fraction of
paths. The main calculations compute the maximum amount
of flow that goes along paths of length 2, then conditioned
on that, maximize flow along paths of length 3, so on and so
forth. We compute _𝜇_ 2 _, 𝜇_ 3 _, 𝜇_ 4, and _𝜇_ 5 defined as follows. The
average amount of flow that a source sends along length _𝑖_
paths is _𝜇𝑖𝑑_ . The total demand multiplier is ( _𝜇_ 2+ _𝜇_ 3+ _𝜇_ 4+ _𝜇_ 5) _𝑑_,
and hence the oversub is ( _𝜇_ 2 + _𝜇_ 3 + _𝜇_ 4 + _𝜇_ 5) [−][1] .

**The average case principle:** By Theorem 2.1 of [37], the
worst-case traffic matrix is a permutation matrix, which is a
perfect matching of source to sinks. We will actually analyze
the average demand multiplier, and hence oversub, of a _ran-_
_dom_ permutation matrix. In many problems in random graph
theory, the worst-case behavior can be shown to be close to
the average-case behavior. Specifically, suppose an adversary
picks a traffic matrix and then we choose the graph _𝐺_ . We
can compute the probability that the demand multiplier deviates significantly from the average value. If this probability
is small enough (like _<_ _𝑛_ [−] _[𝑛]_ ), we could union bound over
all permutation matrices. This means, that with non-trivial

24

probability, a random graph will have high demand multipliers for _all_ permutation matrices. This is a common paradigm
in random graph/matrix theory: show that the probability of
large deviations from average are exponentially small, and
then union bound over all the exponential possibilities (proof
of expansion of random graphs, Chap. 5 of [34]).

**The random deletion principle:** Once (say) we have determined _𝜇_ 2, this flow uses up some capacity. When computing _𝜇_ 3, the capacity constraints have changed. We consider
a simplified model for the change. The length 2 flow uses up
2 _𝜇_ 2 _𝑛𝑑_ capacity from the network, so we assume that each
edge is fully congested with probability 2 _𝜇_ 2 _𝑛𝑑_ / _𝑛𝑑_ = 2 _𝜇_ 2. We
delete these edges, since they are unavailable to carry flow.
This deletion principle is less accurate for larger length flows.
Larger length flows do not use up the capacity of constituent
edges. Hence, for most calculations, we will only assume this
principle for smaller length flows.

**The** **viable** **path** **principle:** For any length _𝑖_, we estimate the number of paths of length _𝑖_ that can be used for
routing. For concreteness, for the remaining principles, we
will consider length 3 (the first non-trivial case). Such a path
goes _𝑠_ → _𝑊𝑃_ 1( _𝑡_ ) → _𝑁𝑏𝑟_ ( _𝑡_ ) → _𝑡_ . Theorem E.4 tells us how
many neighbors of _𝑠_ lead to such paths (in this case, it is
_𝑝𝑑_ [2] / _𝑛_ for an average source _𝑠_ ). Because of the deletion principle, some of these edges (from _𝑠_ to _𝑊𝑃_ 1( _𝑡_ )) get deleted.
Consider some _𝑣_ ∈ _𝑊𝑃_ 1( _𝑡_ ) such that ( _𝑠, 𝑣_ ) is not deleted.
The pointing paths from _𝑣_ to _𝑡_ may get removed _after_ the
deletions. We need to model the probability of this event.
The parameter _ℎ_ ensures that each _𝑣_ has _ℎ_ (edge disjoint)
pointing paths to _𝑡_ . We calculate the probability that some
path survives the deletion. Putting it all together, we can estimate the number of paths of length 3 that allow for routing.
The next principles account for the intersections/congestion
among these paths, from which we compute the flow that
can be sent along these paths.

**The unique position principle:** By the mincut bounds
of Lemma F.7, there should be enough edge disjoint paths
length between a given source-destination pair to carry the
desired flow. (We do not expect an oversub less than 2, so
even an mincut of _𝑑_ /2 suffices for a source-destination pair.)
Consider the entire collection of edge disjoint length 3 paths,
over all source-destination pairs. Congestion occurs because
some edges are present among length 3 paths for multiple
source-destination pair.

The concept of _position_ helps us bound the congestion.
For a path, an edge has one of three positions: first, middle,
or last. _An edge_ ( _𝑢, 𝑣_ ) _cannot be in the first position for more_
_than one path._ When ( _𝑢, 𝑣_ ) is the first edge, _𝑢_ must be the
source, and all length 3 paths from _𝑢_ (in the collection) are
edge disjoint. Similarly, an edge cannot be in the last position
for more than one path. Extrapolating, we assume that no
edge can be in a specific position for more than one path.

(This is technically false, since an edge could be in the middle
for multiple paths, but we believe this only leads to a lower
order term.) Overall, for length 3, an edge can participate in
at most 3 flow paths of length 3. Similarly, we assume that
for length _𝑖_, an edge participates in at most _𝑖_ flow paths, one
in each position.

**The binomial congestion principle:** We want to compute the amount of flow along length 3 paths to estimate _𝜇_ 3.
Using the viable path principle, suppose we determine that
there are _𝜙_ 3 _𝑑_ edge disjoint paths of length 3 between every
source-destination pair. Consider the total collection of _𝜙_ 3 _𝑛𝑑_
paths. We want to model, for a given edge, the number of
paths that this edge participates in. This is the congestion on
that edge, focusing only on length 3 flow. By the unique position principle, the congestion is at most 3. We will assume
that an edge is present in a particular position independently
with probability _𝜙_ 3. Consider an edge on a particular length 3
path. It already occupies a position on this path, and can take
up two other positions (on different paths). The congestion
on the edge is distributed as the binomial _𝐵_ (2 _,𝜙_ 3) + 1 (the
binomial _𝐵_ (2 _,𝜙_ 3) is the sum of 2 independent 0-1 random
variables with expectation _𝜙_ 3) plus one.

**The** **reciprocal** **principle:** On each edge of the path,
using the binomial model, we have a distribution for the
number of _other_ paths that use this edge. The maximum
value among all the edges of the path is the congestion of the
path. We use the following simple claim to get a flow bound.

Claim G.3. _Consider a family_ P _of paths. For each path_
_in_ _𝑃_ ∈P _,_ _let 𝑐_ ( _𝑃_ ) _be_ _the_ _congestion_ _of_ _𝑃_ _among_ _the_ _paths_
P _._ _(So_ _𝑐_ ( _𝑃_ ) _is_ _the_ _maximum,_ _among_ _all_ _edges_ _of_ _𝑃,_ _of_ _the_
_number of paths that use the edge.) Then each path 𝑃_ ∈P _can_
_simultaneously route_ 1/ _𝑐_ ( _𝑃_ ) _units of flow without violating_
_the (unit) capacity constraints._

Proof. Suppose every path _𝑃_ ∈P routes 1/ _𝑐_ ( _𝑃_ ) units of
flow. Consider any edge _𝑒_ that is contained in path _𝑃_ 1 _, 𝑃_ 2 _, . . ., 𝑃𝑘_ .
The congestion of _𝑒_, denoted _𝑐_ ( _𝑒_ ), is _𝑘_ . Observe that for every path _𝑃𝑖_, _𝑐_ ( _𝑃𝑖_ ) ≥ _𝑐_ ( _𝑒_ ) = _𝑘_ . The total amount of flow in _𝑒_
is  _𝑖_ ≤ _𝑘_ [1][/] _[𝑐]_ [(] _[𝑃]_ _𝑖_ [) ≤]  _𝑖_ ≤ _𝑘_ [1][/] _[𝑐]_ [(] _[𝑒]_ [)] [=] _𝑖_ ≤ _𝑘_ [1][/] _[𝑘]_ [=][ 1.] 

_𝑖_ ≤ _𝑘_ [1][/] _[𝑐]_ [(] _[𝑃]_ _𝑖_ [) ≤] 

_𝑖_ ≤ _𝑘_ [1][/] _[𝑐]_ [(] _[𝑒]_ [)] [=]

_𝑖_ ≤ _𝑘_ [1][/] _[𝑘]_ [=][ 1.] 

This claim allows us to get the total flow that can be sent
along, say, length 3 paths. Over these paths, we have computed the distribution of congestion. The average value of
the reciprocal of the congestion is the average flow that can
be sent along paths of this length. We multiply this average
by the total number of paths to get the total flow.

To move to the next path length, we use the random deletion principle to delete edges that are used by this flow. We
run this entire calculation again for the next path length.
For larger paths lengths _𝑖_ (like 4 and above), the congestion
values of the paths are quite close to their maximum value _𝑖_ .
So we just send 1/ _𝑖_ units of flow along paths of these length.

25

This simplification helps us avoid complicated probability
calculations that are lower order terms.

**G.2** **The oversub formula**

We now compute the formula based on the principles above.
Given the parameters, _𝑛_, _𝑑_, _𝑝_, and _ℎ_, the final formula is a
polynomial function of _𝑝_ and _𝑑_ / _𝑛_, with exponential dependencies on _ℎ_ . There are minor corrections needed for extreme
parameter settings (when _𝑑_ is comparable to _𝑛_, or _𝑝_ is close
to _𝑑_ ). As discussed earlier, we will estimate _𝜇_ 2 _, 𝜇_ 3 _, 𝜇_ 4, and _𝜇_ 5.

_𝜇_ 2: By Theorem E.4, for a given destination _𝑡_, a typical
source _𝑠_ would have a _𝑑_ / _𝑛_ fraction of its neighbors in _𝑁𝑏𝑟_ ( _𝑡_ ).
The total number of such paths from _𝑠_ to _𝑡_ is _𝑑_ [2] / _𝑛_ and the
total number of edges on these paths is 2 _𝑑_ [2] / _𝑛_ . As a fraction
of the total number of arcs (directed edges), we get 2 _𝑑_ / _𝑛_ (=
(2 _𝑑_ [2] / _𝑛_ ) · _𝑛_ / _𝑛𝑑_ ). We typically assume that 2 _𝑑_ ≪ _𝑛_ . Assuming
that an edge is present on these paths with probability 2 _𝑑_ / _𝑛_,
the probability that an edge is on two (or more) paths is
(2 _𝑑_ / _𝑛_ ) [2], which is negligible. So we assume that no edge is
present on two of these paths, or equivalently, the congestion
of every path/edge is at most one. So all the length 2 paths
across all source-destination pairs are edge disjoint. Each
such path can carry one unit of flow, so _𝑠_ can send _𝑑_ [2] / _𝑛_ units
of flow along length 2 paths to _𝑡_ . Thus, _𝜇_ 2 = _𝑑_ / _𝑛_

_𝜇_ 3: This is where most of the work goes. By the unique
position principle and the random deletion principle, each
edge has probability _𝜇_ 2 of being in the first position of a
length 2 flow path. (Same for the last position.) So we will
delete a _𝜇_ 2 fraction of edges (for the first position), and delete
another _𝜇_ 2 fraction for the last position.

We now estimate the number of length 3 paths that can be
used to route flow. We compute a fraction _𝜙_ 3 such that each
source-destination pair has _𝜙_ 3 _𝑑_ viable length 3 paths to route
flow. By Theorem E.4, a typical source _𝑠_ has a _𝑝𝑑_ / _𝑛_ = _𝑝𝜇_ 2
fraction of neighbors in _𝑊𝑃_ 1( _𝑡_ ). (For extreme large values
of _𝑝_, _𝑝𝜇_ 2 could be larger than one, so we “correct" by making
this fraction min( _𝑝𝜇_ 2 _,_ 1 − _𝜇_ 2). The latter term just assumes
that everything that is not in _𝑁𝑏𝑟_ ( _𝑡_ ) is in _𝑊𝑃_ 1( _𝑡_ ).) Of these
corresponding edges incident to _𝑠_, some of them might be
in the last position of a length 2 flow. They cannot be in
the first position, since all first position edges go from _𝑠_ to
_𝑁𝑏𝑟_ ( _𝑡_ ), while these edges under consideration go from _𝑠_ to
_𝑊𝑃_ 1( _𝑡_ ). By the deletion principle, we expect a _𝜇_ 2-fraction of

the edges to be deleted.

So we get that a min( _𝑝𝜇_ 2 _,_ 1 − _𝜇_ 2)  - (1 − _𝜇_ 2) fraction of
neighbors of a source _𝑠_ lead to length 3 paths to the corresponding destination _𝑡_ . Consider such a neighbor _𝑣_ of _𝑠_ that
is in _𝑊𝑃_ 1( _𝑡_ ). It has _ℎ_ pointing (likely edge disjoint) paths
of length 2 to the destination _𝑡_ . Each edge gets deleted with
independent probability 2 _𝜇_ 2, so a path survives with probability (1 − 2 _𝜇_ 2) [2] ≈ 1 − 4 _𝜇_ 2 (assuming _𝜇_ 2 _<<_ 1). The path

gets removed with probability ≈ 4 _𝜇_ 2. The probability that
at least one of _ℎ_ edge disjoint paths survives is 1 −(4 _𝜇_ 2) _[ℎ]_ .
Overall, the probability that _𝑣_ ∈ _𝑊𝑃_ 1( _𝑡_ ) still has a path to _𝑡_
is 1 −(4 _𝜇_ 2) _[ℎ]_ .

Combining with the number of such _𝑣_ ’s, we get that there
are _𝜙_ 3 _𝑑_ neighbors of _𝑠_ that lead to viable 3 length flows,
where:

_𝜙_ 3 = min( _𝑝𝜇_ 2 _,_ 1 − _𝜇_ 2) · (1 − _𝜇_ 2) · (1 −(4 _𝜇_ 2) _[ℎ]_ ) (6)

Our next step is to deal with the congestion. Consider a
length 3 flow path. Each edge on this path could potentially
take up two other positions (on different paths), using the
unique position principle. The congestion on the path is the
maximum of three independently chosen random variables
according to the shifted binomial _𝐵_ (2 _,𝜙_ 3) + 1.

Claim G.4. _Define 𝑌_ := max( _𝑋_ 1 _,𝑋_ 2 _,𝑋_ 3) _,_ _where_ _each 𝑋𝑖_
_is_ _independently_ _chosen_ _from_ _𝐵_ (2 _,𝜙_ 3) _._ _Then,_ Pr[ _𝑌_ = 0] =
(1 − _𝜙_ 3) [6] _,_ Pr[ _𝑌_ = 1] = [(1 − _𝜙_ 3 [2][)][3][ −(][1][ −] _[𝜙]_ [3][)][6][]] _[, and]_ [ Pr][[] _[𝑌]_ [=]

2] = [1 −(1 − _𝜙_ 3 [2][)][3][]] _[.]_

Proof. We can treat each binomial as the sum of two
independent Bernoullis, each with parameter _𝜙_ 3. For _𝑌_ to be
zero, all the Bernoullis need to take value zero. This happens
with probability (1 − _𝜙_ 3) [6] .

Each _𝑋𝑖_ takes value 2 with probability _𝜙_ 3 [2][. The probability]

that no _𝑋𝑖_ takes value 2 is (1 − _𝜙_ [2][)][3][.] [Thus,] [Pr][[] _[𝑌]_ [=] [2][]] [=]

_𝜅_ 3 = (1 − _𝜙_ 3) [6] + [(1 − _𝜙_ 3 [2][)][3][ −(][1][ −] _[𝜙]_ [3][)][6][]/][2]

+[1 −(1 − _𝜙_ 3 [2][)][3][]/][3] (7)

Finally, we set _𝜇_ 3 = _𝜙_ 3 _𝜅_ 3.

_𝜇_ 4 and _𝜇_ 5: We create variables for the relative sizes of the
Spraypoint levels, based on Theorem E.4.

_𝜎_ 4 = 1 −( _𝑝_ + 1) _𝑑_ / _𝑛_ - exp(− _𝑝𝑑_ [2] / _𝑛_ ) _𝜎_ 5 = exp(− _𝑝𝑑_ [2] / _𝑛_ ) (8)

Let us start with _𝜇_ 4. The quantity _𝜎_ 4 is the fraction of _𝑠_ ’s
neighbors that lead to a length 4 flow path. The probability
that these corresponding edges are removed by previous
flows is _𝜇_ 2 + 2 _𝜇_ 3. (This edge can take up the last position in
length 2 flows, and the middle or last position in length 3
flows.)

Consider a neighbor _𝑣_ of _𝑠_ leading to length 4 path. As
in the previous _𝜇_ 3 calculations, we need to compute the
probability that _𝑣_ still has a path to _𝑡_ after the deletions. We
will model _𝑣_ ’s pointing paths as follows. It has _ℎ_ neighbors in
_𝑊𝑃_ 1( _𝑡_ ), each of which has _ℎ_ edge disjoint paths to _𝑡_ . Since

Each _𝑋𝑖_ takes value 2 with probability _𝜙_ [2]

that no _𝑋𝑖_ takes value 2 is (1 − _𝜙_ 3 [2][)][3][.] [Thus,] [Pr][[] _[𝑌]_ [=] [2][]] [=]

[1 −(1 − _𝜙_ [2][)][3][]][.]

[1 −(1 − _𝜙_ 3 [2][)][3][]][.]

We deduce Pr[ _𝑌_ = 1] as 1 − Pr[ _𝑌_ = 0] − Pr[ _𝑌_ = 2], and
applying the above formulas. 

The congestion on a path is distributed as _𝑌_ + 1, where
_𝑌_ is distributed as in Claim G.4. As discussed in the earlier
section, the average flow that can be sent is E[1/( _𝑌_ + 1)].
Using Claim G.4, this average can be computed easily:

26

we are considering longer paths, we will go with the weaker
deletion principle of removing edges with probability 2 _𝜇_ 2.
The probability that _𝑣_ still has a path to _𝑡_ can be approximated
as _𝛽_, defined below.

_𝛽_ = 1 −[1 −(1 − 2 _𝜇_ 2)(1 −(4 _𝜇_ 2) _[ℎ]_ )] _[ℎ]_ (9)

The fraction of viable paths is _𝜙_ 4 = _𝜎_ 4 _𝛽_ . For paths of length
4, we will simply assume the worst case congestion of 4, so
we can only send 1/4 units of flow on each path. So we set
_𝜅_ 4 = 1/4 and _𝜇_ 4 = _𝜎_ 4 _𝜅_ 4 = _𝜎_ 4 _𝛽_ (1 − _𝜇_ 2 − 2 _𝜇_ 3)/4.

For _𝜇_ 5, we only look at deletions incident to the source
_𝑠_ . This is because there will be many paths (polynomial in
_ℎ_ ) from a neighbor of _𝑠_ (in _𝑂𝑅_ ( _𝑡_ )) to the destination _𝑡_ . The
odds are quite high that some path will still be available for
routing, so we do not bother to model it carefully. Following
the logic for _𝜇_ 4, we estimate _𝜇_ 5 = _𝜎_ 4(1 − _𝜇_ 2 − 2 _𝜇_ 3 − 3 _𝜇_ 4)/5.

Let _𝜇𝑖_ [+] [=][ max][(] _[𝜇][𝑖][,]_ [ 0][)][. This deals with extreme situations (] _[𝑛]_

is too small, _𝑝_ or _𝑑_ are large). Finally, our oversub bound is

( _𝜇_ 2 [+] [+] _[ 𝜇]_ 3 [+] [+] _[ 𝜇]_ 4 [+] [+] _[ 𝜇]_ 5 [+][)] [−][1] (10)

27

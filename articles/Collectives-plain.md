# Collective Operations in Distributed Machine Learning

A Focus on Large Language Model (LLM) Training

Chen Avin

## Introduction to Collective Operations

- Collective operations are mechanisms for coordinating data sharing and processing
across devices.

- Critical for efficient scaling in distributed machine learning.

- Used extensively in LLM training to handle massive computational workloads.

- Focus on seven key collectives: Reduce, Gather, All-Reduce, All-Gather, Scatter,
Reduce-Scatter, All-to-All.

##### Distributed Machine Learning

[https://huggingface.co/spaces/HoangPhuc7678/ultrascale-playbook?section=high_level_overview](https://huggingface.co/spaces/HoangPhuc7678/ultrascale-playbook?section=high_level_overview)

[T3P: Topology-Tailored Tensor Parallelism](https://scholar.google.co.il/citations?view_op=view_citation&hl=en&user=n8JGcgQAAAAJ&sortby=pubdate&citation_for_view=n8JGcgQAAAAJ:p__nRnzSRKYC) . SB Yochana, C Avin, G Scalosub
Proceedings of the 2nd Workshop on Networks for AI Computing, 81-88

**DNN Model Architecture (Simplified)**

![](images/Collectives-plain/Collectives-plain.pdf-3-0.png)

|3|5|2|4|
|---|---|---|---|
|6|1|3|2|

|61|43|54|60|
|---|---|---|---|
|53|51|32|43|

|4|6|3|2|
|---|---|---|---|
|5|1|7|4|
|6|2|1|5|
|3|4|2|6|

• A model consisting of𝐿matrix multiplications:
• Input:𝑋0 ∈ℝ𝑛𝑥×𝑛0
• For each layerℓ: 𝑊ℓ∈ℝ𝑛ℓ−1×𝑛ℓ
• Activation function𝑓⋅is applied element-wise
3
5
2
4
6
1
3
2
4
6
3
2
5
1
7
4
6
2
1
5
3
4
2
×
=
𝑋(ℓ−1)
𝑊(ℓ)
𝑌(ℓ)
𝑌(ℓ) = 𝑓𝑋(ℓ−1)𝑊(ℓ) ,
ℓ∈{1, … , 𝐿}
61
43
54
60
53
51
32
43
6

𝑌(ℓ) = 𝑓𝑋(ℓ−1)𝑊(ℓ) ,
ℓ∈{1, … , 𝐿}

##### Training on one GPU

![](images/Collectives-plain/Collectives-plain.pdf-4-0.png)
##### Data Parallelism

![](images/Collectives-plain/Collectives-plain.pdf-5-0.png)
##### Tensor Parallelism (column)

![](images/Collectives-plain/Collectives-plain.pdf-6-0.png)

![](images/Collectives-plain/Collectives-plain.pdf-6-1.png)
##### Tensor Parallelism (row)

![](images/Collectives-plain/Collectives-plain.pdf-7-0.png)

![](images/Collectives-plain/Collectives-plain.pdf-7-1.png)
**Sharding**

   - **Sharding:** Dividing a tensor into shards

**Row-wise**

𝑋 [(ℓ−1)] 𝑊 [(ℓ)] 𝑌 [(ℓ)]

Shard(1) Shard(0) Partial(SUM)

![](images/Collectives-plain/Collectives-plain.pdf-8-0.png)

- **1D TP:** Partition a weight
matrix along one dimension

**Column-wise**

𝑋 [(ℓ−1)] 𝑊 [(ℓ)] 𝑌 [(ℓ)]

Replicate Shard(1) Shard(1)

Device 1

Device 2

|37|23|44|26|
|---|---|---|---|
|29|37|25|16|

|3|5|2|4|
|---|---|---|---|
|6|1|3|2|

|61|43|Col3|Col4|
|---|---|---|---|
|53|51|||

|3 5<br>×<br>6 1|Col2|Col3|Col4|Col5|Col6|4|6|3|2|Col11|37 23 44 26<br>=<br>29 37 25 16|
|---|---|---|---|---|---|---|---|---|---|---|---|
|3|5|||||5|1|7|4|4|4|
|3|5||||×||||||=|
|6|1|||||||||||
|6|1|||||||||||

|3 5 2 4<br>×<br>6 1 3 2|4|6|Col4|Col5|61 43<br>=<br>53 51|
|---|---|---|---|---|---|
|2<br>4<br>3<br>2<br>3<br>5<br>6<br>1<br>×|5|1||||
|2<br>4<br>3<br>2<br>3<br>5<br>6<br>1<br>×|6|2||||
|2<br>4<br>3<br>2<br>3<br>5<br>6<br>1<br>×|3|4||||

Device 2

|24|20|10|34|
|---|---|---|---|
|24|14|7|27|

|3|5|2|4|
|---|---|---|---|
|6|1|3|2|

32

43

|2 4<br>×<br>3 2|Col2|Col3|Col4|Col5|Col6|Col7|Col8|Col9|Col10|Col11|24 20 10 34<br>=<br>24 14 7 27|
|---|---|---|---|---|---|---|---|---|---|---|---|
|||2|4|4|4|||||||
|||2|4||×||||||=|
|||3|2||||2|1|5|||
|||3|2|||3|4|2|6|6|6|

|3 5 2 4<br>×<br>6 1 3 2|Col2|Col3|3|2|54 60<br>=<br>32 43|
|---|---|---|---|---|---|
|2<br>4<br>3<br>2<br>3<br>5<br>6<br>1<br>×|||7<br>7|**4**|**4**|
|2<br>4<br>3<br>2<br>3<br>5<br>6<br>1<br>×|||1|5|5|
|2<br>4<br>3<br>2<br>3<br>5<br>6<br>1<br>×|||2|6|6|

**Resharding & Collective Operations**

   - Consecutive layers may require **re-sharding:**

➢ Converts the output sharding of layer ℓ to the input sharding of layer ℓ+ 1
➢ Performed with collective operations.

![](images/Collectives-plain/Collectives-plain.pdf-9-0.png)

![](images/Collectives-plain/Collectives-plain.pdf-9-3.png)

![](images/Collectives-plain/Collectives-plain.pdf-9-4.png)

![](images/Collectives-plain/Collectives-plain.pdf-9-5.png)

|37|23|44|26|
|---|---|---|---|
|29|37|25|16|

|61|43|Col3|Col4|
|---|---|---|---|
|53|51|||

|24|20|10|34|
|---|---|---|---|
|24|14|7|27|

32

43

**Identity (No-Op)**

**Reduce-Scatter (RS)**

**All-Reduce (AR)**

|4|6|3|2|
|---|---|---|---|
|5|1|7|4|
|||||
|||||

6

2

1

5

3

4

![](images/Collectives-plain/Collectives-plain.pdf-9-1.png)

![](images/Collectives-plain/Collectives-plain.pdf-9-2.png)
##### Pipeline Parallelism

##### Mixture of Expert

![](images/Collectives-plain/Collectives-plain.pdf-11-0.png)
![](images/Collectives-plain/Collectives-plain.pdf-12-0.png)
## Overview of Collectives

- Reduce: Aggregates data across devices to a single device.

- Gather: Combines data from all devices into one.

- All-Reduce: Combines data and distributes results to all devices.

- All-Gather: Collects all data from devices and shares it back with all.

- Scatter: Divides data and sends portions to devices.

- Reduce-Scatter: Combines and distributes data in a single operation.

- All-to-All: Each device sends data to all other devices.

## Reduce

- **What It Does** :

   - Aggregates data from all devices and
places the result on a single device.
Typical operations include summation,
average, or max.

- **Use in LLM Training** :

   - **Parallelism Type** : Data Parallelism.

   - **Scenario** : Aggregating the computed loss
values from all devices to one device for
logging or checkpointing purposes.

   - Example: When training with large batches
distributed across GPUs, loss values are
reduced to calculate metrics like
perplexity

![](images/Collectives-plain/Collectives-plain.pdf-14-0.png)
## All-Reduce

- **What It Does** :

   - Combines data across all devices (e.g., summing gradients) and
distributes the combined result back to all devices.

- **Use in LLM Training** :

   - **Parallelism Type** : Data Parallelism.

   - **Scenario** : Gradient synchronization during backpropagation.
After computing local gradients, all-reduce ensures all GPUs
have the same gradient values for consistent weight updates.

   - Example: In GPT-like models trained with data parallelism,
gradients computed locally are all-reduced across devices to
synchronize updates.

![](images/Collectives-plain/Collectives-plain.pdf-15-0.png)

![](images/Collectives-plain/Collectives-plain.pdf-15-1.png)
## Gather

- **What It Does** :

   - Collects data from all devices into one
without performing any computation.

- **Use in LLM Training** :

   - **Parallelism Type** : Model Parallelism.

   - **Scenario** : Consolidating embedding
vectors calculated independently on
multiple GPUs into a single batch for postprocessing (e.g., input to a fully connected
layer).

   - Example: Gathering partial outputs of
transformers computed on separate GPUs
into a unified tensor.

![](images/Collectives-plain/Collectives-plain.pdf-16-0.png)
## All-Gather

- **What It Does** :

   - Each device collects and shares its local
data with all other devices.

- **Use in LLM Training** :

   - **Parallelism Type** : Model Parallelism or
Expert Parallelism.

   - **Scenario** : Sharing activation outputs
across GPUs for forward or backward
passes in model-parallel architectures.

   - Example: When splitting layers of a
transformer across GPUs, activations from
one GPU must be gathered by all others to
continue computation.

![](images/Collectives-plain/Collectives-plain.pdf-17-0.png)

![](images/Collectives-plain/Collectives-plain.pdf-17-1.png)
## Scatter

- **What It Does** :

   - Divides a dataset into smaller parts
and sends each part to a different
device.

- **Use in LLM Training** :

   - **Parallelism Type** : Data Parallelism.

   - **Scenario** : Distributing input batches
or datasets among GPUs for
preprocessing or training.

   - Example: Sharding a large input batch
into smaller chunks and scattering
them to GPUs for parallel processing.

![](images/Collectives-plain/Collectives-plain.pdf-18-0.png)
## Reduce-Scatter

- **What It Does** :

   - Combines data from all devices (e.g., sum or
average) and simultaneously distributes
portions of the result back to devices.

- **Use in LLM Training** :

   - **Parallelism Type** : Model Parallelism.

   - **Scenario** : Efficient gradient reduction and
distribution in tensor-parallel training setups.

   - Example: When distributing a tensor’s
updates in transformer-based LLMs,
gradients are reduced and scattered to
ensure only the necessary updates are
shared with each GPU.

![](images/Collectives-plain/Collectives-plain.pdf-19-0.png)
![](images/Collectives-plain/Collectives-plain.pdf-20-0.png)
## Reduce-Scatter

+

- We can do All-reduce using Reduce-Scatter

=

![](images/Collectives-plain/Collectives-plain.pdf-20-1.png)

![](images/Collectives-plain/Collectives-plain.pdf-20-2.png)
## All-to-All

- **What It Does** :

   - Each device sends its local data to all other devices.

   - Matrix Transpose

- **Use in LLM Training** :

   - **Parallelism Type** : Tensor Parallelism or Expert
Parallelism.

   - **Scenario** : Exchanging intermediate results between
devices during tensor-parallel or mixture-of-experts
(MoE) layers.

   - Example: In MoE architectures, tokens assigned to
specific experts are routed to corresponding GPUs
using an all-to-all communication step.

![](images/Collectives-plain/Collectives-plain.pdf-21-0.png)

![](images/Collectives-plain/Collectives-plain.pdf-21-1.png)
## Summary of Collectives

- Recap of collectives:

  - Data Parallelism: Reduce, All-Reduce, Scatter.

  - Model Parallelism: Gather, All-Gather, ReduceScatter.

  - Expert Parallelism: All-to-All, All-Gather.

- Contribution to scalability and efficiency in
LLM training.

![](images/Collectives-plain/Collectives-plain.pdf-22-0.png)

![](images/Collectives-plain/Collectives-plain.pdf-22-1.png)
###### Introduction to Algorithmic Implementation

- The performance of collective operations depends significantly on the algorithm
used, especially when implemented over communication networks.

- The following topics will cover different algorithmic approaches for collective
operations:

   - Complete Graph Model: Direct communication between all nodes.

   - Ring Algorithm (for All-Reduce)

   - Recursive Doubling (for All-Gather)

   - Bruck Algorithm: Optimizes data sharing for All-Gather in specific scenarios.

   - Recursive halving Algorithm: A method to reduce communication steps, optimizing for
certain network topologies.

Reference paper: "Optimization of Collective Communication Operations in MPICH" by Thakur et al., 2005 (Link
to Paper: https://web.cels.anl.gov/~thakur/papers/ijhpca-coll.pdf).

### Key Parameters in Collective Operations

![](images/Collectives-plain/Collectives-plain.pdf-24-0.png)

• Definition: In a complete graph, all nodes are directly connected to each other.
• Time Complexity:𝑂(𝛼+ 𝛽𝑛), as data can be shared in constant time between
nodes.
• Message Complexity:𝑂(𝑝𝑛), where p is the number of nodes (since each node
sends messages to all other nodes).
• Example: All-reduce in a complete graph can be done in a single communication
step. Start
End
Complete graph

step. Start

End

Complete graph

![](images/Collectives-plain/Collectives-plain.pdf-25-0.png)

![](images/Collectives-plain/Collectives-plain.pdf-25-1.png)

![](images/Collectives-plain/Collectives-plain.pdf-25-2.png)
## Parameter Server

![](images/Collectives-plain/Collectives-plain.pdf-26-0.png)

![](images/Collectives-plain/Collectives-plain.pdf-26-1.png)
## Ring Algorithm for All-Reduce

- Description: The ring algorithm reduces data in a
circular fashion where each node communicates
with its neighbor.

- Ring Algorithm Phases (without pipeline):

   - Collect full information.

   - Compute.

- Time Complexity: 𝑂((𝛼+ 𝑛𝛽)(𝑝−1))

- Message/BW Complexity: 𝑂(𝑝𝑛).

![](images/Collectives-plain/Collectives-plain.pdf-27-0.png)
## Ring Algorithm for All-Reduce

![](images/Collectives-plain/Collectives-plain.pdf-28-0.png)

## Ring Algorithm for All-Reduce

Reduce-Scatter

All-gather

![](images/Collectives-plain/Collectives-plain.pdf-29-0.png)

![](images/Collectives-plain/Collectives-plain.pdf-29-1.png)

![](images/Collectives-plain/Collectives-plain.pdf-29-2.png)

![](images/Collectives-plain/Collectives-plain.pdf-29-3.png)
![](images/Collectives-plain/Collectives-plain.pdf-30-0.png)

Sequential and Parallel Algorithms and Data Structures: The Basic Toolbox.
Peter Sanders, Kurt Mehlhorn, Martin Dietzfelbinger, Roman Dementiev. 2019

Selected Topics in Networking – Chen Avin

![](images/Collectives-plain/Collectives-plain.pdf-31-0.png)

![](images/Collectives-plain/Collectives-plain.pdf-31-1.png)

Missing, reduce-scatter!!!

## Recursive Doubling for All-Gather

![](images/Collectives-plain/Collectives-plain.pdf-32-0.png)

![](images/Collectives-plain/Collectives-plain.pdf-32-1.png)
## 𝑝 Bruck Algorithm for All-Gather (any )

![](images/Collectives-plain/Collectives-plain.pdf-33-1.png)

![](images/Collectives-plain/Collectives-plain.pdf-33-0.png)
#### Bruck Algorithm for All-2-All (any 𝑝)

![](images/Collectives-plain/Collectives-plain.pdf-34-1.png)

![](images/Collectives-plain/Collectives-plain.pdf-34-0.png)
##### Recursive halving Algorithm

![](images/Collectives-plain/Collectives-plain.pdf-35-0.png)
log 𝑝

![](images/Collectives-plain/Collectives-plain.pdf-36-0.png)

(log 𝑝)(𝛼+ 𝛽𝑛)

![](images/Collectives-plain/Collectives-plain.pdf-37-0.png)

⟹

![](images/Collectives-plain/Collectives-plain.pdf-37-1.png)

![](images/Collectives-plain/Collectives-plain.pdf-37-2.png)

![](images/Collectives-plain/Collectives-plain.pdf-37-3.png)

![](images/Collectives-plain/Collectives-plain.pdf-37-4.png)
![](images/Collectives-plain/Collectives-plain.pdf-38-0.png)

![](images/Collectives-plain/Collectives-plain.pdf-38-1.png)

![](images/Collectives-plain/Collectives-plain.pdf-38-2.png)

![](images/Collectives-plain/Collectives-plain.pdf-38-3.png)
##### Discussion

distributed machine learning

- Many optimization opportunities:

  - Within collective: a lot of existing research

  - Overall communication patterns:

     - At large, current networks (Ethernet) are not optimized for collective

     - Much less is done: routing, congestion, error recovery, topology, schedule

     - Better modeling for networking preformance

     - Failure is a larger issue: the whole collective may fail

- Questions?

![](images/Collectives-plain/Collectives-plain.pdf-39-0.png)

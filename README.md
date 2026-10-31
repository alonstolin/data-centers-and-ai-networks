# Data Center Networks & AI (Course 361.2.2460)

Course 361.2.2460, Semester A 2026. Covers scalable data center architectures, hyperscale Clos fabrics, lossless RDMA transports (RoCEv2, PFC, DCQCN), distributed congestion control, and network fabrics for large-scale AI/LLM clusters.

---

## Syllabus & Literature Map

| Unit | Topic | Foundational Literature | Labs & Notes |
|:---:|---|---|:---:|
| **1** | Clos Topologies & Fat-Trees | • [Al-Fares Fat-Tree (2008)](articles/README.md#al-fares-et-al-2008)<br>• [VL2 (2009)](articles/README.md#greenberg-et-al-2009)<br>• [Jupiter Rising (2015)](articles/README.md#singh-et-al-2015) | • [HW1: Fat-Tree Topology Generation and Analysis](ex1/README.md)<br>• [Topic 1: AI Factory Networking Overview](articles/notes/topic1-podcast-ai-factory.md) |
| **2** | Traffic Characteristics in the Wild | • [Kandula et al. (2009)](articles/README.md#kandula-et-al-2009) | — |
| **3** | Low-Latency Transport & DCTCP | • [DCTCP (2010)](articles/README.md#alizadeh-et-al-2010) | — |
| **4** | Lossless Ethernet & RDMA Transport | • [DCQCN (2015)](articles/README.md#zhu-et-al-2015)<br>• [TIMELY (2015)](articles/README.md#mittal-et-al-2015) | — |
| **5** | In-Network Load Balancing | • [FlowBender (2014)](articles/README.md#kabbani-et-al-2014)<br>• [WCMP (2014)](articles/README.md#zhou-et-al-2014)<br>• [CONGA (2014)](articles/README.md#alizadeh-et-al-2014) | — |
| **6** | AI Training Workloads & Dual-Plane Fabrics | • [Alibaba HPN (2024)](articles/README.md#fu-et-al-2024)<br>• [AI Load Balancing](articles/README.md#load-balancing-for-ai-training-workloads-slide-deck) | — |
| **7** | Collective Communications (AllReduce/NCCL) | • [Collectives Slide Deck](articles/README.md#collectives-slide-deck) | — |
| **8** | Distributed LLM Clusters & Scale | • [Megatron-LM (2021)](articles/README.md#narayanan-et-al-2021)<br>• [Meta RoCEv2 (2024)](articles/README.md#choudhury-et-al-2024) | — |
| **9** | Deadlocks & Buffer Management | • [Deadlocks in DCN (2021)](articles/README.md#gupta-et-al-2021) | — |
| **10** | Flat & Non-Clos Topologies | • [Random Regular Graphs / RNG (2024)](articles/README.md#zhao-et-al-2024) | — |

---

## Studying with AI: The "Sparring Partner" Method

Using AI for ready-made answers creates an illusion of competence that breaks down during class discussions, technical interviews, and exams. Instead, use AI to challenge your own understanding:

1. **Try first:** Inspect the paper's figures and form your own explanation before opening an AI prompt.
2. **Ask AI to challenge you (Sparring):** Paste your reading of a figure or mechanism and ask the AI:
   > *"Here is my interpretation of Figure X: [...]. Do not give me the answer. Point out flaws in my reasoning and ask me 2 tough questions to test whether I truly understand it."*
3. **Verify against the paper:** AI tools frequently hallucinate units, scales, and details (e.g. confusing KB with MB). **If the AI and the paper disagree, the paper wins.** Catching these discrepancies is where real learning happens.

---

## Exercises

| # | Topic | Folder | Tests |
|:---:|---|---|:---:|
| **HW1** | **$k$-ary Fat-Tree Generation, Link Failures & Bisection Bandwidth**<br>Constructing Clos topologies, modeling link degradation, and showing that failures reduce path diversity $(1-p)^4$ well before reachability drops. | [ex1/](ex1/README.md) | [![32 passed](https://img.shields.io/badge/pytest-32%20passed-success?style=flat-square)](ex1/test_fattree.py) |

---

## Articles & Literature

[`articles/`](articles/README.md) contains 17 research papers and presentation decks covering foundational and recent data center systems (2008–2024).

Each paper includes:
- Original PDF
- Audited Markdown transcription (`articles/markdown/`) with embedded figures
- Concise executive summary of the problem, technique, and key takeaway

---

## Lecture Notes

| Topic | Document | Description |
|:---:|---|---|
| **Topic 1** | [AI Factory Networking Overview (Hebrew)](articles/notes/topic1-podcast-ai-factory.md) | Audio and lecture companion notes covering AI factory networks, scale-up vs. scale-out, and InfiniBand vs. RoCEv2. |

---

## Setup

Requires Python 3.9+. All exercises share one virtual environment and `requirements.txt` in this folder:

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows (Linux/macOS: source .venv/bin/activate)
pip install -r requirements.txt
```

Run tests from exercise subdirectories:

```bash
cd ex1
python -m pytest test_fattree.py -v
```

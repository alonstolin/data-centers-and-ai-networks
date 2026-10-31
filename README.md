# Data Center Networks & AI (Course 361.2.2460)

[![Course](https://img.shields.io/badge/course-361.2.2460-blue?style=flat-square)](#)
[![Term](https://img.shields.io/badge/term-Semester%20A%202026-orange?style=flat-square)](#)
[![Python 3.9+](https://img.shields.io/badge/python-3.9+-3776AB.svg?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![Tests](https://img.shields.io/badge/pytest-32%20passed-success?style=flat-square&logo=pytest&logoColor=white)](ex1/test_fattree.py)
[![Papers](https://img.shields.io/badge/curated%20papers-17%20analyzed-informational?style=flat-square)](articles/README.md)

> Advanced graduate course covering modern data center interconnects, hyperscale Clos fabrics, lossless RDMA transports (RoCEv2, PFC, DCQCN), distributed congestion control, and networking architectures for generative AI and LLM training clusters.

---

## 🧭 Course Overview & Syllabus Roadmap

Modern data center networks are transitioning from general web request-response architectures to specialized, ultra-high-throughput fabrics powering distributed AI training (Megatron-LM, DeepSpeed, NCCL). This syllabus maps each core topic to its foundational literature, hands-on lab exercises, and companion notes:

| Unit | Topic | Foundational Papers & Decks | Labs & Notes |
|:---:|---|---|:---:|
| **1** | **Clos Topologies & Fat-Trees** | • [Al-Fares Fat-Tree (2008)](articles/README.md#al-fares-et-al-2008)<br>• [VL2 (2009)](articles/README.md#greenberg-et-al-2009)<br>• [Jupiter Rising (2015)](articles/README.md#singh-et-al-2015) | [HW1: Fat-Tree Sim](ex1/README.md)<br>[Topic 1 Notes](articles/notes/topic1-podcast-ai-factory.md) |
| **2** | **Traffic Characteristics in the Wild** | • [Kandula et al. (2009)](articles/README.md#kandula-et-al-2009) | — |
| **3** | **Ultra-Low-Latency Transport & DCTCP** | • [DCTCP (2010)](articles/README.md#alizadeh-et-al-2010) | — |
| **4** | **Lossless Ethernet & RDMA Transport** | • [DCQCN (2015)](articles/README.md#zhu-et-al-2015)<br>• [TIMELY (2015)](articles/README.md#mittal-et-al-2015) | — |
| **5** | **In-Network Load Balancing** | • [FlowBender (2014)](articles/README.md#kabbani-et-al-2014)<br>• [WCMP (2014)](articles/README.md#zhou-et-al-2014)<br>• [CONGA (2014)](articles/README.md#alizadeh-et-al-2014) | — |
| **6** | **AI Training Workloads & Dual-Plane Fabrics** | • [Alibaba HPN (2024)](articles/README.md#al-fares-et-al-2008)<br>• [AI Load Balancing](articles/README.md#load-balancing-for-ai-training-workloads-slide-deck) | — |
| **7** | **Collective Communications (AllReduce/NCCL)** | • [Collectives Slide Deck](articles/README.md#collectives-slide-deck) | — |
| **8** | **Distributed LLM Clusters & Scale** | • [Megatron-LM (2021)](articles/README.md#narayanan-et-al-2021)<br>• [Meta RoCEv2 (2024)](articles/README.md#choudhury-et-al-2024) | — |
| **9** | **Deadlocks & Buffer Management** | • [Deadlocks in DCN (2021)](articles/README.md#gupta-et-al-2021) | — |
| **10** | **Flat & Non-Clos Topologies** | • [Random Regular Graphs / RNG (2024)](articles/README.md#zhao-et-al-2024) | — |

---

## 🥊 Studying with AI: The "Sparring Partner" Method

> [!IMPORTANT]
> Relying on AI for ready-made answers creates an illusion of competence that quickly collapses during technical interviews, oral exams, and production debugging. 

To build deep systems intuition, treat the AI model strictly as a **Sparring Partner**:

1. **Formulate First:** Inspect the paper's architectural diagrams, topology graphs, and packet flows. Write down your own interpretation before prompting an AI model.
2. **Invite Counter-Attacks (Sparring):** Provide your summary and instruct the model to attack your logic:
   > *"Here is my reading of Figure 4 in the VL2 paper: [...]. Do not give me the correct answer. Challenge my assumptions, point out edge cases, and ask me 2 tough questions to test my understanding."*
3. **Audit Against Ground Truth:** AI models frequently hallucinate units, link speeds, and buffer thresholds (e.g., claiming 100 KB instead of 100 MB).
   > [!CAUTION]
   > **If the AI and the paper disagree, the paper always wins.** Uncovering and explaining these discrepancies is where genuine mastery happens.

---

## 💻 Course Exercises

| # | Topic | Folder | Test Status |
|:---:|---|---|:---:|
| **HW1** | **$k$-ary Fat-Tree Generation, Link-Failure Degradation & Bisection Bandwidth**<br>Simulating large-scale Clos switches, evaluating failure resilience, and proving that link failures degrade capacity $(1-p)^4$ well before reachability drops. | [ex1/](ex1/README.md) | [![32 passed](https://img.shields.io/badge/pytest-32%20passed-success?style=flat-square)](ex1/test_fattree.py) |

---

## 📖 Research Articles & Literature

The [`articles/`](articles/README.md) directory contains an audited, comprehensive literature base:
- **17 Research Papers & Presentations** covering 2008–2024 breakthrough systems.
- **Dual Format:** Original archival PDFs alongside fully audited Markdown versions (`articles/markdown/`) with embedded vector graphics and math rendering.
- **One-Paragraph Summaries:** Each paper includes a concise executive summary highlighting its problem statement, core insight, and impact.

---

## 📝 Lecture Notes

| Topic | Document | Focus |
|:---:|---|---|
| **Topic 1** | [AI Factory Networking Overview (Hebrew)](articles/notes/topic1-podcast-ai-factory.md) | Audio/lecture deep dive into scale-up vs. scale-out, InfiniBand vs. RoCEv2, and AI fabric design. |

---

## 🛠️ Environment Setup

All exercises in this course share a unified virtual environment and dependency specification:

```bash
# 1. Navigate to the course root directory
cd courses/data-centers-and-ai-networks

# 2. Create Python virtual environment (Python 3.9+)
python -m venv .venv

# 3. Activate the environment
# Windows (PowerShell / CMD):
.venv\Scripts\activate
# Linux / macOS:
source .venv/bin/activate

# 4. Install dependencies
pip install -r requirements.txt
```

### Run Unit Tests
```bash
python -m pytest ex1/test_fattree.py -v
```

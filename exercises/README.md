# Exercises

Homework exercises for this course. Each exercise is self-contained in its own folder, and all of them share one virtual environment and one `requirements.txt` in this folder.

| # | Topic | Folder |
|:---:|---|---|
| **HW1** | **$k$-ary Fat-Tree Generation, Link Failures & Bisection Bandwidth**<br>Constructing Clos topologies, modeling link degradation, and showing that failures reduce path diversity $(1-p)^4$ well before reachability drops. | [ex1/](ex1/README.md) |

---

## Setup

Requires Python 3.9+. Run once from this folder:

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows (Linux/macOS: source .venv/bin/activate)
pip install -r requirements.txt
```

Run tests from the exercise subdirectory:

```bash
cd ex1
python -m pytest test_fattree.py -v
```

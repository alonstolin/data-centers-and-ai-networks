# Data Center Networks & AI

Course 361.2.2460, Semester A 2026.

## Studying with AI: The "Sparring Partner" Method

Using AI for ready-made answers creates an illusion of competence that breaks down during class discussions and exams. Instead, use AI to challenge your own understanding:

1. **Try first:** Inspect the paper's figures and form your own explanation before opening an AI prompt.
2. **Ask AI to challenge you (Sparring):** Paste your reading of a figure/mechanism and ask the AI:
   > *"Here is my interpretation of Figure X: [...]. Do not give me the answer. Point out flaws in my reasoning and ask me 2 tough questions to test whether I truly understand it."*
3. **Verify against the paper:** AI tools frequently hallucinate units, scales, and details (e.g., confusing KB with MB). **If the AI and the paper disagree, the paper wins.** Catching these discrepancies is where real learning happens.

## Notes

| Topic | File |
|---|---|
| 1 | [AI factory networking overview (Hebrew)](articles/notes/topic1-podcast-ai-factory.md) |

## Articles

[articles/](articles/README.md) has one-paragraph summaries of each paper and the lecture slides, grouped by theme, with direct links to both original PDFs and audited Markdown conversions (`.md`) with embedded high-resolution figures.

## Exercises

| # | Topic | Folder |
|---|---|---|
| 1 | Fat-tree topology generation and analysis | [ex1/](ex1/README.md) |

## Setup

Requires Python 3.9+. All exercises share one virtual environment and `requirements.txt` in this folder:

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows (Linux/macOS: source .venv/bin/activate)
pip install -r requirements.txt
```

Then follow the README inside each exercise folder.

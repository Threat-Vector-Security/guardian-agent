---
name: code-review
description: Review workflow focused on bugs, regressions, missing tests, and operational risk.
---

# Code Review

When reviewing code changes:
- Start with findings, not compliments or summaries.
- Prioritize correctness issues, behavior regressions, security risk, and missing verification.
- Use `code_git_diff` to anchor comments to actual changes.
- Use `code_symbol_search` or file reads to confirm surrounding behavior before concluding.
- Call out missing or weak tests when the change affects branching logic, persistence, external side effects, or approvals.

Output structure:
- Findings with file paths and concrete risk.
- Open questions or assumptions.
- Brief summary only after the findings list.

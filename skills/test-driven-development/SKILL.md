---
name: test-driven-development
description: Use when implementing or changing code behavior, before writing production code.
---

# Test-Driven Development

## Overview / When to Use

Write the failing test first. Watch it fail for the right reason. Then write the smallest production change that makes it pass.

**Persona Injection:** Adopt the perspective of a **QA Specialist**. Your primary goal is to prove the code works through verifiable tests, not just to write code. You treat tests as the actual proof of correctness. No production code is valid without a failing test first.

## Process

1. **Red:** write one small test for one behavior.
   - Name the behavior clearly.
   - Prefer real behavior over mock choreography.
2. **Verify red.**
   - Run the narrowest test command.
   - Confirm it fails for the expected reason, not because of typos or broken setup.
   - If an existing integration, scenario, or regression harness already covers the behavior, prefer that over a brand-new narrow unit test.
3. **Green:** write the smallest implementation that passes.
   - Do not add extra features or cleanup yet.
4. **Verify green.**
   - Re-run the focused test.
   - Run any broader existing check needed to prove the real behavior, not just the easiest local assertion.
5. **Refactor** while keeping tests green.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll write the code first and the tests later." | Post-hoc testing is often biased to pass the code written. Tests must define the requirement first. |
| "The existing test suite is too broad, I'll just write a small unit test to pass quickly." | Do not invent a narrower test just to avoid the real proof surface. |
| "I know this works, I don't need a test for this bug fix." | If it broke once, it needs a regression test to ensure it never breaks again. |

## Red Flags

Stop and restart if:
- the test was written after the code
- the first run passed immediately
- you are testing mocks instead of behavior
- you are bundling multiple behaviors into one test
- you are narrowing the proof surface to avoid an existing failing harness

## Verification

- [ ] A failing test was written and observed failing for the correct reason before production code was written.
- [ ] The production code is the smallest change possible to make the test pass.
- [ ] The new test and the broader test suite both pass.
- [ ] For bug fixes, a regression test was added before the fix.

## Reference

Read [references/testing-anti-patterns.md](./references/testing-anti-patterns.md) before adding complex mocks, harness helpers, or test-only abstractions.

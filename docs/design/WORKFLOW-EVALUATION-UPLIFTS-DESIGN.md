# Workflow Evaluation Uplifts Design

**Status:** Implemented baseline  
**Primary Files:** `src/eval/types.ts`, `src/eval/metrics.ts`, `src/eval/runner.ts`, `src/eval/metrics.test.ts`

## Goal

Extend eval coverage from prompt/output checks into workflow-shape and evidence-grounding checks.

Before this uplift, Guardian evals were strongest at:
- content assertions
- tool trajectory checks
- metadata matching
- safety assertions

That left a gap for orchestration quality and grounded-output expectations.

## Implemented Expectations

### Workflow Expectations

`EvalExpected.workflow` now supports:
- `orchestration`
- `branchSelected`
- `minCompletedSteps`
- `maxFailedSteps`
- `requireStateKeys`

These assertions validate runtime metadata rather than only raw text.

### Evidence Expectations

`EvalExpected.evidence` now supports:
- `minCitations`
- `minEvidenceItems`
- `requireUrls`
- `requireCitationMentionsInContent`

These assertions let tests verify that outputs are actually grounded when a workflow is supposed to be evidence-backed.

## Benefits

- Better coverage for multi-step assistant behavior
- Regression detection for orchestration metadata drift
- Grounded-output checks without requiring a full LLM-as-judge stack
- Clearer path to evaluating role-separated workflows and evidence-backed reporting

## Implementation Notes

- Metrics are additive and optional; older suites remain valid
- Assertions are deterministic and metadata-driven
- The runner evaluates workflow and evidence expectations alongside existing content/trajectory/safety checks

## Current Boundaries

- No semantic judge or claim-level reasoning quality score yet
- No automatic handoff-quality grader yet
- Eval quality still depends on the runtime surfacing the relevant metadata

## Verification

- `src/eval/metrics.test.ts`

from __future__ import annotations

import json
import os
import sys
from dataclasses import asdict
from pathlib import Path


def main() -> int:
    config_path = Path(sys.argv[1])
    cfg = json.loads(config_path.read_text(encoding="utf-8"))
    llmmap_root = cfg["llmmap_root"]
    if llmmap_root not in sys.path:
        sys.path.insert(0, llmmap_root)

    from llmmap.config import RuntimeConfig
    from llmmap.core.run import create_run_workspace
    from llmmap.core.scanner import run_scan
    from llmmap.reporting.writer import write_markdown_report, write_scan_report

    runtime = RuntimeConfig(
        mode=cfg["mode"],
        enabled_stages=("stage1",),
        target_url=None,
        run_root=Path(cfg["output_dir"]),
        request_file=Path(cfg["request_file"]),
        method=None,
        param_filter=tuple(),
        headers=tuple(),
        cookies=tuple(),
        data=None,
        marker="*",
        injection_points="B",
        scheme="http",
        timeout_seconds=float(cfg["timeout_seconds"]),
        retries=int(cfg["retries"]),
        proxy=None,
        verify_ssl=False,
        prompt_dir=None,
        prompt_stage="stage1",
        prompt_families=tuple(cfg.get("prompt_families", [])),
        prompt_tags=tuple(),
        max_prompts=int(cfg["max_prompts"]),
        detector_threshold=float(cfg["detector_threshold"]),
        fp_suppression=True,
        reliability_retries=int(cfg["reliability_retries"]),
        confirm_threshold=int(cfg["confirm_threshold"]),
        match_regex=tuple(),
        match_keywords=tuple(),
        secret_hints=tuple(),
        temperature_sweep=tuple(),
        repro_check=False,
        oob_provider="none",
        interactsh_client_path="interactsh-client",
        interactsh_server=None,
        interactsh_token=None,
        oob_wait_seconds=10.0,
        oob_poll_interval=5,
        mutation_profile="baseline",
        mutation_max_variants=6,
        context_feedback=False,
        pivot_attacks=False,
        interactive=False,
        local_generator=None,
        canary_listener=False,
        canary_listener_host="127.0.0.1",
        canary_listener_port=8787,
        intensity=int(cfg["intensity"]),
        threads=int(cfg["threads"]),
        semantic_use_provider=False,
        operator_id="guardian-llmmap-harness",
        retention_days=0,
        purge_old_runs=False,
        ignore_code=tuple(),
        goal=cfg["goal"],
        llm_provider="ollama",
        llm_model=cfg["ollama_model"],
        llm_api_key=None,
        llm_base_url=cfg["ollama_base_url"],
        callback_url=None,
        data_flow=False,
    )

    run_dir = create_run_workspace(runtime)
    report = run_scan(runtime, run_dir)
    json_report = run_dir / "scan-report.json"
    markdown_report = run_dir / "scan-report.md"
    write_scan_report(json_report, report)
    write_markdown_report(markdown_report, report)

    result = {
        "status": report.status,
        "mode": report.mode,
        "run_dir": str(run_dir),
        "target_url": report.target_url,
        "finding_count": len(report.findings),
        "evidence_count": len(report.evidence),
        "stage_results": [asdict(item) for item in report.stage_results],
        "findings": [asdict(item) for item in report.findings],
        "json_report": str(json_report),
        "markdown_report": str(markdown_report),
    }
    Path(cfg["result_file"]).write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

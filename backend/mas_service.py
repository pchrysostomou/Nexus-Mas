from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

HOST = "127.0.0.1"
PORT = int(os.environ.get("MAS_BACKEND_PORT", "5055"))
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5-coder:latest")
DATA_DIR = Path(__file__).resolve().parent / "data"
LOG_PATH = DATA_DIR / "agent_logs.jsonl"
RUNS_DIR = DATA_DIR / "runs"
BUILD_STAGE_DIR = DATA_DIR / "build_stage"
APPLY_STAGE_DIR = DATA_DIR / "apply_stage"
SELF_TEST_DIR = DATA_DIR / "self_tests"
LATEST_RUN_PATH = DATA_DIR / "latest_run_id.txt"
LATEST_PROPOSAL_PATH = DATA_DIR / "latest_proposal_id.txt"
LATEST_APPLY_PLAN_PATH = DATA_DIR / "latest_apply_plan_id.txt"
LATEST_SELF_TEST_PATH = DATA_DIR / "latest_self_test_id.txt"
WORKSPACE_ROOT = Path(os.environ.get("MAS_WORKSPACE_ROOT", Path(__file__).resolve().parents[1])).resolve()
APPLY_STAGE_SOURCE_PATH = WORKSPACE_ROOT / "lib" / "generated" / "masApplyStage.ts"
SELF_TEST_COMMAND = (
    "Run a full local MAS self-test: assign all six agents one verification job, "
    "execute the safe local tools, store proof in the ledger, approve the build gate, "
    "apply the controlled stage, and report whether the dashboard is ready."
)


def write_log(event: dict[str, Any]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    event["timestamp"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    with LOG_PATH.open("a", encoding="utf-8") as file:
        file.write(json.dumps(event, ensure_ascii=False) + "\n")


def read_recent_logs(limit: int = 80) -> list[dict[str, Any]]:
    if not LOG_PATH.exists():
        return []

    lines = LOG_PATH.read_text(encoding="utf-8").splitlines()[-limit:]
    logs: list[dict[str, Any]] = []
    for line in lines:
        try:
            logs.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return logs


def call_ollama(prompt: str, timeout: int = 35) -> str | None:
    body = json.dumps(
        {
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {"num_predict": 440, "temperature": 0.35, "top_p": 0.85},
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        f"{OLLAMA_HOST}/api/generate",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
            return payload.get("response")
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return None


def ollama_models() -> list[str]:
    try:
        with urllib.request.urlopen(f"{OLLAMA_HOST}/api/tags", timeout=3) as response:
            payload = json.loads(response.read().decode("utf-8"))
            return [model.get("name") or model.get("model") for model in payload.get("models", []) if model]
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return []


def build_prompt(command: str, agents: list[dict[str, Any]]) -> str:
    return "\n".join(
        [
            "You are a local Python MAS orchestrator.",
            "Convert the user command into concrete work packets for available agents.",
            "Return only valid compact JSON in this shape:",
            '{"command":"string","summary":"string","assignments":[{"agentId":"string","task":"string","priority":"low|medium|high","expectedOutput":"string","logs":["string","string","string"]}]}',
            "Use only listed agent ids. Keep task text practical and visible in a dashboard.",
            f"Available agents: {json.dumps(agents, ensure_ascii=False)}",
            f"User command: {command}",
        ]
    )


def fallback_plan(command: str, agents: list[dict[str, Any]]) -> dict[str, Any]:
    by_id = {agent.get("id"): agent for agent in agents}
    preferred_ids = [
        agent_id
        for agent_id in ["researcher", "designer", "analyst", "builder", "qa", "security"]
        if agent_id in by_id
    ]
    selected_ids = preferred_ids or [agent.get("id") for agent in agents[:4]]
    templates = {
        "researcher": ("Research objective and collect local context", "Research brief", "high"),
        "designer": ("Design the factory room interaction and visual state", "Design notes", "medium"),
        "analyst": ("Correlate live ledger metrics and task priority", "Priority map", "medium"),
        "builder": ("Prepare implementation steps for the requested change", "Build checklist", "medium"),
        "qa": ("Validate the result and report broken flows", "QA report", "high"),
        "security": ("Check local-only execution boundaries and endpoint safety", "Safety note", "medium"),
    }

    assignments = []
    for agent_id in selected_ids:
        task, output, priority = templates.get(agent_id, ("Process commander objective", "Agent report", "medium"))
        assignments.append(
            {
                "agentId": agent_id,
                "task": f"{task}: {command[:56]}",
                "priority": priority,
                "expectedOutput": output,
                "logs": [
                    "python orchestrator accepted command",
                    "allocating local work packet",
                    "writing execution log to local memory",
                ],
            }
        )

    return {"command": command, "summary": "Python MAS assigned local work packets.", "assignments": assignments}


def parse_plan(response_text: str | None, command: str, agents: list[dict[str, Any]]) -> dict[str, Any]:
    if not response_text:
        return fallback_plan(command, agents)

    valid_ids = {agent.get("id") for agent in agents}
    try:
        parsed = json.loads(response_text)
        assignments = []
        for assignment in parsed.get("assignments", [])[:6]:
            agent_id = assignment.get("agentId")
            if agent_id not in valid_ids:
                continue
            assignments.append(
                {
                    "agentId": agent_id,
                    "task": assignment.get("task") or "Review commander request",
                    "priority": assignment.get("priority") or "medium",
                    "expectedOutput": assignment.get("expectedOutput") or "Agent report",
                    "logs": [line for line in assignment.get("logs", []) if line][:4],
                }
            )
        if assignments:
            return {
                "command": command,
                "summary": parsed.get("summary") or "Python MAS assigned work packets.",
                "assignments": assignments,
            }
    except json.JSONDecodeError:
        pass

    return fallback_plan(command, agents)


def default_self_test_agents() -> list[dict[str, Any]]:
    return [
        {
            "id": "researcher",
            "name": "Researcher",
            "role": "research",
            "task": "Index workspace context and prove the repo is visible.",
            "status": "idle",
        },
        {
            "id": "designer",
            "name": "Designer",
            "role": "design",
            "task": "Audit realistic agent room assets.",
            "status": "idle",
        },
        {
            "id": "analyst",
            "name": "Analyst",
            "role": "analysis",
            "task": "Measure ledger activity for the self-test run.",
            "status": "idle",
        },
        {
            "id": "builder",
            "name": "Builder",
            "role": "build",
            "task": "Run the TypeScript noEmit check.",
            "status": "idle",
        },
        {
            "id": "qa",
            "name": "QA Sentinel",
            "role": "qa",
            "task": "Smoke-test local endpoints.",
            "status": "idle",
        },
        {
            "id": "security",
            "name": "Security",
            "role": "security",
            "task": "Confirm local-only execution boundaries.",
            "status": "idle",
        },
    ]


def compact_text(value: str, limit: int = 150) -> str:
    normalized = " ".join(value.split())
    if len(normalized) <= limit:
        return normalized
    return f"{normalized[: limit - 3]}..."


def workspace_files(limit: int = 3000) -> list[Path]:
    ignored = {".git", ".next", "node_modules", "dist", "coverage", "__pycache__"}
    files: list[Path] = []
    for path in WORKSPACE_ROOT.rglob("*"):
        if any(part in ignored for part in path.relative_to(WORKSPACE_ROOT).parts):
            continue
        if path.is_file():
            files.append(path)
        if len(files) >= limit:
            break
    return files


def tool_repo_scan(_command: str, _assignment: dict[str, Any], _run_id: str) -> dict[str, Any]:
    files = workspace_files()
    components = [path for path in files if "components" in path.relative_to(WORKSPACE_ROOT).parts and path.suffix in {".tsx", ".ts"}]
    api_routes = [path for path in files if path.name == "route.ts"]
    assets = [path for path in files if "public" in path.relative_to(WORKSPACE_ROOT).parts and path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}]
    details = [
        f"{len(components)} React component files",
        f"{len(api_routes)} Next API routes",
        f"{len(assets)} visual assets",
    ]
    return {
        "tool": "repo_scan",
        "ok": True,
        "summary": f"Indexed {len(files)} workspace files; {details[0]}, {details[1]}, {details[2]}.",
        "details": details,
    }


def tool_visual_asset_audit(_command: str, _assignment: dict[str, Any], _run_id: str) -> dict[str, Any]:
    room_dir = WORKSPACE_ROOT / "public" / "assets" / "agent-rooms"
    room_files = sorted(room_dir.glob("*.png")) if room_dir.exists() else []
    sizes = [f"{path.stem}:{max(1, path.stat().st_size // 1024)}KB" for path in room_files]
    expected = {"researcher", "designer", "analyst", "builder", "qa", "security"}
    present = {path.stem for path in room_files}
    missing = sorted(expected - present)
    ok = not missing
    summary = f"Verified {len(room_files)}/6 realistic room images."
    if missing:
        summary = f"Missing room images: {', '.join(missing)}."
    return {
        "tool": "visual_asset_audit",
        "ok": ok,
        "summary": summary,
        "details": sizes[:6],
    }


def tool_ledger_metrics(_command: str, _assignment: dict[str, Any], run_id: str) -> dict[str, Any]:
    run_events = [event for event in read_recent_logs(1000) if event.get("runId") == run_id]
    counts: dict[str, int] = {}
    for event in run_events:
        event_type = str(event.get("type", "event"))
        counts[event_type] = counts.get(event_type, 0) + 1
    details = [f"{event_type}:{count}" for event_type, count in sorted(counts.items())]
    return {
        "tool": "ledger_metrics",
        "ok": bool(run_events),
        "summary": f"Measured {len(run_events)} events for the active run.",
        "details": details,
    }


def tool_typecheck(_command: str, _assignment: dict[str, Any], _run_id: str) -> dict[str, Any]:
    npm = shutil.which("npm.cmd") or shutil.which("npm")
    if not npm:
        return {
            "tool": "typecheck",
            "ok": False,
            "summary": "npm was not found in PATH; TypeScript check could not run.",
            "details": [],
        }

    try:
        result = subprocess.run(
            [npm, "exec", "tsc", "--", "--noEmit"],
            cwd=WORKSPACE_ROOT,
            capture_output=True,
            check=False,
            shell=False,
            text=True,
            timeout=22,
        )
    except subprocess.TimeoutExpired:
        return {
            "tool": "typecheck",
            "ok": False,
            "summary": "TypeScript noEmit check timed out after 22 seconds.",
            "details": [],
        }

    output = compact_text(result.stdout or result.stderr or "no compiler output", 220)
    ok = result.returncode == 0
    summary = "TypeScript noEmit passed." if ok else f"TypeScript noEmit failed with exit {result.returncode}."
    return {
        "tool": "typecheck",
        "ok": ok,
        "summary": summary,
        "exitCode": result.returncode,
        "details": [output],
    }


def tool_endpoint_smoke(_command: str, _assignment: dict[str, Any], _run_id: str) -> dict[str, Any]:
    endpoints = [
        ("python-mas", f"http://{HOST}:{PORT}/health"),
        ("ollama", f"{OLLAMA_HOST}/api/tags"),
    ]
    details = []
    online = 0
    for label, url in endpoints:
        try:
            with urllib.request.urlopen(url, timeout=4) as response:
                ok = 200 <= response.status < 300
                online += 1 if ok else 0
                details.append(f"{label}:{response.status}")
        except (urllib.error.URLError, TimeoutError):
            details.append(f"{label}:offline")
    return {
        "tool": "endpoint_smoke",
        "ok": online == len(endpoints),
        "summary": f"{online}/{len(endpoints)} local endpoints responded.",
        "details": details,
    }


def tool_local_safety_audit(_command: str, _assignment: dict[str, Any], _run_id: str) -> dict[str, Any]:
    local_hosts = ("http://localhost", "http://127.0.0.1")
    ollama_local = OLLAMA_HOST.startswith(local_hosts)
    backend_local = HOST in {"127.0.0.1", "localhost"}
    workspace_ok = str(WORKSPACE_ROOT).lower().startswith(str(Path(__file__).resolve().parents[1]).lower())
    ok = ollama_local and backend_local and workspace_ok
    details = [
        f"ollamaLocal:{ollama_local}",
        f"backendHost:{HOST}",
        f"workspace:{WORKSPACE_ROOT}",
    ]
    return {
        "tool": "local_safety_audit",
        "ok": ok,
        "summary": "Local-only execution boundaries verified." if ok else "Local boundary audit found a configuration warning.",
        "details": details,
    }


TOOL_BY_AGENT = {
    "researcher": tool_repo_scan,
    "designer": tool_visual_asset_audit,
    "analyst": tool_ledger_metrics,
    "builder": tool_typecheck,
    "qa": tool_endpoint_smoke,
    "security": tool_local_safety_audit,
}


def run_agent_tool(command: str, assignment: dict[str, Any], run_id: str) -> dict[str, Any]:
    agent_id = str(assignment.get("agentId", ""))
    tool = TOOL_BY_AGENT.get(agent_id, tool_repo_scan)
    tool_name = tool.__name__.replace("tool_", "")
    write_log(
        {
            "type": "tool_start",
            "command": command,
            "runId": run_id,
            "agentId": agent_id,
            "task": assignment.get("task"),
            "tool": tool_name,
        }
    )
    started = time.perf_counter()
    try:
        result = tool(command, assignment, run_id)
    except Exception as exc:  # noqa: BLE001 - tool failures must be logged, not crash the MAS route.
        result = {
            "tool": tool_name,
            "ok": False,
            "summary": f"Tool crashed safely: {type(exc).__name__}",
            "details": [compact_text(str(exc), 180)],
        }

    duration_ms = int((time.perf_counter() - started) * 1000)
    result = {
        "tool": result.get("tool", tool_name),
        "ok": bool(result.get("ok")),
        "summary": compact_text(str(result.get("summary", "Tool completed.")), 220),
        "durationMs": duration_ms,
        "exitCode": result.get("exitCode"),
        "details": result.get("details", []),
    }
    write_log(
        {
            "type": "tool_result",
            "command": command,
            "runId": run_id,
            "agentId": agent_id,
            "task": assignment.get("task"),
            **result,
        }
    )
    return result


def build_run_report(command: str, plan: dict[str, Any], executed_assignments: list[dict[str, Any]], run_id: str) -> dict[str, Any]:
    created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    agent_reports = []
    ok_count = 0

    for assignment in executed_assignments:
        tool = assignment.get("tool") or {}
        ok = bool(tool.get("ok"))
        ok_count += 1 if ok else 0
        agent_reports.append(
            {
                "agentId": assignment.get("agentId"),
                "task": assignment.get("task"),
                "priority": assignment.get("priority"),
                "expectedOutput": assignment.get("expectedOutput"),
                "tool": tool.get("tool"),
                "ok": ok,
                "summary": tool.get("summary", "No tool proof recorded."),
                "durationMs": tool.get("durationMs"),
                "exitCode": tool.get("exitCode"),
                "details": tool.get("details", []),
            }
        )

    all_ok = ok_count == len(executed_assignments) and bool(executed_assignments)
    status = "ready" if all_ok else "needs_review"
    report = {
        "runId": run_id,
        "createdAt": created_at,
        "command": command,
        "summary": plan.get("summary", "Python MAS assigned local work packets."),
        "status": status,
        "checksPassed": ok_count,
        "checksTotal": len(executed_assignments),
        "agentReports": agent_reports,
        "nextStep": "Ready for approved build-stage work." if all_ok else "Review warning outputs before build-stage work.",
    }
    return report


def report_to_markdown(report: dict[str, Any]) -> str:
    lines = [
        f"# Nexus MAS Run Report",
        "",
        f"- Run: `{report.get('runId', 'unknown')}`",
        f"- Created: `{report.get('createdAt', 'unknown')}`",
        f"- Status: `{report.get('status', 'unknown')}`",
        f"- Checks: `{report.get('checksPassed', 0)}/{report.get('checksTotal', 0)}`",
        "",
        "## Command",
        "",
        str(report.get("command", "")),
        "",
        "## Agent Results",
        "",
    ]

    for item in report.get("agentReports", []):
        status = "OK" if item.get("ok") else "WARN"
        lines.extend(
            [
                f"### {item.get('agentId', 'agent')} - {status}",
                "",
                f"- Tool: `{item.get('tool', 'unknown')}`",
                f"- Output: {item.get('expectedOutput', 'Agent report')}",
                f"- Summary: {item.get('summary', 'No summary')}",
            ]
        )
        details = item.get("details", [])
        if details:
            lines.append("- Details:")
            for detail in details[:8]:
                lines.append(f"  - {detail}")
        lines.append("")

    lines.extend(["## Next Step", "", str(report.get("nextStep", "Review report.")), ""])
    return "\n".join(lines)


def write_run_report(report: dict[str, Any]) -> dict[str, Any]:
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    run_id = str(report.get("runId", "run-unknown"))
    json_path = RUNS_DIR / f"{run_id}.json"
    markdown_path = RUNS_DIR / f"{run_id}.md"
    report_with_artifacts = {
        **report,
        "artifacts": {
            "json": str(json_path),
            "markdown": str(markdown_path),
        },
    }
    json_path.write_text(json.dumps(report_with_artifacts, ensure_ascii=False, indent=2), encoding="utf-8")
    markdown_path.write_text(report_to_markdown(report_with_artifacts), encoding="utf-8")
    LATEST_RUN_PATH.write_text(run_id, encoding="utf-8")
    return report_with_artifacts


def read_run_report(run_id: str) -> dict[str, Any] | None:
    if not run_id:
        return None

    report_path = (RUNS_DIR / f"{run_id}.json").resolve()
    if not str(report_path).startswith(str(RUNS_DIR.resolve())) or not report_path.exists():
        return None

    try:
        return json.loads(report_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def read_latest_report() -> dict[str, Any] | None:
    if not LATEST_RUN_PATH.exists():
        return None
    return read_run_report(LATEST_RUN_PATH.read_text(encoding="utf-8").strip())


def build_stage_work_items(report: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {
            "agentId": "researcher",
            "title": "Map implementation scope",
            "targetFiles": ["backend/mas_service.py", "components/AgentDashboard.tsx"],
            "proofRequired": "Repository scan must stay green before patch application.",
        },
        {
            "agentId": "designer",
            "title": "Protect dashboard visual quality",
            "targetFiles": ["components/RunReportPanel.tsx", "components/BuildStagePanel.tsx"],
            "proofRequired": "Room assets and dashboard panels must remain readable.",
        },
        {
            "agentId": "builder",
            "title": "Apply approved implementation patch",
            "targetFiles": ["backend/mas_service.py", "app/api/agents/build-stage/route.ts"],
            "proofRequired": "TypeScript noEmit and Python compile must pass.",
        },
        {
            "agentId": "qa",
            "title": "Run endpoint smoke after patch",
            "targetFiles": ["app/api/agents/state/route.ts", "app/api/agents/report/route.ts"],
            "proofRequired": "Python MAS and Ollama endpoints must respond.",
        },
        {
            "agentId": "security",
            "title": "Enforce local-only execution boundary",
            "targetFiles": ["backend/mas_service.py"],
            "proofRequired": "No arbitrary prompt-to-shell execution without explicit approval.",
        },
    ]


def build_stage_proposal_to_markdown(proposal: dict[str, Any]) -> str:
    lines = [
        "# Nexus MAS Build Stage Proposal",
        "",
        f"- Proposal: `{proposal.get('proposalId', 'unknown')}`",
        f"- Source run: `{proposal.get('sourceRunId', 'unknown')}`",
        f"- Created: `{proposal.get('createdAt', 'unknown')}`",
        f"- Status: `{proposal.get('status', 'unknown')}`",
        f"- Readiness: `{proposal.get('readiness', 'unknown')}`",
        "",
        "## Summary",
        "",
        str(proposal.get("summary", "")),
        "",
        "## Work Items",
        "",
    ]
    for item in proposal.get("workItems", []):
        lines.extend(
            [
                f"### {item.get('agentId', 'agent')}: {item.get('title', 'Work item')}",
                "",
                "- Target files:",
            ]
        )
        for target_file in item.get("targetFiles", []):
            lines.append(f"  - `{target_file}`")
        lines.extend(["", f"- Proof required: {item.get('proofRequired', 'Proof required')}", ""])

    lines.extend(["## Guardrails", ""])
    for guardrail in proposal.get("guardrails", []):
        lines.append(f"- {guardrail}")

    if proposal.get("approvedAt"):
        lines.extend(["", "## Approval", "", f"- Approved at: `{proposal.get('approvedAt')}`", f"- Approved by: `{proposal.get('approvedBy', 'commander')}`"])

    lines.append("")
    return "\n".join(lines)


def write_build_stage_proposal(proposal: dict[str, Any]) -> dict[str, Any]:
    BUILD_STAGE_DIR.mkdir(parents=True, exist_ok=True)
    proposal_id = str(proposal.get("proposalId", "proposal-unknown"))
    json_path = BUILD_STAGE_DIR / f"{proposal_id}.json"
    markdown_path = BUILD_STAGE_DIR / f"{proposal_id}.md"
    proposal_with_artifacts = {
        **proposal,
        "artifacts": {
            "json": str(json_path),
            "markdown": str(markdown_path),
        },
    }
    json_path.write_text(json.dumps(proposal_with_artifacts, ensure_ascii=False, indent=2), encoding="utf-8")
    markdown_path.write_text(build_stage_proposal_to_markdown(proposal_with_artifacts), encoding="utf-8")
    LATEST_PROPOSAL_PATH.write_text(proposal_id, encoding="utf-8")
    return proposal_with_artifacts


def read_build_stage_proposal(proposal_id: str) -> dict[str, Any] | None:
    if not proposal_id:
        return None

    proposal_path = (BUILD_STAGE_DIR / f"{proposal_id}.json").resolve()
    if not str(proposal_path).startswith(str(BUILD_STAGE_DIR.resolve())) or not proposal_path.exists():
        return None

    try:
        return json.loads(proposal_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def read_latest_build_stage_proposal() -> dict[str, Any] | None:
    if not LATEST_PROPOSAL_PATH.exists():
        return None
    return read_build_stage_proposal(LATEST_PROPOSAL_PATH.read_text(encoding="utf-8").strip())


def create_build_stage_proposal() -> dict[str, Any]:
    report = read_latest_report()
    created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    if not report:
        proposal = {
            "proposalId": f"proposal-{time.time_ns()}",
            "createdAt": created_at,
            "status": "blocked",
            "readiness": "missing_report",
            "summary": "No ready run report is available yet.",
            "sourceRunId": "",
            "workItems": [],
            "guardrails": ["Run a full MAS audit before build-stage approval."],
        }
        return write_build_stage_proposal(proposal)

    report_ready = report.get("status") == "ready" and report.get("checksPassed") == report.get("checksTotal")
    proposal = {
        "proposalId": f"proposal-{time.time_ns()}",
        "createdAt": created_at,
        "status": "proposed" if report_ready else "blocked",
        "readiness": "ready" if report_ready else "needs_review",
        "summary": "Build-stage proposal prepared from the latest verified MAS report.",
        "sourceRunId": report.get("runId", ""),
        "sourceReport": report.get("artifacts", {}),
        "checksPassed": report.get("checksPassed", 0),
        "checksTotal": report.get("checksTotal", 0),
        "workItems": build_stage_work_items(report),
        "guardrails": [
            "Apply no file changes until the proposal is explicitly approved.",
            "Keep execution local to the workspace and localhost services.",
            "Record every approved patch with an artifact and verification result.",
            "Run Python compile, TypeScript noEmit, and endpoint smoke checks after applying changes.",
        ],
    }
    return write_build_stage_proposal(proposal)


def approve_build_stage_proposal(approved_by: str = "commander") -> dict[str, Any]:
    proposal = read_latest_build_stage_proposal() or create_build_stage_proposal()
    approved_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    if proposal.get("status") not in {"proposed", "approved"}:
        return proposal

    approved = {
        **proposal,
        "status": "approved",
        "approvedAt": proposal.get("approvedAt") or approved_at,
        "approvedBy": approved_by,
        "nextStep": "Ready for controlled patch generation and apply-stage verification.",
    }
    write_log(
        {
            "type": "build_stage_approval",
            "command": "Approve latest build-stage proposal",
            "runId": approved.get("sourceRunId", ""),
            "proposalId": approved.get("proposalId"),
            "approvedBy": approved_by,
            "task": approved.get("summary"),
        }
    )
    return write_build_stage_proposal(approved)


def apply_plan_to_markdown(plan: dict[str, Any]) -> str:
    lines = [
        "# Nexus MAS Apply Stage Plan",
        "",
        f"- Plan: `{plan.get('applyPlanId', 'unknown')}`",
        f"- Proposal: `{plan.get('sourceProposalId', 'unknown')}`",
        f"- Created: `{plan.get('createdAt', 'unknown')}`",
        f"- Status: `{plan.get('status', 'unknown')}`",
        "",
        "## Summary",
        "",
        str(plan.get("summary", "")),
        "",
        "## Operations",
        "",
    ]
    for operation in plan.get("operations", []):
        lines.extend(
            [
                f"- `{operation.get('type', 'operation')}` `{operation.get('path', 'unknown')}`",
                f"  - {operation.get('reason', 'No reason recorded.')}",
            ]
        )

    checks = plan.get("verification", [])
    if checks:
        lines.extend(["", "## Verification", ""])
        for check in checks:
            status = "OK" if check.get("ok") else "WARN"
            lines.append(f"- {status} `{check.get('name', 'check')}`: {check.get('summary', '')}")

    artifacts = plan.get("artifacts", {})
    if artifacts:
        lines.extend(["", "## Artifacts", ""])
        for name, path in artifacts.items():
            lines.append(f"- {name}: `{path}`")

    lines.append("")
    return "\n".join(lines)


def write_apply_plan(plan: dict[str, Any]) -> dict[str, Any]:
    APPLY_STAGE_DIR.mkdir(parents=True, exist_ok=True)
    plan_id = str(plan.get("applyPlanId", "apply-unknown"))
    json_path = APPLY_STAGE_DIR / f"{plan_id}.json"
    markdown_path = APPLY_STAGE_DIR / f"{plan_id}.md"
    patch_path = APPLY_STAGE_DIR / f"{plan_id}.patch.txt"
    plan_with_artifacts = {
        **plan,
        "artifacts": {
            **plan.get("artifacts", {}),
            "json": str(json_path),
            "markdown": str(markdown_path),
            "patch": str(patch_path),
        },
    }
    json_path.write_text(json.dumps(plan_with_artifacts, ensure_ascii=False, indent=2), encoding="utf-8")
    markdown_path.write_text(apply_plan_to_markdown(plan_with_artifacts), encoding="utf-8")
    patch_path.write_text(str(plan_with_artifacts.get("patchPreview", "")), encoding="utf-8")
    LATEST_APPLY_PLAN_PATH.write_text(plan_id, encoding="utf-8")
    return plan_with_artifacts


def read_apply_plan(plan_id: str) -> dict[str, Any] | None:
    if not plan_id:
        return None

    plan_path = (APPLY_STAGE_DIR / f"{plan_id}.json").resolve()
    if not str(plan_path).startswith(str(APPLY_STAGE_DIR.resolve())) or not plan_path.exists():
        return None

    try:
        return json.loads(plan_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def read_latest_apply_plan() -> dict[str, Any] | None:
    if not LATEST_APPLY_PLAN_PATH.exists():
        return None
    return read_apply_plan(LATEST_APPLY_PLAN_PATH.read_text(encoding="utf-8").strip())


def generated_apply_stage_source(manifest: dict[str, Any]) -> str:
    manifest_json = json.dumps(manifest, ensure_ascii=False, indent=2)
    return "\n".join(
        [
            "export const masApplyStageStatus = " + manifest_json + " as const;",
            "",
            "export type MasApplyStageStatus = typeof masApplyStageStatus;",
            "",
        ]
    )


def build_patch_preview(relative_path: str, source: str) -> str:
    lines = ["*** Begin Generated Patch", f"*** Upsert File: {relative_path}"]
    lines.extend(f"+{line}" for line in source.splitlines())
    lines.append("*** End Generated Patch")
    lines.append("")
    return "\n".join(lines)


def create_apply_stage_plan() -> dict[str, Any]:
    proposal = read_latest_build_stage_proposal()
    created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    plan_id = f"apply-{time.time_ns()}"
    relative_path = APPLY_STAGE_SOURCE_PATH.relative_to(WORKSPACE_ROOT).as_posix()

    if not proposal or proposal.get("status") != "approved":
        plan = {
            "applyPlanId": plan_id,
            "createdAt": created_at,
            "status": "blocked",
            "summary": "No approved build-stage proposal is available.",
            "sourceProposalId": proposal.get("proposalId", "") if proposal else "",
            "operations": [],
            "verification": [],
            "patchPreview": "",
        }
        return write_apply_plan(plan)

    manifest = {
        "applyPlanId": plan_id,
        "sourceProposalId": proposal.get("proposalId"),
        "sourceRunId": proposal.get("sourceRunId"),
        "createdAt": created_at,
        "status": "planned",
        "approvedAt": proposal.get("approvedAt"),
        "workItems": proposal.get("workItems", []),
        "guardrails": proposal.get("guardrails", []),
    }
    source = generated_apply_stage_source(manifest)
    plan = {
        "applyPlanId": plan_id,
        "createdAt": created_at,
        "status": "planned",
        "summary": "Controlled apply-stage patch prepared from the approved build-stage proposal.",
        "sourceProposalId": proposal.get("proposalId"),
        "sourceRunId": proposal.get("sourceRunId"),
        "operations": [
            {
                "type": "upsert",
                "path": relative_path,
                "reason": "Persist the approved MAS apply-stage manifest as a typed generated source artifact.",
            }
        ],
        "verification": [],
        "manifest": manifest,
        "patchPreview": build_patch_preview(relative_path, source),
    }
    return write_apply_plan(plan)


def verify_python_compile() -> dict[str, Any]:
    result = subprocess.run(
        [sys.executable, "-m", "py_compile", str(Path(__file__).resolve())],
        cwd=WORKSPACE_ROOT,
        capture_output=True,
        check=False,
        shell=False,
        text=True,
        timeout=20,
    )
    ok = result.returncode == 0
    return {
        "name": "python_compile",
        "ok": ok,
        "summary": "Python backend compile passed." if ok else f"Python backend compile failed with exit {result.returncode}.",
        "exitCode": result.returncode,
        "details": [compact_text(result.stdout or result.stderr or "no compiler output", 220)],
    }


def verify_typecheck() -> dict[str, Any]:
    result = tool_typecheck("", {}, "")
    return {
        "name": "typescript_noemit",
        "ok": result.get("ok"),
        "summary": result.get("summary"),
        "exitCode": result.get("exitCode"),
        "details": result.get("details", []),
    }


def verify_endpoint_smoke() -> dict[str, Any]:
    result = tool_endpoint_smoke("", {}, "")
    return {
        "name": "endpoint_smoke",
        "ok": result.get("ok"),
        "summary": result.get("summary"),
        "exitCode": result.get("exitCode"),
        "details": result.get("details", []),
    }


def apply_latest_apply_stage_plan() -> dict[str, Any]:
    plan = read_latest_apply_plan() or create_apply_stage_plan()
    if plan.get("status") not in {"planned", "failed"}:
        return plan

    manifest = {
        **plan.get("manifest", {}),
        "status": "applied",
        "appliedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    source = generated_apply_stage_source(manifest)
    APPLY_STAGE_SOURCE_PATH.parent.mkdir(parents=True, exist_ok=True)
    APPLY_STAGE_SOURCE_PATH.write_text(source, encoding="utf-8")

    verification = [verify_python_compile(), verify_typecheck(), verify_endpoint_smoke()]
    all_ok = all(check.get("ok") for check in verification)
    applied = {
        **plan,
        "status": "applied" if all_ok else "failed",
        "appliedAt": manifest["appliedAt"],
        "summary": "Apply-stage patch applied and verified." if all_ok else "Apply-stage patch applied but verification found warnings.",
        "manifest": manifest,
        "verification": verification,
        "patchPreview": build_patch_preview(APPLY_STAGE_SOURCE_PATH.relative_to(WORKSPACE_ROOT).as_posix(), source),
    }
    write_log(
        {
            "type": "apply_stage_result",
            "command": "Apply latest approved MAS patch plan",
            "runId": str(plan.get("sourceRunId", "")),
            "proposalId": plan.get("sourceProposalId"),
            "applyPlanId": plan.get("applyPlanId"),
            "task": applied["summary"],
            "ok": all_ok,
        }
    )
    return write_apply_plan(applied)


def build_system_readiness() -> dict[str, Any]:
    report = read_latest_report()
    proposal = read_latest_build_stage_proposal()
    apply_plan = read_latest_apply_plan()

    report_ready = bool(report and report.get("status") == "ready" and report.get("checksPassed") == report.get("checksTotal"))
    proposal_ready = bool(proposal and proposal.get("status") == "approved")
    apply_ready = bool(
        apply_plan
        and apply_plan.get("status") == "applied"
        and all(check.get("ok") for check in apply_plan.get("verification", []))
    )
    runtime_ready = bool(ollama_models())
    all_ready = report_ready and proposal_ready and apply_ready and runtime_ready

    return {
        "status": "ready" if all_ready else "needs_attention",
        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "summary": "Nexus MAS pipeline is ready for controlled feature work." if all_ready else "One or more MAS pipeline stages need attention.",
        "phases": [
            {
                "id": "runtime",
                "label": "Runtime",
                "status": "ready" if runtime_ready else "needs_attention",
                "summary": "Ollama model registry responded." if runtime_ready else "Ollama model registry is not responding.",
            },
            {
                "id": "run_report",
                "label": "Run Report",
                "status": "ready" if report_ready else "needs_attention",
                "summary": f"{report.get('checksPassed', 0)}/{report.get('checksTotal', 0)} checks passed." if report else "No report artifact found.",
                "artifact": report.get("artifacts", {}).get("markdown") if report else "",
            },
            {
                "id": "build_stage",
                "label": "Build Gate",
                "status": "approved" if proposal_ready else "needs_attention",
                "summary": proposal.get("nextStep", proposal.get("summary", "")) if proposal else "No build-stage proposal found.",
                "artifact": proposal.get("artifacts", {}).get("markdown") if proposal else "",
            },
            {
                "id": "apply_stage",
                "label": "Apply Stage",
                "status": "applied" if apply_ready else "needs_attention",
                "summary": apply_plan.get("summary", "") if apply_plan else "No apply-stage plan found.",
                "artifact": apply_plan.get("artifacts", {}).get("markdown") if apply_plan else "",
            },
        ],
    }


def build_agent_state() -> dict[str, Any]:
    logs = read_recent_logs(1000)
    latest_command = ""
    latest_command_ts = ""
    latest_run_id = ""
    for event in reversed(logs):
        if event.get("type") == "command_received":
            latest_command = str(event.get("command", ""))
            latest_command_ts = str(event.get("timestamp", ""))
            latest_run_id = str(event.get("runId", ""))
            break

    def is_latest_run_event(event: dict[str, Any]) -> bool:
        if not latest_command or event.get("command") != latest_command:
            return False
        if latest_run_id:
            return event.get("runId") == latest_run_id

        event_ts = str(event.get("timestamp", ""))
        return bool(latest_command_ts and event_ts >= latest_command_ts)

    states: dict[str, dict[str, Any]] = {}
    completed_counts: dict[str, int] = {}
    latest_agent_ids: set[str] = set()
    latest_event_counts: dict[str, int] = {}

    for event in logs:
        event_type = event.get("type")
        agent_id = event.get("agentId")
        if not agent_id:
            continue

        agent_id = str(agent_id)
        command = str(event.get("command", ""))
        state = states.setdefault(
            agent_id,
            {
                "agentId": agent_id,
                "status": "idle",
                "task": "",
                "progress": 0,
                "completedTasks": 0,
                "logs": [],
                "lastCommand": "",
                "lastSeen": "",
            },
        )

        state["lastCommand"] = command
        state["lastSeen"] = event.get("timestamp", "")

        if event_type == "assignment":
            completed_counts[agent_id] = completed_counts.get(agent_id, 0) + 1
            state["task"] = event.get("task", "")
            state["logs"].append(f"assigned: {event.get('expectedOutput', 'agent output')}")
            for line in event.get("logs", []):
                if line:
                    state["logs"].append(str(line))
        elif event_type == "worker_step":
            state["logs"].append(str(event.get("step", "worker step recorded")))
        elif event_type == "tool_start":
            state["logs"].append(f"tool start: {event.get('tool', 'local tool')}")
        elif event_type == "tool_result":
            prefix = "tool ok" if event.get("ok") else "tool warning"
            state["logs"].append(f"{prefix}: {event.get('summary', 'local proof recorded')}")
        elif event_type == "agent_output":
            proof = event.get("proof")
            if proof:
                state["logs"].append(f"output ready: {event.get('expectedOutput', 'agent report')} / {proof}")
            else:
                state["logs"].append(f"output ready: {event.get('expectedOutput', 'agent report')}")

        if is_latest_run_event(event):
            latest_agent_ids.add(agent_id)
            latest_event_counts[agent_id] = latest_event_counts.get(agent_id, 0) + 1

    for agent_id, state in states.items():
        is_latest = agent_id in latest_agent_ids
        event_count = latest_event_counts.get(agent_id, 0)
        state["status"] = "active" if is_latest else "idle"
        state["progress"] = min(100, max(0, event_count * 20)) if is_latest else 0
        state["completedTasks"] = completed_counts.get(agent_id, 0)
        state["logs"] = state["logs"][-8:]

    latest_assignments = [
        event
        for event in logs
        if event.get("type") == "assignment" and is_latest_run_event(event)
    ]
    return {
        "source": "python-mas-ledger",
        "latestCommand": latest_command,
        "latestCommandTimestamp": latest_command_ts,
        "latestRunId": latest_run_id,
        "metrics": {
            "activeAgents": len(latest_agent_ids),
            "totalTasksCompleted": sum(completed_counts.values()),
            "queueDepth": len(latest_assignments),
            "signalIntegrity": 100,
        },
        "agentStates": list(states.values()),
    }


def write_assignment_events(command: str, assignment: dict[str, Any], run_id: str) -> dict[str, Any]:
    write_log({"type": "assignment", "command": command, "runId": run_id, **assignment})
    for step in assignment.get("logs", []):
        if step:
            write_log(
                {
                    "type": "worker_step",
                    "command": command,
                    "runId": run_id,
                    "agentId": assignment.get("agentId"),
                    "task": assignment.get("task"),
                    "step": step,
                }
            )
    tool_result = run_agent_tool(command, assignment, run_id)
    write_log(
        {
            "type": "agent_output",
            "command": command,
            "runId": run_id,
            "agentId": assignment.get("agentId"),
            "task": assignment.get("task"),
            "expectedOutput": assignment.get("expectedOutput"),
            "proof": tool_result["summary"],
        }
    )
    return {
        **assignment,
        "tool": tool_result,
        "logs": [
            *[str(line) for line in assignment.get("logs", []) if line],
            f"tool proof: {tool_result['summary']}",
        ][-5:],
    }


def execute_mas_command(command: str, agents: list[dict[str, Any]]) -> dict[str, Any]:
    run_id = f"run-{time.time_ns()}"
    write_log({"type": "command_received", "command": command, "runId": run_id})
    response_text = call_ollama(build_prompt(command, agents))
    plan = parse_plan(response_text, command, agents)
    executed_assignments = []
    for assignment in plan["assignments"]:
        executed_assignments.append(write_assignment_events(command, assignment, run_id))
    report = write_run_report(build_run_report(command, plan, executed_assignments, run_id))

    return {
        **plan,
        "summary": f"{plan.get('summary', 'Python MAS assigned work packets.')} Safe tool execution proof stored.",
        "assignments": executed_assignments,
        "report": report,
        "source": "python-mas",
        "runId": run_id,
        "logsStored": True,
    }


def self_test_to_markdown(self_test: dict[str, Any]) -> str:
    lines = [
        "# Nexus MAS Self-Test",
        "",
        f"- Self-test: `{self_test.get('selfTestId', 'unknown')}`",
        f"- Created: `{self_test.get('createdAt', 'unknown')}`",
        f"- Status: `{self_test.get('status', 'unknown')}`",
        f"- Command run: `{self_test.get('runId', 'unknown')}`",
        "",
        "## Summary",
        "",
        str(self_test.get("summary", "")),
        "",
        "## Checks",
        "",
    ]

    for check in self_test.get("checks", []):
        status = "OK" if check.get("ok") else "WARN"
        lines.append(f"- {status} `{check.get('name', 'check')}`: {check.get('summary', '')}")

    artifacts = self_test.get("artifacts", {})
    if artifacts:
        lines.extend(["", "## Artifacts", ""])
        for name, path in artifacts.items():
            lines.append(f"- {name}: `{path}`")

    lines.append("")
    return "\n".join(lines)


def write_self_test(self_test: dict[str, Any]) -> dict[str, Any]:
    SELF_TEST_DIR.mkdir(parents=True, exist_ok=True)
    self_test_id = str(self_test.get("selfTestId", "selftest-unknown"))
    json_path = SELF_TEST_DIR / f"{self_test_id}.json"
    markdown_path = SELF_TEST_DIR / f"{self_test_id}.md"
    self_test_with_artifacts = {
        **self_test,
        "artifacts": {
            **self_test.get("artifacts", {}),
            "json": str(json_path),
            "markdown": str(markdown_path),
        },
    }
    json_path.write_text(json.dumps(self_test_with_artifacts, ensure_ascii=False, indent=2), encoding="utf-8")
    markdown_path.write_text(self_test_to_markdown(self_test_with_artifacts), encoding="utf-8")
    LATEST_SELF_TEST_PATH.write_text(self_test_id, encoding="utf-8")
    return self_test_with_artifacts


def read_self_test(self_test_id: str) -> dict[str, Any] | None:
    if not self_test_id:
        return None

    self_test_path = (SELF_TEST_DIR / f"{self_test_id}.json").resolve()
    if not str(self_test_path).startswith(str(SELF_TEST_DIR.resolve())) or not self_test_path.exists():
        return None

    try:
        return json.loads(self_test_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def read_latest_self_test() -> dict[str, Any] | None:
    if not LATEST_SELF_TEST_PATH.exists():
        return None
    return read_self_test(LATEST_SELF_TEST_PATH.read_text(encoding="utf-8").strip())


def run_end_to_end_self_test(command: str | None = None) -> dict[str, Any]:
    started = time.perf_counter()
    created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    self_test_id = f"selftest-{time.time_ns()}"
    test_command = (command or SELF_TEST_COMMAND).strip() or SELF_TEST_COMMAND
    agents = default_self_test_agents()

    command_plan = execute_mas_command(test_command, agents)
    report = command_plan.get("report", {})
    proposal = create_build_stage_proposal()
    if proposal.get("status") == "proposed":
        proposal = approve_build_stage_proposal("self-test")
    apply_plan = create_apply_stage_plan()
    if apply_plan.get("status") in {"planned", "failed"}:
        apply_plan = apply_latest_apply_stage_plan()
    readiness = build_system_readiness()

    report_ok = report.get("status") == "ready" and report.get("checksPassed") == report.get("checksTotal")
    proposal_ok = proposal.get("status") == "approved"
    apply_ok = apply_plan.get("status") == "applied" and all(check.get("ok") for check in apply_plan.get("verification", []))
    readiness_ok = readiness.get("status") == "ready"
    checks = [
        {
            "name": "python_mas_command",
            "ok": report_ok,
            "summary": f"{report.get('checksPassed', 0)}/{report.get('checksTotal', 0)} agent tool checks passed.",
        },
        {
            "name": "build_stage_gate",
            "ok": proposal_ok,
            "summary": f"Build proposal {proposal.get('proposalId', 'unknown')} is {proposal.get('status', 'unknown')}.",
        },
        {
            "name": "apply_stage_verification",
            "ok": apply_ok,
            "summary": f"Apply plan {apply_plan.get('applyPlanId', 'unknown')} is {apply_plan.get('status', 'unknown')}.",
        },
        {
            "name": "system_readiness",
            "ok": readiness_ok,
            "summary": readiness.get("summary", "No readiness summary recorded."),
        },
    ]
    status = "passed" if all(check["ok"] for check in checks) else "needs_attention"
    self_test = {
        "selfTestId": self_test_id,
        "createdAt": created_at,
        "status": status,
        "summary": "End-to-end MAS self-test passed." if status == "passed" else "End-to-end MAS self-test found warnings.",
        "command": test_command,
        "durationMs": int((time.perf_counter() - started) * 1000),
        "runId": command_plan.get("runId"),
        "proposalId": proposal.get("proposalId"),
        "applyPlanId": apply_plan.get("applyPlanId"),
        "checks": checks,
        "readiness": readiness,
        "artifacts": {
            "runReport": report.get("artifacts", {}).get("markdown", ""),
            "buildProposal": proposal.get("artifacts", {}).get("markdown", ""),
            "applyPlan": apply_plan.get("artifacts", {}).get("markdown", ""),
        },
    }
    write_log(
        {
            "type": "self_test_result",
            "command": test_command,
            "runId": command_plan.get("runId"),
            "selfTestId": self_test_id,
            "task": self_test["summary"],
            "ok": status == "passed",
        }
    )
    return write_self_test(self_test)


class MasHandler(BaseHTTPRequestHandler):
    server_version = "NexusMAS/0.1"

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.add_headers()
        self.end_headers()

    def do_GET(self) -> None:
        if self.path.startswith("/health"):
            self.respond(
                {
                    "status": "online",
                    "service": "python-mas",
                    "ollamaHost": OLLAMA_HOST,
                    "ollamaModel": OLLAMA_MODEL,
                    "models": ollama_models(),
                    "logCount": len(read_recent_logs(1000)),
                }
            )
            return

        if self.path.startswith("/api/logs"):
            self.respond({"logs": read_recent_logs()})
            return

        if self.path.startswith("/api/state"):
            self.respond(build_agent_state())
            return

        if self.path.startswith("/api/report"):
            report = read_latest_report()
            self.respond({"report": report, "source": "python-mas"} if report else {"report": None, "source": "python-mas"})
            return

        if self.path.startswith("/api/build-stage"):
            proposal = read_latest_build_stage_proposal()
            self.respond({"proposal": proposal, "source": "python-mas"} if proposal else {"proposal": None, "source": "python-mas"})
            return

        if self.path.startswith("/api/apply-stage"):
            plan = read_latest_apply_plan()
            self.respond({"applyPlan": plan, "source": "python-mas"} if plan else {"applyPlan": None, "source": "python-mas"})
            return

        if self.path.startswith("/api/readiness"):
            self.respond({"readiness": build_system_readiness(), "source": "python-mas"})
            return

        if self.path.startswith("/api/self-test"):
            self_test = read_latest_self_test()
            self.respond({"selfTest": self_test, "source": "python-mas"} if self_test else {"selfTest": None, "source": "python-mas"})
            return

        self.respond({"error": "not found"}, status=404)

    def do_POST(self) -> None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(length).decode("utf-8") if length else "{}"
            body = json.loads(raw_body)
        except (ValueError, json.JSONDecodeError):
            self.respond({"error": "invalid json"}, status=400)
            return

        if self.path.startswith("/api/build-stage"):
            action = str(body.get("action", "propose")).strip().lower()
            if action == "approve":
                proposal = approve_build_stage_proposal(str(body.get("approvedBy", "commander")))
            else:
                proposal = create_build_stage_proposal()
            self.respond({"proposal": proposal, "source": "python-mas"})
            return

        if self.path.startswith("/api/apply-stage"):
            action = str(body.get("action", "plan")).strip().lower()
            if action == "apply":
                plan = apply_latest_apply_stage_plan()
            else:
                plan = create_apply_stage_plan()
            self.respond({"applyPlan": plan, "source": "python-mas"})
            return

        if self.path.startswith("/api/self-test"):
            command = str(body.get("command", "")).strip() or None
            self.respond({"selfTest": run_end_to_end_self_test(command), "source": "python-mas"})
            return

        if not self.path.startswith("/api/run-agents"):
            self.respond({"error": "not found"}, status=404)
            return

        command = str(body.get("command", "")).strip()
        agents = body.get("agents") if isinstance(body.get("agents"), list) else []
        if not command:
            self.respond({"error": "command required"}, status=400)
            return

        self.respond(execute_mas_command(command, agents))

    def respond(self, payload: dict[str, Any], status: int = 200) -> None:
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.add_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        try:
            self.wfile.write(encoded)
        except (BrokenPipeError, ConnectionAbortedError):
            return

    def add_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def log_message(self, format: str, *args: Any) -> None:
        return


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer((HOST, PORT), MasHandler)
    print(f"Nexus Python MAS listening on http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()

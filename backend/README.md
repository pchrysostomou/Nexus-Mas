# Nexus Python MAS Backend

Local Python middleware for Nexus MAS command orchestration.

The backend intentionally uses the Python standard library only. That keeps the local agent pipeline usable before adding heavier orchestration packages such as CrewAI, Flask, or Supabase.

## Run

```powershell
python backend\mas_service.py
```

or from the project root:

```powershell
npm.cmd run dev:backend
```

Default server:

```text
http://127.0.0.1:5055
```

## Environment

```text
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen2.5-coder:latest
MAS_BACKEND_PORT=5055
```

## Endpoints

- `GET /health`
- `GET /api/logs`
- `GET /api/state`
- `GET /api/report`
- `GET /api/build-stage`
- `GET /api/apply-stage`
- `GET /api/readiness`
- `GET /api/self-test`
- `POST /api/run-agents`
- `POST /api/build-stage`
- `POST /api/apply-stage`
- `POST /api/self-test`

## Safe Tool Registry

Each agent maps to a fixed local tool:

- Researcher: repository scan
- Designer: visual asset audit
- Analyst: ledger metrics
- Builder: TypeScript noEmit
- QA Sentinel: endpoint smoke checks
- Security: local-only safety audit

Prompt text cannot directly execute arbitrary shell commands.

## Local Data

Runtime artifacts are written to:

```text
backend/data/
```

This folder is ignored by Git because it can contain local command logs, run reports, self-test results, and generated apply-stage artifacts.

## Validation

```powershell
python -m py_compile backend\mas_service.py
curl.exe http://127.0.0.1:5055/health
curl.exe -X POST -H "Content-Type: application/json" --data-raw "{}" http://127.0.0.1:5055/api/self-test
```

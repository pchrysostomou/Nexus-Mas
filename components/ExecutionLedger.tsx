"use client";

import { RadioTower, ScrollText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Agent } from "@/lib/agents";

type ExecutionLog = {
  timestamp?: string;
  type?: string;
  command?: string;
  runId?: string;
  agentId?: string;
  task?: string;
  priority?: string;
  expectedOutput?: string;
  proof?: string;
  tool?: string;
  ok?: boolean;
  summary?: string;
  durationMs?: number;
  exitCode?: number | null;
  details?: string[];
};

type ExecutionLedgerProps = {
  agents: Agent[];
};

export function ExecutionLedger({ agents }: ExecutionLedgerProps) {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [source, setSource] = useState("checking");
  const agentNames = useMemo(() => new Map(agents.map((agent) => [agent.id, agent.name])), [agents]);

  useEffect(() => {
    let mounted = true;
    let timer: number | undefined;

    async function pullHistory() {
      try {
        const response = await fetch("/api/agents/history");
        const payload = (await response.json()) as { logs?: ExecutionLog[]; source?: string };

        if (mounted) {
          setLogs(payload.logs ?? []);
          setSource(payload.source ?? "unknown");
        }
      } finally {
        if (mounted) {
          timer = window.setTimeout(pullHistory, 5000);
        }
      }
    }

    void pullHistory();

    return () => {
      mounted = false;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  const visibleLogs = useMemo(() => buildVisibleLogs(logs), [logs]);
  const isOnline = source === "python-mas";

  return (
    <section className="rounded-lg border border-cyan-300/16 bg-slate-950/54 p-3 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/75">
          <ScrollText className="h-4 w-4 text-cyan-300" />
          Execution Ledger
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
            isOnline ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200" : "border-amber-300/25 bg-amber-300/10 text-amber-200"
          }`}
        >
          <RadioTower className="h-3.5 w-3.5" />
          {isOnline ? "python-mas live" : "waiting"}
        </span>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {visibleLogs.length > 0 ? (
          visibleLogs.map((log, index) => (
            <div
              className="min-w-0 rounded-md border border-white/10 bg-white/[0.035] px-3 py-2"
              key={`${log.timestamp}-${log.type}-${log.agentId ?? "command"}-${index}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-semibold text-white">
                  {log.agentId ? agentNames.get(log.agentId) ?? log.agentId : "Commander"}
                </p>
                <span className="rounded border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-slate-300">
                  {formatLogType(log.type)}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-300">{formatLogBody(log)}</p>
              <p className="mt-2 truncate font-mono text-[10px] text-cyan-200/70">
                {formatTime(log.timestamp)}
                {formatLogFooter(log)}
              </p>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-slate-400">
            Waiting for the next Python MAS event
          </div>
        )}
      </div>
    </section>
  );
}

function formatLogType(type: string | undefined) {
  if (type === "command_received") {
    return "command";
  }

  if (type === "assignment") {
    return "assignment";
  }

  if (type === "tool_start") {
    return "tool_start";
  }

  if (type === "tool_result") {
    return "tool_result";
  }

  if (type === "agent_output") {
    return "output";
  }

  return type ?? "event";
}

function buildVisibleLogs(logs: ExecutionLog[]) {
  const latestProofs: ExecutionLog[] = [];
  const seenAgents = new Set<string>();

  for (const log of [...logs].reverse()) {
    if (!log.agentId || seenAgents.has(log.agentId)) {
      continue;
    }

    if (log.type === "tool_result" || log.type === "agent_output") {
      latestProofs.push(log);
      seenAgents.add(log.agentId);
    }
  }

  if (latestProofs.length >= 3) {
    return latestProofs.slice(0, 6);
  }

  return logs.slice(-6).reverse();
}

function formatLogBody(log: ExecutionLog) {
  if (log.summary) {
    return log.summary;
  }

  if (log.proof) {
    return log.proof;
  }

  return log.task || log.command || "Backend event recorded";
}

function formatLogFooter(log: ExecutionLog) {
  const parts = [];

  if (log.tool) {
    parts.push(log.tool);
  }

  if (typeof log.ok === "boolean") {
    parts.push(log.ok ? "ok" : "warning");
  }

  if (typeof log.durationMs === "number") {
    parts.push(`${log.durationMs}ms`);
  }

  if (log.expectedOutput) {
    parts.push(log.expectedOutput);
  }

  return parts.length ? ` / ${parts.join(" / ")}` : "";
}

function formatTime(timestamp: string | undefined) {
  if (!timestamp) {
    return "local memory";
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

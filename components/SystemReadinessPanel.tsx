"use client";

import { CheckCircle2, CircleAlert, Gauge } from "lucide-react";
import { useEffect, useState } from "react";

type ReadinessPhase = {
  id: string;
  label: string;
  status: string;
  summary: string;
  artifact?: string;
};

type SystemReadiness = {
  status: "ready" | "needs_attention" | string;
  updatedAt: string;
  summary: string;
  phases: ReadinessPhase[];
};

export function SystemReadinessPanel() {
  const [readiness, setReadiness] = useState<SystemReadiness | null>(null);
  const [source, setSource] = useState("checking");

  useEffect(() => {
    let mounted = true;
    let timer: number | undefined;

    async function pullReadiness() {
      try {
        const response = await fetch("/api/agents/readiness");
        const payload = (await response.json()) as { readiness?: SystemReadiness | null; source?: string };

        if (mounted) {
          setReadiness(payload.readiness ?? null);
          setSource(payload.source ?? "unknown");
        }
      } finally {
        if (mounted) {
          timer = window.setTimeout(pullReadiness, 8000);
        }
      }
    }

    void pullReadiness();

    return () => {
      mounted = false;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  const ready = readiness?.status === "ready";

  return (
    <section className="rounded-lg border border-cyan-300/20 bg-slate-950/58 p-3 shadow-neon-cyan backdrop-blur-xl">
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/75">
            <Gauge className="h-4 w-4 text-cyan-300" />
            System Readiness
          </div>
          <p className="mt-1 truncate text-sm leading-5 text-slate-300">
            {readiness?.summary ?? (source === "offline" ? "Readiness offline" : "Checking MAS readiness")}
          </p>
        </div>

        <span
          className={`inline-flex w-fit items-center gap-2 rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
            ready ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200" : "border-amber-300/25 bg-amber-300/10 text-amber-200"
          }`}
        >
          {ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />}
          {readiness?.status ?? source}
        </span>
      </div>

      {readiness ? (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {readiness.phases.map((phase) => {
            const phaseReady = ["ready", "approved", "applied"].includes(phase.status);

            return (
              <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.035] px-3 py-2" key={phase.id}>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-semibold text-white">{phase.label}</p>
                  {phaseReady ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <CircleAlert className="h-4 w-4 text-amber-300" />}
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-300">{phase.summary}</p>
                <p className="mt-2 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-cyan-200/70">{phase.status}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-slate-400">
          Waiting for Python MAS readiness data
        </div>
      )}
    </section>
  );
}

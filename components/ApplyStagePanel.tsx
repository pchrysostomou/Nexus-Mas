"use client";

import { CheckCircle2, FileCode2, Loader2, Play, ScrollText, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

type ApplyOperation = {
  type: string;
  path: string;
  reason: string;
};

type VerificationCheck = {
  name: string;
  ok: boolean;
  summary: string;
  exitCode?: number | null;
  details?: string[];
};

type ApplyPlan = {
  applyPlanId: string;
  createdAt: string;
  status: "planned" | "applied" | "failed" | "blocked" | string;
  summary: string;
  sourceProposalId?: string;
  sourceRunId?: string;
  operations: ApplyOperation[];
  verification?: VerificationCheck[];
  appliedAt?: string;
  artifacts?: {
    json?: string;
    markdown?: string;
    patch?: string;
  };
};

type ApplyPayload = {
  applyPlan?: ApplyPlan | null;
  source?: string;
};

export function ApplyStagePanel() {
  const [applyPlan, setApplyPlan] = useState<ApplyPlan | null>(null);
  const [source, setSource] = useState("checking");
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    let mounted = true;
    let timer: number | undefined;

    async function pullApplyPlan() {
      try {
        const response = await fetch("/api/agents/apply-stage");
        const payload = (await response.json()) as ApplyPayload;

        if (mounted) {
          setApplyPlan(payload.applyPlan ?? null);
          setSource(payload.source ?? "unknown");
        }
      } finally {
        if (mounted) {
          timer = window.setTimeout(pullApplyPlan, 7000);
        }
      }
    }

    void pullApplyPlan();

    return () => {
      mounted = false;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  async function sendAction(action: "plan" | "apply") {
    setIsWorking(true);
    try {
      const response = await fetch("/api/agents/apply-stage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action })
      });
      const payload = (await response.json()) as ApplyPayload;
      setApplyPlan(payload.applyPlan ?? null);
      setSource(payload.source ?? "unknown");
    } finally {
      setIsWorking(false);
    }
  }

  const canApply = applyPlan?.status === "planned" || applyPlan?.status === "failed";

  return (
    <section className="rounded-lg border border-emerald-300/18 bg-slate-950/56 p-3 backdrop-blur-xl">
      <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200/75">
            <FileCode2 className="h-4 w-4 text-emerald-300" />
            Apply Stage
          </div>
          <p className="mt-1 truncate font-mono text-[11px] text-slate-400">
            {applyPlan?.applyPlanId ?? (source === "offline" ? "apply-stage offline" : "waiting for apply plan")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-300/16 disabled:cursor-not-allowed disabled:opacity-55"
            disabled={isWorking}
            onClick={() => void sendAction("plan")}
            type="button"
          >
            {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScrollText className="h-4 w-4" />}
            Generate Plan
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-md border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-300/16 disabled:cursor-not-allowed disabled:opacity-55"
            disabled={isWorking || !canApply}
            onClick={() => void sendAction("apply")}
            type="button"
          >
            <Play className="h-4 w-4" />
            Apply
          </button>
        </div>
      </div>

      {applyPlan ? (
        <>
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="rounded-md border border-white/10 bg-white/[0.035] px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={applyPlan.status} />
                <span className="rounded border border-cyan-300/18 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-100">
                  {applyPlan.operations.length} operation{applyPlan.operations.length === 1 ? "" : "s"}
                </span>
              </div>
              <p className="mt-2 text-sm leading-5 text-slate-200">{applyPlan.summary}</p>
            </div>
            <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.035] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Patch Artifact</p>
              <p className="mt-1 truncate font-mono text-[11px] text-cyan-100/80">{applyPlan.artifacts?.patch ?? "patch artifact pending"}</p>
            </div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {applyPlan.operations.map((operation) => (
              <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.035] px-3 py-2" key={`${applyPlan.applyPlanId}-${operation.path}`}>
                <p className="truncate font-mono text-xs font-semibold text-white">{operation.path}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-300">{operation.reason}</p>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-200/70">{operation.type}</p>
              </div>
            ))}
          </div>

          {applyPlan.verification?.length ? (
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {applyPlan.verification.map((check) => (
                <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.035] px-3 py-2" key={`${applyPlan.applyPlanId}-${check.name}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-mono text-xs font-semibold text-white">{check.name}</p>
                    {check.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <TriangleAlert className="h-4 w-4 text-amber-300" />}
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-300">{check.summary}</p>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <div className="rounded-md border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-slate-400">
          Generate an apply plan after approving the build-stage proposal.
        </div>
      )}
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "applied"
      ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200"
      : status === "planned"
        ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-200"
        : status === "failed"
          ? "border-rose-300/25 bg-rose-300/10 text-rose-200"
          : "border-amber-300/25 bg-amber-300/10 text-amber-200";

  return (
    <span className={`inline-flex items-center gap-2 rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${tone}`}>
      {status}
    </span>
  );
}

"use client";

import { CheckCircle2, ClipboardCheck, Gauge, Loader2, Play, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

type SelfTestCheck = {
  name: string;
  ok: boolean;
  summary: string;
};

type SelfTest = {
  selfTestId: string;
  createdAt: string;
  status: "passed" | "needs_attention" | string;
  summary: string;
  command: string;
  durationMs?: number;
  runId?: string;
  proposalId?: string;
  applyPlanId?: string;
  checks: SelfTestCheck[];
  artifacts?: {
    json?: string;
    markdown?: string;
    runReport?: string;
    buildProposal?: string;
    applyPlan?: string;
  };
};

type SelfTestPayload = {
  selfTest?: SelfTest | null;
  source?: string;
};

const defaultSelfTestPrompt =
  "Run a full local MAS self-test: assign all six agents one verification job, execute the safe local tools, store proof in the ledger, approve the build gate, apply the controlled stage, and report whether the dashboard is ready.";

export function SelfTestPanel() {
  const [selfTest, setSelfTest] = useState<SelfTest | null>(null);
  const [source, setSource] = useState("checking");
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let mounted = true;
    let timer: number | undefined;

    async function pullSelfTest() {
      try {
        const response = await fetch("/api/agents/self-test");
        const payload = (await response.json()) as SelfTestPayload;

        if (mounted) {
          setSelfTest(payload.selfTest ?? null);
          setSource(payload.source ?? "unknown");
        }
      } finally {
        if (mounted) {
          timer = window.setTimeout(pullSelfTest, 9000);
        }
      }
    }

    void pullSelfTest();

    return () => {
      mounted = false;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  async function runSelfTest() {
    setIsRunning(true);
    try {
      const response = await fetch("/api/agents/self-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ command: defaultSelfTestPrompt })
      });
      const payload = (await response.json()) as SelfTestPayload;
      setSelfTest(payload.selfTest ?? null);
      setSource(payload.source ?? "unknown");
    } finally {
      setIsRunning(false);
    }
  }

  const passed = selfTest?.status === "passed";

  return (
    <section className="rounded-lg border border-emerald-300/20 bg-slate-950/58 p-3 shadow-neon-cyan backdrop-blur-xl">
      <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200/75">
            <Gauge className="h-4 w-4 text-emerald-300" />
            Commander Self-Test
          </div>
          <p className="mt-1 truncate text-sm leading-5 text-slate-300">
            {selfTest?.summary ?? (source === "offline" ? "Self-test offline" : "Waiting for self-test artifact")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
              passed ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200" : "border-amber-300/25 bg-amber-300/10 text-amber-200"
            }`}
          >
            {passed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <TriangleAlert className="h-3.5 w-3.5" />}
            {selfTest?.status ?? source}
          </span>
          <button
            className="inline-flex items-center gap-2 rounded-md border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-300/16 disabled:cursor-not-allowed disabled:opacity-55"
            disabled={isRunning}
            onClick={() => void runSelfTest()}
            type="button"
          >
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {isRunning ? "Running" : "Run Self-Test"}
          </button>
        </div>
      </div>

      {selfTest ? (
        <>
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-md border border-white/10 bg-white/[0.035] px-3 py-2">
              <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                <ClipboardCheck className="h-3.5 w-3.5 text-cyan-300" />
                Verification Prompt
              </div>
              <p className="line-clamp-2 text-sm leading-5 text-slate-200">{selfTest.command}</p>
            </div>
            <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.035] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Artifact</p>
              <p className="mt-1 truncate font-mono text-[11px] text-cyan-100/80">{selfTest.artifacts?.markdown ?? "self-test artifact pending"}</p>
              <p className="mt-1 truncate font-mono text-[10px] text-slate-500">
                {selfTest.durationMs ? `${Math.round(selfTest.durationMs / 100) / 10}s` : "duration pending"}
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {selfTest.checks.map((check) => (
              <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.035] px-3 py-2" key={`${selfTest.selfTestId}-${check.name}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-mono text-xs font-semibold text-white">{check.name}</p>
                  {check.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <TriangleAlert className="h-4 w-4 text-amber-300" />}
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-300">{check.summary}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-md border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-slate-400">
          Press Run Self-Test to verify the full local MAS pipeline.
        </div>
      )}
    </section>
  );
}

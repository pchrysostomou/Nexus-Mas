"use client";

import { CheckCircle2, ClipboardCheck, FileCog, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

type WorkItem = {
  agentId: string;
  title: string;
  targetFiles: string[];
  proofRequired: string;
};

type BuildStageProposal = {
  proposalId: string;
  createdAt: string;
  status: "proposed" | "approved" | "blocked" | string;
  readiness: string;
  summary: string;
  sourceRunId: string;
  checksPassed?: number;
  checksTotal?: number;
  workItems: WorkItem[];
  guardrails: string[];
  approvedAt?: string;
  nextStep?: string;
  artifacts?: {
    json?: string;
    markdown?: string;
  };
};

type ProposalPayload = {
  proposal?: BuildStageProposal | null;
  source?: string;
};

const agentLabel: Record<string, string> = {
  analyst: "Analyst",
  builder: "Builder",
  designer: "Designer",
  qa: "QA Sentinel",
  researcher: "Researcher",
  security: "Security"
};

export function BuildStagePanel() {
  const [proposal, setProposal] = useState<BuildStageProposal | null>(null);
  const [source, setSource] = useState("checking");
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    let mounted = true;
    let timer: number | undefined;

    async function pullProposal() {
      try {
        const response = await fetch("/api/agents/build-stage");
        const payload = (await response.json()) as ProposalPayload;

        if (mounted) {
          setProposal(payload.proposal ?? null);
          setSource(payload.source ?? "unknown");
        }
      } finally {
        if (mounted) {
          timer = window.setTimeout(pullProposal, 7000);
        }
      }
    }

    void pullProposal();

    return () => {
      mounted = false;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  async function sendAction(action: "propose" | "approve") {
    setIsWorking(true);
    try {
      const response = await fetch("/api/agents/build-stage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action, approvedBy: "commander" })
      });
      const payload = (await response.json()) as ProposalPayload;
      setProposal(payload.proposal ?? null);
      setSource(payload.source ?? "unknown");
    } finally {
      setIsWorking(false);
    }
  }

  const approved = proposal?.status === "approved";
  const proposed = proposal?.status === "proposed";

  return (
    <section className="rounded-lg border border-fuchsia-300/18 bg-slate-950/56 p-3 backdrop-blur-xl">
      <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-fuchsia-200/75">
            <FileCog className="h-4 w-4 text-fuchsia-300" />
            Build Stage Gate
          </div>
          <p className="mt-1 truncate font-mono text-[11px] text-slate-400">
            {proposal?.proposalId ?? (source === "offline" ? "build-stage offline" : "waiting for proposal")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-300/16 disabled:cursor-not-allowed disabled:opacity-55"
            disabled={isWorking}
            onClick={() => void sendAction("propose")}
            type="button"
          >
            {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
            Create Proposal
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-md border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-300/16 disabled:cursor-not-allowed disabled:opacity-55"
            disabled={isWorking || !proposed}
            onClick={() => void sendAction("approve")}
            type="button"
          >
            <CheckCircle2 className="h-4 w-4" />
            Approve
          </button>
        </div>
      </div>

      {proposal ? (
        <>
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="rounded-md border border-white/10 bg-white/[0.035] px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={proposal.status} />
                <span className="rounded border border-cyan-300/18 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-100">
                  {proposal.checksPassed ?? 0}/{proposal.checksTotal ?? 0} checks
                </span>
              </div>
              <p className="mt-2 text-sm leading-5 text-slate-200">{proposal.nextStep ?? proposal.summary}</p>
            </div>
            <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.035] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Artifact</p>
              <p className="mt-1 truncate font-mono text-[11px] text-cyan-100/80">{proposal.artifacts?.markdown ?? "proposal artifact pending"}</p>
            </div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {proposal.workItems.map((item) => (
              <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.035] px-3 py-2" key={`${proposal.proposalId}-${item.agentId}`}>
                <p className="truncate text-xs font-semibold text-white">{agentLabel[item.agentId] ?? item.agentId}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-300">{item.title}</p>
                <p className="mt-2 truncate font-mono text-[10px] text-cyan-200/70">{item.targetFiles.join(", ")}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-md border border-white/10 bg-white/[0.035] px-3 py-2">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
              Guardrails
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {proposal.guardrails.slice(0, 4).map((guardrail) => (
                <p className="rounded border border-white/10 bg-slate-950/40 px-2 py-1 text-xs leading-5 text-slate-300" key={guardrail}>
                  {guardrail}
                </p>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-md border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-slate-400">
          Create a proposal after a ready run report.
        </div>
      )}
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "approved"
      ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200"
      : status === "proposed"
        ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-200"
        : "border-amber-300/25 bg-amber-300/10 text-amber-200";

  return (
    <span className={`inline-flex items-center gap-2 rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${tone}`}>
      {status}
    </span>
  );
}

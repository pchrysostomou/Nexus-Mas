"use client";

import { ClipboardList } from "lucide-react";
import type { Agent } from "@/lib/agents";
import type { CommandPlan } from "@/lib/commands";

type TaskBoardProps = {
  agents: Agent[];
  plan: CommandPlan | null;
  onSelectAgent: (agentId: string) => void;
};

export function TaskBoard({ agents, plan, onSelectAgent }: TaskBoardProps) {
  if (!plan) {
    return null;
  }

  const sourceLabel = {
    fallback: "fallback",
    local: "local dispatch",
    "next-ollama": "ollama",
    "python-mas": "python-mas"
  }[plan.source ?? "local"];

  return (
    <section className="rounded-lg border border-cyan-300/16 bg-slate-950/54 p-3 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/75">
          <ClipboardList className="h-4 w-4 text-cyan-300" />
          Task Board
        </div>
        <span className="rounded border border-fuchsia-300/20 bg-fuchsia-300/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-fuchsia-100">
          {plan.assignments.length} active // {sourceLabel}
        </span>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {plan.assignments.map((assignment) => {
          const agent = agents.find((item) => item.id === assignment.agentId);

          return (
            <button
              className="rounded-md border border-white/10 bg-white/[0.035] p-3 text-left transition hover:border-cyan-300/38 hover:bg-cyan-300/10"
              key={`${assignment.agentId}-${assignment.task}`}
              onClick={() => onSelectAgent(assignment.agentId)}
              type="button"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold text-white">{agent?.name ?? assignment.agentId}</p>
                <span className="rounded border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-300">
                  {assignment.priority}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-300">{assignment.task}</p>
              <p className="mt-2 truncate font-mono text-[11px] text-cyan-200/70">{assignment.expectedOutput}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

"use client";

import { ChevronRight, Cpu, Gauge, Layers3, Zap, type LucideIcon } from "lucide-react";
import { agents, systemMetrics } from "@/lib/agents";
import type { Agent } from "@/lib/agents";

type CommanderSidebarProps = {
  agentsList?: Agent[];
  metrics?: typeof systemMetrics;
  selectedAgentId: string;
  onSelectAgent: (agentId: string) => void;
};

export function CommanderSidebar({ agentsList = agents, metrics = systemMetrics, selectedAgentId, onSelectAgent }: CommanderSidebarProps) {
  return (
    <aside className="scanline flex w-full shrink-0 flex-col gap-4 rounded-lg border border-fuchsia-300/18 bg-slate-950/72 p-4 shadow-neon-purple backdrop-blur-xl lg:h-[calc(100vh-2.5rem)] lg:w-[360px]">
      <div className="flex items-center gap-3 border-b border-white/10 pb-4">
        <div className="grid h-11 w-11 place-items-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 text-cyan-100 shadow-neon-cyan">
          <Cpu className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-fuchsia-200/75">Commander</p>
          <h2 className="truncate text-lg font-semibold text-white">Center</h2>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SidebarMetric icon={Zap} label="Active Agents" value={`${metrics.activeAgents}/${agentsList.length}`} />
        <SidebarMetric icon={Layers3} label="Tasks Done" value={String(metrics.totalTasksCompleted)} />
        <SidebarMetric icon={Gauge} label="Queue Depth" value={String(metrics.queueDepth)} />
        <SidebarMetric icon={Cpu} label="Integrity" value={`${metrics.signalIntegrity}%`} />
      </div>

      <div className="min-h-0 flex-1">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Agent Roster</p>
          <span className="rounded border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
            Live
          </span>
        </div>

        <div className="space-y-2 overflow-y-auto pr-1 lg:max-h-[calc(100vh-22rem)]">
          {agentsList.map((agent) => {
            const Icon = agent.icon;
            const isSelected = selectedAgentId === agent.id;

            return (
              <button
                className={`group w-full rounded-md border p-3 text-left transition ${
                  isSelected
                    ? "border-cyan-300/45 bg-cyan-300/10 shadow-neon-cyan"
                    : "border-white/10 bg-white/[0.035] hover:border-fuchsia-300/35 hover:bg-fuchsia-300/10"
                }`}
                key={agent.id}
                onClick={() => onSelectAgent(agent.id)}
                type="button"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-md border bg-slate-950/70 font-mono text-sm font-bold"
                    style={{ borderColor: `${agent.color}66`, color: agent.color, boxShadow: `0 0 16px ${agent.color}33` }}
                  >
                    {agent.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0" style={{ color: agent.color }} />
                        <p className="truncate text-sm font-semibold text-white">{agent.name}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-cyan-200" />
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{agent.task}</p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${agent.progress}%`,
                          background: `linear-gradient(90deg, ${agent.color}, rgba(255,255,255,0.75))`,
                          boxShadow: `0 0 12px ${agent.color}88`
                        }}
                      />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

function SidebarMetric({
  icon: Icon,
  label,
  value
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.035] p-3">
      <div className="flex items-center gap-2 text-cyan-200">
        <Icon className="h-4 w-4" />
        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</span>
      </div>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

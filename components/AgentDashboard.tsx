"use client";

import { GitBranch, Grid2X2, RadioTower, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { AgentGraph } from "@/components/AgentGraph";
import { AgentRoomCard } from "@/components/AgentRoomCard";
import { ApplyStagePanel } from "@/components/ApplyStagePanel";
import { BuildStagePanel } from "@/components/BuildStagePanel";
import { CommandConsole } from "@/components/CommandConsole";
import { CommanderSidebar } from "@/components/CommanderSidebar";
import { ExecutionLedger } from "@/components/ExecutionLedger";
import { FactoryFloor } from "@/components/FactoryFloor";
import { RunReportPanel } from "@/components/RunReportPanel";
import { SelfTestPanel } from "@/components/SelfTestPanel";
import { SystemTelemetry } from "@/components/SystemTelemetry";
import { SystemReadinessPanel } from "@/components/SystemReadinessPanel";
import { TaskBoard } from "@/components/TaskBoard";
import { agents, systemMetrics } from "@/lib/agents";
import type { Agent } from "@/lib/agents";
import type { CommandPlan } from "@/lib/commands";

type ViewMode = "rooms" | "graph";
type DashboardMetrics = typeof systemMetrics;
type MasAgentState = {
  agentId: string;
  status: Agent["status"];
  task: string;
  progress: number;
  completedTasks: number;
  logs: string[];
};
type MasStateResponse = {
  source: string;
  latestCommand?: string;
  metrics?: DashboardMetrics | null;
  agentStates?: MasAgentState[];
};

const emptyMetrics: DashboardMetrics = {
  activeAgents: 0,
  totalTasksCompleted: 0,
  queueDepth: 0,
  signalIntegrity: 0
};

const initialLedgerAgents: Agent[] = agents.map((agent) => ({
  ...agent,
  status: "idle",
  task: "Waiting for Python MAS ledger event",
  progress: 0,
  completedTasks: 0,
  logs: ["waiting for Python MAS ledger event"]
}));

export function AgentDashboard() {
  const [runtimeAgents, setRuntimeAgents] = useState<Agent[]>(initialLedgerAgents);
  const [ledgerMetrics, setLedgerMetrics] = useState<DashboardMetrics>(emptyMetrics);
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.id ?? "");
  const [viewMode, setViewMode] = useState<ViewMode>("rooms");
  const [lastPlan, setLastPlan] = useState<CommandPlan | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const selectedAgent = runtimeAgents.find((agent) => agent.id === selectedAgentId) ?? runtimeAgents[0];
  const SelectedAgentIcon = selectedAgent.icon;
  const metrics = ledgerMetrics;

  useEffect(() => {
    let mounted = true;
    let timer: number | undefined;

    async function pullLedgerState() {
      try {
        const response = await fetch("/api/agents/state");
        const payload = (await response.json()) as MasStateResponse;

        if (!mounted) {
          return;
        }

        if (payload.metrics) {
          setLedgerMetrics(payload.metrics);
        }

        if (payload.agentStates?.length) {
          const stateById = new Map(payload.agentStates.map((state) => [state.agentId, state]));
          setRuntimeAgents((currentAgents) =>
            currentAgents.map((agent) => {
              const state = stateById.get(agent.id);

              if (!state) {
                return {
                  ...agent,
                  status: "idle",
                  progress: 0
                };
              }

              return {
                ...agent,
                status: state.status,
                task: state.task || agent.task,
                progress: state.progress,
                completedTasks: state.completedTasks,
                logs: state.logs.length > 0 ? state.logs : agent.logs
              };
            })
          );
        }
      } finally {
        if (mounted) {
          timer = window.setTimeout(pullLedgerState, 5000);
        }
      }
    }

    void pullLedgerState();

    return () => {
      mounted = false;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  async function dispatchPlan(plan: CommandPlan) {
    setIsDispatching(true);
    setLastPlan(plan);

    setRuntimeAgents((currentAgents) =>
      currentAgents.map((agent) => {
        const assignment = plan.assignments.find((item) => item.agentId === agent.id);

        if (!assignment) {
          return agent;
        }

        return {
          ...agent,
          status: "active",
          task: assignment.task,
          progress: Math.max(8, Math.min(agent.progress, 42)),
          logs: [
            `commander command accepted: ${plan.command.slice(0, 52)}`,
            `priority ${assignment.priority}`,
            `target output: ${assignment.expectedOutput}`,
            ...assignment.logs
          ]
        };
      })
    );

    if (plan.assignments[0]) {
      setSelectedAgentId(plan.assignments[0].agentId);
    }

    setTimeout(() => setIsDispatching(false), 450);
  }

  return (
    <main className="relative min-h-screen overflow-hidden p-3 text-slate-100 sm:p-4 lg:p-5">
      <div className="dashboard-backdrop" />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[1800px] flex-col gap-4 lg:flex-row">
        <CommanderSidebar
          agentsList={runtimeAgents}
          metrics={metrics}
          selectedAgentId={selectedAgentId}
          onSelectAgent={setSelectedAgentId}
        />

        <section className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="rounded-lg border border-cyan-300/20 bg-slate-950/58 px-4 py-3 shadow-neon-cyan backdrop-blur-xl">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/75">
                  <RadioTower className="h-4 w-4 text-cyan-300" />
                  Nexus MAS // Local Command Layer
                </div>
                <h1 className="mt-2 text-2xl font-semibold tracking-normal text-white sm:text-3xl">
                  Commander Center
                </h1>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[520px]">
                <MetricPill label="Active" value={`${metrics.activeAgents}/${runtimeAgents.length}`} tone="cyan" />
                <MetricPill label="Completed" value={String(metrics.totalTasksCompleted)} tone="green" />
                <MetricPill label="Queue" value={String(metrics.queueDepth)} tone="purple" />
                <MetricPill label="Signal" value={`${metrics.signalIntegrity}%`} tone="amber" />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-3 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2">
                <SelectedAgentIcon className="h-5 w-5 shrink-0" style={{ color: selectedAgent.color }} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{selectedAgent.name}</p>
                  <p className="truncate text-xs text-slate-400">{selectedAgent.task}</p>
                </div>
              </div>

              <div className="inline-flex rounded-md border border-cyan-300/20 bg-slate-950/70 p-1">
                <ViewButton active={viewMode === "rooms"} icon={Grid2X2} label="Rooms" onClick={() => setViewMode("rooms")} />
                <ViewButton active={viewMode === "graph"} icon={GitBranch} label="Graph" onClick={() => setViewMode("graph")} />
              </div>
            </div>
          </header>

          <CommandConsole
            agents={runtimeAgents}
            isDispatching={isDispatching}
            lastPlan={lastPlan}
            onPlan={dispatchPlan}
          />

          <SystemTelemetry />

          <SystemReadinessPanel />

          <SelfTestPanel />

          <ExecutionLedger agents={runtimeAgents} />

          <RunReportPanel />

          <BuildStagePanel />

          <ApplyStagePanel />

          <TaskBoard agents={runtimeAgents} onSelectAgent={setSelectedAgentId} plan={lastPlan} />

          {viewMode === "rooms" ? (
            <FactoryFloor agents={runtimeAgents} selectedAgentId={selectedAgentId} onSelectAgent={setSelectedAgentId} />
          ) : (
            <AgentGraph agentsList={runtimeAgents} selectedAgentId={selectedAgentId} onSelectAgent={setSelectedAgentId} />
          )}

          {viewMode === "rooms" ? (
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
              <div className="rounded-lg border border-white/10 bg-slate-950/50 p-4 backdrop-blur-xl">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/75">Selected Room Feed</p>
                <AgentRoomCard agent={selectedAgent} isSelected onSelect={() => setSelectedAgentId(selectedAgent.id)} />
              </div>
            </section>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function MetricPill({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "cyan" | "green" | "purple" | "amber";
}) {
  const toneClass = {
    cyan: "border-cyan-300/30 text-cyan-200",
    green: "border-emerald-300/30 text-emerald-200",
    purple: "border-fuchsia-300/30 text-fuchsia-200",
    amber: "border-amber-300/30 text-amber-200"
  }[tone];

  return (
    <div className={`rounded-md border bg-slate-900/68 px-3 py-2 ${toneClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function ViewButton({
  active,
  icon: Icon,
  label,
  onClick
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium transition ${
        active
          ? "bg-cyan-300/14 text-cyan-100 shadow-neon-cyan"
          : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
      }`}
      onClick={onClick}
      type="button"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

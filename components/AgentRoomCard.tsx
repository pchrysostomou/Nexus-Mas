"use client";

import { Maximize2, TerminalSquare, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import type { Agent } from "@/lib/agents";

type AgentRoomCardProps = {
  agent: Agent;
  isSelected: boolean;
  onSelect: () => void;
};

const roomWorkflow: Partial<Record<Agent["role"], [string, string, string]>> = {
  analysis: ["Ingest", "Score", "Report"],
  build: ["Plan", "Code", "Ship"],
  design: ["Sketch", "Tune", "Mock"],
  qa: ["Replay", "Check", "Approve"],
  research: ["Scan", "Index", "Brief"],
  security: ["Inspect", "Seal", "Alert"]
};

const roomImages: Partial<Record<Agent["id"], string>> = {
  analyst: "/assets/agent-rooms/analyst.png",
  builder: "/assets/agent-rooms/builder.png",
  designer: "/assets/agent-rooms/designer.png",
  qa: "/assets/agent-rooms/qa.png",
  researcher: "/assets/agent-rooms/researcher.png",
  security: "/assets/agent-rooms/security.png"
};

export function AgentRoomCard({ agent, isSelected, onSelect }: AgentRoomCardProps) {
  const Icon = agent.icon;
  const { liveLogs, source } = useLiveLogs(agent);

  return (
    <article
      className={`group relative min-h-[360px] overflow-hidden rounded-lg border bg-slate-950/58 p-4 backdrop-blur-xl transition duration-300 ${
        isSelected ? "border-cyan-300/55 shadow-neon-cyan" : "border-white/12 hover:border-fuchsia-300/42 hover:shadow-neon-purple"
      }`}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-90"
        style={{ background: `linear-gradient(90deg, transparent, ${agent.color}, transparent)` }}
      />

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border bg-slate-950/72"
              style={{ borderColor: `${agent.color}70`, boxShadow: `0 0 24px ${agent.color}33` }}
            >
              <Icon className="h-6 w-6" style={{ color: agent.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{agent.callsign}</p>
              <h3 className="truncate text-xl font-semibold text-white">{agent.name}</h3>
            </div>
          </div>

          <button
            aria-label={`View ${agent.name} details`}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-slate-400 transition hover:border-cyan-300/35 hover:text-cyan-100"
            onClick={onSelect}
            type="button"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
              agent.status === "active"
                ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-200"
                : "border-slate-400/20 bg-slate-400/10 text-slate-300"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${agent.status === "active" ? "bg-emerald-300 shadow-neon-green" : "bg-slate-500"}`} />
            {agent.status}
          </span>
          <span className="rounded border border-white/10 bg-white/[0.035] px-2.5 py-1 text-xs font-medium text-slate-300">
            {agent.progress}% task load
          </span>
        </div>

        <p className="mt-4 min-h-10 text-sm leading-6 text-slate-300">{agent.task}</p>

        <FactoryRoom agent={agent} />

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800/90">
          <div
            className="h-full rounded-full"
            style={{
              width: `${agent.progress}%`,
              background: `linear-gradient(90deg, ${agent.color}, rgba(255,255,255,0.75))`,
              boxShadow: `0 0 18px ${agent.color}88`
            }}
          />
        </div>

        <div className="mt-5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-cyan-300/14 bg-[#030711]/88 shadow-inner">
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/10 bg-white/[0.035] px-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
            </div>
            <div className="flex min-w-0 items-center gap-2 text-xs text-cyan-100/75">
              <TerminalSquare className="h-4 w-4 shrink-0" />
              <span className="truncate font-mono">{agent.id}.log</span>
            </div>
            <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-300">
              {source}
            </span>
          </div>

          <div className="terminal-scroll min-h-[150px] flex-1 overflow-y-auto p-3 font-mono text-[12px] leading-6 text-cyan-50/88">
            {liveLogs.map((log, index) => (
              <p className="break-words" key={`${agent.id}-${index}-${log}`}>
                <span className="text-fuchsia-300">$</span>{" "}
                <span className="text-cyan-300">{agent.callsign.toLowerCase()}</span>{" "}
                <span className="text-slate-500">::</span> {log}
              </p>
            ))}
            <p className="text-emerald-200">
              <span className="text-fuchsia-300">$</span> stream<span className="ml-1 animate-pulse">_</span>
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

function useLiveLogs(agent: Agent) {
  const [visibleLogs, setVisibleLogs] = useState(() => agent.logs.slice(-8));

  useEffect(() => {
    setVisibleLogs(agent.logs.slice(-8));
  }, [agent.logs]);

  return { liveLogs: visibleLogs.length > 0 ? visibleLogs : ["waiting for Python MAS ledger event"], source: "ledger" };
}

function WorkerAvatar({ agent, index, x, y }: { agent: Agent; index: number; x: number; y: number }) {
  const isActive = agent.status === "active";

  return (
    <div
      className={`absolute grid h-8 w-8 place-items-center rounded-full border bg-slate-950/80 transition ${
        isActive ? "animate-pulse" : "opacity-45"
      }`}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        borderColor: `${agent.color}70`,
        boxShadow: isActive ? `0 0 16px ${agent.color}66` : "none",
        transform: `translate(${isActive ? Math.sin(index + agent.progress / 12) * 6 : 0}px, ${
          isActive ? Math.cos(index + agent.progress / 10) * 4 : 0
        }px)`
      }}
      title={`${agent.name} worker ${index + 1}`}
    >
      <UserRound className="h-4 w-4" style={{ color: agent.color }} />
    </div>
  );
}

function FactoryRoom({ agent }: { agent: Agent }) {
  const workflow = roomWorkflow[agent.role] ?? ["Input", "Work", "Output"];
  const imageUrl = roomImages[agent.id] ?? "/assets/agent-factory-backdrop.png";

  return (
    <div className="mt-4 overflow-hidden rounded-md border border-white/10 bg-white/[0.025] p-3">
      <div className="real-room-frame relative h-48 rounded border border-cyan-300/10 bg-[#040816]/88">
        <div className="real-room-image" style={{ backgroundImage: `url(${imageUrl})` }} />
        <div className="real-room-vignette" />
        <div className="real-room-scanline" />
        <div className="real-room-data-lane" style={{ borderColor: `${agent.color}66` }}>
          <span style={{ backgroundColor: agent.color, boxShadow: `0 0 16px ${agent.color}` }} />
        </div>
        <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
          {workflow.map((label) => (
            <span
              className="rounded border bg-slate-950/62 px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-50/90 backdrop-blur"
              key={`${agent.id}-detail-${label}`}
              style={{ borderColor: `${agent.color}55` }}
            >
              {label}
            </span>
          ))}
        </div>
        <div className="absolute bottom-2 left-2 right-2 rounded border border-white/10 bg-slate-950/78 px-2 py-1">
          <p className="truncate font-mono text-[11px] text-cyan-100/80">{agent.task}</p>
        </div>
      </div>
    </div>
  );
}

function FactoryStation({ agent, label, x, y }: { agent: Agent; label: string; x: number; y: number }) {
  return (
    <div
      className="absolute h-12 w-20 rounded border bg-slate-950/64"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        borderColor: `${agent.color}55`,
        boxShadow: `inset 0 0 16px ${agent.color}18`
      }}
    >
      <div className="h-2 border-b border-white/10" style={{ background: `${agent.color}44` }} />
      <div className="flex h-10 items-center justify-center px-1">
        <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-slate-300">{label}</p>
      </div>
    </div>
  );
}

function Conveyor({ agent }: { agent: Agent }) {
  return (
    <div className="absolute left-[10%] right-[10%] top-[58%] h-3 overflow-hidden rounded-full border border-white/10 bg-slate-950/80">
      <div
        className="h-full w-[220%] opacity-80"
        style={{
          backgroundImage: `repeating-linear-gradient(90deg, ${agent.color}66 0 12px, transparent 12px 24px)`,
          transform: `translateX(${agent.status === "active" ? -(agent.progress % 24) : 0}px)`
        }}
      />
    </div>
  );
}

function DataPacket({ agent, delay, left }: { agent: Agent; delay: number; left: number }) {
  const isActive = agent.status === "active";

  return (
    <span
      className={`absolute top-[56%] h-4 w-4 rounded-sm border bg-slate-950 transition ${isActive ? "opacity-100" : "opacity-35"}`}
      style={{
        left: `${left + (isActive ? (agent.progress % 14) : 0)}%`,
        borderColor: `${agent.color}88`,
        boxShadow: isActive ? `0 0 14px ${agent.color}88` : "none",
        transitionDelay: `${delay}s`
      }}
    />
  );
}

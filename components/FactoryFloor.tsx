"use client";

import type { Agent } from "@/lib/agents";

type FactoryFloorProps = {
  agents: Agent[];
  selectedAgentId: string;
  onSelectAgent: (agentId: string) => void;
};

const roomTint = [
  "from-cyan-400/24 via-sky-500/10 to-cyan-950/50",
  "from-fuchsia-400/24 via-violet-500/10 to-purple-950/50",
  "from-emerald-400/22 via-teal-500/10 to-emerald-950/50",
  "from-amber-300/22 via-orange-500/10 to-slate-950/60",
  "from-sky-400/22 via-blue-500/10 to-slate-950/60",
  "from-rose-400/22 via-pink-500/10 to-slate-950/60"
];

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

export function FactoryFloor({ agents, selectedAgentId, onSelectAgent }: FactoryFloorProps) {
  return (
    <section className="relative overflow-hidden rounded-lg border border-cyan-200/30 bg-[#020817]/88 p-3 shadow-neon-cyan backdrop-blur-xl">
      <div className="factory-art-wash" />
      <div className="factory-stars" />
      <div className="factory-main-road factory-main-road-x" />
      <div className="factory-main-road factory-main-road-y" />

      <div className="relative z-10 mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/75">Factory Floor</p>
          <h2 className="text-xl font-semibold text-white">Live Agent Factory</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">
          <FactoryKey color="#22d3ee" label="moving data" />
          <FactoryKey color="#facc15" label="workers" />
          <FactoryKey color="#4ade80" label="active rooms" />
        </div>
      </div>

      <div className="relative z-10 grid min-h-[900px] grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {agents.map((agent, index) => (
          <WorkshopRoom
            agent={agent}
            index={index}
            isSelected={selectedAgentId === agent.id}
            key={agent.id}
            onSelect={() => onSelectAgent(agent.id)}
          />
        ))}
      </div>
    </section>
  );
}

function WorkshopRoom({
  agent,
  index,
  isSelected,
  onSelect
}: {
  agent: Agent;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const Icon = agent.icon;
  const isActive = agent.status === "active";
  const workflow = roomWorkflow[agent.role] ?? ["Input", "Work", "Output"];
  const imageUrl = roomImages[agent.id] ?? "/assets/agent-factory-backdrop.png";

  return (
    <button
      className={`factory-room group relative min-h-[470px] overflow-hidden rounded-md border bg-gradient-to-br p-3 text-left transition ${
        roomTint[index % roomTint.length]
      } ${isSelected ? "border-cyan-100/80 shadow-neon-cyan" : "border-white/16 hover:border-fuchsia-200/60 hover:shadow-neon-purple"}`}
      onClick={onSelect}
      type="button"
    >
      <div
        className="absolute inset-0 opacity-20 blur-[1px] saturate-125 transition duration-500 group-hover:opacity-30"
        style={{ background: `linear-gradient(rgba(2,6,23,.48), rgba(2,6,23,.82)), url(${imageUrl}) center / cover no-repeat` }}
      />
      <div className="factory-room-grid" />
      <div className="factory-room-scan" />
      <div className="factory-pipe factory-pipe-top" style={{ backgroundColor: `${agent.color}2f` }} />
      <div className="factory-pipe factory-pipe-side" style={{ backgroundColor: `${agent.color}26` }} />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="grid h-12 w-12 shrink-0 place-items-center rounded-md border bg-slate-950/80"
            style={{ borderColor: `${agent.color}88`, boxShadow: `0 0 22px ${agent.color}44` }}
          >
            <Icon className="h-6 w-6" style={{ color: agent.color }} />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-400">{agent.callsign}</p>
            <h3 className="truncate text-xl font-semibold text-white">{agent.name}</h3>
          </div>
        </div>
        <span
          className={`rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
            isActive ? "border-emerald-300/40 bg-emerald-300/12 text-emerald-200" : "border-slate-400/25 bg-slate-400/10 text-slate-300"
          }`}
        >
          {agent.status}
        </span>
      </div>

      <div className="real-room-frame relative z-10 mt-4 h-[306px] overflow-hidden rounded-md border border-white/18 bg-[#030817]/82">
        <div
          className="real-room-image"
          style={{
            backgroundImage: `url(${imageUrl})`
          }}
        />
        <div className="real-room-vignette" />
        <div className="real-room-scanline" />
        <div className="real-room-data-lane" style={{ borderColor: `${agent.color}66` }}>
          <span style={{ backgroundColor: agent.color, boxShadow: `0 0 16px ${agent.color}` }} />
        </div>
        <div className="absolute left-4 top-4 flex gap-2">
          {workflow.map((label) => (
            <span
              className="rounded border bg-slate-950/62 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-50/90 backdrop-blur"
              key={`${agent.id}-${label}`}
              style={{ borderColor: `${agent.color}55` }}
            >
              {label}
            </span>
          ))}
        </div>
        <div className="absolute right-4 top-4 flex items-center gap-2 rounded border border-white/14 bg-slate-950/68 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-200 backdrop-blur">
          <span
            className={`h-2 w-2 rounded-full ${isActive ? "animate-pulse" : ""}`}
            style={{ backgroundColor: isActive ? agent.color : "#64748b", boxShadow: isActive ? `0 0 12px ${agent.color}` : "none" }}
          />
          Live Room
        </div>

        <div className="absolute bottom-3 left-3 right-3 rounded border border-white/12 bg-[#01040d]/88 px-3 py-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Current Assignment</p>
            <p className="font-mono text-[10px]" style={{ color: agent.color }}>
              {agent.progress}%
            </p>
          </div>
          <p className="line-clamp-2 text-xs leading-5 text-cyan-50/90">{agent.task}</p>
        </div>
      </div>

      <div className="relative z-10 mt-3 h-2 overflow-hidden rounded-full bg-slate-800/90">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${agent.progress}%`,
            background: `linear-gradient(90deg, ${agent.color}, rgba(255,255,255,.82))`,
            boxShadow: `0 0 16px ${agent.color}88`
          }}
        />
      </div>

      <div className="relative z-10 mt-3 grid grid-cols-2 gap-2">
        {agent.logs.slice(-4).map((log, logIndex) => (
          <div className="min-w-0 rounded border border-white/10 bg-slate-950/42 px-2 py-1" key={`${agent.id}-factory-log-${logIndex}`}>
            <p className="truncate font-mono text-[10px] text-cyan-100/80">{log}</p>
          </div>
        ))}
      </div>
    </button>
  );
}

function Machine({ agent, label, left, top, tall = false }: { agent: Agent; label: string; left: number; top: number; tall?: boolean }) {
  return (
    <div
      className={`factory-machine ${tall ? "h-24" : "h-20"} absolute w-[24%] rounded-md border bg-slate-950/78`}
      style={{
        left: `${left}%`,
        top: `${top}%`,
        borderColor: `${agent.color}66`,
        boxShadow: `inset 0 0 22px ${agent.color}20`
      }}
    >
      <div className="h-4 rounded-t" style={{ backgroundColor: `${agent.color}55` }} />
      <div className="grid h-[calc(100%-16px)] place-items-center px-2">
        <div className="factory-machine-core" style={{ borderColor: `${agent.color}88`, boxShadow: `0 0 18px ${agent.color}55` }} />
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">{label}</p>
      </div>
    </div>
  );
}

function RobotArm({ agent, left, top, reverse = false }: { agent: Agent; left: number; top: number; reverse?: boolean }) {
  return (
    <div className={`factory-arm ${reverse ? "factory-arm-reverse" : ""}`} style={{ left: `${left}%`, top: `${top}%`, color: agent.color }}>
      <span />
    </div>
  );
}

function Belt({ agent }: { agent: Agent }) {
  return (
    <div className="factory-belt absolute left-[9%] right-[9%] top-[52%] h-9 overflow-hidden rounded-full border border-white/12 bg-slate-950/92">
      <div
        className="factory-belt-stripes"
        style={{
          backgroundImage: `repeating-linear-gradient(90deg, ${agent.color}88 0 16px, transparent 16px 32px)`
        }}
      />
    </div>
  );
}

function TaskPacket({ agent, lane }: { agent: Agent; lane: number }) {
  return (
    <span
      className="factory-packet"
      style={{
        borderColor: `${agent.color}aa`,
        boxShadow: `0 0 16px ${agent.color}99`,
        animationDelay: `${lane * -1.35}s`
      }}
    />
  );
}

function TinyWorker({ agent, delay, label, left, top }: { agent: Agent; delay: number; label: string; left: number; top: number }) {
  const active = agent.status === "active";

  return (
    <div
      className={`tiny-worker ${active ? "tiny-worker-active" : ""}`}
      style={{
        left: `${left}%`,
        top: `${top}%`,
        animationDelay: `${delay}s`,
        ["--worker-accent" as string]: agent.color
      }}
    >
      <div className="tiny-worker-shadow" />
      <div className="tiny-worker-body">
        <div className="tiny-worker-helmet" />
        <div className="tiny-worker-goggles">
          <span />
          <span />
        </div>
        <div className="tiny-worker-suit" />
      </div>
      <p>{label}</p>
    </div>
  );
}

function Spark({ agent, left, top, delay = 0 }: { agent: Agent; left: number; top: number; delay?: number }) {
  return (
    <span
      className="factory-spark"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        backgroundColor: agent.color,
        boxShadow: `0 0 14px ${agent.color}`,
        animationDelay: `${delay}s`
      }}
    />
  );
}

function FactoryKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded border border-white/10 bg-white/[0.04] px-2 py-1">
      <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
      {label}
    </span>
  );
}

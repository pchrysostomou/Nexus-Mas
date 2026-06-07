import {
  Beaker,
  Bot,
  Brush,
  CircuitBoard,
  Code2,
  Eye,
  type LucideIcon,
  ShieldCheck
} from "lucide-react";

export type AgentStatus = "active" | "idle";

export type AgentRole = "commander" | "research" | "design" | "analysis" | "build" | "qa" | "security";

export type Agent = {
  id: string;
  name: string;
  callsign: string;
  role: AgentRole;
  avatar: string;
  status: AgentStatus;
  task: string;
  progress: number;
  completedTasks: number;
  color: string;
  glow: "cyan" | "purple" | "green" | "amber" | "rose";
  icon: LucideIcon;
  logs: string[];
};

export const agents: Agent[] = [
  {
    id: "researcher",
    name: "Researcher",
    callsign: "RX-01",
    role: "research",
    avatar: "R",
    status: "active",
    task: "Scanning GitHub references for reusable MAS UI patterns",
    progress: 78,
    completedTasks: 42,
    color: "#22d3ee",
    glow: "cyan",
    icon: Beaker,
    logs: [
      "indexing open-source agent dashboards",
      "ranking cyberpunk layouts by interaction density",
      "extracting reusable component language",
      "summarizing source candidates for commander review"
    ]
  },
  {
    id: "designer",
    name: "Designer",
    callsign: "UX-24",
    role: "design",
    avatar: "D",
    status: "active",
    task: "Tuning room cards, neon borders, and terminal contrast",
    progress: 64,
    completedTasks: 36,
    color: "#a855f7",
    glow: "purple",
    icon: Brush,
    logs: [
      "balancing cyan and violet accent weights",
      "checking responsive grid density",
      "testing glass panel readability",
      "syncing hover states with agent focus model"
    ]
  },
  {
    id: "analyst",
    name: "Analyst",
    callsign: "AN-07",
    role: "analysis",
    avatar: "A",
    status: "active",
    task: "Correlating agent progress with task queue priority",
    progress: 88,
    completedTasks: 59,
    color: "#4ade80",
    glow: "green",
    icon: Eye,
    logs: [
      "reading event stream buffer",
      "classifying task risk as medium",
      "detecting two idle workers available",
      "projecting completion window from current velocity"
    ]
  },
  {
    id: "builder",
    name: "Builder",
    callsign: "BD-11",
    role: "build",
    avatar: "B",
    status: "idle",
    task: "Waiting for approved implementation brief",
    progress: 32,
    completedTasks: 27,
    color: "#f59e0b",
    glow: "amber",
    icon: Code2,
    logs: [
      "standing by for repository context",
      "last build cache is warm",
      "no write target assigned",
      "toolchain health nominal"
    ]
  },
  {
    id: "qa",
    name: "QA Sentinel",
    callsign: "QA-03",
    role: "qa",
    avatar: "Q",
    status: "idle",
    task: "Preparing visual regression checklist",
    progress: 45,
    completedTasks: 18,
    color: "#38bdf8",
    glow: "cyan",
    icon: ShieldCheck,
    logs: [
      "loading viewport matrix",
      "checking interaction states",
      "waiting for latest build artifact",
      "test queue prepared"
    ]
  },
  {
    id: "security",
    name: "Security",
    callsign: "SC-09",
    role: "security",
    avatar: "S",
    status: "idle",
    task: "Monitoring local-only execution boundaries",
    progress: 51,
    completedTasks: 21,
    color: "#fb7185",
    glow: "rose",
    icon: CircuitBoard,
    logs: [
      "watching outbound request policy",
      "validating local model endpoint rules",
      "flagging config exposure as low risk",
      "awaiting connector credentials"
    ]
  }
];

export const commander = {
  id: "commander",
  name: "Commander",
  callsign: "USER",
  color: "#e879f9",
  icon: Bot
};

export const systemMetrics = {
  totalTasksCompleted: agents.reduce((total, agent) => total + agent.completedTasks, 0),
  activeAgents: agents.filter((agent) => agent.status === "active").length,
  queueDepth: 14,
  signalIntegrity: 96
};

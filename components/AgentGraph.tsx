"use client";

import {
  Background,
  BaseEdge,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  getBezierPath,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps
} from "@xyflow/react";
import { useMemo } from "react";
import { agents, commander } from "@/lib/agents";
import type { Agent } from "@/lib/agents";

type RoleNodeData = {
  label: string;
  sublabel: string;
  role: "commander" | "agent";
  status?: "active" | "idle";
  color: string;
};

type RoleNode = Node<RoleNodeData, "roleNode">;

type AgentGraphProps = {
  agentsList?: Agent[];
  selectedAgentId: string;
  onSelectAgent: (agentId: string) => void;
};

const nodeTypes = {
  roleNode: GlowingRoleNode
};

const edgeTypes = {
  particle: ParticleEdge
};

export function AgentGraph({ agentsList = agents, selectedAgentId, onSelectAgent }: AgentGraphProps) {
  const nodes = useMemo<RoleNode[]>(() => {
    const radius = 260;
    const center = { x: 410, y: 260 };

    const commanderNode: RoleNode = {
      id: commander.id,
      type: "roleNode",
      position: center,
      data: {
        label: commander.name,
        sublabel: commander.callsign,
        role: "commander",
        color: commander.color
      },
      draggable: false
    };

    const agentNodes = agentsList.map((agent, index) => {
      const angle = (Math.PI * 2 * index) / agentsList.length - Math.PI / 2;
      return {
        id: agent.id,
        type: "roleNode",
        position: {
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius
        },
        data: {
          label: agent.name,
          sublabel: agent.callsign,
          role: "agent",
          status: agent.status,
          color: selectedAgentId === agent.id ? "#ffffff" : agent.color
        },
        draggable: false
      } satisfies RoleNode;
    });

    return [commanderNode, ...agentNodes];
  }, [agentsList, selectedAgentId]);

  const edges = useMemo<Edge[]>(
    () =>
      agentsList.map((agent, index) => ({
        id: `commander-${agent.id}`,
        source: commander.id,
        target: agent.id,
        type: "particle",
        animated: true,
        data: {
          color: agent.color,
          duration: 2.6 + index * 0.25
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: agent.color,
          width: 18,
          height: 18
        }
      })),
    [agentsList]
  );

  return (
    <section className="min-h-[680px] overflow-hidden rounded-lg border border-cyan-300/20 bg-slate-950/58 shadow-neon-cyan backdrop-blur-xl">
      <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/75">React Flow Graph View</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Communication Map</h2>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs text-slate-300">
          <GraphKey color="#22d3ee" label="research" />
          <GraphKey color="#a855f7" label="design" />
          <GraphKey color="#4ade80" label="active" />
        </div>
      </div>

      <div className="h-[610px] w-full">
        <ReactFlow
          colorMode="dark"
          edgeTypes={edgeTypes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.22 }}
          maxZoom={1.35}
          minZoom={0.48}
          nodes={nodes}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => {
            if (node.id !== commander.id) {
              onSelectAgent(node.id);
            }
          }}
          panOnScroll
          proOptions={{ hideAttribution: true }}
        >
          <Background color="rgba(34, 211, 238, 0.22)" gap={34} size={1.2} />
          <MiniMap
            maskColor="rgba(2, 6, 23, 0.68)"
            nodeBorderRadius={80}
            nodeColor={(node) => String((node.data as RoleNodeData).color)}
            pannable
            zoomable
          />
          <Controls position="bottom-right" />
        </ReactFlow>
      </div>
    </section>
  );
}

function GlowingRoleNode({ data }: NodeProps<RoleNode>) {
  const isCommander = data.role === "commander";
  const sizeClass = isCommander ? "h-36 w-36" : "h-28 w-28";

  return (
    <div
      className={`${sizeClass} grid cursor-pointer place-items-center rounded-full border bg-slate-950/86 text-center backdrop-blur-xl transition hover:scale-105`}
      style={{
        borderColor: `${data.color}88`,
        boxShadow: `0 0 26px ${data.color}66, inset 0 0 22px ${data.color}22`
      }}
    >
      <Handle className="opacity-0" position={Position.Top} type="target" />
      <Handle className="opacity-0" position={Position.Right} type="source" />
      <Handle className="opacity-0" position={Position.Bottom} type="target" />
      <Handle className="opacity-0" position={Position.Left} type="source" />

      <div className="px-4">
        <div
          className="mx-auto mb-2 h-2.5 w-2.5 rounded-full"
          style={{
            background: data.status === "idle" ? "#64748b" : data.color,
            boxShadow: data.status === "idle" ? "none" : `0 0 14px ${data.color}`
          }}
        />
        <p className="text-sm font-semibold text-white">{data.label}</p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{data.sublabel}</p>
      </div>
    </div>
  );
}

function ParticleEdge(props: EdgeProps) {
  const { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, markerEnd } = props;
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  });
  const data = props.data as { color?: string; duration?: number } | undefined;
  const color = data?.color ?? "#22d3ee";
  const duration = data?.duration ?? 3;

  return (
    <>
      <BaseEdge
        markerEnd={markerEnd}
        path={edgePath}
        style={{
          stroke: color,
          strokeOpacity: 0.66,
          strokeWidth: 1.8,
          filter: `drop-shadow(0 0 8px ${color})`
        }}
      />
      <circle className="flowing-particle" fill={color} r="4">
        <animateMotion dur={`${duration}s`} path={edgePath} repeatCount="indefinite" />
      </circle>
      <circle className="flowing-particle" fill="#ffffff" opacity="0.72" r="2">
        <animateMotion begin="0.42s" dur={`${duration}s`} path={edgePath} repeatCount="indefinite" />
      </circle>
    </>
  );
}

function GraphKey({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded border border-white/10 bg-white/[0.04] px-2 py-1">
      <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
      <span className="uppercase tracking-[0.12em]">{label}</span>
    </div>
  );
}

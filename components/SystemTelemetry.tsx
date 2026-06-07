"use client";

import { Activity, Cpu, DatabaseZap, HardDrive } from "lucide-react";
import { useEffect, useState } from "react";
import type { SystemTelemetry as Telemetry } from "@/lib/telemetry";

export function SystemTelemetry() {
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);

  useEffect(() => {
    let mounted = true;
    let timer: number | undefined;

    async function pullTelemetry() {
      try {
        const response = await fetch("/api/system/telemetry");
        const nextTelemetry = (await response.json()) as Telemetry;

        if (mounted) {
          setTelemetry(nextTelemetry);
        }
      } finally {
        if (mounted) {
          timer = window.setTimeout(pullTelemetry, 10000);
        }
      }
    }

    void pullTelemetry();

    return () => {
      mounted = false;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  return (
    <section className="rounded-lg border border-cyan-300/16 bg-slate-950/54 p-3 backdrop-blur-xl">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        <TelemetryCell
          icon={Activity}
          label="Ollama"
          tone={telemetry?.ollamaOnline ? "green" : "amber"}
          value={telemetry?.ollamaOnline ? "online" : "checking"}
        />
        <TelemetryCell
          icon={Activity}
          label="Python MAS"
          tone={telemetry?.pythonBackendOnline ? "green" : "amber"}
          value={telemetry?.pythonBackendOnline ? "online" : "fallback"}
        />
        <TelemetryCell icon={DatabaseZap} label="Models" value={telemetry?.models.join(", ") || "loading"} />
        <TelemetryCell icon={Cpu} label="Runtime" value={telemetry ? `${telemetry.nodeVersion} ${telemetry.platform}` : "loading"} />
        <TelemetryCell
          icon={HardDrive}
          label="Memory"
          value={telemetry ? `${telemetry.freeMemoryMb}MB / ${telemetry.totalMemoryMb}MB free` : "loading"}
        />
      </div>
    </section>
  );
}

function TelemetryCell({
  icon: Icon,
  label,
  tone = "cyan",
  value
}: {
  icon: typeof Activity;
  label: string;
  tone?: "cyan" | "green" | "amber";
  value: string;
}) {
  const toneClass = {
    amber: "text-amber-200 border-amber-300/20",
    cyan: "text-cyan-200 border-cyan-300/20",
    green: "text-emerald-200 border-emerald-300/20"
  }[tone];

  return (
    <div className={`min-w-0 rounded-md border bg-white/[0.035] px-3 py-2 ${toneClass}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" />
        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      </div>
      <p className="mt-1 truncate font-mono text-xs text-slate-200">{value}</p>
    </div>
  );
}

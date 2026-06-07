import os from "node:os";
import { NextResponse } from "next/server";
import type { SystemTelemetry } from "@/lib/telemetry";

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5-coder:latest";
const PYTHON_MAS_URL = process.env.PYTHON_MAS_URL ?? "http://127.0.0.1:5055";

export async function GET() {
  const telemetry: SystemTelemetry = {
    timestamp: new Date().toISOString(),
    ollamaOnline: false,
    ollamaHost: OLLAMA_HOST,
    defaultModel: OLLAMA_MODEL,
    pythonBackendOnline: false,
    pythonBackendUrl: PYTHON_MAS_URL,
    models: [],
    nodeVersion: process.version,
    platform: `${process.platform}/${process.arch}`,
    freeMemoryMb: Math.round(os.freemem() / 1024 / 1024),
    totalMemoryMb: Math.round(os.totalmem() / 1024 / 1024)
  };

  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
      signal: AbortSignal.timeout(3500)
    });

    if (response.ok) {
      const data = (await response.json()) as { models?: Array<{ name?: string; model?: string }> };
      telemetry.ollamaOnline = true;
      telemetry.models = data.models?.map((model) => model.name ?? model.model ?? "unknown").filter(Boolean) ?? [];
    }
  } catch {
    telemetry.ollamaOnline = false;
  }

  try {
    const response = await fetch(`${PYTHON_MAS_URL}/health`, {
      signal: AbortSignal.timeout(3000)
    });

    if (response.ok) {
      telemetry.pythonBackendOnline = true;
    }
  } catch {
    telemetry.pythonBackendOnline = false;
  }

  return NextResponse.json(telemetry);
}

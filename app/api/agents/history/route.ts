import { NextResponse } from "next/server";

const PYTHON_MAS_URL = process.env.PYTHON_MAS_URL ?? "http://127.0.0.1:5055";

type PythonMasLog = {
  timestamp?: string;
  type?: string;
  command?: string;
  runId?: string;
  agentId?: string;
  task?: string;
  priority?: string;
  expectedOutput?: string;
  proof?: string;
  tool?: string;
  ok?: boolean;
  summary?: string;
  durationMs?: number;
  exitCode?: number | null;
  details?: string[];
};

export async function GET() {
  try {
    const response = await fetch(`${PYTHON_MAS_URL}/api/logs`, {
      method: "GET",
      signal: AbortSignal.timeout(4000)
    });

    if (!response.ok) {
      throw new Error("Python MAS logs unavailable");
    }

    const payload = (await response.json()) as { logs?: PythonMasLog[] };
    return NextResponse.json({
      logs: payload.logs?.slice(-64) ?? [],
      source: "python-mas"
    });
  } catch {
    return NextResponse.json({
      logs: [],
      source: "offline"
    });
  }
}

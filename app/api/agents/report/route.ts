import { NextResponse } from "next/server";

const PYTHON_MAS_URL = process.env.PYTHON_MAS_URL ?? "http://127.0.0.1:5055";

export async function GET() {
  try {
    const response = await fetch(`${PYTHON_MAS_URL}/api/report`, {
      method: "GET",
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new Error("Python MAS report unavailable");
    }

    return NextResponse.json(await response.json());
  } catch {
    return NextResponse.json({
      report: null,
      source: "offline"
    });
  }
}

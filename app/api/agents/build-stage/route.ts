import { NextResponse } from "next/server";

const PYTHON_MAS_URL = process.env.PYTHON_MAS_URL ?? "http://127.0.0.1:5055";

export async function GET() {
  try {
    const response = await fetch(`${PYTHON_MAS_URL}/api/build-stage`, {
      method: "GET",
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new Error("Python MAS build-stage proposal unavailable");
    }

    return NextResponse.json(await response.json());
  } catch {
    return NextResponse.json({
      proposal: null,
      source: "offline"
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const response = await fetch(`${PYTHON_MAS_URL}/api/build-stage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) {
      throw new Error("Python MAS build-stage proposal rejected");
    }

    return NextResponse.json(await response.json());
  } catch {
    return NextResponse.json(
      {
        proposal: null,
        source: "offline"
      },
      { status: 503 }
    );
  }
}

import {
  studioSessions,
  commandQueues,
  type StudioCommand,
} from "@/lib/studio-state";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const session = studioSessions.get(sessionId);
    if (session) {
      session.lastHeartbeat = Date.now();
    }

    const queue = commandQueues.get(sessionId) ?? [];
    commandQueues.set(sessionId, []);

    const result: { commands: StudioCommand[] } = { commands: queue };
    return NextResponse.json(result);
  } catch (err) {
    console.error("studio/poll GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

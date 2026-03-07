import {
  studioSessions,
  cleanupStaleSessions,
  type StudioSession,
} from "@/lib/studio-state";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "crypto";

interface RegisterBody {
  placeId?: string;
  placeName?: string;
  universeId?: string;
  creatorType?: string;
  creatorId?: string;
  sessionId?: string;
}

export async function POST(request: NextRequest) {
  try {
    cleanupStaleSessions(30000);

    const body = (await request.json()) as RegisterBody;
    const {
      placeId,
      placeName,
      universeId,
      creatorType,
      creatorId,
      sessionId: providedSessionId,
    } = body;

    const sessionId = providedSessionId ?? randomUUID();
    const now = Date.now();

    const session: StudioSession = {
      sessionId,
      placeId,
      placeName,
      universeId,
      creatorType,
      creatorId,
      lastHeartbeat: now,
    };

    studioSessions.set(sessionId, session);

    return NextResponse.json({ sessionId });
  } catch (err) {
    console.error("studio/register POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

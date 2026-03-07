import {
  studioSessions,
  cleanupStaleSessions,
  type StudioSession,
} from "@/lib/studio-state";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    cleanupStaleSessions(30000);

    const sessions: Omit<StudioSession, "lastHeartbeat">[] = [];
    for (const session of studioSessions.values()) {
      sessions.push({
        sessionId: session.sessionId,
        placeId: session.placeId,
        placeName: session.placeName,
        universeId: session.universeId,
        creatorType: session.creatorType,
        creatorId: session.creatorId,
      });
    }

    return NextResponse.json({ sessions });
  } catch (err) {
    console.error("studio/sessions GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

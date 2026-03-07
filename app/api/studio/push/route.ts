import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-guard";
import { commandQueues, type StudioCommand } from "@/lib/studio-state";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

interface PushBody {
  sessionId: string;
  instancePath: string;
  source: string;
  commandType?: string;
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  try {
    const body = (await request.json()) as PushBody;
    const { sessionId, instancePath, source, commandType = "Execute" } = body;

    if (!sessionId || instancePath === undefined || source === undefined) {
      return NextResponse.json(
        { error: "sessionId, instancePath, and source are required" },
        { status: 400 }
      );
    }

    const command: StudioCommand = {
      commandType,
      instancePath,
      source,
    };

    const queue = commandQueues.get(sessionId) ?? [];
    queue.push(command);
    commandQueues.set(sessionId, queue);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("studio/push POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

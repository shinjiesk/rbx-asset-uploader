import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-guard";
import { commandQueues, type StudioCommand } from "@/lib/studio-state";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

interface PlaceBody {
  sessionId: string;
  assetType: string;
  assetId: string;
  instancePath: string;
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  try {
    const body = (await request.json()) as PlaceBody;
    const { sessionId, assetType, assetId, instancePath } = body;

    if (!sessionId || !assetType || !assetId || !instancePath) {
      return NextResponse.json(
        { error: "sessionId, assetType, assetId, and instancePath are required" },
        { status: 400 }
      );
    }

    const source = JSON.stringify({
      assetType,
      assetId,
      rbxassetid: `rbxassetid://${assetId}`,
    });

    const command: StudioCommand = {
      commandType: "PlaceAsset",
      instancePath,
      source,
    };

    const queue = commandQueues.get(sessionId) ?? [];
    queue.push(command);
    commandQueues.set(sessionId, queue);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("studio/place POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-guard";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  try {
    return NextResponse.json({
      services: ["ServerStorage", "ReplicatedStorage", "Workspace", "SoundService"],
    });
  } catch (err) {
    console.error("studio/tree GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

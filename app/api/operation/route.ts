import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { getOperation, makeAuthHeaders, RobloxApiError } from "@/lib/roblox-api";
import { decrypt } from "@/lib/crypto";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const operationId = searchParams.get("operationId");
    const projectId = searchParams.get("projectId");

    if (!operationId || !projectId) {
      return NextResponse.json(
        { error: "Missing required query params: operationId, projectId" },
        { status: 400 }
      );
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: user.id },
      include: { groupProfile: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    let authHeaders: ReturnType<typeof makeAuthHeaders>;

    if (project.creatorType === "user") {
      if (!user.accessToken) {
        return NextResponse.json(
          { error: "OAuth token not available. Please re-login." },
          { status: 400 }
        );
      }
      authHeaders = makeAuthHeaders("oauth", user.accessToken);
    } else {
      if (!project.groupProfile) {
        return NextResponse.json(
          { error: "Group profile not found for this project" },
          { status: 400 }
        );
      }
      const apiKey = decrypt(project.groupProfile.apiKey);
      authHeaders = makeAuthHeaders("api_key", apiKey);
    }

    const operation = await getOperation(operationId, authHeaders);
    return NextResponse.json(operation);
  } catch (e) {
    if (e instanceof RobloxApiError) {
      const status =
        e.code === "auth" ? 401 : e.code === "validation" ? 400 : 502;
      return NextResponse.json({ error: e.message }, { status });
    }
    if (e instanceof Error && e.message.includes("Invalid encrypted format")) {
      return NextResponse.json(
        { error: "Invalid API key configuration" },
        { status: 500 }
      );
    }
    console.error("Operation fetch error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Operation fetch failed" },
      { status: 500 }
    );
  }
}

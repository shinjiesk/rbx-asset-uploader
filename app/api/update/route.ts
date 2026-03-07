import { NextResponse } from "next/server";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import {
  updateAsset,
  makeAuthHeaders,
  RobloxApiError,
} from "@/lib/roblox-api";
import { getAssetTypeInfo } from "@/lib/asset-types";
import { decrypt } from "@/lib/crypto";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;
    const assetId = formData.get("assetId") as string | null;

    if (!file || typeof projectId !== "string" || typeof assetId !== "string") {
      return NextResponse.json(
        { error: "Missing required fields: file, projectId, assetId" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 20MB limit" },
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

    const filename = file.name;
    const typeInfo = getAssetTypeInfo(filename);
    if (!typeInfo) {
      return NextResponse.json(
        { error: `Unsupported file type: ${filename}` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    await updateAsset(assetId, buffer, filename, typeInfo.apiType, authHeaders);

    return NextResponse.json({ assetId, filename });
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
    console.error("Update error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 500 }
    );
  }
}

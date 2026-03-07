import { NextResponse } from "next/server";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import {
  createAsset,
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
    const displayName = formData.get("displayName") as string | null;

    if (!file || typeof projectId !== "string" || typeof displayName !== "string") {
      return NextResponse.json(
        { error: "Missing required fields: file, projectId, displayName" },
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
    let creatorType: "user" | "group";
    let creatorId: string;

    if (project.creatorType === "user") {
      if (!user.accessToken) {
        return NextResponse.json(
          { error: "OAuth token not available. Please re-login." },
          { status: 400 }
        );
      }
      authHeaders = makeAuthHeaders("oauth", user.accessToken);
      creatorType = "user";
      creatorId = user.robloxUserId;
    } else {
      if (!project.groupProfile) {
        return NextResponse.json(
          { error: "Group profile not found for this project" },
          { status: 400 }
        );
      }
      const apiKey = decrypt(project.groupProfile.apiKey);
      authHeaders = makeAuthHeaders("api_key", apiKey);
      creatorType = "group";
      creatorId = project.groupProfile.groupId;
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
    const assetId = await createAsset(
      buffer,
      filename,
      typeInfo.apiType,
      displayName,
      creatorType,
      creatorId,
      authHeaders
    );

    await prisma.assetEntry.upsert({
      where: {
        projectId_filename: { projectId, filename },
      },
      create: {
        projectId,
        filename,
        category: typeInfo.category,
        assetId,
      },
      update: {
        assetId,
        category: typeInfo.category,
      },
    });

    return NextResponse.json({
      assetId,
      filename,
      category: typeInfo.category,
    });
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
    console.error("Upload error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}

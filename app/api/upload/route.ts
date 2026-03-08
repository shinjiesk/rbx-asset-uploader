import { NextResponse } from "next/server";
import { getAuthenticatedUser, getAccessToken, unauthorizedResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { getAssetTypeInfo } from "@/lib/asset-types";
import { decrypt } from "@/lib/crypto";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ROBLOX_ASSETS_URL = "https://apis.roblox.com/assets/v1/assets";

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
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const filename = file.name;
    const typeInfo = getAssetTypeInfo(filename);
    if (!typeInfo) {
      return NextResponse.json(
        { error: `Unsupported file type: ${filename}` },
        { status: 400 }
      );
    }

    let authHeader: Record<string, string>;
    let creator: Record<string, string>;

    if (project.creatorType === "user") {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        return NextResponse.json(
          { error: "OAuth token not available. Please re-login." },
          { status: 400 }
        );
      }
      authHeader = { Authorization: `Bearer ${accessToken}` };
      creator = { userId: user.robloxUserId };
    } else {
      if (!user.apiKey) {
        return NextResponse.json(
          { error: "API キーが設定されていません。設定ページで登録してください。" },
          { status: 400 }
        );
      }
      if (!project.groupId) {
        return NextResponse.json(
          { error: "Group ID not found for this project" },
          { status: 400 }
        );
      }
      const apiKey = decrypt(user.apiKey);
      authHeader = { "x-api-key": apiKey };
      creator = { groupId: project.groupId };
    }

    const fileBytes = new Uint8Array(await file.arrayBuffer());

    const requestJson = JSON.stringify({
      assetType: typeInfo.apiType,
      displayName,
      description: "",
      creationContext: { creator },
    });

    const boundary = `----FormBoundary${Date.now()}`;
    const parts: Buffer[] = [];

    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="request"\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${requestJson}\r\n`
    ));

    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="fileContent"; filename="${filename}"\r\n` +
      `Content-Type: ${typeInfo.contentType}\r\n\r\n`
    ));
    parts.push(Buffer.from(fileBytes));
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const bodyBuffer = Buffer.concat(parts);

    const resp = await fetch(ROBLOX_ASSETS_URL, {
      method: "POST",
      headers: {
        ...authHeader,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: bodyBuffer,
    });

    if (!resp.ok) {
      const respText = await resp.text();
      let errorMsg: string;
      try {
        const errJson = JSON.parse(respText);
        errorMsg = errJson.message || errJson.errors?.[0]?.message || respText;
      } catch {
        errorMsg = respText;
      }

      if (resp.status === 401 && errorMsg.toLowerCase().includes("invalid api key")) {
        return NextResponse.json(
          { error: "API キーが無効です。設定ページで正しいキーを再登録してください。" },
          { status: 401 }
        );
      }

      const status = resp.status === 401 || resp.status === 403 ? 401 : resp.status >= 500 ? 502 : 400;
      return NextResponse.json({ error: errorMsg }, { status });
    }

    const respJson = await resp.json();
    const operationPath = respJson.path;

    let assetId: string | null = null;

    if (respJson.done && respJson.response?.assetId) {
      assetId = respJson.response.assetId;
    } else if (operationPath) {
      assetId = await pollOperation(operationPath, authHeader);
    }

    if (!assetId) {
      return NextResponse.json(
        { error: "Failed to get asset ID from operation" },
        { status: 502 }
      );
    }

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
    console.error("Upload error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}

async function pollOperation(
  operationPath: string,
  authHeader: Record<string, string>
): Promise<string> {
  const maxPolls = 30;
  const interval = 2000;

  for (let i = 0; i < maxPolls; i++) {
    await new Promise((r) => setTimeout(r, interval));

    const resp = await fetch(
      `https://apis.roblox.com/assets/v1/${operationPath}`,
      { headers: authHeader }
    );

    if (!resp.ok) continue;

    const data = await resp.json();
    if (data.done && data.response?.assetId) {
      return data.response.assetId;
    }
  }

  throw new Error("Operation polling timed out");
}

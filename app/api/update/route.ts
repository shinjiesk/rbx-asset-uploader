import { NextResponse } from "next/server";
import { getAuthenticatedUser, getAccessToken, unauthorizedResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
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

    if (project.creatorType === "user") {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        return NextResponse.json(
          { error: "OAuth token not available. Please re-login." },
          { status: 400 }
        );
      }
      authHeader = { Authorization: `Bearer ${accessToken}` };
    } else {
      if (!user.apiKey) {
        return NextResponse.json(
          { error: "API キーが設定されていません。設定ページで登録してください。" },
          { status: 400 }
        );
      }
      const apiKey = decrypt(user.apiKey);
      authHeader = { "x-api-key": apiKey };
    }

    const fileBytes = new Uint8Array(await file.arrayBuffer());

    const requestJson = JSON.stringify({ assetType: typeInfo.apiType });

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

    const resp = await fetch(
      `https://apis.roblox.com/assets/v1/assets/${assetId}`,
      {
        method: "PATCH",
        headers: {
          ...authHeader,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body: bodyBuffer,
      }
    );

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

    return NextResponse.json({ assetId, filename });
  } catch (e) {
    console.error("Update error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 500 }
    );
  }
}

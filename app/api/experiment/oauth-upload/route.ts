import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  getAccessToken,
  unauthorizedResponse,
} from "@/lib/auth-guard";

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { error: "No access token available. Re-login may be required." },
      { status: 401 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const creatorType = formData.get("creatorType") as string | null;
    const creatorId = formData.get("creatorId") as string | null;
    const displayName = formData.get("displayName") as string | null;

    if (!file || !creatorType || !creatorId || !displayName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const fileBytes = new Uint8Array(await file.arrayBuffer());

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const typeMap: Record<string, { assetType: string; contentType: string }> = {
      png: { assetType: "Decal", contentType: "image/png" },
      jpg: { assetType: "Decal", contentType: "image/jpeg" },
      jpeg: { assetType: "Decal", contentType: "image/jpeg" },
      bmp: { assetType: "Decal", contentType: "image/bmp" },
      mp3: { assetType: "Audio", contentType: "audio/mpeg" },
      ogg: { assetType: "Audio", contentType: "audio/ogg" },
      fbx: { assetType: "Model", contentType: "model/fbx" },
    };

    const typeInfo = typeMap[ext];
    if (!typeInfo) {
      return NextResponse.json(
        { error: `Unsupported file type: .${ext}` },
        { status: 400 }
      );
    }

    const creator =
      creatorType === "user"
        ? { userId: creatorId }
        : { groupId: creatorId };

    const requestJson = JSON.stringify({
      assetType: typeInfo.assetType,
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
      `Content-Disposition: form-data; name="fileContent"; filename="${file.name}"\r\n` +
      `Content-Type: ${typeInfo.contentType}\r\n\r\n`
    ));
    parts.push(Buffer.from(fileBytes));
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const bodyBuffer = Buffer.concat(parts);

    const resp = await fetch("https://apis.roblox.com/assets/v1/assets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: bodyBuffer,
    });

    const respText = await resp.text();
    let respJson;
    try {
      respJson = JSON.parse(respText);
    } catch {
      respJson = { raw: respText };
    }

    return NextResponse.json({
      status: resp.status,
      ok: resp.ok,
      authMethod: "oauth",
      debug: {
        fileSize: fileBytes.length,
        bodySize: bodyBuffer.length,
        requestJson,
        tokenPrefix: accessToken.substring(0, 20) + "...",
      },
      response: respJson,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

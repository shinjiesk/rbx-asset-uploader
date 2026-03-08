import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  let keyPreview: string | null = null;
  if (user.apiKey) {
    try {
      const decrypted = decrypt(user.apiKey);
      keyPreview = decrypted.substring(0, 6) + "..." + decrypted.slice(-4);
    } catch {
      keyPreview = "(復号エラー)";
    }
  }

  return NextResponse.json({
    hasApiKey: !!user.apiKey,
    keyPreview,
  });
}

async function verifyApiKeyWithRoblox(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const resp = await fetch("https://apis.roblox.com/assets/v1/assets?pageSize=1", {
      headers: { "x-api-key": apiKey },
    });
    if (resp.status === 401) {
      const text = await resp.text();
      if (text.toLowerCase().includes("invalid api key")) {
        return { valid: false, error: "このAPIキーはRobloxに認識されません。正しいキーを確認してください。" };
      }
    }
    return { valid: true };
  } catch {
    return { valid: true };
  }
}

export async function PUT(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { apiKey } = body as { apiKey?: string };

    if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
      return NextResponse.json(
        { error: "apiKey is required and must be non-empty" },
        { status: 400 }
      );
    }

    const trimmedKey = apiKey.trim();

    const verification = await verifyApiKeyWithRoblox(trimmedKey);
    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { apiKey: encrypt(trimmedKey) },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PUT /api/user-apikey:", e);
    return NextResponse.json(
      { error: "Failed to save API key" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { apiKey: null },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/user-apikey:", e);
    return NextResponse.json(
      { error: "Failed to delete API key" },
      { status: 500 }
    );
  }
}

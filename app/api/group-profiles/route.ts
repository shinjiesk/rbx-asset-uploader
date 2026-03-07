import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { GroupProfile } from "@prisma/client";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  try {
    const profiles = await prisma.groupProfile.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    const result = profiles.map((p: GroupProfile) => ({
      id: p.id,
      groupId: p.groupId,
      groupName: p.groupName,
      roleName: p.roleName,
      createdAt: p.createdAt,
    }));

    return NextResponse.json(result);
  } catch (e) {
    console.error("GET /api/group-profiles:", e);
    return NextResponse.json(
      { error: "Failed to list group profiles" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { groupId, groupName, roleName, apiKey } = body as {
      groupId?: string | number;
      groupName?: string;
      roleName?: string;
      apiKey?: string;
    };

    if (!groupId || (typeof groupId !== "string" && typeof groupId !== "number")) {
      return NextResponse.json(
        { error: "groupId is required" },
        { status: 400 }
      );
    }

    if (!groupName || typeof groupName !== "string" || groupName.trim() === "") {
      return NextResponse.json(
        { error: "groupName is required and must be non-empty" },
        { status: 400 }
      );
    }

    if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
      return NextResponse.json(
        { error: "apiKey is required and must be non-empty" },
        { status: 400 }
      );
    }

    const groupIdStr = String(groupId);

    const existing = await prisma.groupProfile.findUnique({
      where: {
        userId_groupId: { userId: user.id, groupId: groupIdStr },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Group profile already exists for this group" },
        { status: 409 }
      );
    }

    const encryptedApiKey = encrypt(apiKey.trim());

    const profile = await prisma.groupProfile.create({
      data: {
        userId: user.id,
        groupId: groupIdStr,
        groupName: groupName.trim(),
        roleName: roleName != null ? String(roleName).trim() : null,
        apiKey: encryptedApiKey,
      },
    });

    return NextResponse.json({
      id: profile.id,
      groupId: profile.groupId,
      groupName: profile.groupName,
      roleName: profile.roleName,
      createdAt: profile.createdAt,
    });
  } catch (e) {
    console.error("POST /api/group-profiles:", e);
    return NextResponse.json(
      { error: "Failed to create group profile" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { id, apiKey } = body as { id?: string; apiKey?: string };

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const profile = await prisma.groupProfile.findFirst({
      where: { id, userId: user.id },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Group profile not found or access denied" },
        { status: 404 }
      );
    }

    const updates: { apiKey?: string } = {};

    if (apiKey !== undefined) {
      if (typeof apiKey !== "string" || apiKey.trim() === "") {
        return NextResponse.json(
          { error: "apiKey must be non-empty when provided" },
          { status: 400 }
        );
      }
      updates.apiKey = encrypt(apiKey.trim());
    }

    const updated = await prisma.groupProfile.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({
      id: updated.id,
      groupId: updated.groupId,
      groupName: updated.groupName,
      roleName: updated.roleName,
      createdAt: updated.createdAt,
    });
  } catch (e) {
    console.error("PATCH /api/group-profiles:", e);
    return NextResponse.json(
      { error: "Failed to update group profile" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { id } = body as { id?: string };

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const profile = await prisma.groupProfile.findFirst({
      where: { id, userId: user.id },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Group profile not found or access denied" },
        { status: 404 }
      );
    }

    await prisma.groupProfile.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/group-profiles:", e);
    return NextResponse.json(
      { error: "Failed to delete group profile" },
      { status: 500 }
    );
  }
}

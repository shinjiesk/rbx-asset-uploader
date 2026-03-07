import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  try {
    const projects = await prisma.project.findMany({
      where: { userId: user.id },
      include: {
        _count: {
          select: { places: true, assetEntries: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = projects.map((p) => ({
      id: p.id,
      name: p.name,
      creatorType: p.creatorType as "user" | "group",
      groupProfileId: p.groupProfileId,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      placesCount: p._count.places,
      assetEntriesCount: p._count.assetEntries,
    }));

    return NextResponse.json(result);
  } catch (e) {
    console.error("GET /api/projects:", e);
    return NextResponse.json(
      { error: "Failed to list projects" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { name, creatorType, groupProfileId } = body as {
      name?: string;
      creatorType?: "user" | "group";
      groupProfileId?: string;
    };

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "name is required and must be non-empty" },
        { status: 400 }
      );
    }

    if (!creatorType || !["user", "group"].includes(creatorType)) {
      return NextResponse.json(
        { error: "creatorType must be 'user' or 'group'" },
        { status: 400 }
      );
    }

    const effectiveGroupProfileId =
      creatorType === "group" ? groupProfileId ?? null : null;

    if (creatorType === "group" && !effectiveGroupProfileId) {
      return NextResponse.json(
        { error: "groupProfileId is required when creatorType is 'group'" },
        { status: 400 }
      );
    }

    if (effectiveGroupProfileId) {
      const gp = await prisma.groupProfile.findFirst({
        where: { id: effectiveGroupProfileId, userId: user.id },
      });
      if (!gp) {
        return NextResponse.json(
          { error: "Group profile not found or access denied" },
          { status: 404 }
        );
      }
    }

    const project = await prisma.project.create({
      data: {
        userId: user.id,
        name: name.trim(),
        creatorType,
        groupProfileId: effectiveGroupProfileId,
      },
    });

    return NextResponse.json(project);
  } catch (e) {
    console.error("POST /api/projects:", e);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { id, name, creatorType, groupProfileId } = body as {
      id?: string;
      name?: string;
      creatorType?: "user" | "group";
      groupProfileId?: string;
    };

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const project = await prisma.project.findFirst({
      where: { id, userId: user.id },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 }
      );
    }

    const updates: {
      name?: string;
      creatorType?: string;
      groupProfileId?: string | null;
    } = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim() === "") {
        return NextResponse.json(
          { error: "name must be non-empty when provided" },
          { status: 400 }
        );
      }
      updates.name = name.trim();
    }

    if (creatorType !== undefined) {
      if (!["user", "group"].includes(creatorType)) {
        return NextResponse.json(
          { error: "creatorType must be 'user' or 'group'" },
          { status: 400 }
        );
      }
      updates.creatorType = creatorType;
      updates.groupProfileId =
        creatorType === "group" ? groupProfileId ?? null : null;

      if (creatorType === "group" && !updates.groupProfileId) {
        return NextResponse.json(
          { error: "groupProfileId is required when creatorType is 'group'" },
          { status: 400 }
        );
      }

      if (updates.groupProfileId) {
        const gp = await prisma.groupProfile.findFirst({
          where: { id: updates.groupProfileId, userId: user.id },
        });
        if (!gp) {
          return NextResponse.json(
            { error: "Group profile not found or access denied" },
            { status: 404 }
          );
        }
      }
    }

    const updated = await prisma.project.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("PATCH /api/projects:", e);
    return NextResponse.json(
      { error: "Failed to update project" },
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

    const project = await prisma.project.findFirst({
      where: { id, userId: user.id },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 }
      );
    }

    await prisma.project.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/projects:", e);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}

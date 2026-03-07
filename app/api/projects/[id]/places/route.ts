import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";

async function getProjectForUser(projectId: string, userId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, userId },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  try {
    const { id: projectId } = await params;

    const project = await getProjectForUser(projectId, user.id);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 }
      );
    }

    const places = await prisma.projectPlace.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(places);
  } catch (e) {
    console.error("GET /api/projects/[id]/places:", e);
    return NextResponse.json(
      { error: "Failed to list places" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  try {
    const { id: projectId } = await params;

    const project = await getProjectForUser(projectId, user.id);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { placeId, placeName } = body as {
      placeId: string | number;
      placeName?: string;
    };

    if (placeId === undefined || placeId === null) {
      return NextResponse.json(
        { error: "placeId is required" },
        { status: 400 }
      );
    }

    const placeIdStr = String(placeId);

    const existing = await prisma.projectPlace.findUnique({
      where: {
        projectId_placeId: { projectId, placeId: placeIdStr },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Place already exists in this project" },
        { status: 409 }
      );
    }

    const place = await prisma.projectPlace.create({
      data: {
        projectId,
        placeId: placeIdStr,
        placeName: placeName != null ? String(placeName) : null,
      },
    });

    return NextResponse.json(place);
  } catch (e) {
    console.error("POST /api/projects/[id]/places:", e);
    return NextResponse.json(
      { error: "Failed to add place" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  try {
    const { id: projectId } = await params;

    const project = await getProjectForUser(projectId, user.id);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { placeId } = body as { placeId?: string | number };

    if (placeId === undefined || placeId === null) {
      return NextResponse.json(
        { error: "placeId is required" },
        { status: 400 }
      );
    }

    const placeIdStr = String(placeId);

    const existing = await prisma.projectPlace.findUnique({
      where: {
        projectId_placeId: { projectId, placeId: placeIdStr },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Place not found in this project" },
        { status: 404 }
      );
    }

    await prisma.projectPlace.delete({
      where: {
        projectId_placeId: { projectId, placeId: placeIdStr },
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/projects/[id]/places:", e);
    return NextResponse.json(
      { error: "Failed to remove place" },
      { status: 500 }
    );
  }
}

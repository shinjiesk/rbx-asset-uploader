import { auth } from "./auth";
import { prisma } from "./db";
import { NextResponse } from "next/server";

export async function getAuthenticatedUser() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.upsert({
    where: { robloxUserId: session.user.id },
    create: {
      robloxUserId: session.user.id,
      robloxUsername: session.user.name ?? null,
      robloxAvatarUrl: session.user.image ?? null,
    },
    update: {
      robloxUsername: session.user.name ?? undefined,
      robloxAvatarUrl: session.user.image ?? undefined,
    },
  });

  return user;
}

export async function getAccessToken(): Promise<string | null> {
  const session = await auth();
  return ((session as unknown as Record<string, unknown>)?.accessToken as string) ?? null;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

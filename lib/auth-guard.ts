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
      robloxUsername: session.user.name,
      robloxAvatarUrl: session.user.image,
    },
    update: {},
  });

  return user;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

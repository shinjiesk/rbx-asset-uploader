import { auth } from "./auth";
import { prisma } from "./db";
import { NextResponse } from "next/server";

export async function getAuthenticatedUser() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { robloxUserId: session.user.id },
  });

  return user;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

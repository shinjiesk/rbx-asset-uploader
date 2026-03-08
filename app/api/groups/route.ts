import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-guard";
import { getUserGroups } from "@/lib/roblox-api";

export async function GET(_request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  try {
    const groups = await getUserGroups(user.robloxUserId);

    const result = groups
      .filter((g) => g.role.rank >= 100)
      .sort((a, b) => b.role.rank - a.role.rank)
      .map((g) => ({
        groupId: g.group.id,
        groupName: g.group.name,
        roleName: g.role.name,
        roleRank: g.role.rank,
      }));

    return NextResponse.json(result);
  } catch (e) {
    console.error("GET /api/groups:", e);
    return NextResponse.json(
      { error: "Failed to fetch groups" },
      { status: 500 }
    );
  }
}

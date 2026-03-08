import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

function robloxProvider() {
  return {
    id: "roblox",
    name: "Roblox",
    type: "oauth" as const,
    clientId: process.env.ROBLOX_CLIENT_ID!,
    clientSecret: process.env.ROBLOX_CLIENT_SECRET!,
    issuer: "https://apis.roblox.com/oauth/",
    authorization: {
      url: "https://apis.roblox.com/oauth/v1/authorize",
      params: {
        scope: "openid profile asset:read asset:write",
        response_type: "code",
      },
    },
    token: {
      url: "https://apis.roblox.com/oauth/v1/token",
      conform: async (response: Response) => {
        // Roblox returns id_token even for OAuth (non-OIDC) flows.
        // Strip it to prevent oauth4webapi from attempting JWKS validation
        // against the authorization server metadata (which lacks jwks_uri
        // when explicit endpoints are used).
        const body = await response.json();
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id_token, ...rest } = body as Record<string, unknown>;
        return new Response(JSON.stringify(rest), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
    userinfo: {
      url: "https://apis.roblox.com/oauth/v1/userinfo",
    },
    checks: ["state" as const],
    client: {
      token_endpoint_auth_method: "client_secret_post",
    },
    profile(profile: Record<string, unknown>) {
      return {
        id: profile.sub as string,
        name: (profile.preferred_username as string) || (profile.name as string),
        image: (profile.picture as string) || null,
      };
    },
  };
}

function devCredentialsProvider() {
  return Credentials({
    name: "Dev Login",
    credentials: {
      username: { label: "Username", type: "text", placeholder: "TestUser" },
    },
    async authorize(credentials) {
      const username = (credentials?.username as string) || "DevUser";
      return {
        id: "dev-user-12345",
        name: username,
        image: null,
        robloxUserId: "12345",
      };
    },
  });
}

function buildProviders() {
  const providers = [];

  if (process.env.ROBLOX_CLIENT_ID && process.env.ROBLOX_CLIENT_SECRET) {
    providers.push(robloxProvider());
  }

  if (process.env.NODE_ENV === "development") {
    providers.push(devCredentialsProvider());
  }

  return providers;
}

async function refreshAccessToken(token: Record<string, unknown>) {
  try {
    const resp = await fetch("https://apis.roblox.com/oauth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: token.refreshToken as string,
        client_id: process.env.ROBLOX_CLIENT_ID!,
        client_secret: process.env.ROBLOX_CLIENT_SECRET!,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("Token refresh failed:", resp.status, text);
      return { ...token, error: "RefreshTokenError" };
    }

    const data = await resp.json();
    return {
      ...token,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? token.refreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in as number),
      error: undefined,
    };
  } catch (e) {
    console.error("Token refresh error:", e);
    return { ...token, error: "RefreshTokenError" };
  }
}

const authConfig: NextAuthConfig = {
  providers: buildProviders(),
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        token.robloxUserId = (profile?.sub as string) || token.sub;
        return token;
      }

      const expiresAt = (token.expiresAt as number) ?? 0;
      if (Date.now() / 1000 < expiresAt - 60) {
        return token;
      }

      if (token.refreshToken) {
        return await refreshAccessToken(token);
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.robloxUserId as string) || token.sub!;
      }
      (session as unknown as Record<string, unknown>).accessToken = token.accessToken;
      (session as unknown as Record<string, unknown>).error = token.error;
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
};

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);

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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        (session as unknown as Record<string, unknown>).robloxUserId =
          token.robloxUserId as string;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
};

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);

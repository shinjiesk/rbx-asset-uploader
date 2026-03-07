"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="mb-2 text-center text-2xl font-bold">
          Roblox Asset Uploader
        </h1>
        <p className="mb-8 text-center text-sm text-gray-500">
          ログインしてアセットを管理
        </p>

        <div className="space-y-3">
          <button
            onClick={() => signIn("roblox", { callbackUrl: "/" })}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#393b3d] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#4b4d4f]"
          >
            Roblox でログイン
          </button>

          {process.env.NODE_ENV === "development" && (
            <button
              onClick={() =>
                signIn("credentials", {
                  username: "DevUser",
                  callbackUrl: "/",
                })
              }
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Dev Login（開発用）
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

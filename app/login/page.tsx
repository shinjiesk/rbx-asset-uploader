"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

const ERROR_MESSAGES: Record<string, string> = {
  Configuration: "サーバー設定エラーが発生しました。管理者に連絡してください。",
  OAuthSignin: "OAuth認証の開始に失敗しました。",
  OAuthCallback: "OAuth認証のコールバックでエラーが発生しました。",
  OAuthAccountNotLinked: "このアカウントは別のログイン方法で登録されています。",
  Default: "ログインに失敗しました。もう一度お試しください。",
};

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const error = searchParams.get("error");

  async function handleDevLogin() {
    setLoading(true);
    const res = await signIn("credentials", {
      username: "DevUser",
      redirect: false,
    });
    if (res?.ok) {
      router.push("/");
    } else {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="mb-2 text-center text-2xl font-bold">
          Roblox Asset Uploader
        </h1>
        <p className="mb-8 text-center text-sm text-gray-500">
          ログインしてアセットを管理
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {ERROR_MESSAGES[error] || ERROR_MESSAGES.Default}
            <p className="mt-1 text-xs text-red-400">Error: {error}</p>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={() => signIn("roblox", { callbackUrl: "/" })}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#393b3d] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#4b4d4f]"
          >
            Roblox でログイン
          </button>

          {process.env.NODE_ENV !== "production" && (
            <button
              onClick={handleDevLogin}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? "ログイン中..." : "Dev Login（開発用）"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

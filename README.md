# Roblox Asset Uploader

Roblox のゲーム開発で使う画像・音声・3Dモデルを、ブラウザから一括アップロードできるWebアプリ。

## 機能

- **Roblox OAuth ログイン** — Robloxアカウントでログインするだけで使い始められる
- **ドラッグ＆ドロップ一括アップロード** — ファイル・フォルダをD&Dで投入、3並列でアップロード
- **プロジェクト管理** — ゲームごとにアセットを分けて管理
- **ロックファイル** — ファイル名↔アセットIDの対応をDB管理、再アップロード時はIDを維持して上書き
- **Luauコード生成** — `Assets.lua` モジュールを自動生成、名前でアセット参照可能に
- **グループ対応** — グループのOpen Cloud APIキーを暗号化保存してグループアセットもアップロード
- **Studio連携** — プラグイン経由でStudioにModuleScriptを差し込み
- **エクスポート** — CSV / TSV / Markdown / TOML 形式でアセット一覧を出力

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フレームワーク | Next.js 15 (App Router) + TypeScript |
| 認証 | NextAuth.js v5 + Roblox OAuth 2.0 |
| DB | Prisma + SQLite (dev) / Vercel Postgres (prod) |
| UI | React + Tailwind CSS |
| ホスティング | Vercel |
| Studio連携 | Luau プラグイン ↔ API Routes |

## 開発

```bash
# 依存関係インストール
npm install

# DBマイグレーション
npx prisma migrate dev

# 開発サーバー起動
npm run dev
```

ブラウザで http://localhost:3000 を開く。

### 環境変数

`.env.local.example` をコピーして `.env.local` を作成:

```bash
cp .env.local.example .env.local
```

| 変数 | 説明 |
|------|------|
| `NEXTAUTH_URL` | アプリのURL (dev: `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | セッション暗号化キー |
| `ROBLOX_CLIENT_ID` | Roblox OAuth アプリのClient ID (空ならdev mock有効) |
| `ROBLOX_CLIENT_SECRET` | Roblox OAuth アプリのClient Secret |
| `ENCRYPTION_KEY` | トークン・APIキー暗号化用 32バイトhex (64文字) |
| `DATABASE_URL` | DB接続URL (dev: `file:./prisma/dev.db`) |

### Studio プラグイン

`studio-plugin/AssetUploaderBridge.server.lua` を Roblox Studio のプラグインフォルダにコピー。

## プロジェクト構成

```
app/                    Next.js App Router
  page.tsx              メイン画面
  login/page.tsx        ログイン画面
  settings/page.tsx     設定画面
  api/                  API Routes (16 endpoints)
components/             React コンポーネント
lib/                    サーバーサイドライブラリ
  auth.ts               NextAuth 設定 + Roblox OAuth
  roblox-api.ts         Roblox API クライアント (リトライ付き)
  crypto.ts             AES-256-GCM 暗号化
  codegen.ts            Assets.lua / TOML 生成
  db.ts                 Prisma Client
prisma/                 DBスキーマ + マイグレーション
studio-plugin/          Roblox Studio Luau プラグイン
docs/                   仕様書
```

# Roblox Asset Uploader

---

## すぐに使う（はじめての方へ）

### このアプリでできること

Roblox のゲーム開発で使う画像・音声・3Dモデルを、**ドラッグ＆ドロップ**で一括アップロードできます。  
アップロード後は、ゲーム内のスクリプトから「ファイル名」でアセットを参照できるコードが自動生成されます。

### 必要なもの

- **Roblox Open Cloud API キー**（[Roblox Creator Hub](https://create.roblox.com/) で取得）
- **macOS** または **Windows**

### 使い方

1. **アプリをダウンロード**  
   [Releases](https://github.com/shinjiesk/rbx-asset-uploader/releases) から `.dmg`（Mac）または `.exe`（Windows）をダウンロードしてインストール

   **Mac で「壊れているため開けません」と出る場合**  
   ダウンロードしたアプリに macOS の隔離属性が付いているためです。ターミナルで以下を実行してください：
   ```bash
   xattr -cr /Applications/Roblox\ Asset\ Uploader.app
   ```
   （アプリを別の場所に置いた場合は、そのパスに置き換えてください）

2. **初回設定**
   - アプリを起動
   - 設定画面で API キーを入力して保存
   - クリエイタープロファイル（Group ID または User ID）を追加

3. **アップロード**
   - プロジェクトフォルダを選択
   - 画像（.png, .jpeg）・音声（.mp3, .ogg など）・モデル（.fbx）をドラッグ＆ドロップ
   - プレビューで内容を確認して「アップロード」をクリック

4. **Roblox Studio に反映する場合**
   - `studio-plugin/` 内のプラグインを Studio にインストール
   - アプリと Studio を両方起動しておくと、アップロード完了時に自動で Studio に反映されます

### サポートするファイル形式

| 種類 | 拡張子 |
|------|--------|
| 画像 | .png, .jpeg |
| 音声 | .mp3, .ogg, .flac, .wav |
| 3Dモデル | .fbx |

---

## Technical Documentation

### Features

- **Drag & drop** file and folder upload with recursive scanning
- **Bulk upload** with 3-parallel concurrency, per-file progress and retry
- **Lock file** (`assets.lock.toml`) tracks filename → asset ID mappings
- **Luau codegen** generates `Assets.lua` so game scripts reference assets by name
- **Update support** — re-uploading a file PATCHes the existing asset (ID stays the same)
- **API key security** — stored in OS keychain (macOS Keychain / Windows Credential Manager)
- **Creator profiles** — switch between Group/User IDs via dropdown
- **Studio bridge** — pushes the Assets module directly into a running Roblox Studio instance

### Tech Stack

| Layer | Technology |
|-------|-------------|
| Framework | Tauri v2 (Rust + HTML/CSS/JS) |
| HTTP client | reqwest (multipart, retry, backoff) |
| Keychain | keyring crate |
| Studio bridge | axum HTTP server ↔ Studio Luau plugin |
| Frontend | Vanilla HTML / CSS / JavaScript |

### Prerequisites

- [Rust](https://rustup.rs/) (stable)
- [Node.js](https://nodejs.org/) ≥ 18
- Platform build tools for Tauri — see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

### Development

```bash
npm install
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

Outputs: `.dmg` (macOS) / `.exe` + `.msi` (Windows)

### Studio Plugin

Copy `studio-plugin/AssetUploaderBridge.server.lua` into your Roblox Studio plugins folder, or install it as an `.rbxm` model.

The plugin automatically registers with the desktop app and polls for commands. Click the **Bridge** toolbar button to toggle the connection.

### Project Structure

```
src/                  Frontend (HTML/CSS/JS)
src-tauri/            Rust backend
  src/
    api/              Roblox Open Cloud API client
    commands.rs       Tauri commands (frontend ↔ backend)
    keystore.rs       OS keychain (keyring)
    lockfile.rs       assets.lock.toml reader/writer
    codegen.rs        Assets.lua generator
    upload.rs         Parallel upload orchestration
    server.rs         axum HTTP server for Studio bridge
studio-plugin/        Roblox Studio Luau plugin
docs/                 Specification
```

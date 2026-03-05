# デバッグガイド（AI向け）

このプロジェクトをAIが自律的に検証・デバッグするための手順。

## 検証コマンド

```bash
npm run verify
```

- ビルド → 起動 → HTTPヘルスチェック(127.0.0.1:58750/api/health) → 終了
- 失敗時は `.verify.log` の末尾を表示

## 失敗時のデバッグ

1. **パニック・クラッシュ**
   ```bash
   RUST_BACKTRACE=1 npm run verify
   ```
   または
   ```bash
   bash scripts/debug.sh
   ```
   出力は `.debug.log` に保存される

2. **ログ確認**
   - `.verify.log` — 前回の verify 実行ログ
   - `scripts/debug.sh` 実行時は `.debug.log`

3. **主要な修正ポイント**
   - Tokio ランタイム: `lib.rs` の `setup` 内で HTTP サーバーを `std::thread::spawn` + `Runtime::new().block_on` で起動
   - ポート競合: 58750 が使用中なら `server.rs` の `SERVER_PORT` を変更

## ディレクトリ構成

```
src-tauri/src/
  lib.rs      # エントリ、setup で HTTP サーバー起動
  server.rs   # axum HTTP サーバー (port 58750)
  api/        # Roblox Open Cloud API
  commands.rs # Tauri コマンド
```

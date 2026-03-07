# プロジェクト概要：Robloxアセット一括アップローダー（Webアプリ）

## 背景・目的

Robloxのゲーム開発者は、Roblox Open Cloud Assets APIを通じてアセット（テクスチャ・サウンド・モデルなど）をアップロードできる。しかし既存のツールはCLI操作が必要であり、コマンドラインに慣れていない一般クリエイターには敷居が高い。

このプロジェクトでは、**インストール不要で、ブラウザからすぐに使えるWebアプリ**を作る。Robloxアカウントでログインするだけで使い始められること。

---

## 技術スタック

- **フレームワーク**: Next.js 15（App Router）+ TypeScript
- **認証**: NextAuth.js v5（Auth.js）+ Roblox OAuth 2.0 カスタムプロバイダー
- **データベース**: Vercel Postgres（Neon）
- **ORM**: Prisma
- **UI**: React + Tailwind CSS
- **ホスティング**: Vercel
- **Studio連携**: Roblox Studioプラグイン（MVP後に追加）

---

## 認証方式（ハイブリッド）

### Roblox OAuth ログイン

ユーザー認証はRoblox OAuth 2.0で行う。APIキーの手動入力は不要。

| 項目 | 値 |
|---|---|
| Flow | Authorization Code + PKCE |
| Permission Scopes | `openid`, `profile`, `asset:read`, `asset:write` |
| Redirect URL | `https://<app-domain>/api/auth/callback/roblox` |

- OAuthトークン（access_token / refresh_token）はサーバーサイドのみで保持。ブラウザには一切渡さない
- access_tokenの有効期限は15分。期限切れ時はサーバー側でrefresh_tokenを使い自動更新する
- refresh_tokenの有効期限は90日

### 個人アセット vs グループアセット

| アップロード先 | 認証方法 | 説明 |
|---|---|---|
| 自分（個人） | OAuth Bearer token | ログインするだけでOK。APIキー不要 |
| グループ | APIキー（`x-api-key`） | グループオーナーが発行したOpen Cloud APIキーを使用 |

**グループアセットにAPIキーが必要な理由**:
- Roblox OAuthトークンはログインユーザー本人の権限を表す
- グループのアセットをアップロードするには、グループオーナーがOpen Cloud APIキーを発行し、グループのアセット書き込み権限を付与する必要がある
- グループの「オーナー」でなく「参加メンバー」でも、オーナーから共有されたAPIキーがあればアップロード可能

### APIキーの保存

- グループ用APIキーはサーバーサイド（Vercel Postgres）に暗号化して保存する
- ブラウザには一切渡さない
- サーバーのログにも出力しない

---

## 使用するRoblox Open Cloud エンドポイント

| 操作 | メソッド | エンドポイント |
|---|---|---|
| アセット作成 | `POST` | `https://apis.roblox.com/assets/v1/assets` |
| アセット更新 | `PATCH` | `https://apis.roblox.com/assets/v1/assets/{assetId}` |
| オペレーション取得 | `GET` | `https://apis.roblox.com/assets/v1/operations/{operationId}` |

- 個人アセット: `Authorization: Bearer <access_token>` ヘッダーで認証
- グループアセット: `x-api-key: <api_key>` ヘッダーで認証
- リクエストは `multipart/form-data` 形式で、`request`（JSON文字列）と `fileContent`（バイナリ）の2パートで構成
- 1ファイルあたり最大20MB
- アセットタイプごとにアップロード月間制限あり（ID認証済み: 100件/月、未認証: 10件/月）※オーディオの場合

### Roblox OAuth エンドポイント

| 操作 | メソッド | エンドポイント |
|---|---|---|
| 認可 | `GET` | `https://apis.roblox.com/oauth/v1/authorize` |
| トークン取得・更新 | `POST` | `https://apis.roblox.com/oauth/v1/token` |
| トークン無効化 | `POST` | `https://apis.roblox.com/oauth/v1/token/revoke` |
| ユーザー情報取得 | `GET` | `https://apis.roblox.com/oauth/v1/userinfo` |

### Roblox Web API エンドポイント（認証不要）

| 操作 | メソッド | エンドポイント |
|---|---|---|
| ユーザーの所属グループ一覧取得 | `GET` | `https://groups.roblox.com/v2/users/{userId}/groups/roles` |

- Open Cloud ではなく Roblox 公開 Web API（認証不要）
- ユーザーの所属グループ一覧をグループ名・ID・ロール付きで取得できる
- グループプロファイルの登録時に、ドロップダウンで所属グループを表示するために使用

---

## セキュリティ方針

- **OAuthトークン**: サーバーサイドのみで保持。DB内では暗号化保存。ブラウザには渡さない
- **グループAPIキー**: サーバーサイドのみで保持。DB内では暗号化保存。ブラウザには渡さない
- **セッション**: NextAuth.jsのHTTP-only Cookie
- **API Route**: 認証済みセッションからのみ呼び出し可能
- **HTTPS強制**: Vercelがデフォルトで強制
- **CSRF保護**: NextAuth.js組み込み
- **ログ出力禁止**: トークン・APIキーをサーバーログに一切出力しない

---

## MVP機能

### 1. Robloxアカウントでログイン
- 「Robloxでログイン」ボタンでOAuth認証フローを開始
- ログイン後、Robloxユーザー名・アバターを画面に表示
- 未ログイン状態ではアップロード機能にアクセスできない

### 2. フォルダ・ファイル選択による一括アップロード
- ファイル単位でもフォルダ単位でもアップロード可能
- ドラッグ＆ドロップまたはダイアログから選択できる
- フォルダはサブフォルダも含めて再帰的にスキャン
- アップロードは以下の2ステップで行う：
  1. **プレビュー**: ドロップまたは選択後、対象ファイルの一覧をサムネイル・ファイル名・サイズ・アセットタイプ付きで表示する。ロックファイルに同名ファイルが既に存在する場合は「上書き」マークを表示する。この段階でユーザーは個別にファイルを除外できる
  2. **アップロード実行**: ユーザーが「アップロード」ボタンを押して初めてアップロードを開始する。ボタンを押すまではサーバーへのリクエストは一切行わない
- ファイルごとに結果を表示：成功 / 失敗 / 割り当てられたアセットID
- 3並列でアップロードを実行する

### 3. ロックファイルによるアセットID管理
- ファイル名 ↔ アセットIDの対応をサーバーサイドのDB（`asset_entries`テーブル）に保存
- アセットの同一性は**ファイル名（拡張子含む）**で判断する
- 異なるフォルダに同名ファイルがある場合は競合としてユーザーに警告し、どちらを使うか選択させる
- 同じファイル名がすでに登録されている場合は、上書きするかスキップするかをユーザーに確認する
- 上書き確認ダイアログには「すべてに適用」チェックボックスを設ける。チェックを入れて「上書き」を選択すると、残りの重複ファイルすべてを一括で上書き対象にする。「スキップ」を選択した場合も同様に残りすべてをスキップする
- 上書き時は既存のアセットIDに対して **Update API（PATCH）** を使用し、アセットIDを変えずに内容だけを更新する
- `assets.lock.toml` 形式でのエクスポート / インポート機能あり

### 4. Luauコードの自動生成
- ロックファイル（DB内のデータ）からLuauモジュールを生成し、コーダーが名前でアセットを参照できるようにする
- アセットタイプ別（Image / Audio / Model）にテーブルをネストする。分類は拡張子から自動判定する
- `Assets.lua` はダウンロードボタンで取得する
- ファイルを差し替えて再アップロードすると、ロックファイルと生成モジュールが自動更新される

### 5. グループプロファイル管理
- ログイン時にRoblox Web API（`groups.roblox.com/v2/users/{userId}/groups/roles`）でユーザーの所属グループ一覧を自動取得する
- 設定画面では所属グループがドロップダウンで表示され、**グループ名で選択**してからAPIキーを入力する
- グループ名・GroupID・ロール名はAPIレスポンスから自動で埋まる。ユーザーが手入力するのはAPIキーのみ
- APIキーはサーバーで暗号化保存

### 6. プロジェクト管理
- **プロジェクトとは**: 1つのゲーム（Experience / Universe）に対応するアセットの管理単位。プロジェクトごとにアセット一覧（ロックファイル）と `Assets.lua` が分かれる
- ユーザーは複数のプロジェクトを作成できる（例: 「RPGゲーム」「レースゲーム」「ロビー」）
- プロジェクトの切り替えはドロップダウンで行う
- **新規プロジェクト作成フロー**:
  1. メイン画面のプロジェクトドロップダウンから「+ 新規プロジェクト」を選択
  2. ダイアログが開き、以下を入力/選択する：
     - プロジェクト名（任意の名前。例: 「RPGゲーム」）
     - クリエイター: 「自分（個人）」または登録済みグループ名から選択
     - プレイス: クリエイター選択後、そのクリエイターに属する接続中Studioのプレイス一覧が表示される。1つ以上選択する（後から追加も可能）
  3. 「作成」ボタンでプロジェクトが作成され、自動的にそのプロジェクトに切り替わる
- 初回ログイン時にプロジェクトが1つもない場合は、新規プロジェクト作成ダイアログを自動表示する
- **プロジェクトの編集・削除**: 設定画面からプロジェクト名・クリエイターの変更、プロジェクトの削除が可能。削除時はアセット一覧も削除される旨を確認する
- **アップロード先はプロジェクトで決まる**:
  - 個人プロジェクト → OAuth token で認証してアップロード
  - グループプロジェクト → そのグループのAPIキーで認証してアップロード
  - プロジェクトを選ぶだけでアップロード先が自動的に確定する。別途選択する必要はない
- **プレイスの管理**:
  - 1つのプロジェクトに複数のプレイスを紐付けできる（例: 同じゲームのメインプレイスとテストプレイス）
  - メイン画面にプロジェクトに属するプレイス名の一覧が常に表示される
  - プレイス一覧の近くに「+」ボタンがあり、押下するとそのプロジェクトのクリエイター（グループ or 個人）に属する接続中Studioのプレイス一覧が表示される。選択するとプロジェクトに追加される
  - Studio未接続時やリストにない場合は、PlaceIDを手動入力して追加することも可能
  - プレイスの削除は各プレイス名の横の「×」ボタンで行う
  - Studio連携の送信先ドロップダウンには、このプレイス一覧のうち接続中のもののみ表示される

### 7. アセットリストのエクスポート
- プロジェクト内の登録済みアセット一覧を外部アプリ（Excel、Notion、Google Sheets など）で利用できる形式でエクスポートする
- **エクスポート形式**:
  - CSV ファイルダウンロード（カンマ区切り）
  - TSV ファイルダウンロード（タブ区切り）
  - Markdown ファイルダウンロード（テーブル形式）
  - ダイアログ表示 + クリップボードコピー（カンマ区切り / タブ区切り / Markdown を切り替え可能）
- **出力カラム**: ファイル名, アセットID, アセットタイプ(Image/Audio/Model), rbxassetid URL, 登録日時
- カテゴリ（Image / Audio / Model）でフィルタリング可能

### 8. Studio連携（プラグイン経由）
- **Studioプラグイン**をインストールして使用する（`studio-plugin/AssetUploaderBridge.server.lua`）
- **複数Studioインスタンス対応**:
  - 各Studioインスタンスのプラグインが起動時にWebアプリのAPIに以下を送信して登録する：
    - PlaceID, プレイス名, Universe ID (game.GameId)
    - CreatorType (`User` or `Group`), CreatorId (ユーザーID or グループID)
    - 一意のセッションID
  - メイン画面のプレイス一覧で、接続中のプレイスには接続状態インジケータ（緑マーク等）を表示する
  - Studio連携の送信先ドロップダウンには、プロジェクトに紐付いたプレイスのうち接続中のもののみ表示される
- **プレイスとプロジェクトの整合性チェック**:
  - プラグインから送信された CreatorType / CreatorId と、現在選択中のプロジェクトのクリエイターを照合する
  - 一致しない場合は「このプレイスは選択中のプロジェクトのクリエイターと一致しません」と警告を表示する
  - 該当グループのAPIキーが未登録の場合は「グループ "〇〇" のAPIキーが未登録です」と警告を表示し、設定画面へのリンクを提示する
- **ポーリング間隔**: 2秒
- **接続タイムアウト**: 30秒間ポーリングがなければ切断扱い。UI上で接続状態を表示（接続中 / 切断）
- Studioが起動していない場合やプラグイン未インストールの場合は、ダウンロードで代替する

#### 8a. Assets ModuleScript の差し込み
- 生成した `Assets` ModuleScript を、選択したStudioのプレイスに直接差し込む
- 「Studioに送信」ボタンで実行

#### 8b. アップロード済みアセットのStudio配置
- アップロード完了したアセットを、Studioのツリー上にインスタンスとして配置する
- **自動/手動の切り替え**:
  - **自動モード**: アップロード完了時に自動で配置（Studio接続中かつ有効時）
  - **手動モード**: アップロード後に「Studioに配置」ボタンで実行
  - 設定画面で切り替え可能。デフォルトは手動
- **生成されるインスタンス**:
  - 画像 → `Decal`（`Texture = "rbxassetid://..."`）
  - オーディオ → `Sound`（`SoundId = "rbxassetid://..."`）
  - 3Dモデル → `InsertService:LoadAsset()` で取得したモデル
  - インスタンスの `Name` はファイル名（拡張子なし）
- **配置先の指定**:
  - プラグインがStudioのツリー構造（サービス一覧 + 直下のフォルダ一覧）をWebアプリに送信する
  - Webアプリ上でアセットタイプごとに配置先をドロップダウンで選択する
  - 選択肢の例: `ServerStorage`, `ServerStorage.Assets`, `ReplicatedStorage.Models`, `SoundService` など
  - **新規フォルダの作成**: ドロップダウンの末尾に「+ 新規フォルダ」オプションがあり、選択するとフォルダ名を入力して親サービス配下にフォルダを作成できる
  - 配置先の設定はプロジェクトごとに保存される
- **デフォルト配置先**:
  - 画像: `ServerStorage`
  - オーディオ: `ServerStorage`
  - 3Dモデル: `ServerStorage`
- **同名インスタンスの処理**: 配置先に同名のインスタンスが既に存在する場合は上書き（既存を削除してから新規作成）

### 9. エラーハンドリングとリトライ
- HTTPステータスコードに基づくエラー分類（認証エラー / レート制限 / サーバーエラー / バリデーションエラー）
- レート制限（429）を受けた場合は `Retry-After` ヘッダーを尊重して自動リトライ
- ネットワークエラーやサーバーエラー（5xx）は指数バックオフ（1秒 → 2秒 → 4秒）で最大3回リトライ
- Operation取得（GetOperation）のポーリング：完了まで2秒間隔で最大30回（60秒）リトライ
- すべてのエラーをUI上でファイル単位で表示し、失敗したファイルのみ再アップロード可能

---

## データモデル（Vercel Postgres）

```sql
users
  id                UUID PRIMARY KEY
  roblox_user_id    BIGINT UNIQUE
  roblox_username   TEXT
  roblox_display_name TEXT
  roblox_avatar_url TEXT
  access_token      TEXT (encrypted)
  refresh_token     TEXT (encrypted)
  token_expires_at  TIMESTAMP
  created_at        TIMESTAMP
  updated_at        TIMESTAMP

group_profiles
  id                UUID PRIMARY KEY
  user_id           UUID REFERENCES users
  group_id          BIGINT
  group_name        TEXT
  role_name         TEXT
  api_key           TEXT (encrypted)
  created_at        TIMESTAMP
  updated_at        TIMESTAMP
  UNIQUE(user_id, group_id)

projects
  id                UUID PRIMARY KEY
  user_id           UUID REFERENCES users
  name              TEXT
  creator_type      TEXT ('user' | 'group')
  group_profile_id  UUID REFERENCES group_profiles (NULL for user type)
  created_at        TIMESTAMP
  updated_at        TIMESTAMP

project_places
  id                UUID PRIMARY KEY
  project_id        UUID REFERENCES projects
  place_id          BIGINT
  place_name        TEXT
  created_at        TIMESTAMP
  UNIQUE(project_id, place_id)

asset_entries (= lock file)
  id                UUID PRIMARY KEY
  project_id        UUID REFERENCES projects
  filename          TEXT
  category          TEXT ('Image' | 'Audio' | 'Model')
  asset_id          BIGINT
  created_at        TIMESTAMP
  updated_at        TIMESTAMP
  UNIQUE(project_id, filename)
```

---

## ロックファイルのエクスポート形式（`assets.lock.toml`）

```toml
[assets]

[assets.Image]
"wood_floor.png" = 12345678
"brick_wall.jpeg" = 22334455

[assets.Audio]
"bgm.mp3" = 87654321

[assets.Model]
"shelf.fbx" = 11223344
```

---

## 生成されるLuauモジュールの例（`Assets.lua`）

```lua
-- Auto-generated by Roblox Asset Uploader
-- Do not edit manually

local Assets = {
    Image = {
        wood_floor = "rbxassetid://12345678",
        brick_wall = "rbxassetid://22334455",
    },
    Audio = {
        bgm = "rbxassetid://87654321",
    },
    Model = {
        shelf = "rbxassetid://11223344",
    },
}

return Assets
```

---

## UI画面構成

1. **ログイン画面**:
   - 「Robloxでログイン」ボタン
   - ログイン後はメイン画面にリダイレクト

2. **メイン画面**:
   - ヘッダー: Robloxユーザー名・アバター表示、設定ボタン、ログアウト
   - プロジェクト切り替えドロップダウン（末尾に「+ 新規プロジェクト」オプション）
   - アップロード先表示: 選択中のプロジェクトのクリエイター（「自分」またはグループ名）を表示
   - **プレイス一覧**: プロジェクトに紐付いたプレイス名をリスト表示。各プレイス名の横に「×」（削除）ボタン。リスト末尾に「+」ボタン（押下でクリエイターに属する接続中Studioプレイスの選択肢を表示）
   - ドラッグ＆ドロップエリア（ファイル・フォルダ受付）
   - **プレビューリスト**（ドロップ/選択後に表示）：
     - ファイル名・サイズ・アセットタイプ
     - 画像（.png / .jpeg）：サムネイル表示
     - オーディオ（.mp3 / .ogg / .flac / .wav）：再生ボタン
     - 3Dモデル（.fbx）：アイコン表示のみ
     - ロックファイルに既存の場合は「上書き」バッジ表示
     - ファイルごとの除外チェックボックス
   - **上書き確認**（重複ファイルがある場合にアップロードボタン押下時に表示）：
     - 重複ファイルごとに「上書き / スキップ」を選択
     - 「すべてに適用」チェックボックス付き（チェック + 上書き or スキップで残り全件に一括適用）
   - **「アップロード」ボタン**（プレビュー表示中のみ有効）
   - ファイルごとのアップロード進捗（アップロード実行後に表示）
   - アップロード結果（成功 / 失敗 / アセットID）
   - 失敗ファイルの再アップロードボタン
   - Assets.luaダウンロードボタン
   - **Studio連携**（Studio接続時のみ表示）:
     - 接続中のStudio一覧（プレイス名・接続状態インジケータ）
     - 送信先プレイスのドロップダウン選択
     - 「Assets.lua を送信」ボタン（ModuleScript差し込み）
     - 「Studioに配置」ボタン（アセットインスタンス配置）
     - アセットタイプごとの配置先ドロップダウン（Studioツリーから取得した選択肢）
     - 各ドロップダウン末尾に「+ 新規フォルダ」オプション（フォルダ名入力で作成）
     - 自動配置モードのON/OFFトグル
   - ロックファイルのエクスポート / インポートボタン
   - **アセットリストのエクスポート**:
     - 「エクスポート」ドロップダウンメニュー（CSV / TSV / Markdown / クリップボードにコピー）
     - クリップボードコピー時はダイアログが開き、カンマ区切り / タブ区切り / Markdown を切り替えてプレビュー表示。「コピー」ボタンでクリップボードに転送
     - カテゴリフィルタ（全て / Image / Audio / Model）で出力対象を絞り込み可能

3. **設定画面**:
   - **グループプロファイル管理**:
     - グループの追加・編集・削除
     - グループ追加時：所属グループ一覧がドロップダウンで表示される（Roblox Web APIから自動取得）
     - グループ名で選択すると、グループID・ロール名が自動入力される。ユーザーが入力するのはAPIキーのみ
     - APIキーの入力欄は入力時以外マスク表示
     - 登録済みグループの一覧表示（グループ名・ロール名・登録日）
     - グループごとにAPIキーの更新・削除が可能
   - **プロジェクト管理**:
     - プロジェクト一覧（プロジェクト名・クリエイター・紐付けプレイス数）
     - プロジェクトの編集（名前・クリエイターの変更）
     - プロジェクトの削除（アセット一覧も削除される旨の確認ダイアログ付き）
     - 紐付けプレイスの管理（PlaceID・プレイス名の一覧表示、手動追加・削除）
     - アセット自動配置モードの切り替え（自動 / 手動、デフォルト: 手動）
     - アセットタイプごとの配置先パス設定

---

## サポートするアセットタイプ

| カテゴリ | 拡張子 | API上の assetType | 備考 |
|---|---|---|---|
| 画像 | `.png`, `.jpeg` | `Decal` | API上の名称は「Decal」だが、生成されるアセットIDはテクスチャ・パーティクル・UI画像など用途を問わず使用可能 |
| オーディオ | `.mp3`, `.ogg`, `.flac`, `.wav` | `Audio` | |
| 3Dモデル | `.fbx` | `Model` | |

> **注意**: `.bmp` と `.tga` はOpen Cloud APIで正常に動作しない報告があるため、MVPではサポート対象外とする。

---

## ディレクトリ構成

```
app/
  page.tsx                       メイン画面
  login/page.tsx                 ログイン画面
  settings/page.tsx              設定（グループプロファイル管理）
  api/
    auth/[...nextauth]/route.ts  NextAuth handler
    upload/route.ts              Create Asset proxy
    update/route.ts              Update Asset proxy
    operation/route.ts           GetOperation proxy
    projects/route.ts            プロジェクトCRUD
    groups/route.ts              所属グループ一覧取得（Roblox Web API proxy）
    group-profiles/route.ts      グループプロファイル CRUD
    lockfile/route.ts            ロックファイル CRUD + エクスポート
    codegen/route.ts             Assets.lua 生成・ダウンロード
    export/route.ts              アセットリスト CSV/TSV エクスポート
    studio/register/route.ts     Studio プラグイン登録
    studio/poll/route.ts         Studio プラグイン ポーリング（コマンド取得）
    studio/push/route.ts         Studio へモジュール送信（フロントエンドから呼出）
    studio/place/route.ts        Studio へアセット配置コマンド送信
    studio/tree/route.ts         Studio ツリー構造取得（配置先選択用）
    studio/sessions/route.ts     接続中 Studio 一覧取得
lib/
  auth.ts                        NextAuth config + Roblox OAuth provider
  roblox-api.ts                  Roblox API client (server-side)
  db.ts                          Prisma client
  crypto.ts                      トークン・APIキーの暗号化/復号
  codegen.ts                     Assets.lua generator
  asset-types.ts                 拡張子 → アセットタイプ判定
prisma/
  schema.prisma                  DBスキーマ
components/
  DropZone.tsx
  FileList.tsx
  GroupProfileForm.tsx
  GroupProfileList.tsx
  UploadTargetSelect.tsx
  ProjectSelect.tsx
  LoginButton.tsx
studio-plugin/
  AssetUploaderBridge.server.lua   Studio プラグイン（登録・ポーリング・モジュール差し込み）
```

---

## 前提条件

- Roblox Creator Dashboard で OAuth 2.0 アプリを登録する必要がある（要ID認証）
- Private mode で最大10ユーザーまでテスト可能。一般公開には審査が必要
- ユーザーは13歳以上のRobloxアカウントが必要

---

## 開発ステップ

1. Next.js 15 プロジェクト初期化（TypeScript + Tailwind CSS）
2. Roblox OAuth ログイン実装（NextAuth.js + カスタムプロバイダー）
3. Vercel Postgres + Prisma セットアップ
4. トークン・APIキーの暗号化モジュール実装
5. API Route 実装（アップロード・更新・オペレーション取得のプロキシ）
6. エラーハンドリング・リトライロジック実装
7. プロジェクト管理 + ロックファイル（DB）実装
8. メイン画面UI（D&D・プレビュー・並列アップロード・進捗表示）
9. 設定画面（グループプロファイル管理）
10. Luauコード生成 + ダウンロード
11. ロックファイルのエクスポート / インポート
12. UI仕上げ + Vercel本番デプロイ

**ステップ1から始めてください。**

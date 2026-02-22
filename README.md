# MCP Apps 広告プラットフォーム デモ

ChatGPT Apps (MCP Apps) 上で動作する**コンテキスチュアル広告プラットフォーム**のデモアプリです。

ChatGPT の LLM が自身の知識で商品を推薦し、サーバーが Amazon 検索リンクとスポンサード広告を自動付与します。
API キー不要で動作します。

## 仕組み

```
ユーザー: 「おすすめのヘッドホンを探して」
    ↓
ChatGPT (LLM): 知識をもとに商品を推薦 → search_products ツールを呼び出し
    ↓
サーバー: Amazon検索リンク + スポンサード広告 + バナーを付与して返却
    ↓
ウィジェット: 商品カード一覧 + 広告を表示
```

## 機能一覧

| 機能 | 説明 |
|---|---|
| 商品推薦 | LLM の知識による商品推薦 + Amazon 検索リンク自動生成 |
| スポンサード広告 | キーワードにマッチした広告を結果上部に表示（CPC課金） |
| ブランドバナー | カテゴリにマッチしたブランド広告を結果下部に表示（月額固定） |
| クリックトラッキング | 広告クリック時に CPC 課金を記録 |
| 広告ダッシュボード | キャンペーン別の Imp / Click / CTR / 消化額を一覧表示 |

---

## 前提条件

- **ChatGPT Plus** アカウント（MCP Apps 機能を使用するため）
- デプロイ先に応じて以下のいずれか：
  - **Render アカウント**（無料、推奨）
  - **Node.js** v18 以上 + **ngrok**（ローカル開発用）

---

## デプロイ方法 A: Render（推奨）

ngrok 不要で、固定 URL が取得できます。

### 1. Render にサインアップ

[https://render.com](https://render.com) でアカウントを作成（GitHub 連携推奨）

### 2. Web Service を作成

1. Render ダッシュボードで **「New」** > **「Web Service」** をクリック
2. **「Build and deploy from a Git repository」** を選択
3. GitHub リポジトリ `mizugasira/map-apps-demo` を選択
4. 以下を設定：

| 項目 | 値 |
|---|---|
| Name | `mcp-ad-platform`（任意） |
| Region | `Oregon` or `Singapore` |
| Branch | `main` |
| Runtime | `Node` |
| Build Command | `npm install` |
| Start Command | `node server.js` |
| Instance Type | **Free** |

5. 必要に応じて環境変数を追加：
   - `AMAZON_PARTNER_TAG` = `your-tag-22`（アフィリエイト用、任意）
6. **「Deploy Web Service」** をクリック

### 3. デプロイ完了後の URL 確認

デプロイが完了すると、以下のような URL が発行されます：

```
https://mcp-ad-platform.onrender.com
```

MCP エンドポイントは：

```
https://mcp-ad-platform.onrender.com/mcp
```

> **注意**: Render 無料プランでは 15 分間アクセスがないとスリープします。初回アクセス時に 30〜60 秒のコールドスタートがあります。

### 4. ChatGPT にコネクタを登録

1. [ChatGPT](https://chatgpt.com) を開く
2. 画面右上の **設定アイコン** > **Apps (Beta)** に移動
3. **「Add App」** をクリック
4. **Server URL** に Render の URL を入力：
   ```
   https://mcp-ad-platform.onrender.com/mcp
   ```
5. **保存**する

### 5. 動作確認

ChatGPT のチャット画面で、登録したアプリのコネクタを **有効化** してから以下を入力：

```
おすすめのヘッドホンを探して
```

ウィジェットに以下が表示されれば成功です：
- 上部: **Sponsored** バッジ付きのスポンサード商品カード（実 ASIN リンク）
- 中央: LLM が推薦した商品一覧（各商品に「Amazonで検索」リンク付き）
- 下部: ブランドバナー

ダッシュボードを確認するには：

```
広告ダッシュボードを見せて
```

---

## デプロイ方法 B: ローカル + ngrok

開発・デバッグ用です。

### 1. 依存パッケージのインストール

```bash
git clone https://github.com/mizugasira/map-apps-demo.git
cd map-apps-demo
npm install
```

### 2. サーバーの起動

```bash
npm start
```

以下のログが表示されれば成功です：

```
Contextual Ad Platform MCP server on http://localhost:8787/mcp
```

開発中にファイル変更を自動反映したい場合：

```bash
npm run dev
```

### 3. ngrok トンネルの作成

ngrok がインストールされていない場合：

```bash
# Windows
winget install Ngrok.Ngrok

# macOS
brew install ngrok
```

authtoken を設定（[https://dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken) から取得）：

```bash
ngrok config add-authtoken <YOUR_AUTHTOKEN>
```

別のターミナルで以下を実行：

```bash
ngrok http 8787
```

表示された HTTPS URL + `/mcp` を ChatGPT のコネクタに登録してください。

> **注意**: ngrok を再起動すると URL が変わります。その都度コネクタ設定の更新が必要です。

---

## ChatGPT での質問例

### 商品検索

```
おすすめのヘッドホンを探して
```
```
スキンケアでおすすめの商品を教えて
```
```
プログラマー向けのキーボードを探して
```
```
1万円以下のワイヤレスイヤホンのおすすめは？
```

### ダッシュボード

```
広告ダッシュボードを見せて
```

---

## 検索キーワードと広告のマッチング

商品データは LLM が推薦するため、どんなキーワードでも商品が表示されます。
広告（スポンサード・バナー）は以下のキーワードにマッチした場合に表示されます。

| 検索ワード例 | スポンサード広告 | ブランドバナー |
|---|---|---|
| ヘッドホン / イヤホン / ノイズキャンセリング | Sony WH-1000XM5 | Sony |
| 化粧水 / スキンケア / 美容液 / エッセンス | SK-II フェイシャルトリートメント | SK-II |
| キーボード / HHKB / タイピング | HHKB Professional HYBRID | なし |
| それ以外のキーワード | なし | なし |

---

## プロジェクト構成

```
mcp-app/
├── server.js                    # MCP サーバー（広告ロジック + URL生成）
├── public/
│   └── amazon-search.html       # ウィジェット UI（ChatGPT内で描画）
├── render.yaml                  # Render デプロイ設定
├── package.json
└── README.md
```

---

## MCP ツール一覧

| ツール名 | 説明 | 呼び出し元 |
|---|---|---|
| `search_products` | LLM が推薦した商品に Amazon 検索リンク + 広告を付与 | ChatGPT (LLM) |
| `track_ad_click` | 広告クリックの記録（CPC課金） | ウィジェット (app) |
| `get_ad_dashboard` | 広告キャンペーンダッシュボード表示 | ChatGPT (LLM) |

### search_products の入力スキーマ

LLM が以下の形式で商品データを渡します：

```json
{
  "query": "ヘッドホン",
  "products": [
    {
      "title": "Sony WH-1000XM5",
      "brand": "Sony",
      "category": "ヘッドホン",
      "description": "業界最高クラスのノイズキャンセリング",
      "estimatedPrice": "¥44,000前後"
    }
  ]
}
```

サーバーが各商品に Amazon 検索 URL（`amazon.co.jp/s?k=Sony+WH-1000XM5`）を自動付与して返します。

---

## 環境変数（オプション）

```bash
AMAZON_PARTNER_TAG=your-tag-22 npm start
```

| 変数名 | 説明 |
|---|---|
| `AMAZON_PARTNER_TAG` | Amazon アソシエイトパートナータグ（リンクに `?tag=xxx` を付与） |
| `PORT` | サーバーポート（デフォルト: `8787`） |

---

## トラブルシューティング

### ツールが呼ばれない

- ChatGPT のチャット画面でコネクタが **有効になっているか** 確認
- ngrok / Render の URL が正しいか確認
- Render の場合、初回アクセスでスリープ解除に 30〜60 秒かかることがある

### Render でデプロイが失敗する

- Render ダッシュボードの **Logs** タブでエラーを確認
- `npm install` でエラーが出る場合は Node.js バージョンを確認（v18 以上が必要）

### ポートが使用中 (`EADDRINUSE`)（ローカル開発時）

```bash
# Windows
netstat -ano | findstr :8787
taskkill /PID <PID> /F

# macOS / Linux
lsof -i :8787
kill -9 <PID>
```

### ngrok の URL が変わった

ngrok を再起動した場合、新しい URL で ChatGPT のコネクタ設定を更新してください。
固定 URL が必要な場合は Render へのデプロイを推奨します。

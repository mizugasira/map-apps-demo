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

- **Node.js** v18 以上
- **npm** v9 以上
- **ngrok** アカウント（無料プランで可）
- **ChatGPT Plus** アカウント（MCP Apps 機能を使用するため）

---

## セットアップ手順

### 1. 依存パッケージのインストール

```bash
cd D:\workspace\mcp-app
npm install
```

### 2. ngrok のインストール

ngrok がインストールされていない場合：

```bash
# Windows (winget)
winget install Ngrok.Ngrok

# macOS (Homebrew)
brew install ngrok

# Linux
snap install ngrok
```

ngrok アカウントの authtoken を設定：

```bash
ngrok config add-authtoken <YOUR_AUTHTOKEN>
```

> authtoken は [https://dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken) から取得できます。

### 3. サーバーの起動

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

### 4. ngrok トンネルの作成

別のターミナルで以下を実行：

```bash
ngrok http 8787
```

表示された HTTPS URL をメモします（例: `https://xxxx-xxxx.ngrok-free.app`）。

> **注意**: ngrok を再起動すると URL が変わります。その際は ChatGPT 側のコネクタ設定も更新が必要です。

### 5. ChatGPT にコネクタを登録

1. [ChatGPT](https://chatgpt.com) を開く
2. 画面右上の **設定アイコン** > **Apps (Beta)** に移動
3. **「Add App」** をクリック
4. 以下を入力：
   - **Server URL**: `https://xxxx-xxxx.ngrok-free.app/mcp`（ngrok の URL + `/mcp`）
5. **保存**する

### 6. 動作確認

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

### ngrok の URL が変わった

ngrok を再起動した場合、新しい URL で ChatGPT のコネクタ設定を更新してください。
固定ドメインが必要な場合は ngrok の有料プランを検討してください。

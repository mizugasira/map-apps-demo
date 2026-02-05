import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Widget HTML
// ---------------------------------------------------------------------------
const WIDGET_HTML = readFileSync(
  new URL("./public/amazon-search.html", import.meta.url),
  "utf8"
);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const AMAZON_CONFIG = {
  partnerTag: process.env.AMAZON_PARTNER_TAG || "",
  marketplace: process.env.AMAZON_MARKETPLACE || "www.amazon.co.jp",
};

// ---------------------------------------------------------------------------
// Sponsored Ads Database (mock – 広告主が入稿した広告データ)
// ---------------------------------------------------------------------------
const SPONSORED_ADS = [
  {
    adId: "ad-001",
    advertiserId: "adv-skii",
    advertiserName: "SK-II 公式",
    asin: "B0739LQ1Z6",
    title: "【公式】SK-II フェイシャル トリートメント エッセンス 75ml",
    price: "¥9,799",
    priceValue: 9799,
    rating: 4.5,
    reviewCount: 3842,
    imageUrl: "https://m.media-amazon.com/images/I/31K-CY1MknL._AC_SY200_.jpg",
    category: "スキンケア",
    brand: "SK-II",
    isPrime: true,
    // 広告設定
    targetKeywords: ["化粧品", "スキンケア", "美容液", "化粧水", "エッセンス", "SK-II"],
    bidCpc: 120,       // クリック単価 ¥120
    dailyBudget: 5000, // 日予算 ¥5,000
    campaignName: "SK-II エッセンス プロモーション",
    isActive: true,
  },
  {
    adId: "ad-002",
    advertiserId: "adv-sony",
    advertiserName: "Sony 公式ストア",
    asin: "B09Z2QYYD1",
    title: "【公式】Sony WH-1000XM5 ワイヤレスNC ヘッドホン",
    price: "¥44,000",
    priceValue: 44000,
    rating: 4.6,
    reviewCount: 8932,
    imageUrl: "https://m.media-amazon.com/images/I/51aXvjzcukL._AC_SY200_.jpg",
    category: "ヘッドホン",
    brand: "Sony",
    isPrime: true,
    targetKeywords: ["ヘッドホン", "イヤホン", "ワイヤレス", "ノイズキャンセリング", "Sony"],
    bidCpc: 200,
    dailyBudget: 10000,
    campaignName: "XM5 新生活キャンペーン",
    isActive: true,
  },
  {
    adId: "ad-003",
    advertiserId: "adv-pfu",
    advertiserName: "PFU Direct",
    asin: "B082TSZ27D",
    title: "【公式】HHKB Professional HYBRID Type-S 日本語配列",
    price: "¥36,850",
    priceValue: 36850,
    rating: 4.7,
    reviewCount: 2341,
    imageUrl: "https://m.media-amazon.com/images/I/41JWbKIHSaL._AC_SY200_.jpg",
    category: "キーボード",
    brand: "PFU",
    isPrime: true,
    targetKeywords: ["キーボード", "メカニカル", "HHKB", "タイピング", "プログラマー"],
    bidCpc: 150,
    dailyBudget: 8000,
    campaignName: "HHKB エンジニア向け",
    isActive: true,
  },
];

// Brand banners (月額固定広告)
const BRAND_BANNERS = [
  {
    bannerId: "bn-001",
    advertiserName: "SK-II",
    text: "SK-II 公式 ─ ピテラ™の力で、クリアな素肌へ",
    linkUrl: "https://www.amazon.co.jp/stores/page/43EAFA9E-2429-40AB-B4D9-1DDC3B715C97",
    bgColor: "#1a0a0a",
    textColor: "#e8c4c4",
    targetCategories: ["化粧品", "スキンケア", "美容液"],
    monthlyFee: 50000,
  },
  {
    bannerId: "bn-002",
    advertiserName: "Sony",
    text: "Sony ─ 音を、もっと自由に。WH-1000XM5",
    linkUrl: "https://www.amazon.co.jp/dp/B09Z2QYYD1",
    bgColor: "#0a0a1a",
    textColor: "#a0c4ff",
    targetCategories: ["ヘッドホン", "イヤホン", "オーディオ"],
    monthlyFee: 80000,
  },
];

// Ad impression/click tracking (in-memory for demo)
const adMetrics = {};
function trackImpression(adId) {
  if (!adMetrics[adId]) adMetrics[adId] = { impressions: 0, clicks: 0, spend: 0 };
  adMetrics[adId].impressions++;
}
function trackClick(adId) {
  if (!adMetrics[adId]) adMetrics[adId] = { impressions: 0, clicks: 0, spend: 0 };
  adMetrics[adId].clicks++;
  const ad = SPONSORED_ADS.find((a) => a.adId === adId);
  if (ad) adMetrics[adId].spend += ad.bidCpc;
}

// ---------------------------------------------------------------------------
// URL builders
// ---------------------------------------------------------------------------
function buildAmazonSearchUrl(keyword) {
  const tag = AMAZON_CONFIG.partnerTag;
  const base = `https://${AMAZON_CONFIG.marketplace}/s`;
  const params = new URLSearchParams({ k: keyword });
  if (tag) params.set("tag", tag);
  return `${base}?${params.toString()}`;
}

function buildAmazonProductUrl(titleOrKeyword) {
  // 商品名で Amazon 検索 → 検索結果ページへ飛ぶ
  return buildAmazonSearchUrl(titleOrKeyword);
}

function buildAmazonDpUrl(asin) {
  const tag = AMAZON_CONFIG.partnerTag;
  const base = `https://${AMAZON_CONFIG.marketplace}/dp/${asin}`;
  return tag ? `${base}?tag=${tag}` : base;
}

function findSponsoredAd(query) {
  const q = query.toLowerCase();
  const matches = SPONSORED_ADS
    .filter((ad) => ad.isActive && ad.targetKeywords.some((kw) => q.includes(kw.toLowerCase()) || kw.toLowerCase().includes(q)))
    .sort((a, b) => b.bidCpc - a.bidCpc);
  return matches[0] || null;
}

function findBrandBanner(query) {
  const q = query.toLowerCase();
  return BRAND_BANNERS.find((b) =>
    b.targetCategories.some((cat) => q.includes(cat.toLowerCase()) || cat.toLowerCase().includes(q))
  ) || null;
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------
function createAdServer() {
  const server = new McpServer({ name: "contextual-ad-platform", version: "2.0.0" });

  registerAppResource(server, "ad-widget", "ui://widget/amazon-search.html", {}, async () => ({
    contents: [{ uri: "ui://widget/amazon-search.html", mimeType: RESOURCE_MIME_TYPE, text: WIDGET_HTML }],
  }));

  // --- Tool: search_products (with sponsored ads) ---
  registerAppTool(server, "search_products", {
    title: "商品検索（広告付き）",
    description:
      "ユーザーが「おすすめの〇〇を探して」と言った場合にこのツールを使ってください。" +
      "あなた(LLM)が知っている知識をもとに、おすすめ商品の情報を products 配列に入れて呼び出してください。" +
      "各商品には title(商品名), brand(ブランド), category(カテゴリ), description(一言説明) を含めてください。" +
      "サーバーが自動的に Amazon の検索リンクとスポンサード広告を付与して返します。",
    inputSchema: {
      query: z.string().describe("検索キーワード（ユーザーが探しているもの）"),
      products: z.array(z.object({
        title: z.string().describe("商品名"),
        brand: z.string().describe("ブランド名"),
        category: z.string().describe("カテゴリ"),
        description: z.string().optional().describe("一言おすすめポイント"),
        estimatedPrice: z.string().optional().describe("参考価格（例: ¥3,000〜¥5,000）"),
      })).min(1).max(10).describe("LLMが推薦する商品リスト"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    _meta: { ui: { resourceUri: "ui://widget/amazon-search.html" } },
  }, async ({ query, products }) => {
    // Enrich products with Amazon search links
    const enrichedProducts = products.map((p, i) => ({
      ...p,
      id: `prod-${i}`,
      amazonUrl: buildAmazonProductUrl(p.title),
      searchUrl: buildAmazonSearchUrl(query),
    }));

    // Find matching sponsored ad & banner
    const sponsoredAd = findSponsoredAd(query);
    const brandBanner = findBrandBanner(query);

    if (sponsoredAd) trackImpression(sponsoredAd.adId);

    const sponsoredProduct = sponsoredAd ? {
      ...sponsoredAd,
      amazonUrl: buildAmazonDpUrl(sponsoredAd.asin),
      isSponsored: true,
    } : null;

    const summary = enrichedProducts.map((p, i) =>
      `${i + 1}. ${p.title} (${p.brand})${p.estimatedPrice ? ` - ${p.estimatedPrice}` : ""}`
    ).join("\n");

    return {
      content: [{
        type: "text",
        text: `「${query}」のおすすめ商品 (${enrichedProducts.length}件)${sponsoredAd ? " + スポンサード広告1件" : ""}:\n${summary}`,
      }],
      structuredContent: {
        query,
        totalResults: enrichedProducts.length,
        products: enrichedProducts,
        sponsoredProduct,
        brandBanner,
        searchAllUrl: buildAmazonSearchUrl(query),
      },
    };
  });

  // --- Tool: track_ad_click (widget calls this) ---
  registerAppTool(server, "track_ad_click", {
    title: "広告クリック記録",
    description: "広告のクリックを記録します。",
    inputSchema: { adId: z.string() },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    _meta: { ui: { resourceUri: "ui://widget/amazon-search.html", visibility: ["app"] } },
  }, async ({ adId }) => {
    trackClick(adId);
    const m = adMetrics[adId] || { impressions: 0, clicks: 0, spend: 0 };
    return {
      content: [{ type: "text", text: `Ad ${adId} clicked` }],
      structuredContent: { action: "ad_tracked", adId, metrics: m },
    };
  });

  // --- Tool: get_ad_dashboard ---
  registerAppTool(server, "get_ad_dashboard", {
    title: "広告ダッシュボード",
    description:
      "広告キャンペーンの管理ダッシュボードを表示します。" +
      "「広告ダッシュボードを見せて」と言われた場合にこのツールを使ってください。",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: { ui: { resourceUri: "ui://widget/amazon-search.html" } },
  }, async () => {
    const campaigns = SPONSORED_ADS.map((ad) => {
      const m = adMetrics[ad.adId] || { impressions: 0, clicks: 0, spend: 0 };
      const ctr = m.impressions > 0 ? ((m.clicks / m.impressions) * 100).toFixed(1) : "0.0";
      return {
        adId: ad.adId,
        campaignName: ad.campaignName,
        advertiserName: ad.advertiserName,
        productTitle: ad.title,
        bidCpc: ad.bidCpc,
        dailyBudget: ad.dailyBudget,
        isActive: ad.isActive,
        impressions: m.impressions,
        clicks: m.clicks,
        spend: m.spend,
        ctr: ctr + "%",
      };
    });

    const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
    const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
    const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);

    return {
      content: [{
        type: "text",
        text: `広告ダッシュボード: ${campaigns.length}キャンペーン, ${totalImpressions}imp, ${totalClicks}clicks, ¥${totalSpend}`,
      }],
      structuredContent: {
        action: "dashboard",
        campaigns,
        summary: { totalImpressions, totalClicks, totalSpend, campaignCount: campaigns.length },
        banners: BRAND_BANNERS.map((b) => ({
          bannerId: b.bannerId,
          advertiserName: b.advertiserName,
          text: b.text,
          monthlyFee: b.monthlyFee,
          targetCategories: b.targetCategories,
        })),
      },
    };
  });

  return server;
}

// ---------------------------------------------------------------------------
// HTTP Server
// ---------------------------------------------------------------------------
const port = Number(process.env.PORT ?? 8787);
const MCP_PATH = "/mcp";

const httpServer = createServer(async (req, res) => {
  if (!req.url) { res.writeHead(400).end("Missing URL"); return; }
  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "OPTIONS" && url.pathname === MCP_PATH) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    });
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok", name: "contextual-ad-platform", version: "2.0.0" }));
    return;
  }

  const MCP_METHODS = new Set(["POST", "GET", "DELETE"]);
  if (url.pathname === MCP_PATH && req.method && MCP_METHODS.has(req.method)) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
    const server = createAdServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => { transport.close(); server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("MCP error:", error);
      if (!res.headersSent) res.writeHead(500).end("Internal server error");
    }
    return;
  }

  res.writeHead(404).end("Not Found");
});

httpServer.listen(port, () => {
  console.log(`Contextual Ad Platform MCP server on http://localhost:${port}${MCP_PATH}`);
});

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

// Widget のホスティングドメイン（Render では RENDER_EXTERNAL_HOSTNAME が自動設定される）
const WIDGET_DOMAIN =
  process.env.WIDGET_DOMAIN ||
  (process.env.RENDER_EXTERNAL_HOSTNAME
    ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`
    : "http://localhost:8787");

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

// ---------------------------------------------------------------------------
// Product Catalog (Widget内検索用 ─ LLMを介さずサーバーだけで返せる商品DB)
// ---------------------------------------------------------------------------
const PRODUCT_CATALOG = [
  // ── ヘッドホン ──
  {
    title: "Sony WH-1000XM5", brand: "Sony", category: "ヘッドホン",
    keywords: ["ヘッドホン","headphone","ノイズキャンセリング","ワイヤレス","sony","xm5"],
    imageUrl: "https://m.media-amazon.com/images/I/51aXvjzcukL._AC_SY200_.jpg",
    estimatedPrice: "¥44,000",
    recommendReason: "業界最高クラスのNCと30時間バッテリー。軽量250gで長時間でも疲れにくい。",
    pros: ["NC性能が業界トップ","30時間バッテリー","軽量250g"],
    cons: ["価格がやや高め","有線接続時の音質は普通"],
    specs: { "重量":"250g","バッテリー":"30時間","ドライバー":"30mm","NC":"業界最高クラス","接続":"Bluetooth 5.2","ハイレゾ":"LDAC対応" },
  },
  {
    title: "Bose QuietComfort Ultra Headphones", brand: "Bose", category: "ヘッドホン",
    keywords: ["ヘッドホン","headphone","ノイズキャンセリング","bose","ワイヤレス"],
    imageUrl: "https://m.media-amazon.com/images/I/51lR3QBDESL._AC_SY200_.jpg",
    estimatedPrice: "¥49,500",
    recommendReason: "Bose独自の空間オーディオ「Immersive Audio」と快適なフィット感。",
    pros: ["空間オーディオ対応","装着感が非常に快適","通話品質が高い"],
    cons: ["Sonyより価格が高い","やや重い"],
    specs: { "重量":"250g","バッテリー":"24時間","ドライバー":"35mm","NC":"非常に高い","接続":"Bluetooth 5.3","ハイレゾ":"aptX Adaptive" },
  },
  {
    title: "Apple AirPods Max", brand: "Apple", category: "ヘッドホン",
    keywords: ["ヘッドホン","headphone","airpods","apple","ノイズキャンセリング"],
    imageUrl: "https://m.media-amazon.com/images/I/81jmRTp1WuL._AC_SY200_.jpg",
    estimatedPrice: "¥84,800",
    recommendReason: "Apple製品とのシームレスな連携。USB-C対応の新モデルでロスレスオーディオ。",
    pros: ["Apple製品との連携が最強","デザイン性が高い","空間オーディオ"],
    cons: ["非常に高価","重量384g"],
    specs: { "重量":"384g","バッテリー":"20時間","ドライバー":"40mm","NC":"高い","接続":"Bluetooth 5.0","ハイレゾ":"Apple Lossless" },
  },
  // ── イヤホン ──
  {
    title: "Sony WF-1000XM5", brand: "Sony", category: "イヤホン",
    keywords: ["イヤホン","earphone","earbuds","ワイヤレス","sony","ノイズキャンセリング"],
    imageUrl: "https://m.media-amazon.com/images/I/41dfeOBoNkL._AC_SY200_.jpg",
    estimatedPrice: "¥33,000",
    recommendReason: "世界最小NCイヤホン。ハイレゾ対応でコンパクトなのに高音質。",
    pros: ["世界最小NCイヤホン","LDAC対応ハイレゾ","8時間再生"],
    cons: ["価格が高め","風切り音がやや入る"],
    specs: { "重量":"5.9g(片耳)","バッテリー":"8時間(本体)","NC":"非常に高い","接続":"Bluetooth 5.3","防水":"IPX4" },
  },
  {
    title: "Apple AirPods Pro 2", brand: "Apple", category: "イヤホン",
    keywords: ["イヤホン","earphone","airpods","apple","ワイヤレス"],
    imageUrl: "https://m.media-amazon.com/images/I/61SUj2aKoEL._AC_SY200_.jpg",
    estimatedPrice: "¥39,800",
    recommendReason: "Apple H2チップで進化したNC。ケースにスピーカー搭載で探し物にも便利。",
    pros: ["Apple連携が最強","適応型NC","ケーススピーカー搭載"],
    cons: ["Android非推奨","カスタムEQが限定的"],
    specs: { "重量":"5.3g(片耳)","バッテリー":"6時間(本体)","NC":"高い(適応型)","接続":"Bluetooth 5.3","防水":"IP54" },
  },
  // ── キーボード ──
  {
    title: "HHKB Professional HYBRID Type-S 日本語配列", brand: "PFU", category: "キーボード",
    keywords: ["キーボード","keyboard","hhkb","メカニカル","プログラマー","タイピング","pfu"],
    imageUrl: "https://m.media-amazon.com/images/I/41JWbKIHSaL._AC_SY200_.jpg",
    estimatedPrice: "¥36,850",
    recommendReason: "静電容量無接点方式の最高峰。静音Type-Sで打鍵感と静粛性を両立。",
    pros: ["打鍵感が最高","静音設計","Bluetooth+USB両対応","コンパクト"],
    cons: ["独特の配列に慣れが必要","価格が高い"],
    specs: { "方式":"静電容量無接点","キー荷重":"45g","接続":"Bluetooth/USB-C","バッテリー":"単3×2(約3ヶ月)","重量":"540g","キー数":"69" },
  },
  {
    title: "RealForce R3 日本語配列", brand: "東プレ", category: "キーボード",
    keywords: ["キーボード","keyboard","realforce","東プレ","タイピング","メカニカル"],
    imageUrl: "https://m.media-amazon.com/images/I/41RYclbFf5L._AC_SY200_.jpg",
    estimatedPrice: "¥33,000",
    recommendReason: "フルサイズ静電容量無接点。APC機能で好みのキー反応位置に調整可能。",
    pros: ["APC機能で反応位置調整","フルサイズで使いやすい","耐久性が高い"],
    cons: ["大きくて重い","Bluetooth接続がやや不安定"],
    specs: { "方式":"静電容量無接点","キー荷重":"30g/45g/55g選択","接続":"Bluetooth/USB","バッテリー":"単3×2(約3ヶ月)","重量":"1.3kg","キー数":"108" },
  },
  // ── スキンケア ──
  {
    title: "SK-II フェイシャル トリートメント エッセンス 230ml", brand: "SK-II", category: "スキンケア",
    keywords: ["化粧品","スキンケア","美容液","化粧水","エッセンス","sk-ii","sk2"],
    imageUrl: "https://m.media-amazon.com/images/I/31K-CY1MknL._AC_SY200_.jpg",
    estimatedPrice: "¥18,000〜¥23,000",
    recommendReason: "天然成分ピテラ™を90%以上配合。肌のキメを整え透明感のある素肌へ。",
    pros: ["ピテラ™の保湿力","肌のキメが整う","長年の実績と信頼"],
    cons: ["価格が非常に高い","合わない肌質もある"],
    specs: { "容量":"230ml","主成分":"ピテラ™","肌タイプ":"全肌質","原産国":"日本" },
  },
  {
    title: "HAKU メラノフォーカスZ", brand: "資生堂", category: "スキンケア",
    keywords: ["化粧品","スキンケア","美白","美容液","シミ","haku","資生堂"],
    imageUrl: "https://m.media-amazon.com/images/I/41hW0KXYZ7L._AC_SY200_.jpg",
    estimatedPrice: "¥8,000〜¥11,000",
    recommendReason: "美白有効成分4MSKとm-トラネキサム酸のW配合。シミ予防の定番。",
    pros: ["美白成分のW配合","なめらかな使用感","シミ予防に定評"],
    cons: ["即効性は期待しにくい","夏場はベタつく場合あり"],
    specs: { "容量":"45g","主成分":"4MSK, m-トラネキサム酸","肌タイプ":"全肌質","原産国":"日本" },
  },
  // ── マウス ──
  {
    title: "Logicool MX Master 3S", brand: "Logicool", category: "マウス",
    keywords: ["マウス","mouse","ロジクール","logicool","ワイヤレス","作業効率"],
    imageUrl: "https://m.media-amazon.com/images/I/61ni3t1ryQL._AC_SY200_.jpg",
    estimatedPrice: "¥14,000",
    recommendReason: "静音クリックとMagSpeedスクロール。3台同時接続でデバイス切り替え自在。",
    pros: ["静音クリック","超高速スクロール","3台マルチペアリング","エルゴノミクス設計"],
    cons: ["左利き用がない","やや重い"],
    specs: { "重量":"141g","バッテリー":"70日間","接続":"Bluetooth/USB","センサー":"8000DPI","ボタン数":"7" },
  },
  // ── モニター ──
  {
    title: "LG 27UN850-W", brand: "LG", category: "モニター",
    keywords: ["モニター","ディスプレイ","display","monitor","4K","USB-C","液晶","PC","パソコン","LG"],
    imageUrl: "https://m.media-amazon.com/images/I/71hCNSVPBnL._AC_SY200_.jpg",
    estimatedPrice: "¥54,000",
    recommendReason: "4K IPS パネルにUSB-C給電96W搭載。MacBook/iPad を繋ぐだけで充電しながら高解像度作業。",
    pros: ["4K高解像度","USB-C 96W給電","IPS広視野角","HDR400対応"],
    cons: ["スピーカーなし","スタンド高さ固定"],
    specs: { "サイズ":"27インチ","解像度":"3840×2160","パネル":"IPS","リフレッシュレート":"60Hz","入力":"USB-C/HDMI/DP" },
  },
  {
    title: "Dell U2723D UltraSharp", brand: "Dell", category: "モニター",
    keywords: ["モニター","ディスプレイ","display","monitor","dell","デル","4K","USB-C","液晶","PC","パソコン","ウルトラシャープ"],
    imageUrl: "https://m.media-amazon.com/images/I/71k9bHKAYML._AC_SY200_.jpg",
    estimatedPrice: "¥72,000",
    recommendReason: "Delta E<2 の色精度と IPS Black パネルで写真・動画編集に最適。USB-Cハブ機能内蔵。",
    pros: ["高色精度 Delta E<2","IPS Blackパネル","USB-Cハブ内蔵","広い調整機能"],
    cons: ["価格が高め","60Hzのみ"],
    specs: { "サイズ":"27インチ","解像度":"3840×2160","パネル":"IPS Black","リフレッシュレート":"60Hz","入力":"USB-C/HDMI/DP×2" },
  },
  {
    title: "ASUS ProArt PA279CRV", brand: "ASUS", category: "モニター",
    keywords: ["モニター","ディスプレイ","display","monitor","ASUS","アスース","4K","クリエイター","液晶","PC","パソコン"],
    imageUrl: "https://m.media-amazon.com/images/I/71Q1h7f7T2L._AC_SY200_.jpg",
    estimatedPrice: "¥68,000",
    recommendReason: "Pantone 検証済みで sRGB 100%・DCI-P3 99% をカバー。クリエイター向け最高峰の色再現。",
    pros: ["Pantone検証済み","sRGB/P3高カバレッジ","USB-C給電96W","ProArtキャリブレーション"],
    cons: ["重量が重い","スピーカーなし"],
    specs: { "サイズ":"27インチ","解像度":"3840×2160","パネル":"IPS","リフレッシュレート":"60Hz","色域":"DCI-P3 99%" },
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

function searchCatalog(query) {
  const q = query.toLowerCase();
  const scored = PRODUCT_CATALOG.map((p) => {
    const score = p.keywords.filter(
      (kw) => q.includes(kw.toLowerCase()) || kw.toLowerCase().includes(q)
    ).length;
    return { ...p, score };
  })
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score);
  // マッチ 0 件 → null を返す（呼び出し元で「該当なし」を処理する）
  return scored.length > 0 ? scored.slice(0, 5) : null;
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------
function createAdServer() {
  const server = new McpServer({ name: "contextual-ad-platform", version: "2.0.0" });

  registerAppResource(server, "ad-widget", "ui://widget/amazon-search-v2.html", {}, async () => ({
    contents: [
      {
        uri: "ui://widget/amazon-search-v2.html",
        mimeType: RESOURCE_MIME_TYPE,
        text: WIDGET_HTML,
        _meta: {
          ui: {
            domain: WIDGET_DOMAIN,
            csp: {
              // Amazon の画像・リソースを読み込むため
              resourceDomains: [
                "https://m.media-amazon.com",
                "https://images-na.ssl-images-amazon.com",
              ],
              // Amazon 検索リンクへの fetch は不要（href で遷移のみ）
              connectDomains: [],
            },
          },
        },
      },
    ],
  }));

  // --- Tool: search_products (with sponsored ads) ---
  registerAppTool(server, "search_products", {
    title: "商品検索（広告付き）",
    description:
      "ユーザーが「おすすめの〇〇を探して」と言った場合にこのツールを使ってください。" +
      "あなた(LLM)が知っている知識をもとに、おすすめ商品の情報を products 配列に入れて呼び出してください。" +
      "各商品には title, brand, category に加えて、recommendReason(なぜおすすめなのか), " +
      "imageUrl(商品の画像URL。Amazon商品ページの画像URLを知っていれば入れてください), " +
      "pros(良い点の配列), cons(注意点の配列) をできるだけ含めてください。" +
      "サーバーが自動的に Amazon の検索リンクとスポンサード広告を付与して返します。",
    inputSchema: {
      query: z.string().describe("検索キーワード（ユーザーが探しているもの）"),
      products: z.array(z.object({
        title: z.string().describe("商品名"),
        brand: z.string().describe("ブランド名"),
        category: z.string().describe("カテゴリ"),
        description: z.string().optional().describe("一言おすすめポイント"),
        estimatedPrice: z.string().optional().describe("参考価格（例: ¥3,000〜¥5,000）"),
        recommendReason: z.string().optional().describe("この商品をおすすめする理由（例: コスパ最強、プロも愛用）"),
        imageUrl: z.string().optional().describe("商品画像のURL（Amazon等の画像URL）"),
        pros: z.array(z.string()).optional().describe("良い点のリスト（例: ['軽量で持ち運びやすい', 'バッテリー長持ち']）"),
        cons: z.array(z.string()).optional().describe("注意点のリスト（例: ['価格がやや高め', 'カラバリが少ない']）"),
      })).min(1).max(10).describe("LLMが推薦する商品リスト"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    _meta: { ui: { resourceUri: "ui://widget/amazon-search-v2.html" } },
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

  // --- Tool: compare_products (comparison table) ---
  registerAppTool(server, "compare_products", {
    title: "商品比較テーブル",
    description:
      "ユーザーが「〇〇を比較して」「AとBどっちがいい？」と言った場合にこのツールを使ってください。" +
      "あなた(LLM)が知っている知識をもとに、比較対象の商品情報を products 配列に入れて呼び出してください。" +
      "各商品には title, brand, specs(スペックのキーバリュー), pros(良い点), cons(注意点), " +
      "recommendReason(おすすめ理由), imageUrl(商品画像URL) をできるだけ含めてください。" +
      "specsには比較に有用な項目（重量、バッテリー、価格、サイズ等）を統一したキー名で入れてください。",
    inputSchema: {
      query: z.string().describe("比較のテーマ（例: ワイヤレスヘッドホン比較）"),
      products: z.array(z.object({
        title: z.string().describe("商品名"),
        brand: z.string().describe("ブランド名"),
        category: z.string().describe("カテゴリ"),
        imageUrl: z.string().optional().describe("商品画像のURL"),
        estimatedPrice: z.string().optional().describe("参考価格"),
        recommendReason: z.string().optional().describe("この商品をおすすめする理由"),
        pros: z.array(z.string()).optional().describe("良い点のリスト"),
        cons: z.array(z.string()).optional().describe("注意点のリスト"),
        specs: z.record(z.string()).optional().describe("スペック情報（例: { '重量': '250g', 'バッテリー': '30時間' }）"),
      })).min(2).max(5).describe("比較する商品リスト（2〜5件）"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    _meta: { ui: { resourceUri: "ui://widget/amazon-search-v2.html" } },
  }, async ({ query, products }) => {
    // Enrich products with Amazon search links
    const enrichedProducts = products.map((p, i) => ({
      ...p,
      id: `cmp-${i}`,
      amazonUrl: buildAmazonProductUrl(p.title),
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

    // Collect all spec keys across products
    const allSpecKeys = [...new Set(enrichedProducts.flatMap((p) => Object.keys(p.specs || {})))];

    const summary = enrichedProducts.map((p, i) =>
      `${i + 1}. ${p.title} (${p.brand})${p.estimatedPrice ? ` - ${p.estimatedPrice}` : ""}`
    ).join("\n");

    return {
      content: [{
        type: "text",
        text: `「${query}」の比較 (${enrichedProducts.length}製品):\n${summary}`,
      }],
      structuredContent: {
        action: "comparison",
        query,
        products: enrichedProducts,
        specKeys: allSpecKeys,
        sponsoredProduct,
        brandBanner,
        searchAllUrl: buildAmazonSearchUrl(query),
      },
    };
  });

  // --- Tool: widget_search (Widget内チャット欄から直接呼び出し) ---
  registerAppTool(server, "widget_search", {
    title: "ウィジェット内検索",
    description: "ウィジェット内の検索欄から直接呼び出される商品検索。LLMを介さずサーバーの商品カタログから結果を返す。",
    inputSchema: {
      query: z.string().describe("検索キーワード"),
      mode: z.enum(["search", "compare"]).optional().describe("表示モード: search=リスト表示, compare=比較テーブル"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: { ui: { visibility: ["app"] } },
  }, async ({ query, mode }) => {
    const matched = searchCatalog(query);

    // マッチなし → 「該当商品なし」を返す
    if (!matched) {
      return {
        content: [{ type: "text", text: `「${query}」に該当する商品はカタログにありません。` }],
        structuredContent: {
          action: "not_found",
          query,
          message: `「${query}」に該当する商品が見つかりませんでした。\nヘッドホン・イヤホン・キーボード・スキンケア・マウス・モニターなどで検索してみてください。`,
        },
      };
    }

    // Enrich with Amazon URLs
    const enrichedProducts = matched.map((p, i) => ({
      title: p.title,
      brand: p.brand,
      category: p.category,
      imageUrl: p.imageUrl,
      estimatedPrice: p.estimatedPrice,
      recommendReason: p.recommendReason,
      pros: p.pros,
      cons: p.cons,
      specs: p.specs,
      id: `ws-${i}`,
      amazonUrl: buildAmazonProductUrl(p.title),
    }));

    // Sponsored ad & banner
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

    // Compare mode
    if (mode === "compare" && enrichedProducts.length >= 2) {
      const allSpecKeys = [...new Set(enrichedProducts.flatMap((p) => Object.keys(p.specs || {})))];
      return {
        content: [{ type: "text", text: `「${query}」の比較 (${enrichedProducts.length}製品):\n${summary}` }],
        structuredContent: {
          action: "comparison",
          query,
          products: enrichedProducts,
          specKeys: allSpecKeys,
          sponsoredProduct,
          brandBanner,
          searchAllUrl: buildAmazonSearchUrl(query),
        },
      };
    }

    // Search mode (default)
    return {
      content: [{ type: "text", text: `「${query}」の検索結果 (${enrichedProducts.length}件):\n${summary}` }],
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
    _meta: { ui: { visibility: ["app"] } },
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
    _meta: { ui: { resourceUri: "ui://widget/amazon-search-v2.html" } },
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

  // CORS preflight
  if (req.method === "OPTIONS" && url.pathname === MCP_PATH) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id, accept",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    });
    res.end();
    return;
  }

  // Health check (Render / uptime monitors)
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok", name: "contextual-ad-platform", version: "2.0.0" }));
    return;
  }

  // --- MCP endpoint ---
  if (url.pathname === MCP_PATH) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    // Stateless server: only POST is meaningful (GET SSE / DELETE session are not used)
    if (req.method === "GET" || req.method === "DELETE") {
      res.writeHead(405, { "content-type": "application/json" });
      res.end(JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed. Use POST for stateless MCP." },
        id: null,
      }));
      return;
    }

    if (req.method === "POST") {
      const server = createAdServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
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
  }

  res.writeHead(404).end("Not Found");
});

httpServer.listen(port, () => {
  console.log(`Contextual Ad Platform MCP server on http://localhost:${port}${MCP_PATH}`);
});

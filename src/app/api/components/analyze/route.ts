import { NextResponse } from "next/server";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_VISION_MODEL ?? "google/gemini-2.0-flash-001";

export async function POST(request: Request) {
  try {
    if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === "your-openrouter-api-key-here") {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY 尚未設定，請在 .env.local 填入真實的 key" },
        { status: 500 }
      );
    }

    const { imageUrl } = await request.json();
    if (!imageUrl) return NextResponse.json({ error: "imageUrl required" }, { status: 400 });

    // Convert relative URL to absolute for fetch
    const host = new URL(request.url).origin;
    const absoluteUrl = imageUrl.startsWith("http") ? imageUrl : `${host}${imageUrl}`;

    // Fetch image and convert to base64
    const imgRes = await fetch(absoluteUrl);
    if (!imgRes.ok) throw new Error(`無法載入圖片：${imgRes.status}`);
    const buffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const mediaType = imgRes.headers.get("content-type") ?? "image/jpeg";

    // Call OpenRouter (OpenAI-compatible format)
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": host,
        "X-Title": "Marketing Tool",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mediaType};base64,${base64}`,
                },
              },
              {
                type: "text",
                text: `你是一位專業視覺設計師與品牌策略師。請仔細分析這張圖片，並以 JSON 格式回傳以下三個面向的分析結果。

只回傳 JSON，不要任何說明文字：

{
  "composition": {
    "name": "構圖風格名稱（例如：留白極簡、產品居中特寫）",
    "description": "20字以內描述構圖特色",
    "aiPromptText": "可直接用於 AI 圖像生成的英文構圖 prompt（30字以內）"
  },
  "colorScheme": {
    "name": "配色方案名稱（例如：暖橙系、高對比黑白）",
    "primaryColor": "#XXXXXX（主色的 hex code）",
    "secondaryColor": "#XXXXXX（輔色的 hex code，若只有單色則填主色）",
    "aiPromptText": "可直接用於 AI 圖像生成的英文配色 prompt（20字以內）"
  },
  "copyTone": {
    "name": "語氣風格名稱（例如：專業理性、活潑親切）",
    "toneLabels": ["語氣標籤1", "語氣標籤2", "語氣標籤3"],
    "aiPromptText": "可直接用於 AI 文案生成的語氣描述（20字以內）"
  }
}`,
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenRouter 錯誤 ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "";

    // Extract JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI 回應解析失敗", raw }, { status: 500 });
    }

    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[analyze] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

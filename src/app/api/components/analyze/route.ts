import { NextResponse } from "next/server";
import { getAnthropic } from "@/lib/anthropic";

export async function POST(request: Request) {
  const { imageUrl } = await request.json();
  if (!imageUrl) return NextResponse.json({ error: "imageUrl required" }, { status: 400 });

  // Convert relative URL to absolute for fetch
  const host = new URL(request.url).origin;
  const absoluteUrl = imageUrl.startsWith("http") ? imageUrl : `${host}${imageUrl}`;

  // Fetch image and convert to base64
  const imgRes = await fetch(absoluteUrl);
  const buffer = await imgRes.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mediaType = (imgRes.headers.get("content-type") ?? "image/jpeg") as
    | "image/jpeg"
    | "image/png"
    | "image/gif"
    | "image/webp";

  const anthropic = getAnthropic();

  const message = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
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
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";

  // Extract JSON from response
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ error: "AI response parse failed", raw }, { status: 500 });
  }

  const result = JSON.parse(jsonMatch[0]);
  return NextResponse.json(result);
}

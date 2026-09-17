import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeProductVisualProfile,
  buildImageSetArtDirection,
  countProductVisualReferenceImages,
  parseImageSetArtDirection,
} from "./product-visual-analysis.ts";
import { computeProductVisualSourceHash } from "./product-visual-profile.ts";

const productWithThreeReferences = {
  name: "女性電動除毛刀",
  description: "纖巧筆型除毛刀",
  category: "美容儀器",
  rawImageUrls: ["front.png", "detail.png"],
  heroImageUrl: "hero.png",
};

const beautyDeviceProfile = {
  version: 1 as const,
  productType: "女性電動除毛刀",
  productArchetype: "beauty_device" as const,
  confidence: 0.96,
  appearance: {
    shape: "纖長筆型",
    materials: ["霧面塑膠", "金屬刀網"],
    colors: ["白", "冰藍", "銀"],
    distinctiveDetails: ["圓形刀頭", "冰藍按鍵"],
    visibleTextOrLogos: ["Schick"],
  },
  useCases: ["腿部日常修整"],
  suitableScenes: ["明亮浴室"],
  visualMotifs: ["銀藍曲線"],
  prohibitedChanges: ["不得改變刀頭結構"],
  sourceImageCount: 3,
};

const validBeautyDeviceProfileJson = JSON.stringify(beautyDeviceProfile);

test("reference count matches the deduplicated five-image analysis cap", () => {
  assert.equal(countProductVisualReferenceImages({
    rawImageUrls: ["a.png", "a.png", "b.png", "c.png", "d.png", "e.png", "f.png"],
    heroImageUrl: "hero.png",
  }), 5);
  assert.equal(countProductVisualReferenceImages({ rawImageUrls: ["a.png"], heroImageUrl: "a.png" }), 1);
});

test("sends every raw image and the hero image to vision analysis", async () => {
  const seen: string[] = [];

  const result = await analyzeProductVisualProfile(productWithThreeReferences, {
    loadAsDataUrl: async (url) => `data:image/png;base64,${url}`,
    completeVision: async ({ imageDataUrls }) => {
      seen.push(...imageDataUrls);
      return validBeautyDeviceProfileJson;
    },
  });

  assert.equal(seen.length, 3);
  assert.equal(result.productArchetype, "beauty_device");
});

test("falls back without inventing facts when model JSON is invalid", async () => {
  const result = await analyzeProductVisualProfile(productWithThreeReferences, {
    loadAsDataUrl: async (url) => url,
    completeVision: async () => "not json",
  });

  assert.equal(result.confidence, 0);
  assert.equal(result.appearance.distinctiveDetails.length, 0);
});

test("deduplicates references, caps input at five images, and preserves the hero", async () => {
  const seen: string[] = [];
  await analyzeProductVisualProfile(
    {
      ...productWithThreeReferences,
      rawImageUrls: ["one.png", "two.png", "two.png", "three.png", "four.png", "five.png"],
      heroImageUrl: "six.png",
    },
    {
      loadAsDataUrl: async (url) => `data:image/png;base64,${url}`,
      completeVision: async ({ imageDataUrls }) => {
        seen.push(...imageDataUrls);
        return validBeautyDeviceProfileJson;
      },
    },
  );

  assert.deepEqual(seen, [
    "data:image/png;base64,one.png",
    "data:image/png;base64,two.png",
    "data:image/png;base64,three.png",
    "data:image/png;base64,four.png",
    "data:image/png;base64,six.png",
  ]);
});

test("records the number of references actually analyzed instead of the model count", async () => {
  const result = await analyzeProductVisualProfile(productWithThreeReferences, {
    loadAsDataUrl: async (url) => `data:image/png;base64,${url}`,
    completeVision: async () => JSON.stringify({ ...beautyDeviceProfile, sourceImageCount: 99 }),
  });

  assert.equal(result.sourceImageCount, 3);
});

test("propagates the shared abort signal and never starts vision after a reference deadline", async () => {
  const controller = new AbortController();
  let visionCalls = 0;
  await assert.rejects(
    () => analyzeProductVisualProfile(productWithThreeReferences, {
      loadAsDataUrl: async (_url, signal) => {
        assert.equal(signal, controller.signal);
        controller.abort(new Error("analysis absolute deadline reached"));
        throw controller.signal.reason;
      },
      completeVision: async () => { visionCalls += 1; return validBeautyDeviceProfileJson; },
    }, controller.signal),
    /deadline/i,
  );
  assert.equal(visionCalls, 0);
});

test("passes the same request-scoped signal to vision completion", async () => {
  const controller = new AbortController();
  let seen: AbortSignal | undefined;
  await analyzeProductVisualProfile(productWithThreeReferences, {
    loadAsDataUrl: async (url) => `data:image/png;base64,${url}`,
    completeVision: async (request) => {
      seen = request.signal;
      return validBeautyDeviceProfileJson;
    },
  }, controller.signal);
  assert.equal(seen, controller.signal);
});

test("uses product colors as dominant and brand color as accent", () => {
  const art = buildImageSetArtDirection(beautyDeviceProfile, {
    primaryColor: "#ffeb85",
    toneLabels: ["清新"],
  });

  assert.deepEqual(art.palette.dominant, ["白", "冰藍", "銀"]);
  assert.deepEqual(art.palette.accent, ["#ffeb85"]);
});

test("art direction frames new sets as composable advertising assets rather than repeated product photography", () => {
  const art = buildImageSetArtDirection(beautyDeviceProfile, {});

  assert.match(art.concept, /可合成廣告素材包/);
  assert.doesNotMatch(`${art.concept}\n${art.lighting}\n${art.cameraLanguage}`, /產品攝影/);
});

test("parses legacy art direction snapshots with empty optional kit styling", () => {
  const legacy = {
    concept: "一致的商品素材",
    palette: { dominant: ["白"], accent: ["金"] },
    lighting: "柔和棚拍光",
    materials: ["霧面材質"],
    backgroundLanguage: "留白背景",
    cameraLanguage: "正面視角",
    consistencyRules: ["同一活動使用一致色調"],
  };

  assert.deepEqual(parseImageSetArtDirection(legacy), {
    ...legacy,
    mood: [],
    decorationStyle: [],
  });
});

test("optional art-direction styling does not invalidate the product source hash", () => {
  const before = computeProductVisualSourceHash(productWithThreeReferences);
  const parsed = parseImageSetArtDirection({
    ...buildImageSetArtDirection(beautyDeviceProfile, {}),
    mood: ["清爽"],
    decorationStyle: ["細線框"],
  });

  assert.ok(parsed);
  assert.equal(computeProductVisualSourceHash(productWithThreeReferences), before);
});

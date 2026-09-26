const GEMINI_MODEL = "gemini-3.8-flash-tts";
const DEFAULT_API_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const MAX_SEGMENTS = 12;
const MAX_SEGMENT_LENGTH = 420;
const MAX_TRANSCRIPT_LENGTH = 720;
const MAX_RESPONSE_BYTES = 32_000_000;
const CACHE_VERSION = "v1";
const DEFAULT_VOICE = "Vindemiatrix";
const ALLOWED_VOICES = new Set([
  "Vindemiatrix",
  "Achernar",
  "Sulafat",
  "Kore",
  "Aoede",
  "Charon",
]);
const DELIVERY_STYLES = {
  expressive: "warm, vivid audiobook narration in Mandarin Chinese, with natural emotional variation, clear phrasing, and restrained dramatic emphasis",
  natural: "clear and natural Mandarin Chinese narration with calm, steady pacing",
};

function jsonResponse(message, status, extraHeaders = {}) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isAllowedArticlePath(path) {
  return (
    typeof path === "string" &&
    path.length <= 320 &&
    path.startsWith("/posts/") &&
    path.endsWith("/") &&
    !path.includes("..") &&
    !path.includes("?") &&
    !path.includes("#")
  );
}

function validateSegments(rawSegments) {
  if (!Array.isArray(rawSegments) || rawSegments.length === 0 || rawSegments.length > MAX_SEGMENTS) {
    return null;
  }

  const segments = rawSegments.map(normalizeText);
  if (segments.some((segment) => segment.length < 2 || segment.length > MAX_SEGMENT_LENGTH)) {
    return null;
  }

  const transcript = segments.join(" ");
  if (transcript.length > MAX_TRANSCRIPT_LENGTH) return null;
  return { segments, transcript };
}

class ArticleTextHandler {
  constructor() {
    this.value = "";
  }

  text(chunk) {
    this.value += chunk.text;
  }
}

class BlockBoundaryHandler {
  constructor(article) {
    this.article = article;
  }

  element(element) {
    this.article.value += " ";
    element.onEndTag(() => {
      this.article.value += " ";
    });
  }
}

async function readArticleText(env, requestUrl, path) {
  const assetUrl = new URL(path, requestUrl.origin);
  const assetResponse = await env.ASSETS.fetch(
    new Request(assetUrl, { headers: { Accept: "text/html" } }),
  );

  if (!assetResponse.ok || !assetResponse.headers.get("content-type")?.includes("text/html")) {
    return null;
  }

  const article = new ArticleTextHandler();
  const blockBoundaries = new BlockBoundaryHandler(article);
  const parsed = new HTMLRewriter()
    .on("#article-content", article)
    .on(
      "#article-content h1, #article-content h2, #article-content h3, #article-content h4, #article-content h5, #article-content h6, #article-content p, #article-content li, #article-content blockquote, #article-content figcaption, #article-content dt, #article-content dd",
      blockBoundaries,
    )
    .transform(assetResponse);

  await parsed.arrayBuffer();
  return normalizeText(article.value);
}

function segmentsAppearInOrder(articleText, segments) {
  let cursor = 0;
  for (const segment of segments) {
    const index = articleText.indexOf(segment, cursor);
    if (index === -1) return false;
    cursor = index + segment.length;
  }
  return true;
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("Origin");
  const fetchSite = request.headers.get("Sec-Fetch-Site");

  if ((origin && origin !== requestUrl.origin) || (fetchSite && fetchSite !== "same-origin")) {
    return jsonResponse("仅允许从本站发起朗读请求。", 403);
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return jsonResponse("请求格式不正确。", 415);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 12_000) return jsonResponse("请求内容过长。", 413);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse("请求内容不是有效 JSON。", 400);
  }

  if (!isAllowedArticlePath(body.path)) {
    return jsonResponse("文章路径无效。", 400);
  }

  const validated = validateSegments(body.segments);
  if (!validated) return jsonResponse("朗读片段无效。", 400);

  const voice = ALLOWED_VOICES.has(body.voice) ? body.voice : DEFAULT_VOICE;
  const styleName = Object.hasOwn(DELIVERY_STYLES, body.style) ? body.style : "expressive";
  const articleText = await readArticleText(env, requestUrl, body.path);

  if (!articleText || !segmentsAppearInOrder(articleText, validated.segments)) {
    return jsonResponse("朗读内容不属于这篇文章。", 403);
  }

  if (!env.GEMINI_API_KEY) {
    return jsonResponse("AI 朗读服务尚未配置。", 503);
  }

  const cacheHash = await sha256Hex(
    [GEMINI_MODEL, voice, styleName, validated.transcript].join("\n"),
  );
  const objectKey = `reader-audio/${CACHE_VERSION}/${cacheHash}.json`;
  const cacheKey = new Request(new URL(`/__reader-audio/${cacheHash}`, requestUrl.origin), {
    method: "GET",
  });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);

  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set("X-Reader-Cache", "HIT");
    return new Response(cached.body, { status: cached.status, headers });
  }

  if (env.TTS_CACHE) {
    try {
      const stored = await env.TTS_CACHE.get(objectKey);
      if (stored) {
        const headers = new Headers({
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
          "X-Reader-Cache": "R2",
        });
        stored.writeHttpMetadata(headers);
        headers.set("Content-Type", "application/json; charset=utf-8");
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
        const response = new Response(stored.body, { status: 200, headers });
        context.waitUntil(cache.put(cacheKey, response.clone()));
        return response;
      }
    } catch {
      // R2 is the durable cache; a temporary storage error falls through to Gemini.
    }
  }

  const apiUrl = env.GEMINI_API_BASE_URL || DEFAULT_API_URL;
  let upstream;
  try {
    upstream = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        input: [
          {
            type: "user_input",
            content: [
              {
                type: "text",
                text: validated.transcript,
                annotations: [
                  {
                    type: "speech_metadata",
                    style: DELIVERY_STYLES[styleName],
                  },
                ],
              },
            ],
          },
        ],
        response_format: { type: "audio" },
        generation_config: { speech_config: [{ voice }] },
      }),
      signal: request.signal,
    });
  } catch {
    return jsonResponse("AI 朗读服务暂时无法连接。", 502);
  }

  if (!upstream.ok) {
    const status = upstream.status === 429 ? 429 : 502;
    const retryAfter = upstream.headers.get("Retry-After");
    upstream.body?.cancel();
    return jsonResponse(
      status === 429 ? "AI 朗读请求过于频繁，请稍后重试。" : "AI 朗读服务暂时不可用。",
      status,
      retryAfter ? { "Retry-After": retryAfter } : {},
    );
  }

  let payload;
  try {
    payload = await upstream.arrayBuffer();
  } catch {
    return jsonResponse("AI 朗读响应读取失败。", 502);
  }

  if (!payload.byteLength || payload.byteLength > MAX_RESPONSE_BYTES) {
    return jsonResponse("AI 朗读响应大小异常。", 502);
  }

  const response = new Response(payload, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "X-Reader-Cache": "MISS",
    },
  });

  if (env.TTS_CACHE) {
    try {
      await env.TTS_CACHE.put(objectKey, payload, {
        httpMetadata: {
          contentType: "application/json; charset=utf-8",
          cacheControl: "public, max-age=31536000, immutable",
        },
        customMetadata: {
          model: GEMINI_MODEL,
          voice,
          style: styleName,
        },
      });
    } catch {
      // Keep the reader available even if persistent caching is briefly unavailable.
    }
  }

  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

export function onRequest(context) {
  return jsonResponse(`不支持 ${context.request.method} 请求。`, 405, { Allow: "POST" });
}

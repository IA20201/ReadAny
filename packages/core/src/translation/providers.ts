/**
 * Translation Providers
 * Supports AI (using existing AI config) and DeepL
 */

import type { TranslationProvider, TranslatorName } from "./types";

/** Get language display name */
function getLanguageName(code: string): string {
  const langMap: Record<string, string> = {
    "zh-CN": "Simplified Chinese",
    "zh-TW": "Traditional Chinese",
    ja: "Japanese",
    ko: "Korean",
    en: "English",
    fr: "French",
    de: "German",
    es: "Spanish",
    pt: "Portuguese",
    it: "Italian",
    ru: "Russian",
    ar: "Arabic",
    th: "Thai",
    vi: "Vietnamese",
    id: "Indonesian",
    tr: "Turkish",
    pl: "Polish",
    nl: "Dutch",
    sv: "Swedish",
  };
  return langMap[code] || code;
}

/** AI Translation - uses OpenAI-compatible API */
export async function aiTranslate(
  texts: string[],
  _sourceLang: string,
  targetLang: string,
  apiKey: string,
  baseUrl: string,
  model: string,
): Promise<string[]> {
  if (!apiKey) {
    throw new Error("AI API key is required. Please configure in AI settings.");
  }

  const targetLangName = getLanguageName(targetLang);
  const apiUrl = baseUrl || "https://api.openai.com/v1";

  // For single text, use simple translation
  if (texts.length === 1) {
    const response = await fetch(`${apiUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a professional translator. Translate the following text to ${targetLangName}. Only output the translation, no explanations or additional text.`,
          },
          { role: "user", content: texts[0] },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return [data.choices[0]?.message?.content?.trim() || texts[0]];
  }

  // For multiple texts, translate individually
  return Promise.all(
    texts.map(async (text) => {
      try {
        const response = await fetch(`${apiUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model || "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You are a professional translator. Translate the following text to ${targetLangName}. Only output the translation.`,
              },
              { role: "user", content: text },
            ],
            temperature: 0.3,
            max_tokens: 2048,
          }),
        });
        if (!response.ok) {
          console.warn(`[aiTranslate] API error for text: ${response.status}`);
          return "";
        }
        const data = await response.json();
        return data.choices[0]?.message?.content?.trim() || "";
      } catch (err) {
        console.warn("[aiTranslate] Individual translation failed:", err);
        return "";
      }
    }),
  );
}

/**
 * AI Batch Translation — numbered paragraph format.
 * Sends multiple paragraphs in a single API call using numbering to keep
 * context coherent and parsing reliable. Falls back to individual calls
 * on parse failure.
 */
export async function aiTranslateBatch(
  texts: string[],
  _sourceLang: string,
  targetLang: string,
  apiKey: string,
  baseUrl: string,
  model: string,
): Promise<string[]> {
  if (!apiKey) {
    throw new Error("AI API key is required. Please configure in AI settings.");
  }

  // Single text — just delegate
  if (texts.length <= 1) {
    return aiTranslate(texts, _sourceLang, targetLang, apiKey, baseUrl, model);
  }

  const targetLangName = getLanguageName(targetLang);
  const apiUrl = baseUrl || "https://api.openai.com/v1";

  // Build numbered input
  const numberedInput = texts.map((t, i) => `${i + 1}. ${t}`).join("\n");

  try {
    const response = await fetch(`${apiUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a professional translator. Translate each numbered paragraph to ${targetLangName}. Output translations only, keep the same numbering format "N. translation". Do not add any explanation.`,
          },
          { role: "user", content: numberedInput },
        ],
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    const content: string = data.choices[0]?.message?.content?.trim() || "";

    // Parse numbered output
    const parsed = parseNumberedTranslation(content, texts.length);
    if (parsed) return parsed;

    // Fallback: could not parse — translate individually
    console.warn("[aiTranslateBatch] Failed to parse numbered output, falling back to individual");
  } catch (err) {
    console.warn("[aiTranslateBatch] Batch request failed, falling back:", err);
  }

  // Fallback to individual
  return aiTranslate(texts, _sourceLang, targetLang, apiKey, baseUrl, model);
}

/** Parse "1. xxx\n2. yyy\n..." format into an array */
function parseNumberedTranslation(content: string, expectedCount: number): string[] | null {
  const lines = content.split("\n").filter((l) => l.trim());
  const result: string[] = new Array(expectedCount).fill("");

  for (const line of lines) {
    const match = line.match(/^(\d+)\.\s*(.+)/);
    if (match) {
      const idx = Number.parseInt(match[1], 10) - 1;
      if (idx >= 0 && idx < expectedCount) {
        result[idx] = match[2].trim();
      }
    }
  }

  // Verify we got enough translations (at least 60%)
  const filled = result.filter((r) => r).length;
  if (filled < expectedCount * 0.6) return null;

  return result;
}

/** DeepL Translation */
export async function deeplTranslate(
  texts: string[],
  sourceLang: string,
  targetLang: string,
  apiKey: string,
  baseUrl?: string,
): Promise<string[]> {
  if (!apiKey) {
    throw new Error("DeepL API key is required");
  }

  const apiBaseUrl = baseUrl || "https://api-free.deepl.com/v2";

  // Build URLSearchParams properly
  const params = new URLSearchParams();
  texts.forEach((text) => params.append("text", text));
  params.append("target_lang", targetLang.toUpperCase().replace("-", "_"));
  if (sourceLang !== "AUTO") {
    params.append("source_lang", sourceLang.toUpperCase());
  }

  const response = await fetch(`${apiBaseUrl}/translate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `DeepL-Auth-Key ${apiKey}`,
    },
    body: params,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepL API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  return texts.map((_, i) => data.translations?.[i]?.text || texts[i]);
}

/** Provider interface for internal use */
interface InternalTranslationProvider {
  name: TranslatorName;
  label: string;
}

/** Available translators list */
export const TRANSLATOR_PROVIDERS: InternalTranslationProvider[] = [
  { name: "ai", label: "AI 翻译" },
  { name: "deepl", label: "DeepL" },
];

/** Get all available translators */
export function getTranslators(): InternalTranslationProvider[] {
  return TRANSLATOR_PROVIDERS;
}

/** Legacy exports for compatibility */
export const aiProvider: TranslationProvider = {
  name: "ai",
  label: "AI",
  translate: async (texts, sourceLang, targetLang, config) => {
    const { apiKey, baseUrl, model } = config as {
      apiKey?: string;
      baseUrl?: string;
      model?: string;
    };
    return aiTranslate(texts, sourceLang, targetLang, apiKey || "", baseUrl || "", model || "");
  },
};

export const deeplProvider: TranslationProvider = {
  name: "deepl",
  label: "DeepL",
  translate: async (texts, sourceLang, targetLang, config) => {
    const { apiKey, baseUrl } = config as { apiKey?: string; baseUrl?: string };
    return deeplTranslate(texts, sourceLang, targetLang, apiKey || "", baseUrl);
  },
};

/** Get a translator by name */
export function getTranslator(name: TranslatorName): TranslationProvider | undefined {
  if (name === "ai") return aiProvider;
  if (name === "deepl") return deeplProvider;
  return undefined;
}

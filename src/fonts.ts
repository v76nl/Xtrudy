import { updateGeometry } from "./geometry.ts";
import { showLoading } from "./ui.ts";

declare const opentype: {
  parse(buffer: ArrayBuffer): any;
  load(url: string, callback: (err: any, font: any) => void): void;
};

// フォントキー -> CDN上の woff ファイル URL
export const FONT_URLS = {
  sans: "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp@5/files/noto-sans-jp-japanese-700-normal.woff",
  zen: "https://cdn.jsdelivr.net/npm/@fontsource/zen-maru-gothic@5/files/zen-maru-gothic-japanese-700-normal.woff",
  dela: "https://cdn.jsdelivr.net/npm/@fontsource/dela-gothic-one@5/files/dela-gothic-one-japanese-400-normal.woff",
  serif:
    "https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-jp@5/files/noto-serif-jp-japanese-700-normal.woff",
  kaisei:
    "https://cdn.jsdelivr.net/npm/@fontsource/kaisei-tokumin@5/files/kaisei-tokumin-japanese-700-normal.woff",
  yuji: "https://cdn.jsdelivr.net/npm/@fontsource/yuji-boku@5/files/yuji-boku-japanese-400-normal.woff",
  reggae:
    "https://cdn.jsdelivr.net/npm/@fontsource/reggae-one@5/files/reggae-one-japanese-400-normal.woff",
  dot: "https://cdn.jsdelivr.net/npm/@fontsource/dotgothic16@5/files/dotgothic16-japanese-400-normal.woff",
  googlesans:
    "https://cdn.jsdelivr.net/npm/@fontsource/google-sans@5/files/google-sans-latin-700-normal.woff",
} as const;

export type FontKey = keyof typeof FONT_URLS;

export let currentFont: any = null;

// メモリ内フォントキャッシュ (パース済み opentype.Font)
const fontCache = new Map<FontKey, any>();

// 最新のロード要求キー (レースコンディション防止)
let latestRequestedKey: FontKey = "sans";

const CACHE_NAME = "xtrudy-fonts-v1";

async function fetchFontBuffer(url: string): Promise<ArrayBuffer> {
  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const cache = await caches.open(CACHE_NAME);
      const matched = await cache.match(url);
      if (matched) {
        return await matched.arrayBuffer();
      }
      const response = await fetch(url);
      if (response.ok) {
        cache.put(url, response.clone()).catch(() => {});
        return await response.arrayBuffer();
      }
    } catch {
      // Cache API 利用不可時は通常の fetch へフォールバック
    }
  }
  const response = await fetch(url);
  return await response.arrayBuffer();
}

export async function loadFont(key: FontKey): Promise<void> {
  latestRequestedKey = key;
  const url = FONT_URLS[key];
  if (!url) return;

  // メモリキャッシュにあれば即座に反映 (0ms)
  if (fontCache.has(key)) {
    currentFont = fontCache.get(key);
    updateGeometry();
    showLoading(false);
    return;
  }

  showLoading(true);
  try {
    const buffer = await fetchFontBuffer(url);
    const parsedFont = opentype.parse(buffer);
    fontCache.set(key, parsedFont);

    // 別のフォントが後からリクエストされていなければ適用
    if (latestRequestedKey === key) {
      currentFont = parsedFont;
      updateGeometry();
    }
  } catch (err) {
    console.error(`フォント読み込み失敗: ${key}`, err);
  } finally {
    if (latestRequestedKey === key) {
      showLoading(false);
    }
  }
}

// アイドル時のバックグラウンド先読み (ファーストタッチ完了後にキャッシュ)
export function prefetchOtherFonts(): void {
  if (typeof window === "undefined") return;
  const idleCallback =
    window.requestIdleCallback ||
    ((cb: () => void) => setTimeout(cb, 1500));

  idleCallback(() => {
    const keys = Object.keys(FONT_URLS) as FontKey[];
    let i = 0;
    function next() {
      if (i >= keys.length) return;
      const k = keys[i++];
      if (!fontCache.has(k)) {
        fetchFontBuffer(FONT_URLS[k])
          .then((buf) => {
            try {
              fontCache.set(k, opentype.parse(buf));
            } catch {
              // プリフェッチパース失敗は無視
            }
            idleCallback(next);
          })
          .catch(() => idleCallback(next));
      } else {
        next();
      }
    }
    next();
  });
}

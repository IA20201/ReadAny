#!/usr/bin/env node
/**
 * Phase 1 spike: probe Edge TTS readaloud endpoint for Bookmark event support.
 *
 * Sends SSML containing `<bookmark mark="..."/>` elements and logs every text
 * frame received. The point is to answer one question:
 *
 *     Does the Edge readaloud server emit `Type: "Bookmark"` metadata events
 *     in response to `<bookmark mark="..."/>` SSML?
 *
 * If yes → Phase 1 of the foliate-tts migration is viable as designed.
 * If no  → we need a different mark-tracking strategy (e.g. WordBoundary +
 *          offset table) before Phase 2 onwards.
 *
 * This script is **standalone**: uses the `ws` package directly with the right
 * headers, bypassing IPlatformService. No production code paths involved.
 *
 * Run: node scripts/edge-tts-bookmark-spike.mjs
 */

import { WebSocket } from "ws";
import crypto from "node:crypto";

// ── Constants (kept in sync with packages/core/src/tts/edge-tts.ts) ──
const EDGE_SPEECH_URL =
  "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
const EDGE_API_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const CHROMIUM_FULL_VERSION = "143.0.3650.75";
const CHROMIUM_MAJOR_VERSION = "143";
const WIN_EPOCH_OFFSET = 11644473600n;
const S_TO_NS = 1000000000n;

// ── Token generation ──

async function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex").toUpperCase();
}

async function generateSecMsGec() {
  let ticks = BigInt(Math.floor(Date.now() / 1000));
  ticks += WIN_EPOCH_OFFSET;
  ticks -= ticks % 300n;
  ticks *= S_TO_NS / 100n;
  return sha256Hex(`${ticks.toString()}${EDGE_API_TOKEN}`);
}

function generateMuid() {
  return crypto.randomBytes(16).toString("hex").toUpperCase();
}

function randomHex(len) {
  return crypto.randomBytes(len).toString("hex");
}

// ── Test SSML with bookmarks ──

function buildBookmarkSSML() {
  // Three sentences, each preceded by a bookmark. If Edge supports the
  // Microsoft `<bookmark>` extension, we should see exactly three Bookmark
  // events with names "s0", "s1", "s2" — and their timestamps should match
  // the start of each spoken sentence.
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
<voice name="en-US-AriaNeural">
<prosody rate="+0%" pitch="+0Hz">
<bookmark mark="s0"/>The quick brown fox jumps over the lazy dog.
<bookmark mark="s1"/>Pack my box with five dozen liquor jugs.
<bookmark mark="s2"/>How vexingly quick daft zebras jump.
</prosody>
</voice>
</speak>`;
}

function genMessage(headers, content) {
  let header = "";
  for (const k of Object.keys(headers)) header += `${k}: ${headers[k]}\r\n`;
  return `${header}\r\n${content}`;
}

// ── Main spike ──

async function main() {
  const connectId = randomHex(16);
  const secMsGec = await generateSecMsGec();
  const params = new URLSearchParams({
    ConnectionId: connectId,
    TrustedClientToken: EDGE_API_TOKEN,
    "Sec-MS-GEC": secMsGec,
    "Sec-MS-GEC-Version": `1-${CHROMIUM_FULL_VERSION}`,
  });
  const url = `${EDGE_SPEECH_URL}?${params.toString()}`;

  const ws = new WebSocket(url, {
    headers: {
      "User-Agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
      "Accept-Encoding": "gzip, deflate, br, zstd",
      "Accept-Language": "en-US,en;q=0.9",
      Pragma: "no-cache",
      "Cache-Control": "no-cache",
      Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
      Cookie: `muid=${generateMuid()};`,
    },
  });

  const date = new Date().toString();
  const ssml = buildBookmarkSSML();

  const configMsg = genMessage(
    {
      "Content-Type": "application/json; charset=utf-8",
      Path: "speech.config",
      "X-Timestamp": date,
    },
    JSON.stringify({
      context: {
        synthesis: {
          audio: {
            metadataoptions: {
              sentenceBoundaryEnabled: true, // turn on so we see what's available
              wordBoundaryEnabled: true,
            },
            outputFormat: "audio-24khz-48kbitrate-mono-mp3",
          },
        },
      },
    }),
  );

  const ssmlMsg = genMessage(
    {
      "Content-Type": "application/ssml+xml",
      Path: "ssml",
      "X-RequestId": connectId,
      "X-Timestamp": date,
    },
    ssml,
  );

  let totalAudioBytes = 0;
  const observedPaths = new Map(); // path -> count
  const bookmarkEvents = [];
  const wordBoundaryEvents = [];
  const sentenceBoundaryEvents = [];
  const otherMetadata = [];

  ws.on("open", () => {
    console.log("[spike] WS open");
    ws.send(configMsg);
    ws.send(ssmlMsg);
  });

  ws.on("message", (data, isBinary) => {
    if (!isBinary) {
      const raw = data.toString();
      const sep = raw.indexOf("\r\n\r\n");
      const headerBlock = sep >= 0 ? raw.slice(0, sep) : raw;
      const body = sep >= 0 ? raw.slice(sep + 4) : "";
      const pathLine = headerBlock.split("\r\n").find((l) => /^path:/i.test(l));
      const path = pathLine ? pathLine.slice(pathLine.indexOf(":") + 1).trim() : "(none)";
      observedPaths.set(path, (observedPaths.get(path) ?? 0) + 1);

      if (/^audio\.metadata/i.test(path) && body) {
        try {
          const parsed = JSON.parse(body);
          for (const ev of parsed.Metadata ?? []) {
            const t = ev.Type;
            const offset = ev.Data?.Offset;
            if (t === "Bookmark") {
              bookmarkEvents.push({ name: ev.Data?.Name, offsetTicks: offset });
            } else if (t === "WordBoundary") {
              wordBoundaryEvents.push({
                text: ev.Data?.text?.Text,
                offsetTicks: offset,
              });
            } else if (t === "SentenceBoundary") {
              sentenceBoundaryEvents.push({
                text: ev.Data?.text?.Text,
                offsetTicks: offset,
              });
            } else {
              otherMetadata.push({ type: t, data: ev.Data });
            }
          }
        } catch (err) {
          console.warn("[spike] metadata parse failed:", err.message);
        }
      } else if (/^turn\.end/i.test(path)) {
        // print summary then close
        printSummary();
        ws.close();
      }
    } else {
      // binary audio frame — count payload bytes only (skip the 2-byte header
      // length field + the header itself, same as edge-tts.ts).
      const bytes = new Uint8Array(data);
      if (bytes.length >= 2) {
        const headerLen = (bytes[0] << 8) | bytes[1];
        if (bytes.length > headerLen + 2) {
          totalAudioBytes += bytes.length - headerLen - 2;
        }
      }
    }
  });

  ws.on("error", (err) => {
    console.error("[spike] WS error:", err.message);
    process.exit(1);
  });

  ws.on("close", () => {
    console.log("[spike] WS closed");
  });

  function printSummary() {
    console.log("\n──────── EDGE TTS BOOKMARK SPIKE ────────");
    console.log("Audio bytes received:", totalAudioBytes);

    console.log("\nObserved frame Paths:");
    for (const [p, n] of observedPaths) console.log(`  ${p}: ${n}`);

    console.log("\nBookmark events:", bookmarkEvents.length);
    for (const b of bookmarkEvents) {
      console.log(`  name="${b.name}"  offset=${b.offsetTicks} ticks (${b.offsetTicks / 10_000} ms)`);
    }

    console.log("\nWordBoundary events:", wordBoundaryEvents.length);
    for (const w of wordBoundaryEvents.slice(0, 6)) {
      console.log(`  "${w.text}"  offset=${w.offsetTicks} ticks (${w.offsetTicks / 10_000} ms)`);
    }
    if (wordBoundaryEvents.length > 6) {
      console.log(`  … (${wordBoundaryEvents.length - 6} more)`);
    }

    console.log("\nSentenceBoundary events:", sentenceBoundaryEvents.length);
    for (const s of sentenceBoundaryEvents) {
      console.log(`  "${s.text}"  offset=${s.offsetTicks} ticks (${s.offsetTicks / 10_000} ms)`);
    }

    if (otherMetadata.length) {
      console.log("\nOther metadata types:");
      for (const m of otherMetadata) console.log(`  ${m.type}:`, JSON.stringify(m.data));
    }

    console.log("\n──────── VERDICT ────────");
    if (bookmarkEvents.length === 3) {
      console.log("✅ Edge TTS DOES emit Bookmark events for <bookmark mark=\"...\"/>.");
      console.log("   Phase 1 design is viable as planned.");
    } else if (bookmarkEvents.length > 0) {
      console.log(`⚠️  Got ${bookmarkEvents.length} Bookmark events, expected 3.`);
      console.log("   Server accepts <bookmark> partially — investigate timing/dedup.");
    } else {
      console.log("❌ NO Bookmark events received.");
      console.log("   Server ignores the <bookmark> tag. Need fallback strategy:");
      console.log("   1) Use WordBoundary offsets and pre-compute a mark→offset table, OR");
      console.log("   2) Send each bookmark-segment as a separate WS request.");
    }
    console.log();
  }

  setTimeout(() => {
    console.error("[spike] timeout (30s)");
    printSummary();
    process.exit(2);
  }, 30_000);
}

main().catch((err) => {
  console.error("[spike] fatal:", err);
  process.exit(1);
});

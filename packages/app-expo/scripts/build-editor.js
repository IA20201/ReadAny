/**
 * Build the custom 10tap web editor into a self-contained HTML file.
 *
 * Run: node scripts/build-editor.js
 *
 * Output: assets/editor/editor.html
 * This file is loaded via `customSource` in TiptapEditor.tsx.
 */
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ENTRY = path.resolve(ROOT, "src/editor/web-editor.tsx");
const ASSETS_DIR = path.resolve(ROOT, "assets/editor");
const OUTPUT_HTML = path.resolve(ASSETS_DIR, "editor.html");

// The base HTML template — identical to tentap's index.html
const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <title>KnowledgeEditor</title>
  </head>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; background: transparent; }
    #root > div:nth-of-type(1) {
      position: absolute;
      height: 100%;
      overflow: auto;
      width: 100%;
      top: 0;
      bottom: 0;
    }
    #root > div.dynamic-height {
      height: unset;
    }
    #root div .ProseMirror {
      min-height: 100%;
      overflow: visible;
      padding: 16px;
      font-size: 15px;
      line-height: 1.7;
      color: #1e293b;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      outline: none;
    }
    #root div.dynamic-height .ProseMirror {
      height: unset;
    }
    .ProseMirror:focus { outline: none; }
    .highlight-background { background-color: #e6e6ff; }
    /* Prose styles */
    .ProseMirror h1 { font-size: 22px; font-weight: 700; margin: 20px 0 8px; }
    .ProseMirror h2 { font-size: 18px; font-weight: 600; margin: 16px 0 6px; }
    .ProseMirror h3 { font-size: 15px; font-weight: 600; margin: 12px 0 4px; }
    .ProseMirror p { margin: 0 0 8px; }
    .ProseMirror ul, .ProseMirror ol { padding-left: 24px; margin: 4px 0 8px; }
    .ProseMirror li { margin: 2px 0; }
    .ProseMirror blockquote {
      border-left: 3px solid #94a3b8;
      margin: 8px 0;
      padding: 4px 12px;
      color: #64748b;
      font-style: italic;
    }
    .ProseMirror code {
      background: #f1f5f9;
      border-radius: 4px;
      padding: 1px 5px;
      font-size: 13px;
      font-family: 'Menlo', 'Monaco', monospace;
    }
    .ProseMirror hr { border: none; border-top: 1px solid #e2e8f0; margin: 12px 0; }
    .ProseMirror p.is-editor-empty:first-child::before {
      color: #94a3b8;
      content: attr(data-placeholder);
      float: left;
      height: 0;
      pointer-events: none;
    }
  </style>
  <body>
    <div id="root"></div>
    __BUNDLE__
  </body>
</html>`;

async function build() {
  if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
  }

  console.log("Building custom web editor...");

  const result = await esbuild.build({
    entryPoints: [ENTRY],
    bundle: true,
    format: "iife",
    target: "es2019",
    minify: true,
    write: false,
    jsx: "automatic",
    loader: { ".tsx": "tsx", ".ts": "ts" },
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    alias: {
      // Resolve tentap internal imports
      "@10play/tentap-editor/src/webEditorUtils": path.resolve(
        ROOT,
        "../../node_modules/@10play/tentap-editor/src/webEditorUtils/index.ts"
      ),
      "@10play/tentap-editor/src/bridges/StarterKit": path.resolve(
        ROOT,
        "../../node_modules/@10play/tentap-editor/src/bridges/StarterKit.ts"
      ),
      // Stub out React Native — it is not available in the WebView browser context.
      // The tentap bridge files import it only for types (or at runtime via the RN host),
      // so an empty object shim is sufficient for the web bundle.
      "react-native": path.resolve(ROOT, "src/editor/stubs/react-native.js"),
      "react-native-webview": path.resolve(ROOT, "src/editor/stubs/react-native-webview.js"),
    },
  });

  const js = result.outputFiles[0].text;
  const html = HTML_TEMPLATE.replace("__BUNDLE__", `<script>\n${js}\n</script>`);

  fs.writeFileSync(OUTPUT_HTML, html, "utf-8");

  console.log(`✅ editor.html written (${(html.length / 1024).toFixed(1)} KB)`);

  // Also emit a TypeScript module that exports the HTML as a string.
  // This lets TiptapEditor.tsx import it directly without any special Metro
  // asset loaders or filesystem reads at runtime.
  // Use JSON.stringify to safely encode all characters (avoids octal/control
  // char issues that backtick template literals have with minified bundles).
  const TS_MODULE = path.resolve(ROOT, "src/editor/editorHtml.ts");
  const tsContent = `// AUTO-GENERATED — do not edit.  Re-run: node scripts/build-editor.js\nexport const editorHtml: string = ${JSON.stringify(html)};\n`;
  fs.writeFileSync(TS_MODULE, tsContent, "utf-8");
  console.log(`✅ editorHtml.ts written`);
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});

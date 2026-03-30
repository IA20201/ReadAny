const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch the monorepo root so Metro can resolve workspace packages
config.watchFolders = [monorepoRoot];

// 2. Tell Metro where to find node_modules in a pnpm monorepo
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// 3. Block large unused modules from being bundled
config.resolver.blockList = [
  /node_modules\/onnxruntime-node\/.*/,
  /node_modules\/onnxruntime-web\/.*/,
  /node_modules\/@pagefind\/.*/,
  /node_modules\/pdfjs-dist\/.*/,
  /node_modules\/mermaid\/.*/,
  /node_modules\/lucide-react\/.*/,
  /node_modules\/esbuild\/.*/,
  /node_modules\/typescript\/.*/,
  /node_modules\/@biomejs\/.*/,
];

// 4. Add support for TypeScript files
config.resolver.sourceExts = [...config.resolver.sourceExts, "ts", "tsx"];

// 5. Add .html to asset extensions so WebView can load local HTML files
// Add .bin, .ort, .wasm for ONNX models
config.resolver.assetExts = [...config.resolver.assetExts, "html", "bin", "ort", "wasm"];

// 6. Configure SVG transformer
const { transformerPath } = config.transformer;
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve("react-native-svg-transformer"),
};
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== "svg");
config.resolver.sourceExts = [...config.resolver.sourceExts, "svg"];

// 7. Force all packages to use the same React instance from the monorepo root
// pnpm stores packages in node_modules/.pnpm/<package>@<version>/node_modules/<package>
// IMPORTANT: react version must match react-native's renderer version (19.1.4)
const reactPath = path.resolve(monorepoRoot, "node_modules/.pnpm/react@19.1.4/node_modules/react");
const reactNativePath = path.resolve(
  monorepoRoot,
  "node_modules/.pnpm/react-native@0.81.6_@babel+core@7.29.0_@types+react@19.1.17_react@19.1.4/node_modules/react-native",
);

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  react: reactPath,
  "react/jsx-runtime": path.resolve(reactPath, "jsx-runtime"),
  "react/jsx-dev-runtime": path.resolve(reactPath, "jsx-dev-runtime"),
  "react-native": reactNativePath,
};

// 8. Override resolver to redirect modules that depend on Node.js built-ins
const moduleRedirects = {
  punycode: path.resolve(monorepoRoot, "node_modules/punycode/punycode.js"),
};

// Stub path for ONNX runtime modules (mobile doesn't use local embedding)
const onnxStubPath = path.resolve(projectRoot, "src/stubs/onnxruntime-stub.js");

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Redirect ONNX runtime modules to empty stub (mobile uses remote embedding APIs only)
  if (moduleName.startsWith("onnxruntime-node") || moduleName.startsWith("onnxruntime-web")) {
    return { type: "sourceFile", filePath: onnxStubPath };
  }

  // Redirect Node built-in polyfills
  if (moduleRedirects[moduleName]) {
    return { type: "sourceFile", filePath: moduleRedirects[moduleName] };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

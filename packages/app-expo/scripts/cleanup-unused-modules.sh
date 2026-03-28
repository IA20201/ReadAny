#!/bin/bash
# Post-install script to remove unused modules for mobile build
# This runs AFTER pnpm install, so modules are already in node_modules

set -e

echo "🧹 Cleaning up unused modules for mobile build..."

# Get the script's directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Navigate to monorepo root (packages/app-expo/scripts -> packages/app-expo -> packages -> root)
MONOREPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

echo "  Monorepo root: $MONOREPO_ROOT"

# Define the modules to remove (these are brought in by @huggingface/transformers but not needed on mobile)
# Note: Only remove modules that are NOT needed by desktop build
UNUSED_MODULES=(
  "onnxruntime-node"
  "onnxruntime-web"
  "@pagefind"
  "react-devtools-core"
)

for module in "${UNUSED_MODULES[@]}"; do
  module_path="$MONOREPO_ROOT/node_modules/$module"
  if [ -d "$module_path" ]; then
    echo "  Removing $module..."
    rm -rf "$module_path"
  fi
done

echo "✅ Cleanup complete!"

#!/bin/bash
# TEMENOS V2 Cleanup Script
# Removes experimental V2 files to create clean V1 repository

echo "🧹 Cleaning up V2 experimental files..."

# Remove V2 entry points
if [ -f "app.html" ]; then
    echo "  Removing app.html"
    rm app.html
fi

if [ -f "index_2.html" ]; then
    echo "  Removing index_2.html (V1.5 experiment)"
    rm index_2.html
fi

# Remove V2 orchestrator
if [ -f "src/app.js" ]; then
    echo "  Removing src/app.js"
    rm src/app.js
fi

# Remove V2 router
if [ -f "src/core/router.js" ]; then
    echo "  Removing src/core/router.js"
    rm src/core/router.js
fi

# Remove V2 components directory
if [ -d "src/components" ]; then
    echo "  Removing src/components/"
    rm -rf src/components
fi

# Remove V2 design system
if [ -f "src/design-system.css" ]; then
    echo "  Removing src/design-system.css"
    rm src/design-system.css
fi

# Remove orbital integration experiment
if [ -f "src/orbital-integration.js" ]; then
    echo "  Removing src/orbital-integration.js"
    rm src/orbital-integration.js
fi

# Remove private cache (should not be in git)
if [ -f "src/sources/text/data/private_cache.json" ]; then
    echo "  Removing private_cache.json"
    rm src/sources/text/data/private_cache.json
fi

echo "✨ Cleanup complete! V1 repository is ready."
echo ""
echo "Remaining V1 structure:"
echo "  index.html           - Main entry point"
echo "  src/main.js          - Application orchestrator"
echo "  src/style.css        - V1 styles"
echo "  src/core/            - Chunker, player, models, curves"
echo "  src/audio/           - Audio engine and presets"
echo "  src/content/         - Library and starters"
echo "  src/sources/         - Text providers"
echo "  src/visuals/         - Visual cortex"
echo ""
echo "Next steps:"
echo "  1. Review changes: git status"
echo "  2. Stage files: git add ."
echo "  3. Commit: git commit -m 'Clean V1 release'"
echo "  4. Push: git push origin main"

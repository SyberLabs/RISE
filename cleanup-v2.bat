@echo off
REM TEMENOS V2 Cleanup Script (Windows)
REM Removes experimental V2 files to create clean V1 repository

echo 🧹 Cleaning up V2 experimental files...

REM Remove V2 entry points
if exist app.html (
    echo   Removing app.html
    del app.html
)

if exist index_2.html (
    echo   Removing index_2.html (V1.5 experiment^)
    del index_2.html
)

REM Remove V2 orchestrator
if exist src\app.js (
    echo   Removing src\app.js
    del src\app.js
)

REM Remove V2 router
if exist src\core\router.js (
    echo   Removing src\core\router.js
    del src\core\router.js
)

REM Remove V2 components directory
if exist src\components (
    echo   Removing src\components\
    rmdir /s /q src\components
)

REM Remove V2 design system
if exist src\design-system.css (
    echo   Removing src\design-system.css
    del src\design-system.css
)

REM Remove orbital integration experiment
if exist src\orbital-integration.js (
    echo   Removing src\orbital-integration.js
    del src\orbital-integration.js
)

REM Remove private cache (should not be in git)
if exist src\sources\text\data\private_cache.json (
    echo   Removing private_cache.json
    del src\sources\text\data\private_cache.json
)

echo ✨ Cleanup complete! V1 repository is ready.
echo.
echo Remaining V1 structure:
echo   index.html           - Main entry point
echo   src\main.js          - Application orchestrator
echo   src\style.css        - V1 styles
echo   src\core\            - Chunker, player, models, curves
echo   src\audio\           - Audio engine and presets
echo   src\content\         - Library and starters
echo   src\sources\         - Text providers
echo   src\visuals\         - Visual cortex
echo.
echo Next steps:
echo   1. Review changes: git status
echo   2. Stage files: git add .
echo   3. Commit: git commit -m "Clean V1 release"
echo   4. Push: git push origin main

pause

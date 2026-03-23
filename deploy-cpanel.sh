#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# MexiChat — cPanel Deploy Script
# Run: bash deploy-cpanel.sh
# ═══════════════════════════════════════════════════════════════

echo "🚀 Building MexiChat for production..."
npm run build

echo ""
echo "📦 Build complete! Files are in ./dist/"
echo ""
echo "═══ cPanel Upload Instructions ═══"
echo ""
echo "1. Login to cPanel → File Manager"
echo "2. Navigate to: public_html/ (or your domain root)"
echo "3. DELETE all existing files in public_html/"
echo "4. Upload ALL files from the ./dist/ folder:"
echo "   - index.html"
echo "   - .htaccess"
echo "   - manifest.webmanifest"
echo "   - offline.html"
echo "   - robots.txt"
echo "   - sitemap.xml"
echo "   - sw.js"
echo "   - favicon.ico"
echo "   - apple-touch-icon.png"
echo "   - favicon-96x96.png"
echo "   - web-app-manifest-192x192.png"
echo "   - web-app-manifest-512x512.png"
echo "   - assets/ folder (entire folder)"
echo ""
echo "5. In cPanel → Domains → make sure mexichat.app points to public_html/"
echo "6. In cPanel → SSL/TLS → ensure AutoSSL is enabled for mexichat.app"
echo "7. Test: https://mexichat.app"
echo ""
echo "═══ Alternative: ZIP Upload ═══"
echo "zip -r mexichat-deploy.zip dist/*"
echo "Upload ZIP to cPanel → Extract in public_html/"
echo ""
echo "✅ Done! Your app should be live at https://mexichat.app"
const sharp = require('sharp');
const path = require('path');

(async () => {
  // Create a 1024x500 Play Store feature graphic
  const width = 1024;
  const height = 500;
  
  // Navy blue gradient background with MexiChat branding
  const svgBg = `
  <svg width="${width}" height="${height}">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#0f172a"/>
        <stop offset="50%" style="stop-color:#1e3a5f"/>
        <stop offset="100%" style="stop-color:#1d4ed8"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <text x="512" y="200" text-anchor="middle" font-family="Arial,sans-serif" font-size="72" font-weight="bold" fill="white">Mexi<tspan fill="#60a5fa">Chat</tspan></text>
    <text x="512" y="280" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" fill="rgba(255,255,255,0.8)">Mensajería Privada y Segura</text>
    <text x="512" y="360" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" fill="rgba(255,255,255,0.5)">Chat Cifrado · Llamadas HD · Comunidad · Pagos</text>
    <text x="512" y="440" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" fill="rgba(255,255,255,0.35)">🇲🇽 Hecho en México para el mundo</text>
  </svg>`;

  await sharp(Buffer.from(svgBg))
    .resize(width, height)
    .png()
    .toFile(path.join(__dirname, 'store-assets', 'feature-graphic-1024x500.png'));
  console.log('✅ Feature graphic: store-assets/feature-graphic-1024x500.png');

  // Copy the 512x512 icon for Play Store
  await sharp(path.join(__dirname, 'mexichat-icon-source.png'))
    .resize(512, 512, { fit: 'cover' })
    .png()
    .toFile(path.join(__dirname, 'store-assets', 'play-store-icon-512.png'));
  console.log('✅ Store icon: store-assets/play-store-icon-512.png');

  console.log('\n🎉 Store assets ready!');
})();
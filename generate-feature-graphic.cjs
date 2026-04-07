const sharp = require('sharp');

const width = 1024;
const height = 500;

// Create gradient background with text overlay
const svgImage = Buffer.from(
  '<svg width="' + width + '" height="' + height + '">' +
  '<defs>' +
  '<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">' +
  '<stop offset="0%" style="stop-color:#1e3a5f;stop-opacity:1" />' +
  '<stop offset="50%" style="stop-color:#3b82f6;stop-opacity:1" />' +
  '<stop offset="100%" style="stop-color:#93c5fd;stop-opacity:1" />' +
  '</linearGradient>' +
  '</defs>' +
  '<rect width="100%" height="100%" fill="url(#bg)"/>' +
  '<text x="512" y="200" font-family="Arial,Helvetica,sans-serif" font-size="72" font-weight="bold" fill="white" text-anchor="middle">MexiChat Gel</text>' +
  '<text x="512" y="280" font-family="Arial,Helvetica,sans-serif" font-size="32" fill="#e0e7ff" text-anchor="middle">Mensajer\u00eda hecha para M\u00e9xico</text>' +
  '<text x="512" y="380" font-family="Arial,Helvetica,sans-serif" font-size="80" text-anchor="middle">\uD83C\uDDF2\uD83C\uDDFD</text>' +
  '</svg>'
);

sharp(svgImage)
  .resize(width, height)
  .png()
  .toFile('dist/feature-graphic.png')
  .then(() => console.log('Feature graphic created: dist/feature-graphic.png'))
  .catch(e => console.error(e));

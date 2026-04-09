const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const source = path.join(__dirname, 'mexichat-icon-source.png');

// Adaptive icon foreground sizes (canvas is 108dp but safe zone is 66dp = 61%)
// The "M" must fit inside the center 66/108 = ~61% of the image
const foregroundSizes = [
  { dir: 'mipmap-mdpi',    canvas: 108 },
  { dir: 'mipmap-hdpi',    canvas: 162 },
  { dir: 'mipmap-xhdpi',   canvas: 216 },
  { dir: 'mipmap-xxhdpi',  canvas: 324 },
  { dir: 'mipmap-xxxhdpi', canvas: 432 },
];

const legacySizes = [
  { dir: 'mipmap-mdpi',    size: 48 },
  { dir: 'mipmap-hdpi',    size: 72 },
  { dir: 'mipmap-xhdpi',   size: 96 },
  { dir: 'mipmap-xxhdpi',  size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

const webSizes = [
  { name: 'public/favicon-96x96.png', size: 96 },
  { name: 'public/apple-touch-icon.png', size: 180 },
  { name: 'public/web-app-manifest-192x192.png', size: 192 },
  { name: 'public/web-app-manifest-512x512.png', size: 512 },
  { name: 'mexichat-icon-1024.png', size: 1024 },
];

const resBase = 'android/app/src/main/res';

(async () => {
  console.log('=== ADAPTIVE ICON FOREGROUNDS (with safe zone padding) ===');
  
  for (const { dir, canvas } of foregroundSizes) {
    // The icon content should be ~61% of canvas, centered
    const iconSize = Math.round(canvas * 0.61);
    const padding = Math.round((canvas - iconSize) / 2);
    
    const outPath = path.join(__dirname, resBase, dir, 'ic_launcher_foreground.png');
    
    // Resize icon to safe zone size, then extend with transparent padding
    await sharp(source)
      .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({
        top: padding,
        bottom: canvas - iconSize - padding,
        left: padding,
        right: canvas - iconSize - padding,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(outPath);
    
    console.log(`  [OK] ${dir}/ic_launcher_foreground.png (${canvas}x${canvas}, icon ${iconSize}px centered)`);
  }

  console.log('\n=== LEGACY + ROUND ICONS ===');
  
  for (const { dir, size } of legacySizes) {
    // Legacy: full icon with slight padding for rounded corners
    const iconSize = Math.round(size * 0.82);
    const bg = '#7BA4D9';  // Match your icon's blue background
    
    const legacyPath = path.join(__dirname, resBase, dir, 'ic_launcher.png');
    await sharp(source)
      .resize(iconSize, iconSize, { fit: 'contain', background: bg })
      .extend({
        top: Math.round((size - iconSize) / 2),
        bottom: Math.ceil((size - iconSize) / 2),
        left: Math.round((size - iconSize) / 2),
        right: Math.ceil((size - iconSize) / 2),
        background: bg
      })
      .png()
      .toFile(legacyPath);
    console.log(`  [OK] ${dir}/ic_launcher.png (${size}x${size})`);
    
    // Round: same but will be masked by OS
    const roundPath = path.join(__dirname, resBase, dir, 'ic_launcher_round.png');
    await sharp(source)
      .resize(iconSize, iconSize, { fit: 'contain', background: bg })
      .extend({
        top: Math.round((size - iconSize) / 2),
        bottom: Math.ceil((size - iconSize) / 2),
        left: Math.round((size - iconSize) / 2),
        right: Math.ceil((size - iconSize) / 2),
        background: bg
      })
      .png()
      .toFile(roundPath);
    console.log(`  [OK] ${dir}/ic_launcher_round.png (${size}x${size})`);
  }

  console.log('\n=== WEB/PWA ICONS ===');
  
  for (const { name, size } of webSizes) {
    const outPath = path.join(__dirname, name);
    const dir2 = path.dirname(outPath);
    if (!fs.existsSync(dir2)) fs.mkdirSync(dir2, { recursive: true });
    await sharp(source).resize(size, size, { fit: 'cover' }).png().toFile(outPath);
    console.log(`  [OK] ${name} (${size}x${size})`);
  }

  // Favicon
  await sharp(source).resize(48, 48, { fit: 'cover' }).png()
    .toFile(path.join(__dirname, 'public', 'favicon.ico'));
  console.log('  [OK] public/favicon.ico (48x48)');

  console.log('\n✅ ALL ICONS REGENERATED WITH SAFE ZONE PADDING');
  console.log('The "M" will no longer be cut off on any phone!');
})();

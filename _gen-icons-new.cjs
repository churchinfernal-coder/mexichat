const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const source = path.join(__dirname, 'mexichat-icon-source.png');

const sizes = [
  // Web / PWA
  { name: 'public/favicon-96x96.png', size: 96 },
  { name: 'public/apple-touch-icon.png', size: 180 },
  { name: 'public/web-app-manifest-192x192.png', size: 192 },
  { name: 'public/web-app-manifest-512x512.png', size: 512 },
  // Root project icon
  { name: 'mexichat-icon-1024.png', size: 1024 },
  // Android adaptive icon (foreground)
  { name: 'android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png', size: 108 },
  { name: 'android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png', size: 162 },
  { name: 'android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png', size: 216 },
  { name: 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png', size: 324 },
  { name: 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png', size: 432 },
  // Android legacy icon
  { name: 'android/app/src/main/res/mipmap-mdpi/ic_launcher.png', size: 48 },
  { name: 'android/app/src/main/res/mipmap-hdpi/ic_launcher.png', size: 72 },
  { name: 'android/app/src/main/res/mipmap-xhdpi/ic_launcher.png', size: 96 },
  { name: 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png', size: 144 },
  { name: 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png', size: 192 },
  // Android round icon
  { name: 'android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png', size: 48 },
  { name: 'android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png', size: 72 },
  { name: 'android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png', size: 96 },
  { name: 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png', size: 144 },
  { name: 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png', size: 192 },
];

(async () => {
  for (const { name, size } of sizes) {
    const outPath = path.join(__dirname, name);
    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    await sharp(source)
      .resize(size, size, { fit: 'cover' })
      .png({ quality: 95 })
      .toFile(outPath);
    
    console.log(`✅ ${name} (${size}x${size})`);
  }
  
  // Generate favicon.ico from 48px
  await sharp(source)
    .resize(48, 48, { fit: 'cover' })
    .png()
    .toFile(path.join(__dirname, 'public', 'favicon.ico'));
  console.log('✅ public/favicon.ico (48x48)');
  
  console.log('\n🎉 All icons generated!');
})();
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const SOURCE = "mexichat-icon-1024.png";

// All sizes needed for Android + Web + Play Store
const targets = [
  // Android mipmap - ic_launcher (square)
  { path: "android/app/src/main/res/mipmap-mdpi/ic_launcher.png", size: 48 },
  { path: "android/app/src/main/res/mipmap-hdpi/ic_launcher.png", size: 72 },
  { path: "android/app/src/main/res/mipmap-xhdpi/ic_launcher.png", size: 96 },
  { path: "android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png", size: 144 },
  { path: "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png", size: 192 },

  // Android mipmap - ic_launcher_foreground (adaptive icon foreground = 108dp)
  { path: "android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png", size: 108 },
  { path: "android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png", size: 162 },
  { path: "android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png", size: 216 },
  { path: "android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png", size: 324 },
  { path: "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png", size: 432 },

  // Android mipmap - ic_launcher_round (same as ic_launcher)
  { path: "android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png", size: 48 },
  { path: "android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png", size: 72 },
  { path: "android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png", size: 96 },
  { path: "android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png", size: 144 },
  { path: "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png", size: 192 },

  // Web / PWA icons
  { path: "public/favicon-96x96.png", size: 96 },
  { path: "public/apple-touch-icon.png", size: 180 },
  { path: "public/web-app-manifest-192x192.png", size: 192 },
  { path: "public/web-app-manifest-512x512.png", size: 512 },

  // Play Store icon (512x512)
  { path: "fastlane/metadata/android/en-US/images/icon.png", size: 512 },
  { path: "fastlane/metadata/android/es-MX/images/icon.png", size: 512 },
];

async function generate() {
  let count = 0;
  for (const t of targets) {
    const dir = path.dirname(t.path);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    await sharp(SOURCE)
      .resize(t.size, t.size, { fit: "cover", kernel: "lanczos3" })
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(t.path);
    
    const kb = (fs.statSync(t.path).size / 1024).toFixed(1);
    console.log(`  ${t.size}x${t.size}  ${kb}KB  ${t.path}`);
    count++;
  }
  console.log(`\nDone! ${count} icons generated from ${SOURCE}`);
}

generate().catch(err => { console.error("ERROR:", err.message); process.exit(1); });

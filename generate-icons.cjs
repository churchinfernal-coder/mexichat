const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

async function generate() {
  const input = 'mexichat-icon.png';
  if (!fs.existsSync(input)) {
    console.error('ERROR: mexichat-icon.png not found in project root');
    process.exit(1);
  }

  for (const [folder, size] of Object.entries(sizes)) {
    const dir = path.join('android', 'app', 'src', 'main', 'res', folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    await sharp(input).resize(size, size).png().toFile(path.join(dir, 'ic_launcher.png'));
    await sharp(input).resize(size, size).png().toFile(path.join(dir, 'ic_launcher_round.png'));
    await sharp(input).resize(size, size).png().toFile(path.join(dir, 'ic_launcher_foreground.png'));
    console.log(folder + ': ' + size + 'x' + size + ' done');
  }

  // Play Store icon
  await sharp(input).resize(512, 512).png().toFile(
    path.join('android', 'app', 'src', 'main', 'ic_launcher-playstore.png')
  );
  console.log('Play Store 512x512 done');

  // Web favicon
  await sharp(input).resize(192, 192).png().toFile(path.join('public', 'favicon.png'));
  console.log('Web favicon 192x192 done');
}

generate().then(() => console.log('All icons generated')).catch(e => console.error(e));

const sharp = require("sharp");
sharp("mexichat-icon-1024.png").metadata().then(m => {
  console.log("Width:", m.width, "Height:", m.height, "Format:", m.format);
  console.log("Size OK:", m.width >= 512 ? "YES" : "NO - too small, need at least 512x512");
});

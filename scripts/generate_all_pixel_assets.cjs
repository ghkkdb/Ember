const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Base directories
const rootDir = path.join(__dirname, '..');
const spritesDir = path.join(rootDir, 'assets', 'sprites');
const tilesDir = path.join(rootDir, 'assets', 'tiles');
const iconsDir = path.join(rootDir, 'assets', 'icons');

[spritesDir, tilesDir, iconsDir].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// -------------------------------------------------------------
// Pure Node.js Canvas2D & PNG Encoder
// -------------------------------------------------------------
class Canvas2D {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.buffer = Buffer.alloc(width * height * 4, 0); // RGBA initialized to 0
  }

  setPixel(x, y, r, g, b, a = 255) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = (y * this.width + x) * 4;
    if (a >= 255) {
      this.buffer[idx] = r;
      this.buffer[idx + 1] = g;
      this.buffer[idx + 2] = b;
      this.buffer[idx + 3] = a;
    } else if (a > 0) {
      // Alpha blend over existing
      const srcA = a / 255;
      const dstA = this.buffer[idx + 3] / 255;
      const outA = srcA + dstA * (1 - srcA);
      if (outA > 0) {
        this.buffer[idx] = Math.round((r * srcA + this.buffer[idx] * dstA * (1 - srcA)) / outA);
        this.buffer[idx + 1] = Math.round((g * srcA + this.buffer[idx + 1] * dstA * (1 - srcA)) / outA);
        this.buffer[idx + 2] = Math.round((b * srcA + this.buffer[idx + 2] * dstA * (1 - srcA)) / outA);
        this.buffer[idx + 3] = Math.round(outA * 255);
      }
    }
  }

  getPixel(x, y) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return [0, 0, 0, 0];
    const idx = (y * this.width + x) * 4;
    return [this.buffer[idx], this.buffer[idx + 1], this.buffer[idx + 2], this.buffer[idx + 3]];
  }

  fillRect(x, y, w, h, r, g, b, a = 255) {
    x = Math.round(x);
    y = Math.round(y);
    w = Math.round(w);
    h = Math.round(h);
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        this.setPixel(px, py, r, g, b, a);
      }
    }
  }

  strokeRect(x, y, w, h, r, g, b, a = 255) {
    this.drawLine(x, y, x + w - 1, y, r, g, b, a);
    this.drawLine(x, y + h - 1, x + w - 1, y + h - 1, r, g, b, a);
    this.drawLine(x, y, x, y + h - 1, r, g, b, a);
    this.drawLine(x + w - 1, y, x + w - 1, y + h - 1, r, g, b, a);
  }

  drawLine(x0, y0, x1, y1, r, g, b, a = 255) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = (x0 < x1) ? 1 : -1;
    const sy = (y0 < y1) ? 1 : -1;
    let err = dx - dy;

    while (true) {
      this.setPixel(x0, y0, r, g, b, a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }

  fillCircle(cx, cy, radius, r, g, b, a = 255) {
    cx = Math.round(cx);
    cy = Math.round(cy);
    radius = Math.round(radius);
    for (let y = -radius; y <= radius; y++) {
      for (let x = -radius; x <= radius; x++) {
        if (x * x + y * y <= radius * radius) {
          this.setPixel(cx + x, cy + y, r, g, b, a);
        }
      }
    }
  }

  strokeCircle(cx, cy, radius, r, g, b, a = 255) {
    cx = Math.round(cx);
    cy = Math.round(cy);
    radius = Math.round(radius);
    let x = radius;
    let y = 0;
    let err = 0;

    while (x >= y) {
      this.setPixel(cx + x, cy + y, r, g, b, a);
      this.setPixel(cx + y, cy + x, r, g, b, a);
      this.setPixel(cx - y, cy + x, r, g, b, a);
      this.setPixel(cx - x, cy + y, r, g, b, a);
      this.setPixel(cx - x, cy - y, r, g, b, a);
      this.setPixel(cx - y, cy - x, r, g, b, a);
      this.setPixel(cx + y, cy - x, r, g, b, a);
      this.setPixel(cx + x, cy - y, r, g, b, a);

      y += 1;
      err += 1 + 2 * y;
      if (2 * (err - x) + 1 > 0) {
        x -= 1;
        err += 1 - 2 * x;
      }
    }
  }

  toPngBuffer() {
    const rowBytes = this.width * 4;
    const raw = Buffer.alloc(this.height * (rowBytes + 1));
    let offset = 0;
    for (let y = 0; y < this.height; y++) {
      raw[offset++] = 0; // Filter 0: None
      for (let x = 0; x < this.width; x++) {
        const idx = (y * this.width + x) * 4;
        raw[offset++] = this.buffer[idx];
        raw[offset++] = this.buffer[idx + 1];
        raw[offset++] = this.buffer[idx + 2];
        raw[offset++] = this.buffer[idx + 3];
      }
    }
    const compressed = zlib.deflateSync(raw);

    function crc32(buf) {
      let crc = -1;
      for (let i = 0; i < buf.length; i++) {
        let byte = buf[i];
        for (let j = 0; j < 8; j++) {
          if ((crc ^ byte) & 1) crc = (crc >>> 1) ^ 0xedb88320;
          else crc = crc >>> 1;
          byte >>>= 1;
        }
      }
      return (crc ^ -1) >>> 0;
    }

    function chunk(type, data) {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(data.length, 0);
      const typeBuf = Buffer.from(type, 'ascii');
      const crcBuf = Buffer.alloc(4);
      crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
      return Buffer.concat([len, typeBuf, data, crcBuf]);
    }

    const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.width, 0);
    ihdr.writeUInt32BE(this.height, 4);
    ihdr[8] = 8; // 8-bit depth
    ihdr[9] = 6; // RGBA color type
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    return Buffer.concat([
      header,
      chunk('IHDR', ihdr),
      chunk('IDAT', compressed),
      chunk('IEND', Buffer.alloc(0))
    ]);
  }
}

// Color utility
function hexToRgb(hex) {
  if (typeof hex === 'number') {
    return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
  }
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const num = parseInt(hex.slice(0, 6), 16);
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
}

// -------------------------------------------------------------
// Load Game Data from terrabrotato.html
// -------------------------------------------------------------
const html = fs.readFileSync(path.join(rootDir, 'terrabrotato.html'), 'utf8');

const wpnMatch = html.match(/const WEAPONS_DB\s*=\s*\{([\s\S]*?)\n\s*\};/);
const WEAPONS_DB = eval('({' + wpnMatch[1] + '})');

const itemMatch = html.match(/const ITEMS_DB\s*=\s*(\[[\s\S]*?\]);/);
const ITEMS_DB = eval(itemMatch[1]);

const CORE_KEYS = [
  'heavy', 'star', 'volley', 'chain', 'hive', 'charge',
  'frost', 'entropy', 'return', 'orbit', 'dash', 'echo'
];

console.log(`Loaded ${Object.keys(WEAPONS_DB).length} Weapons, ${ITEMS_DB.length} Items, ${CORE_KEYS.length} Core Relics.`);

// -------------------------------------------------------------
// 1. Procedural Pixel Art Generator: 42 Weapons (32×32)
// -------------------------------------------------------------
console.log('Generating 42 Weapons Arsenal...');
for (const [id, w] of Object.entries(WEAPONS_DB)) {
  const cv = new Canvas2D(32, 32);
  const [cr, cg, cb] = hexToRgb(w.color || 0x38bdf8);
  const synergy = w.synergy ? w.synergy[0] : 'blade';
  const isBoss = id.startsWith('boss_');

  // Layer 1: Ambient Drop Shadow (offset +2, +2)
  cv.fillCircle(18, 18, 9, 10, 15, 24, 70);

  // Layer 2 & 3: Mechanical Chassis & Silhouette
  if (synergy === 'blade' || id.includes('sword') || id.includes('edge') || id.includes('spear') || id.includes('scythe')) {
    // 45-degree Angled Heavy Edge Blade
    // Grip & Pommel
    cv.drawLine(6, 26, 11, 21, 51, 65, 85, 255); // Grip wrap
    cv.setPixel(5, 27, 245, 158, 11); // Gold Pommel
    cv.setPixel(6, 28, 180, 83, 9);
    // Crossguard
    cv.drawLine(8, 19, 14, 25, 100, 116, 139, 255);
    cv.setPixel(11, 22, cr, cg, cb); // Core socket
    // Main Spine / Chassis
    cv.drawLine(12, 20, 24, 8, 30, 41, 59, 255);
    cv.drawLine(13, 21, 25, 9, 51, 65, 85, 255);
    // Cutting Edge
    cv.drawLine(11, 18, 26, 3, 203, 213, 225, 255);
    cv.drawLine(10, 17, 25, 2, 248, 250, 252, 255); // 1px gleam
    // Back serrations or scythe curve
    if (id.includes('scythe')) {
      cv.drawLine(20, 4, 28, 6, 71, 85, 105, 255);
      cv.drawLine(28, 6, 26, 12, 148, 163, 184, 255);
      cv.drawLine(27, 8, 24, 15, cr, cg, cb);
    } else if (id.includes('spear')) {
      cv.drawLine(24, 8, 29, 3, 248, 250, 252, 255);
      cv.drawLine(25, 9, 30, 4, 203, 213, 225, 255);
      cv.setPixel(28, 2, cr, cg, cb);
    }
    // High-energy Circuit Inlay
    cv.drawLine(13, 19, 23, 9, cr, cg, cb, 230);
    cv.setPixel(18, 14, 255, 255, 255); // Hotspot
  } else if (synergy === 'gun' || id.includes('shark') || id.includes('rifle') || id.includes('blaster') || id.includes('bow')) {
    if (id.includes('bow') || id.includes('crossbow')) {
      // Tactical Crossbow / Compound Pulley Bow
      cv.drawLine(7, 25, 13, 19, 71, 85, 105, 255); // Stock
      cv.fillRect(11, 17, 7, 5, 30, 41, 59, 255); // Barrel rail
      // Arc limbs
      cv.drawLine(10, 13, 22, 25, 148, 163, 184, 255);
      cv.drawLine(6, 17, 18, 29, 100, 116, 139, 255);
      // Bowstring & energy bolt
      cv.drawLine(7, 17, 21, 25, cr, cg, cb, 200);
      cv.drawLine(12, 18, 26, 4, cr, cg, cb, 255); // High energy bolt
      cv.setPixel(27, 3, 255, 255, 255);
    } else {
      // Heavy Industrial Firearm / Laser Cannon
      cv.fillRect(6, 18, 6, 8, 30, 41, 59, 255); // Grip
      cv.fillRect(8, 14, 16, 6, 51, 65, 85, 255); // Upper receiver
      cv.fillRect(10, 20, 6, 5, 71, 85, 105, 255); // Ammo drum
      cv.fillRect(16, 12, 11, 4, 30, 41, 59, 255); // Twin barrel
      cv.strokeRect(8, 14, 16, 6, 100, 116, 139, 255);
      // Heatsink vents & muzzle
      cv.setPixel(14, 13, 203, 213, 225);
      cv.setPixel(17, 13, 203, 213, 225);
      cv.setPixel(20, 13, 203, 213, 225);
      cv.fillRect(27, 12, 2, 4, 248, 250, 252, 255); // Muzzle brake
      // Circuit indicator
      cv.drawLine(10, 16, 22, 16, cr, cg, cb, 255);
      cv.setPixel(16, 16, 255, 255, 255);
    }
  } else if (synergy === 'thrown' || id.includes('disc') || id.includes('hive') || id.includes('wheel')) {
    // Rotor Disc / Rotary Sentry / Bio-hive
    cv.fillCircle(16, 16, 9, 30, 41, 59, 255);
    cv.strokeCircle(16, 16, 9, 100, 116, 139, 255);
    // Rotor Blades (4-blade or 3-blade)
    cv.drawLine(7, 16, 25, 16, 203, 213, 225, 255);
    cv.drawLine(16, 7, 16, 25, 203, 213, 225, 255);
    cv.drawLine(10, 10, 22, 22, 148, 163, 184, 255);
    cv.drawLine(10, 22, 22, 10, 148, 163, 184, 255);
    // Emissive Core
    cv.fillCircle(16, 16, 4, cr, cg, cb, 255);
    cv.fillCircle(16, 16, 2, 255, 255, 255, 255);
  } else {
    // Arcane Focus / Laser Prism / Energy Relic
    cv.fillRect(7, 23, 5, 5, 71, 85, 105, 255); // Focus base
    cv.drawLine(9, 23, 18, 14, 100, 116, 139, 255); // Shaft
    cv.drawLine(10, 24, 19, 15, 51, 65, 85, 255);
    // Floating Prism Ring & Crystal
    cv.strokeCircle(21, 11, 7, 148, 163, 184, 255);
    // Octahedron Gem Core
    cv.fillRect(19, 9, 5, 5, cr, cg, cb, 255);
    cv.setPixel(21, 11, 255, 255, 255);
    // Orbital energy sparks
    cv.setPixel(14, 11, cr, cg, cb);
    cv.setPixel(28, 11, cr, cg, cb);
    cv.setPixel(21, 4, cr, cg, cb);
    cv.setPixel(21, 18, cr, cg, cb);
  }

  // Boss Exclusive Golden Rim
  if (isBoss) {
    cv.strokeRect(1, 1, 30, 30, 245, 158, 11, 180);
    cv.setPixel(1, 1, 254, 240, 138);
    cv.setPixel(30, 1, 254, 240, 138);
    cv.setPixel(1, 30, 254, 240, 138);
    cv.setPixel(30, 30, 254, 240, 138);
  }

  // Save to assets/sprites/wpn_<id>.png
  const pngPath = path.join(spritesDir, `wpn_${id}.png`);
  fs.writeFileSync(pngPath, cv.toPngBuffer());
}

// -------------------------------------------------------------
// 2. Procedural Pixel Art Generator: 50 Industrial Items (32×32)
// -------------------------------------------------------------
console.log('Generating 50 Industrial Items & Components...');

// Tier border colors
const TIER_COLORS = {
  1: [148, 163, 184], // Slate grey
  2: [56, 189, 248],  // Sky blue
  3: [168, 85, 247],  // Neon purple
  4: [245, 158, 11]   // Radiant gold
};

for (const item of ITEMS_DB) {
  const cv = new Canvas2D(32, 32);
  const tier = item.tier || 1;
  const [tr, tg, tb] = TIER_COLORS[tier] || TIER_COLORS[1];
  const [ir, ig, ib] = hexToRgb(item.color || 0x38bdf8);
  const id = item.id;

  // Background industrial frame slot
  cv.fillRect(2, 2, 28, 28, 15, 23, 42, 240); // Dark titanium plate
  cv.strokeRect(2, 2, 28, 28, 51, 65, 85, 255); // Inner bezel
  // 4 Corner Rivets
  cv.setPixel(3, 3, 100, 116, 139);
  cv.setPixel(28, 3, 100, 116, 139);
  cv.setPixel(3, 28, 100, 116, 139);
  cv.setPixel(28, 28, 100, 116, 139);

  // Subtle Tier Accent on corners
  cv.drawLine(2, 2, 5, 2, tr, tg, tb, 220);
  cv.drawLine(2, 2, 2, 5, tr, tg, tb, 220);
  cv.drawLine(26, 2, 29, 2, tr, tg, tb, 220);
  cv.drawLine(29, 2, 29, 5, tr, tg, tb, 220);
  cv.drawLine(2, 26, 2, 29, tr, tg, tb, 220);
  cv.drawLine(2, 29, 5, 29, tr, tg, tb, 220);
  cv.drawLine(29, 26, 29, 29, tr, tg, tb, 220);
  cv.drawLine(26, 29, 29, 29, tr, tg, tb, 220);

  // Specific Icon Graphics based on identity / type
  if (id.includes('chip') || id.includes('index') || id.includes('voucher') || id.includes('counter') || id.includes('license')) {
    // PCB Microchip
    cv.fillRect(7, 8, 18, 16, 22, 101, 52, 255); // Green PCB substrate
    cv.strokeRect(7, 8, 18, 16, 74, 222, 128, 255);
    // Gold pins
    for (let p = 9; p <= 23; p += 3) {
      cv.setPixel(p, 6, 245, 158, 11);
      cv.setPixel(p, 7, 245, 158, 11);
      cv.setPixel(p, 24, 245, 158, 11);
      cv.setPixel(p, 25, 245, 158, 11);
    }
    // Silicon die in center
    cv.fillRect(12, 12, 8, 8, 30, 41, 59, 255);
    cv.fillRect(14, 14, 4, 4, ir, ig, ib, 255); // Pulsing core LED
    cv.setPixel(15, 15, 255, 255, 255);
  } else if (id.includes('battery') || id.includes('cell') || id.includes('sole') || id.includes('burn')) {
    // Heavy Industrial Battery Cell
    cv.fillRect(10, 7, 12, 18, 51, 65, 85, 255);
    cv.strokeRect(10, 7, 12, 18, 148, 163, 184, 255);
    cv.fillRect(13, 5, 6, 2, 245, 158, 11, 255); // Anode cap
    // Charge level indicator bar
    cv.fillRect(12, 11, 8, 10, 30, 41, 59, 255);
    cv.fillRect(13, 13, 6, 6, ir, ig, ib, 255);
    cv.drawLine(14, 15, 17, 15, 255, 255, 255);
  } else if (id.includes('shield') || id.includes('shackle') || id.includes('obsidian') || id.includes('armor') || id.includes('film') || id.includes('buckle')) {
    // Reinforced Armor Plate / Crest
    cv.fillRect(8, 8, 16, 16, 30, 41, 59, 255);
    cv.strokeRect(8, 8, 16, 16, 148, 163, 184, 255);
    // Angled chevron reinforcement
    cv.drawLine(8, 8, 16, 18, ir, ig, ib, 255);
    cv.drawLine(23, 8, 16, 18, ir, ig, ib, 255);
    cv.drawLine(16, 18, 16, 24, ir, ig, ib, 255);
    cv.setPixel(16, 18, 255, 255, 255);
  } else if (id.includes('lens') || id.includes('scope') || id.includes('glass') || id.includes('prism') || id.includes('antenna')) {
    // Precision Optical Lens / Radar
    cv.fillCircle(16, 16, 8, 30, 41, 59, 255);
    cv.strokeCircle(16, 16, 8, 100, 116, 139, 255);
    cv.strokeCircle(16, 16, 6, ir, ig, ib, 255);
    // Crosshair Reticle
    cv.drawLine(16, 10, 16, 22, 248, 250, 252, 200);
    cv.drawLine(10, 16, 22, 16, 248, 250, 252, 200);
    cv.setPixel(16, 16, 255, 255, 255);
  } else if (id.includes('valve') || id.includes('clip') || id.includes('rectifier') || id.includes('sleeve')) {
    // High-Pressure Valve / Flange
    cv.fillRect(8, 13, 16, 6, 180, 83, 9, 255); // Brass body
    cv.strokeRect(8, 13, 16, 6, 245, 158, 11, 255);
    // Red control turn-wheel
    cv.strokeCircle(16, 9, 4, 239, 68, 68, 255);
    cv.drawLine(16, 10, 16, 13, 100, 116, 139, 255);
    cv.fillRect(14, 15, 4, 2, ir, ig, ib, 255);
  } else if (id.includes('gear') || id.includes('joint') || id.includes('axle') || id.includes('bearing') || id.includes('box')) {
    // Precision Bevel Gear & Bearing
    cv.fillCircle(16, 16, 7, 71, 85, 105, 255);
    cv.strokeCircle(16, 16, 7, 203, 213, 225, 255);
    // Gear teeth
    for (let a = 0; a < 8; a++) {
      const rad = a * Math.PI / 4;
      const tx = Math.round(16 + 9 * Math.cos(rad));
      const ty = Math.round(16 + 9 * Math.sin(rad));
      cv.setPixel(tx, ty, 203, 213, 225);
    }
    cv.fillCircle(16, 16, 3, ir, ig, ib, 255);
    cv.setPixel(16, 16, 255, 255, 255);
  } else if (id.includes('band') || id.includes('ring') || id.includes('tooth') || id.includes('claws') || id.includes('horseshoe')) {
    // Ring / Band / Talisman
    cv.strokeCircle(16, 16, 7, 245, 158, 11, 255);
    cv.strokeCircle(16, 16, 5, 180, 83, 9, 255);
    // Embedded Gemstone
    cv.fillRect(14, 8, 4, 4, ir, ig, ib, 255);
    cv.setPixel(15, 9, 255, 255, 255);
  } else {
    // Celestial / Relic / Breaker / Wings
    cv.fillCircle(16, 16, 8, 30, 41, 59, 255);
    cv.strokeCircle(16, 16, 8, tr, tg, tb, 255);
    // Four-point Star
    cv.drawLine(16, 9, 16, 23, ir, ig, ib, 255);
    cv.drawLine(9, 16, 23, 16, ir, ig, ib, 255);
    cv.setPixel(16, 16, 255, 255, 255);
  }

  // Save to assets/sprites/item_<id>.png
  const pngPath = path.join(spritesDir, `item_${id}.png`);
  fs.writeFileSync(pngPath, cv.toPngBuffer());
}

// -------------------------------------------------------------
// 3. Procedural Pixel Art Generator: 12 Core Relics (32×32)
// -------------------------------------------------------------
console.log('Generating 12 Core Relics...');

const CORE_ICONS = {
  heavy: (cv) => {
    // Warhammer silhouette + shockwave
    cv.fillRect(11, 8, 10, 6, 245, 158, 11, 255);
    cv.strokeRect(11, 8, 10, 6, 254, 240, 138, 255);
    cv.drawLine(16, 14, 16, 24, 148, 163, 184, 255);
    cv.drawLine(12, 23, 20, 23, 239, 68, 68, 255); // Shockwave
    cv.drawLine(9, 25, 23, 25, 239, 68, 68, 200);
  },
  star: (cv) => {
    // Starburst explosion glyph
    cv.drawLine(16, 8, 16, 24, 250, 204, 21, 255);
    cv.drawLine(8, 16, 24, 16, 250, 204, 21, 255);
    cv.drawLine(10, 10, 22, 22, 245, 158, 11, 255);
    cv.drawLine(10, 22, 22, 10, 245, 158, 11, 255);
    cv.fillCircle(16, 16, 3, 255, 255, 255, 255);
  },
  volley: (cv) => {
    // Dual diverge arrows
    cv.drawLine(16, 22, 10, 11, 56, 189, 248, 255);
    cv.drawLine(16, 22, 22, 11, 56, 189, 248, 255);
    cv.drawLine(9, 14, 10, 11, 248, 250, 252, 255);
    cv.drawLine(13, 12, 10, 11, 248, 250, 252, 255);
    cv.drawLine(23, 14, 22, 11, 248, 250, 252, 255);
    cv.drawLine(19, 12, 22, 11, 248, 250, 252, 255);
  },
  chain: (cv) => {
    // Interlocking Lightning Arcs
    cv.drawLine(10, 10, 16, 15, 96, 165, 250, 255);
    cv.drawLine(16, 15, 13, 17, 255, 255, 255, 255);
    cv.drawLine(13, 17, 22, 22, 96, 165, 250, 255);
    cv.fillCircle(10, 10, 2, 191, 219, 254, 255);
    cv.fillCircle(22, 22, 2, 191, 219, 254, 255);
  },
  hive: (cv) => {
    // Honeycomb Cell + Drones
    cv.drawLine(13, 11, 19, 11, 234, 179, 8, 255);
    cv.drawLine(19, 11, 22, 16, 234, 179, 8, 255);
    cv.drawLine(22, 16, 19, 21, 234, 179, 8, 255);
    cv.drawLine(19, 21, 13, 21, 234, 179, 8, 255);
    cv.drawLine(13, 21, 10, 16, 234, 179, 8, 255);
    cv.drawLine(10, 16, 13, 11, 234, 179, 8, 255);
    cv.setPixel(16, 16, 254, 240, 138);
    cv.setPixel(8, 12, 250, 204, 21);
    cv.setPixel(24, 20, 250, 204, 21);
  },
  charge: (cv) => {
    // High Voltage Lightning Bolt
    cv.drawLine(18, 8, 13, 15, 250, 204, 21, 255);
    cv.drawLine(13, 15, 17, 15, 255, 255, 255, 255);
    cv.drawLine(17, 15, 11, 24, 250, 204, 21, 255);
    cv.setPixel(15, 15, 255, 255, 255);
  },
  frost: (cv) => {
    // Symmetrical Cryo Snowflake
    cv.drawLine(16, 8, 16, 24, 103, 232, 249, 255);
    cv.drawLine(8, 16, 24, 16, 103, 232, 249, 255);
    cv.drawLine(11, 11, 21, 21, 103, 232, 249, 255);
    cv.drawLine(11, 21, 21, 11, 103, 232, 249, 255);
    cv.fillCircle(16, 16, 2, 255, 255, 255, 255);
  },
  entropy: (cv) => {
    // Biohazard Acid Tri-spoke
    cv.strokeCircle(16, 16, 6, 163, 230, 53, 255);
    cv.fillCircle(16, 12, 2, 74, 222, 128, 255);
    cv.fillCircle(13, 19, 2, 74, 222, 128, 255);
    cv.fillCircle(19, 19, 2, 74, 222, 128, 255);
    cv.setPixel(16, 16, 255, 255, 255);
  },
  return: (cv) => {
    // Boomerang Loop Arrow
    cv.strokeCircle(16, 16, 6, 132, 204, 22, 255);
    cv.fillRect(10, 16, 6, 7, 15, 23, 42, 255); // Mask partial
    cv.drawLine(11, 11, 14, 11, 255, 255, 255, 255);
    cv.drawLine(11, 11, 11, 14, 255, 255, 255, 255);
  },
  orbit: (cv) => {
    // Planetary Orbit Ring & Satellites
    cv.strokeCircle(16, 16, 7, 129, 140, 248, 255);
    cv.fillCircle(16, 16, 3, 79, 70, 229, 255);
    cv.setPixel(16, 9, 248, 250, 252);
    cv.setPixel(23, 16, 248, 250, 252);
  },
  dash: (cv) => {
    // Supersonic Afterimage Chevrons
    cv.drawLine(12, 10, 18, 16, 244, 63, 94, 255);
    cv.drawLine(18, 16, 12, 22, 244, 63, 94, 255);
    cv.drawLine(8, 12, 13, 16, 244, 63, 94, 160);
    cv.drawLine(13, 16, 8, 20, 244, 63, 94, 160);
    cv.setPixel(19, 16, 255, 255, 255);
  },
  echo: (cv) => {
    // Concentric Sonar Pulse Wavefronts
    cv.strokeCircle(16, 16, 3, 56, 189, 248, 255);
    cv.strokeCircle(16, 16, 6, 56, 189, 248, 200);
    cv.strokeCircle(16, 16, 9, 56, 189, 248, 120);
    cv.setPixel(16, 16, 255, 255, 255);
  }
};

for (const key of CORE_KEYS) {
  const cv = new Canvas2D(32, 32);

  // Hexagonal Alloy Socket
  // Draw Hexagon points: (16, 3), (27, 9), (27, 23), (16, 29), (5, 23), (5, 9)
  const hexPts = [
    [16, 3], [27, 9], [27, 23], [16, 29], [5, 23], [5, 9]
  ];
  for (let y = 3; y <= 29; y++) {
    for (let x = 5; x <= 27; x++) {
      // Point in polygon test
      let inside = false;
      for (let i = 0, j = hexPts.length - 1; i < hexPts.length; j = i++) {
        const xi = hexPts[i][0], yi = hexPts[i][1];
        const xj = hexPts[j][0], yj = hexPts[j][1];
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      if (inside) cv.setPixel(x, y, 15, 23, 42, 255); // Dark titan chassis
    }
  }

  // Draw Hexagon Border
  for (let i = 0; i < hexPts.length; i++) {
    const next = (i + 1) % hexPts.length;
    cv.drawLine(hexPts[i][0], hexPts[i][1], hexPts[next][0], hexPts[next][1], 245, 158, 11, 255); // Golden edge
  }
  // 4 Hex Corner Screws
  cv.setPixel(16, 5, 203, 213, 225);
  cv.setPixel(16, 27, 203, 213, 225);

  // Emissive Topological Icon
  if (CORE_ICONS[key]) {
    CORE_ICONS[key](cv);
  }

  // Save to assets/sprites/core_<key>.png
  const pngPath = path.join(spritesDir, `core_${key}.png`);
  fs.writeFileSync(pngPath, cv.toPngBuffer());
}

// -------------------------------------------------------------
// 4. Procedural Pixel Art Generator: 4 Biome Tiles & Props (32×32)
// -------------------------------------------------------------
console.log('Generating 4 Biome Tiles & Props...');

const BIOMES = [
  {
    key: 'forest',
    name: '绿荫边庭',
    base: [30, 41, 59], // Steel plate
    seam: [22, 101, 52], // Moss & emerald conduits
    prop: [74, 222, 128]
  },
  {
    key: 'hallow',
    name: '镜井天池',
    base: [71, 85, 105], // Chromium mirror steel
    seam: [56, 189, 248], // Sky-blue coolant channels
    prop: [125, 211, 252]
  },
  {
    key: 'corruption',
    name: '鸣砂裂谷',
    base: [69, 26, 3], // Brass oxidized plate
    seam: [245, 158, 11], // Amber geothermal fissures
    prop: [251, 191, 36]
  },
  {
    key: 'underworld',
    name: '熔火炉庭',
    base: [24, 24, 27], // Obsidian blast tile
    seam: [239, 68, 68], // Incandescent magma circuits
    prop: [248, 113, 113]
  }
];

for (const b of BIOMES) {
  // 1. Seamless Tile (32×32)
  const tileCv = new Canvas2D(32, 32);
  const [br, bg, bb] = b.base;
  const [sr, sg, sb] = b.seam;

  // Steel plate body with diamond tread pattern
  tileCv.fillRect(0, 0, 32, 32, br, bg, bb, 255);
  tileCv.strokeRect(0, 0, 32, 32, Math.min(255, br + 25), Math.min(255, bg + 25), Math.min(255, bb + 25), 255);

  // Four corner rivets
  tileCv.setPixel(2, 2, 148, 163, 184);
  tileCv.setPixel(29, 2, 148, 163, 184);
  tileCv.setPixel(2, 29, 148, 163, 184);
  tileCv.setPixel(29, 29, 148, 163, 184);

  // Recessed Energy Conduits / Seams (seamless cross)
  tileCv.drawLine(15, 0, 15, 31, Math.max(0, br - 20), Math.max(0, bg - 20), Math.max(0, bb - 20), 255);
  tileCv.drawLine(16, 0, 16, 31, sr, sg, sb, 220); // Glowing pulse line
  tileCv.drawLine(0, 15, 31, 15, Math.max(0, br - 20), Math.max(0, bg - 20), Math.max(0, bb - 20), 255);
  tileCv.drawLine(0, 16, 31, 16, sr, sg, sb, 220);
  tileCv.setPixel(16, 16, 255, 255, 255); // Intersection hotspot

  fs.writeFileSync(path.join(tilesDir, `tile_${b.key}.png`), tileCv.toPngBuffer());
  fs.writeFileSync(path.join(spritesDir, `tile_${b.key}.png`), tileCv.toPngBuffer());

  // 2. Destructible Tactical Obstacle / Cache Prop (32×32)
  const propCv = new Canvas2D(32, 32);
  // Shadow
  propCv.fillCircle(16, 22, 10, 10, 15, 24, 90);
  // Armored Supply Box / Pylon
  propCv.fillRect(6, 8, 20, 18, 30, 41, 59, 255);
  propCv.strokeRect(6, 8, 20, 18, 100, 116, 139, 255);
  // Reinforced Corner Plates
  propCv.fillRect(5, 7, 4, 4, 148, 163, 184, 255);
  propCv.fillRect(23, 7, 4, 4, 148, 163, 184, 255);
  propCv.fillRect(5, 23, 4, 4, 148, 163, 184, 255);
  propCv.fillRect(23, 23, 4, 4, 148, 163, 184, 255);
  // Hazard Stripes / Energy Core Indicator
  const [pr, pg, pb] = b.prop;
  propCv.fillRect(11, 13, 10, 8, 15, 23, 42, 255);
  propCv.fillRect(13, 15, 6, 4, pr, pg, pb, 255);
  propCv.setPixel(16, 17, 255, 255, 255);

  fs.writeFileSync(path.join(tilesDir, `prop_${b.key}.png`), propCv.toPngBuffer());
  fs.writeFileSync(path.join(spritesDir, `prop_${b.key}.png`), propCv.toPngBuffer());
}

// -------------------------------------------------------------
// 5. Procedural Pixel Art Generator: Game & App Icons
// -------------------------------------------------------------
console.log('Generating Game & App Icons (128×128, 64×64, 32×32)...');

function generateAppIcon(size) {
  const cv = new Canvas2D(size, size);
  const scale = size / 32;
  const cx = size / 2;
  const cy = size / 2;

  // Dark Titanium Background plate
  cv.fillRect(0, 0, size, size, 15, 23, 42, 255);
  cv.strokeRect(0, 0, size, size, 245, 158, 11, 255); // Outer gold frame

  // Corner Hazard caution stripes
  const corner = Math.round(5 * scale);
  for (let i = 0; i < corner; i++) {
    cv.drawLine(i, 0, 0, i, 234, 179, 8, 255);
    cv.drawLine(size - 1 - i, 0, size - 1, i, 234, 179, 8, 255);
    cv.drawLine(0, size - 1 - i, i, size - 1, 234, 179, 8, 255);
    cv.drawLine(size - 1 - i, size - 1, size - 1, size - 1 - i, 234, 179, 8, 255);
  }

  // Heavy Interlocking 8-tooth Industrial Gear
  const gearR = 12 * scale;
  cv.fillCircle(cx, cy, gearR, 30, 41, 59, 255);
  cv.strokeCircle(cx, cy, gearR, 100, 116, 139, 255);
  for (let a = 0; a < 8; a++) {
    const rad = a * Math.PI / 4;
    const tx = cx + Math.cos(rad) * (gearR + 2 * scale);
    const ty = cy + Math.sin(rad) * (gearR + 2 * scale);
    cv.fillCircle(tx, ty, 2 * scale, 148, 163, 184, 255);
  }

  // Radiant Emerald Energy Circuit Loops
  cv.strokeCircle(cx, cy, 8 * scale, 34, 197, 94, 255);
  cv.drawLine(cx - 8 * scale, cy, cx + 8 * scale, cy, 74, 222, 128, 200);
  cv.drawLine(cx, cy - 8 * scale, cx, cy + 8 * scale, 74, 222, 128, 200);

  // Fusion Micro-Reactor Core (Golden Plasma + White Hot Spot)
  cv.fillCircle(cx, cy, 5 * scale, 234, 88, 12, 255); // Orange flame
  cv.fillCircle(cx, cy, 3.5 * scale, 250, 204, 21, 255); // Gold core
  cv.fillCircle(cx, cy, 1.8 * scale, 255, 255, 255, 255); // White hot center

  return cv.toPngBuffer();
}

fs.writeFileSync(path.join(iconsDir, 'app_icon_128.png'), generateAppIcon(128));
fs.writeFileSync(path.join(iconsDir, 'app_icon_64.png'), generateAppIcon(64));
fs.writeFileSync(path.join(iconsDir, 'app_icon_32.png'), generateAppIcon(32));

// Also duplicate 64 into assets/sprites for easy game loading
fs.writeFileSync(path.join(spritesDir, 'app_icon.png'), generateAppIcon(64));

console.log('All pixel art assets generated successfully!');

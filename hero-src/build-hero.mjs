// Сборка слоёв первого экрана из фото Higgsfield — максимальное качество.
// Запуск из корня проекта: node hero-src/build-hero.mjs [--check]
// Вход: hero-src/<src>.webp + mask-<src>.png (из cutout.swift)
// Выход: src/assets/img/hero/{bg,car,lights,bloom}-{desktop,mobile}.webp + mask-*.png
//
// Почему так:
//  - Retina/телефоны рисуют 2–3 физических пикселя на CSS-пиксель, поэтому слои готовим крупнее экрана
//    (Lanczos3 + лёгкая резкость), иначе браузер сам растянет картинку и замылит её.
//  - Мобильный набор обрезан до передней части машины — на вертикальном экране видна только она,
//    а значит те же байты дают почти 1:1 по пикселям.
import sharp from "sharp";
import fs from "node:fs";

const OUT = "src/assets/img/hero";
const CHECK = process.argv.includes("--check");
const SCRATCH = process.env.SCRATCH || "hero-src";

// Исходник: фото из Higgsfield (2000px), увеличенное Real-ESRGAN x4 и сведённое к 4800px (hero-src/master.png)
const SRC = "master";
const SRC_FILE = `hero-src/${SRC}.png`;
// Зоны фар и подсветки решётки в % исходного кадра (x0, y0, x1, y1)
const LIGHT_ZONES = [[60, 54, 74, 64], [73, 55, 87, 70]];

const SETS = {
  // crop — в % исходника; width — итоговая ширина
  desktop: { crop: [0, 0, 100, 100], width: 3840, q: 90 }, // Retina вплоть до 1920×2
  "desktop-1920": { crop: [0, 0, 100, 100], width: 1920, q: 90 }, // обычные мониторы — в 2,8 раза меньше пикселей
  mobile: { crop: [11, 0, 90, 100], width: 2400, q: 88 }, // вся машина по ширине экрана (телефоны с плотным экраном)
  "mobile-1200": { crop: [11, 0, 90, 100], width: 1200, q: 86 }, // обычные телефоны — в 4 раза меньше пикселей
};

fs.mkdirSync(OUT, { recursive: true });

const { width: W, height: H } = await sharp(SRC_FILE).metadata();
const rgb = await sharp(SRC_FILE).removeAlpha().raw().toBuffer();
const mask = await sharp(`hero-src/mask-${SRC}.png`).resize(W, H).extractChannel(0).raw().toBuffer();

// Маска света: яркие пиксели внутри зон фар/решётки
const lights = Buffer.alloc(W * H);
for (const [x0, y0, x1, y1] of LIGHT_ZONES) {
  const ax = Math.round((x0 / 100) * W), bx = Math.round((x1 / 100) * W);
  const ay = Math.round((y0 / 100) * H), by = Math.round((y1 / 100) * H);
  for (let y = ay; y < by; y++) for (let x = ax; x < bx; x++) {
    const i = y * W + x;
    const lum = 0.2126 * rgb[i * 3] + 0.7152 * rgb[i * 3 + 1] + 0.0722 * rgb[i * 3 + 2];
    lights[i] = Math.max(lights[i], Math.max(0, Math.min(255, (lum - 110) * 2.2)));
  }
}
const soft = await sharp(lights, { raw: { width: W, height: H, channels: 1 } }).blur(1.4).extractChannel(0).raw().toBuffer();

// Слои в исходном разрешении
const car = Buffer.alloc(W * H * 4), glow = Buffer.alloc(W * H * 4), bloom = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) {
  const k = soft[i] / 255, r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
  // погасшая линза = тот же пиксель, притемнённый в 5 раз (сохраняет фактуру стекла, без «грязи»)
  const f = 1 - 0.8 * k;
  car[i * 4] = r * f; car[i * 4 + 1] = g * f; car[i * 4 + 2] = b * f; car[i * 4 + 3] = mask[i];
  // свет — исходные пиксели фар: обычное наложение поверх даёт точный оригинал
  glow[i * 4] = r; glow[i * 4 + 1] = g; glow[i * 4 + 2] = b; glow[i * 4 + 3] = soft[i];
  bloom[i * 4] = 225; bloom[i * 4 + 1] = 236; bloom[i * 4 + 2] = 255; bloom[i * 4 + 3] = soft[i];
}
const raw4 = { raw: { width: W, height: H, channels: 4 } };
const bloomBlurred = await sharp(bloom, raw4).blur(W / 120).raw().toBuffer();
// Свет фар + ореол — в одном слое (наложение «поверх»): на один огромный слой меньше для видеокарты
const lightsAll = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) {
  const as = glow[i * 4 + 3] / 255, ab = bloomBlurred[i * 4 + 3] / 255, ao = as + ab * (1 - as);
  for (let c = 0; c < 3; c++) lightsAll[i * 4 + c] = ao ? (glow[i * 4 + c] * as + bloomBlurred[i * 4 + c] * ab * (1 - as)) / ao : 0;
  lightsAll[i * 4 + 3] = ao * 255;
}

for (const [name, set] of Object.entries(SETS)) {
  const [cx0, cy0, cx1, cy1] = set.crop;
  const region = { left: Math.round((cx0 / 100) * W), top: Math.round((cy0 / 100) * H), width: Math.round(((cx1 - cx0) / 100) * W), height: Math.round(((cy1 - cy0) / 100) * H) };
  const up = (input, opts) => sharp(input, opts).extract(region).resize({ width: set.width, kernel: "lanczos3" });
  const webp = (s, q = set.q) => s.webp({ quality: q, alphaQuality: 100, smartSubsample: true, effort: 6 });

  // фон берём из исходного файла, резкость мягкая — подчёркивает кромки, не рисует ореолов
  await webp(up(SRC_FILE)).toFile(`${OUT}/bg-${name}.webp`);
  await webp(up(car, raw4)).toFile(`${OUT}/car-${name}.webp`);
  await webp(up(lightsAll, raw4), 92).toFile(`${OUT}/lights-${name}.webp`);

  const meta = await sharp(`${OUT}/bg-${name}.webp`).metadata();
  const kb = (f) => (fs.statSync(`${OUT}/${f}-${name}.webp`).size / 1024).toFixed(0);
  console.log(`${name} ${meta.width}x${meta.height}  bg ${kb("bg")}KB car ${kb("car")}KB lights ${kb("lights")}KB`);

  if (CHECK) {
    const cw = meta.width, ch = meta.height;
    const flat = await sharp(`${OUT}/bg-${name}.webp`).composite([{ input: `${OUT}/car-${name}.webp` }, { input: `${OUT}/lights-${name}.webp` }]).png().toBuffer();
    const zx = name.startsWith("desktop") ? 0.6 : 0.43;
    await sharp(flat).extract({ left: Math.round(cw * zx), top: Math.round(ch * 0.5), width: Math.round(cw * 0.28), height: Math.round(ch * 0.18) }).resize({ width: 900 }).jpeg({ quality: 95 }).toFile(`${SCRATCH}/q-new-${name}.jpg`);
  }
}

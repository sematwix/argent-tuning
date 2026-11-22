// Убирает логотип генератора из правого нижнего угла фото в photos/ и сохраняет в photos/clean/.
// Маска = светлый текст и салатовая плашка внутри зоны логотипа; заливка — диффузия от краёв + зерно.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const IN = "photos", OUT = "photos/clean";
fs.mkdirSync(OUT, { recursive: true });
const BOX = { x0: 0.785, x1: 0.988, y0: 0.9, y1: 0.985 };

for (const f of fs.readdirSync(IN).filter((n) => n.endsWith(".png"))) {
  const { data, info } = await sharp(path.join(IN, f)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, C = 3;
  const bx0 = Math.round(W * BOX.x0), bx1 = Math.round(W * BOX.x1), by0 = Math.round(H * BOX.y0), by1 = Math.round(H * BOX.y1);
  const bw = bx1 - bx0, bh = by1 - by0;
  const at = (x, y) => (y * W + x) * C;

  // фон зоны: медиана яркости по рамке
  const border = [];
  for (let x = bx0; x < bx1; x++) for (const y of [by0, by1 - 1]) { const i = at(x, y); border.push((data[i] + data[i + 1] + data[i + 2]) / 3); }
  for (let y = by0; y < by1; y++) for (const x of [bx0, bx1 - 1]) { const i = at(x, y); border.push((data[i] + data[i + 1] + data[i + 2]) / 3); }
  border.sort((a, b) => a - b);
  const bg = border[border.length >> 1];

  // маска логотипа
  let mask = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    const i = at(bx0 + x, by0 + y), r = data[i], g = data[i + 1], b = data[i + 2];
    const lum = (r + g + b) / 3;
    if (lum > bg + 45 || (g - b > 60 && g > 110)) mask[y * bw + x] = 1;
  }
  // расширить маску, чтобы забрать сглаженные края букв
  const grow = Math.max(3, Math.round(W / 400));
  for (let k = 0; k < grow; k++) {
    const m2 = mask.slice();
    for (let y = 1; y < bh - 1; y++) for (let x = 1; x < bw - 1; x++) {
      if (mask[y * bw + x]) continue;
      if (mask[y * bw + x - 1] || mask[y * bw + x + 1] || mask[(y - 1) * bw + x] || mask[(y + 1) * bw + x]) m2[y * bw + x] = 1;
    }
    mask = m2;
  }
  // заполнить внутренности (плашка, «дырки» в буквах): закрытие по строкам между близкими пикселями маски
  const gap = Math.round(W / 140);
  for (let y = 0; y < bh; y++) {
    let last = -1;
    for (let x = 0; x < bw; x++) if (mask[y * bw + x]) { if (last >= 0 && x - last <= gap) for (let k = last; k < x; k++) mask[y * bw + k] = 1; last = x; }
  }

  // шум окружения для зерна
  let s = 0, s2 = 0, n = 0;
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw - 1; x++) {
    if (mask[y * bw + x] || mask[y * bw + x + 1]) continue;
    const d = data[at(bx0 + x, by0 + y)] - data[at(bx0 + x + 1, by0 + y)];
    s += d; s2 += d * d; n++;
  }
  const sigma = n ? Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2) / 2) : 1.5;

  // диффузия: замаскированные пиксели — среднее соседей, много итераций (сначала на грубой сетке)
  const buf = new Float32Array(bw * bh * C);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) for (let c = 0; c < C; c++) buf[(y * bw + x) * C + c] = data[at(bx0 + x, by0 + y) + c];
  // начальное значение — линейная интерполяция по столбцу между ближайшими чистыми пикселями сверху и снизу
  for (let x = 0; x < bw; x++) {
    let y = 0;
    while (y < bh) {
      if (!mask[y * bw + x]) { y++; continue; }
      const top = y - 1; let bot = y; while (bot < bh && mask[bot * bw + x]) bot++;
      for (let k = y; k < bot; k++) {
        const t = (k - top) / (bot - top);
        for (let c = 0; c < C; c++) {
          const a = top >= 0 ? buf[(top * bw + x) * C + c] : null, b = bot < bh ? buf[(bot * bw + x) * C + c] : null;
          buf[(k * bw + x) * C + c] = a == null ? (b ?? bg) : b == null ? a : a + (b - a) * t;
        }
      }
      y = bot;
    }
  }
  const iters = Math.round(bh * 6);
  for (let it = 0; it < iters; it++) {
    for (let y = 1; y < bh - 1; y++) for (let x = 1; x < bw - 1; x++) {
      if (!mask[y * bw + x]) continue;
      for (let c = 0; c < C; c++) {
        const p = (y * bw + x) * C + c;
        buf[p] = (buf[p - C] + buf[p + C] + buf[p - bw * C] + buf[p + bw * C]) / 4;
      }
    }
  }
  // записать обратно с зерном
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    if (!mask[y * bw + x]) continue;
    const g = gauss() * sigma;
    for (let c = 0; c < C; c++) data[at(bx0 + x, by0 + y) + c] = Math.max(0, Math.min(255, Math.round(buf[(y * bw + x) * C + c] + g)));
  }

  await sharp(data, { raw: { width: W, height: H, channels: C } }).png().toFile(path.join(OUT, f));
  console.log(f, W + "x" + H, "bg", bg.toFixed(0), "sigma", sigma.toFixed(1));
}

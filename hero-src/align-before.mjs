// Совмещает фото «до» с фото «после» по рамке машины (маски из cutout.swift), чтобы в слайдере машина не прыгала.
// node hero-src/align-before.mjs <do.png> <mask-do.png> <mask-after.png> <out.jpg>
import sharp from "sharp";

const [doPath, mDo, mAfter, out] = process.argv.slice(2);

async function bbox(f) {
  const { data, info } = await sharp(f).greyscale().raw().toBuffer({ resolveWithObject: true });
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[y * info.width + x] > 128) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, W: info.width, H: info.height };
}

const a = await bbox(mAfter), b = await bbox(mDo);
const s = Math.sqrt((a.w / b.w) * (a.h / b.h)); // общий масштаб, пропорции не искажаем
const tx = Math.round((a.x0 + a.x1) / 2 - s * (b.x0 + b.x1) / 2);
const ty = Math.round(a.y1 - s * b.y1); // по колёсам: низ рамки к низу рамки
const W = a.W, H = a.H;
const meta = await sharp(doPath).metadata();
const nw = Math.round(meta.width * s), nh = Math.round(meta.height * s);
// пустые края после сдвига заполняем зеркальным продолжением кадра (стена и пол студии однородные)
const padL = Math.max(0, tx), padT = Math.max(0, ty);
const padR = Math.max(0, W - (tx + nw)), padB = Math.max(0, H - (ty + nh));
const scaled = await sharp(await sharp(doPath).resize(nw, nh, { kernel: "lanczos3" }).toBuffer())
  .extend({ left: padL, top: padT, right: padR, bottom: padB, extendWith: "mirror" }).toBuffer();

// вырезать холст W×H
await sharp(scaled).extract({ left: Math.max(0, -tx), top: Math.max(0, -ty), width: W, height: H })
  .jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: "4:4:4" }).toFile(out);
console.log(out, "scale", s.toFixed(3), "shift", tx, ty);

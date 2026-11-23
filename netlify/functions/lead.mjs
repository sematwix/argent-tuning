// Серверная обработка заявок: POST /api/lead
// 1) проверяет данные на сервере (браузерной проверке доверять нельзя — её легко обойти);
// 2) сохраняет заявку в Netlify Forms (оттуда же уходят письма на почту);
// 3) дублирует заявку в Telegram, если заданы переменные TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID.
// Секреты хранятся только в переменных окружения Netlify, в коде их нет.

const FORMS = { zayavka: "Заявка с сайта", konsultaciya: "Запись на консультацию" };
const MAX_BODY = 4096; // байт: нормальная заявка весит ~300

const json = (status, data) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

const clean = (v, max) =>
  String(v ?? "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max + 1);

// +7 и 10 цифр, мобильные коды Казахстана 70x / 747 / 77x
function normPhone(raw) {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.length === 10) d = "7" + d;
  if (d.length === 11 && d[0] === "8") d = "7" + d.slice(1);
  if (!/^7(70\d|747|77\d)\d{7}$/.test(d)) return null;
  return `+7 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9, 11)}`;
}

function validate(f) {
  const errors = {};
  const name = clean(f.name, 60);
  const phone = normPhone(f.phone);
  const car = clean(f.car, 80);
  const service = clean(f.service, 60);
  if (name.length < 2 || name.length > 60 || !/^[\p{L}][\p{L}\s.'-]*$/u.test(name)) errors.name = "Укажите имя буквами";
  if (!phone) errors.phone = "Нужен номер +7 и 10 цифр";
  if (car.length > 80) errors.car = "Слишком длинно";
  if (service.length > 60) errors.service = "Слишком длинно";
  if (f.agree !== "on") errors.agree = "Нужно согласие";
  return { errors, data: { name, phone, car, service } };
}

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

async function toTelegram(formName, d, page) {
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return "off";
  const text = [
    `<b>${FORMS[formName]}</b>`,
    `Имя: ${esc(d.name)}`,
    `Телефон: ${d.phone}`,
    d.car && `Машина: ${esc(d.car)}`,
    `Услуга: ${esc(d.service || "не выбрана")}`,
    page && `Страница: ${esc(page)}`,
  ].filter(Boolean).join("\n");
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  return r.ok ? "sent" : "error";
}

export default async (req, context) => {
  if (req.method !== "POST") return json(405, { ok: false, error: "method" });

  // Принимаем заявки только со своего сайта
  const origin = req.headers.get("origin");
  const site = process.env.URL ? new URL(process.env.URL).host : new URL(req.url).host;
  if (origin && new URL(origin).host !== site && new URL(origin).host !== new URL(req.url).host) return json(403, { ok: false, error: "origin" });

  const raw = await req.text();
  if (raw.length > MAX_BODY) return json(413, { ok: false, error: "size" });
  const f = Object.fromEntries(new URLSearchParams(raw));

  const formName = f["form-name"];
  if (!FORMS[formName]) return json(400, { ok: false, error: "form" });
  // Ловушка для ботов: поле скрыто от людей. Боту отвечаем «успешно», но заявку не сохраняем.
  if (f["bot-field"]) return json(200, { ok: true });

  const { errors, data } = validate(f);
  if (Object.keys(errors).length) return json(422, { ok: false, errors });

  // Сохранить в Netlify Forms: там хранятся все заявки и настроены письма на почту
  const base = process.env.URL || new URL(req.url).origin;
  const saved = await fetch(base + "/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ "form-name": formName, "bot-field": "", ...data, agree: "on" }).toString(),
  });
  if (!saved.ok) {
    console.error("netlify-forms", saved.status);
    return json(502, { ok: false, error: "save" });
  }

  let tg = "off";
  try { tg = await toTelegram(formName, data, clean(f.page, 120)); } catch (e) { tg = "error"; console.error("telegram", e.message); }
  if (tg === "error") console.error("telegram send failed"); // заявка уже сохранена — посетителю об этом знать не нужно

  return json(200, { ok: true });
};

export const config = { path: "/api/lead" };

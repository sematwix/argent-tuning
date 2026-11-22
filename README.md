# ARGENT — демо-сайт тюнинг-ателье (Алматы)

Eleventy + GSAP + Lenis + Decap CMS + Netlify Forms. Правила дизайна в [AI-RULES.md](AI-RULES.md).

## Запуск
```bash
npm install
npm run dev        # http://localhost:8080
npm run build      # готовый сайт в _site/
```

## Где что менять
- Тексты главной, обещания, фары: `src/_data/home.json`
- Контакты, Метрика, ключ 2ГИС: `src/_data/site.json`
- Услуги: `src/uslugi/*.md` · Проекты: `src/portfolio/*.md` · Отзывы: `src/_data/reviews.json`
- Токены дизайна: начало `src/assets/css/main.css`

## Фото первого экрана (как пересобрать)
1. Новое фото увеличить Real-ESRGAN x4 (`realesrgan-ncnn-vulkan -n realesrgan-x4plus`) и сохранить как `hero-src/master.png` шириной 4800 px.
2. Вырезать машину: `cd hero-src && swift cutout.swift master.png mask-master.png`
3. Собрать слои: `node hero-src/build-hero.mjs` (зоны фар — `LIGHT_ZONES` в скрипте).

## Фото первого экрана (старая схема, для справки)
1. Положить фото 16:9 в `src/assets/uploads/hero.jpg`, машину без фона — в `hero-car.png` (тот же размер кадра).
2. В `home.json`: `heroImage: "/assets/uploads/hero.jpg"`, `heroCutout: "/assets/uploads/hero-car.png"`.
3. Подогнать координаты фар `headlights` (в % от кадра).

## Админка (Decap CMS)
- Локально: `npm run cms` в отдельном терминале + `npm run dev`, затем http://localhost:8080/admin/
- На Netlify: Site settings → Identity → Enable, Registration: Invite only, Services → Git Gateway → Enable, пригласить владельца по почте.
- Если Git Gateway недоступен: Decap Turbo (платно) или вход через GitHub/DecapBridge.

## Заявки
- Netlify Forms находит формы `zayavka` и `konsultaciya` при деплое. Уведомления на почту: Forms → Form notifications → Email.
- Яндекс Метрика: указать ID в `site.json → metrikaId`, в Метрике создать цель «JavaScript-событие» с идентификатором `lead`.

## Перед сдачей
- Заменить заглушки: контакты, отзывы, цифры «О компании», `site.url`.

/* ARGENT — интерактив: плавный скролл, первый экран, свет в портфолио, формы */
(() => {
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(pointer: fine)").matches;
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const hasGsap = !!window.gsap;
  if (reduced) root.classList.add("reduced");
  const hero = $("[data-hero]");
  const title = $("[data-hero-title]");

  /* ---------- Плавный скролл (десктоп); на телефоне — родной скролл, он и так плавный ---------- */
  let lenis = null;
  if (hasGsap) {
    gsap.registerPlugin(ScrollTrigger);
    // не пересчитывать все триггеры при появлении/скрытии адресной строки на телефоне
    ScrollTrigger.config({ ignoreMobileResize: true });
  }
  if (window.Lenis && finePointer && !reduced) {
    // lerp 0.1 — мягкое инерционное «доезжание»; на резкой прокрутке колесом не копится отставание
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 0.9, touchMultiplier: 1, autoRaf: false });
    if (hasGsap) {
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  // Якоря: плавно, с учётом шапки
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href*="#"]');
    if (!a) return;
    const url = new URL(a.href);
    if (url.pathname !== location.pathname || !url.hash) return;
    const target = $(url.hash);
    if (!target) return;
    e.preventDefault();
    closeMenu();
    if (lenis) lenis.scrollTo(target, { offset: -80, duration: 1.4 });
    else target.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
    history.replaceState(null, "", url.hash);
  });

  /* ---------- Шапка: прячется при скролле вниз ---------- */
  const header = $("[data-header]");
  const menuEl = $("[data-menu]");
  let lastY = 0, hidden = false, ticking = false;
  // не чаще одного раза за кадр и без лишних перерисовок шапки
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      const next = y > 240 && y > lastY && (!menuEl || menuEl.hidden);
      if (next !== hidden) { hidden = next; header?.classList.toggle("is-hidden", hidden); }
      lastY = y;
      ticking = false;
    });
  };
  addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Мобильное меню ---------- */
  const burger = $("[data-burger]");
  const menu = $("[data-menu]");
  function closeMenu() { if (menu && !menu.hidden) { menu.hidden = true; burger.setAttribute("aria-expanded", "false"); } }
  burger?.addEventListener("click", () => {
    const open = menu.hidden;
    menu.hidden = !open;
    burger.setAttribute("aria-expanded", String(open));
  });
  menu?.addEventListener("click", (e) => { if (e.target.closest("a")) closeMenu(); });

  /* ---------- Модалка записи ---------- */
  const modal = $("[data-modal]");
  document.addEventListener("click", (e) => {
    const opener = e.target.closest("[data-open-modal]");
    if (opener && modal) {
      closeMenu();
      const sel = $("select[name=service]", modal);
      if (sel) sel.value = opener.dataset.service || "";
      modal.showModal();
      lenis?.stop();
    }
    if (e.target.closest("[data-close-modal]") || e.target === modal) modal.close();
  });
  modal?.addEventListener("close", () => lenis?.start());

  /* ---------- Первый экран ---------- */
  function fitTitle() {
    if (!title) return;
    title.style.fontSize = "100px";
    const ch = title.querySelectorAll(".hero__ch");
    const w = ch[ch.length - 1].getBoundingClientRect().right - ch[0].getBoundingClientRect().left;
    const target = document.documentElement.clientWidth * 0.96;
    title.style.fontSize = (100 * target) / w + "px";
    placeTitle();
  }
  // Заголовок ставим целиком над крышей машины (крыша ≈ 30% высоты кадра), но не выше шапки.
  // Считаем по offset-размерам — они не зависят от текущего наезда камеры при скролле.
  function placeTitle() {
    const car = hero && $(".hero__car", hero);
    const stage = hero && $("[data-hero-stage]", hero);
    if (!car || !stage) return;
    const roof = car.offsetTop + car.offsetHeight * 0.3;
    const gap = Math.max(4, document.documentElement.clientWidth * 0.006);
    const hdr = $(".hdr__row");
    const minTop = (hdr ? hdr.offsetHeight + 20 : 80) - stage.offsetTop;
    title.style.top = Math.max(minTop, roof - title.offsetHeight - gap) + "px";
  }
  if (title) {
    fitTitle();
    document.fonts?.ready.then(fitTitle);
    let rt;
    addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { fitTitle(); hasGsap && ScrollTrigger.refresh(); }, 150); });
  }

  if (hero && hasGsap && !reduced) {
    const stage = $("[data-hero-stage]", hero);
    const letters = $$(".hero__ch > span", hero);
    const lights = $$("[data-hero-lights]", hero);
    const dark = $("[data-hero-dark]", hero);
    const ui = $$("[data-hero-ui]", hero);

    // Интро «включение студийного света»:
    // темнота → софтбокс под потолком мигает → свет волной заливает машину → загораются фары → выезжает заголовок
    gsap.set(ui, { opacity: 0, y: 24 });
    const intro = gsap.timeline({ defaults: { ease: "expo.out" }, delay: 0.2 });
    if (dark) {
      intro.to(dark, {
        keyframes: [
          { "--lr": "16%", duration: 0.06 }, { "--lr": "0%", duration: 0.12 },
          { "--lr": "24%", duration: 0.05 }, { "--lr": "8%", duration: 0.1 },
          { "--lr": "20%", duration: 0.08 },
        ], ease: "none",
      }, 0.1);
      intro.to(dark, { "--lr": "180%", duration: 1.5, ease: "power2.inOut" }, 0.65);
      intro.set(dark, { display: "none" });
    }
    // лёгкий «вдох» сцены, пока разгорается свет; скролл-наезд — на всей сцене, поэтому не конфликтуют
    intro.fromTo($$(".hero__bg, .hero__car", hero), { scale: 1.04 }, { scale: 1, duration: 2.6, ease: "power3.out" }, 0.4);
    // фары: короткое мерцание и ровный свет
    if (lights.length) {
      intro.to(lights, {
        keyframes: [{ opacity: 0.7, duration: 0.07 }, { opacity: 0.1, duration: 0.1 }, { opacity: 0.95, duration: 0.06 }, { opacity: 0.4, duration: 0.12 }, { opacity: 1, duration: 0.45 }],
        stagger: 0.05, ease: "none",
      }, 1.55);
    }
    intro.to(letters, { y: 0, duration: 1.3, stagger: 0.05 }, 1.7);
    intro.to(ui, { opacity: 1, y: 0, duration: 1.1, stagger: 0.12 }, 2.0);
    // после интро снимаем лишние GPU-слои с букв и света
    intro.eventCallback("onComplete", () => gsap.set([...letters, ...lights], { willChange: "auto" }));

    // первый экран ушёл из вида — не рисуем его крупные слои, пока листают ниже
    ScrollTrigger.create({
      trigger: hero, start: "bottom top+=1",
      onEnter: () => (stage.style.visibility = "hidden"),
      onLeaveBack: () => (stage.style.visibility = ""),
    });

    // Скролл: медленный наезд камеры, заголовок уходит чуть быстрее машины — ощущение глубины
    const st = { trigger: hero, start: "top top", end: "bottom top", scrub: 0.8 };
    // fromTo + immediateRender:false — чтобы пересчёт ScrollTrigger не сбрасывал состояние после интро
    gsap.fromTo(stage, { scale: 1, yPercent: 0 }, { scale: 1.1, yPercent: 3, ease: "none", immediateRender: false, scrollTrigger: st });
    gsap.fromTo(title, { yPercent: 0 }, { yPercent: -35, ease: "none", immediateRender: false, scrollTrigger: st });
    gsap.fromTo($(".hero__ui", hero), { opacity: 1, y: 0 }, { opacity: 0, y: -40, ease: "none", immediateRender: false, scrollTrigger: { ...st, end: "45% top" } });
  } else if (hero) {
    $$("[data-hero-lights]", hero).forEach((l) => (l.style.opacity = 1));
    const d = $("[data-hero-dark]", hero);
    if (d) d.style.display = "none";
  }

  /* ---------- Появление блоков ---------- */
  if (hasGsap) {
    // позиции триггеров пересчитываем после загрузки шрифтов и картинок
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    addEventListener("load", () => ScrollTrigger.refresh());
  }
  if (hasGsap && !reduced) {
    ScrollTrigger.batch("[data-reveal]", {
      start: "top 88%",
      once: true,
      onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.1, ease: "expo.out", stagger: 0.08 }),
    });
  } else {
    $$("[data-reveal]").forEach((el) => { el.style.opacity = 1; el.style.transform = "none"; });
  }

  /* ---------- Портфолио: слайдер «до/после» ---------- */
  $$("[data-compare]").forEach((el) => {
    const knob = $("[data-compare-knob]", el);
    const st = { pos: 50 };
    const set = (v) => {
      st.pos = Math.max(0, Math.min(100, v));
      el.style.setProperty("--pos", st.pos + "%");
      knob.setAttribute("aria-valuenow", String(Math.round(st.pos)));
      knob.setAttribute("aria-valuetext", Math.round(st.pos) + "%");
    };
    const fromX = (x) => { const r = el.getBoundingClientRect(); set(((x - r.left) / r.width) * 100); };
    const stopHint = () => { el._touched = true; if (hasGsap) gsap.killTweensOf(st); };
    let dragging = false;
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      stopHint(); dragging = true; el.classList.add("is-drag");
      el.setPointerCapture(e.pointerId); fromX(e.clientX);
    });
    el.addEventListener("pointermove", (e) => { if (dragging) fromX(e.clientX); });
    const end = () => { dragging = false; el.classList.remove("is-drag"); };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    knob.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 10 : 5;
      const map = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step };
      if (e.key in map) { e.preventDefault(); stopHint(); set(st.pos + map[e.key]); }
      else if (e.key === "Home") { e.preventDefault(); stopHint(); set(0); }
      else if (e.key === "End") { e.preventDefault(); stopHint(); set(100); }
    });
    // Подсказка, что шторку можно двигать: один раз качнуть её, когда блок появился на экране
    if (hasGsap && !reduced) {
      ScrollTrigger.create({
        trigger: el, start: "top 65%", once: true,
        onEnter: () => {
          if (el._touched) return;
          gsap.timeline({ onUpdate: () => set(st.pos) })
            .to(st, { pos: 30, duration: 0.7, ease: "power2.inOut" })
            .to(st, { pos: 68, duration: 0.9, ease: "power2.inOut" })
            .to(st, { pos: 50, duration: 0.6, ease: "power2.inOut" });
        },
      });
    }
  });

  /* ---------- Карта: грузим, только когда до неё доскроллили ---------- */
  const map = $("[data-map]");
  const whenNear = (el, fn) => {
    if (!("IntersectionObserver" in window)) return fn();
    const io = new IntersectionObserver((en) => { if (en[0].isIntersecting) { io.disconnect(); fn(); } }, { rootMargin: "400px" });
    io.observe(el);
  };
  if (map && !map.dataset.key) {
    // Яндекс Карты: встраиваемый виджет, тёмная тема, ключ не нужен
    whenNear(map, () => {
      const { lat, lon, zoom } = map.dataset;
      const f = document.createElement("iframe");
      f.className = "contacts__map-frame";
      f.title = "Карта: как к нам проехать";
      f.loading = "lazy";
      f.referrerPolicy = "strict-origin-when-cross-origin";
      f.src = `https://yandex.kz/map-widget/v1/?ll=${lon}%2C${lat}&z=${zoom}&pt=${lon}%2C${lat}%2Cpm2wtm&theme=dark&lang=ru_RU`;
      f.addEventListener("load", () => map.classList.add("is-loaded"), { once: true });
      map.prepend(f);
      // На телефоне карта не перехватывает прокрутку страницы, пока по ней не нажали
      const lock = $("[data-map-unlock]", map);
      if (matchMedia("(pointer: coarse)").matches && lock) {
        lock.hidden = false;
        lock.addEventListener("click", () => { lock.hidden = true; });
      }
    });
  }
  if (map && map.dataset.key) {
    // 2ГИС Maps API 2.0 — нужен ключ (указывается в админке → Настройки сайта)
    const load = () => {
      const { lat, lon, zoom } = map.dataset;
      const s = document.createElement("script");
      s.src = "https://maps.api.2gis.ru/2.0/loader.js?pkg=basic&key=" + encodeURIComponent(map.dataset.key);
      s.onload = () => window.DG && DG.then(() => {
        const box = document.createElement("div");
        box.className = "contacts__map-canvas";
        map.prepend(box);
        const m = DG.map(box, { center: [+lat, +lon], zoom: +zoom, scrollWheelZoom: false, fullscreenControl: false });
        DG.marker([+lat, +lon]).addTo(m).bindPopup(document.querySelector(".hdr__logo")?.textContent || "");
        map.classList.add("is-loaded");
      });
      document.head.appendChild(s);
    };
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((en) => { if (en[0].isIntersecting) { io.disconnect(); load(); } }, { rootMargin: "400px" });
      io.observe(map);
    } else load();
  }

  /* ---------- Маска телефона +7 (___) ___-__-__ ---------- */
  $$("[data-phone]").forEach((inp) => {
    const fmt = (v) => {
      let d = v.replace(/\D/g, "");
      if (d.length === 10 && !v.trim().startsWith("+")) d = "7" + d; // вставили номер без кода: 7071234567
      else if (d.startsWith("8")) d = "7" + d.slice(1);
      if (!d.startsWith("7")) d = "7" + d;
      d = d.slice(0, 11);
      const p = d.slice(1);
      let out = "+7";
      if (p.length) out += " (" + p.slice(0, 3);
      if (p.length >= 3) out += ") " + p.slice(3, 6);
      if (p.length >= 6) out += "-" + p.slice(6, 8);
      if (p.length >= 8) out += "-" + p.slice(8, 10);
      return out;
    };
    inp.addEventListener("focus", () => { if (!inp.value) inp.value = "+7 ("; });
    inp.addEventListener("blur", () => { if (inp.value.replace(/\D/g, "").length <= 1) inp.value = ""; });
    inp.addEventListener("input", () => { inp.value = fmt(inp.value); inp.classList.remove("is-invalid"); });
  });

  /* ---------- Отправка заявок (Netlify Forms) + цель в Метрике ---------- */
  $$("[data-lead-form]").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const phone = $("[data-phone]", form);
      if (phone && phone.value.replace(/\D/g, "").length !== 11) {
        phone.classList.add("is-invalid");
        phone.focus();
        return;
      }
      if (!form.reportValidity()) return;
      const btn = $("button[type=submit]", form);
      btn.disabled = true;
      btn.textContent = "Отправляем…";
      try {
        if (!isLocal) {
          const res = await fetch("/", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams(new FormData(form)).toString(),
          });
          if (!res.ok) throw new Error(res.status);
        }
        const id = document.body.dataset.metrika;
        if (id && window.ym) ym(+id, "reachGoal", "lead", { form: form.name });
        form.classList.add("is-sent");
        $(".lead__done", form).hidden = false;
        if (hasGsap && !reduced) gsap.from($(".lead__done", form), { opacity: 0, y: 20, duration: 0.8, ease: "expo.out" });
      } catch (err) {
        form.submit(); // запасной путь: обычная отправка на /spasibo/
      }
    });
  });
})();

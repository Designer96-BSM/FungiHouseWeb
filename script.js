/* ==========================================================
   Scrollytelling con secuencia de imágenes
   1) Reproduce en bucle los fotogramas de "frames/goku2" en el hero
   2) Sincroniza los fotogramas de "frames/goku3" con el scroll
   ========================================================== */

const CONFIG = {
  heroFolder: "frames/goku2",
  scrollFolder: "frames/goku3",
  prefix: "frame_",        // prefijo de los archivos
  frameCount: 60,          // frame_0001 hasta frame_0060 en cada carpeta
  digits: 4,               // cantidad de dígitos del número
  extensions: ["jpg", "webp", "png", "jpeg", "avif"], // se detecta sola
  loopFps: 12,             // velocidad del bucle del hero
  heroPreviewTime: 1200,   // tiempo mínimo para ver el hero detrás del loader
  minLoadTime: 1000,       // milisegundos mínimos de la animación de carga
  smoothing: 0.12,         // 0 a 1: más alto = responde más rápido al scroll
  blend: false,            // false = una sola imagen nítida (sin efecto fantasma)
  touchSmoothing: 0.4,     // en el teléfono el scroll ya tiene inercia: menos retraso
  maxDpr: 2,               // resolución máxima del canvas en pantallas normales
  maxDprTouch: 1.5         // resolución máxima en teléfonos (más ligero)
};

const isTouch = window.matchMedia("(pointer: coarse)").matches;

const els = {
  scene: document.getElementById("scene"),
  canvas: document.getElementById("stage"),
  loader: document.getElementById("loader"),
  loaderCount: document.getElementById("loaderCount"),
  loaderFill: document.getElementById("loaderFill"),
  loaderError: document.getElementById("loaderError"),
  progressFill: document.getElementById("progressFill"),
  hint: document.getElementById("hint"),
  topbar: document.getElementById("topbar"),
  productsCta: document.getElementById("productsCta"),
  chapters: Array.from(document.querySelectorAll(".chapter")),
  cartOpen: document.getElementById("cartOpen"),
  cartCount: document.getElementById("cartCount"),
  cartDialog: document.getElementById("cartDialog"),
  cartClose: document.getElementById("cartClose"),
  cartContinue: document.getElementById("cartContinue"),
  cartItems: document.getElementById("cartItems"),
  cartEmpty: document.getElementById("cartEmpty"),
  cartTotal: document.getElementById("cartTotal"),
  shop: document.getElementById("productos"),
  productTabs: document.getElementById("productTabs"),
  shopProduct: document.getElementById("shopProduct"),
  shopProductImage: document.getElementById("shopProductImage"),
  shopProductCategory: document.getElementById("shopProductCategory"),
  shopProductName: document.getElementById("shopProductName"),
  shopProductDescription: document.getElementById("shopProductDescription"),
  shopProductPrice: document.getElementById("shopProductPrice"),
  shopPrevious: document.getElementById("shopPrevious"),
  shopPreviousCategory: document.getElementById("shopPreviousCategory"),
  shopNext: document.getElementById("shopNext"),
  shopNextCategory: document.getElementById("shopNextCategory"),
  shopQuantity: document.getElementById("shopQuantity"),
  shopQuantityDecrease: document.getElementById("shopQuantityDecrease"),
  shopQuantityIncrease: document.getElementById("shopQuantityIncrease"),
  shopAdd: document.getElementById("shopAdd")
};

const PRODUCTS = [
  { id: "clasico", category: "Clásico", name: "Choco hongo clásico", description: "Chocolate intenso y equilibrado, hecho para los amantes del cacao.", price: 30000, image: "images/choco-hongo-clasico.png" },
  { id: "mora", category: "Mora", name: "Choco hongo de mora", description: "El sabor frutal de la mora se encuentra con una cubierta de chocolate.", price: 35000, image: "images/choco-hongo-mora.png" },
  { id: "arequipe", category: "Arequipe", name: "Choco hongo de arequipe", description: "Un centro cremoso de arequipe con una generosa capa de chocolate.", price: 35000, image: "images/choco-hongo-arequipe.png" }
];
const productsById = new Map(PRODUCTS.map((product) => [product.id, product]));
const cart = new Map();
let addFeedbackTimeout = null;
let stopProductsScroll = null;
const formatPrice = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0
});

const ctx = els.canvas.getContext("2d");
const heroFrames = [];
const scrollFrames = [];
let currentFrame = 0;    // posición suavizada (puede tener decimales)
let targetFrame = 0;     // posición según el scroll
let lastDrawn = -1;
let lastMode = "";
let heroFrameIndex = 0;
let isHeroLoop = true;
let heroLoopStartedAt = 0;
let isShopActive = false;
let selectedProductId = "clasico";

/* ---------- 1. Cargar imágenes ---------- */

function pad(n) {
  return String(n).padStart(CONFIG.digits, "0");
}

function frameUrl(folder, i, ext) {
  return folder + "/" + CONFIG.prefix + pad(i + 1) + "." + ext;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      // decode() deja la imagen lista para dibujar sin tirones
      (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(() => resolve(img));
    };
    img.onerror = () => reject(new Error("No se encontró " + src));
    img.src = src;
  });
}

// Prueba cada extensión con el primer fotograma hasta encontrar la correcta
async function detectExtension(folder) {
  for (const ext of CONFIG.extensions) {
    try {
      const first = await loadImage(frameUrl(folder, 0, ext));
      return { ext, first };
    } catch (e) { /* prueba la siguiente */ }
  }
  throw new Error(
    "No se encontró " + folder + "/" + CONFIG.prefix + pad(1) + " (probé: " +
    CONFIG.extensions.join(", ") + ")"
  );
}

let realProgress = 0; // 0 a 1, según las imágenes cargadas
let loadedFrames = 0;
const totalFrames = CONFIG.frameCount * 2;

function markFrameLoaded() {
  loadedFrames++;
  realProgress = loadedFrames / totalFrames;
}

async function loadFrameSet(folder, destination) {
  const { ext, first } = await detectExtension(folder);
  destination[0] = first;
  markFrameLoaded();
  const jobs = [];
  for (let i = 1; i < CONFIG.frameCount; i++) {
    jobs.push(
      loadImage(frameUrl(folder, i, ext)).then((img) => {
        destination[i] = img;
        markFrameLoaded();
      })
    );
  }
  await Promise.all(jobs);
}

function startHeroPreview() {
  heroFrameIndex = heroFrames.length - 1;
  heroLoopStartedAt = performance.now();
  drawFrame(heroFrameIndex, heroFrames);
  lastDrawn = heroFrameIndex;
  lastMode = "hero";
  requestAnimationFrame(loop);
}

async function loadFrames() {
  await Promise.all([
    loadFrameSet(CONFIG.heroFolder, heroFrames).then(startHeroPreview),
    loadFrameSet(CONFIG.scrollFolder, scrollFrames)
  ]);
}

/* ---------- 2. Animación de carga breve ---------- */

function runLoaderAnimation() {
  const start = performance.now();
  let shown = 0;

  function update(p) {
    const percent = Math.round(p * 100);
    els.loaderCount.textContent = percent + "%";
    els.loaderFill.style.width = percent + "%";
  }

  update(0);

  return new Promise((resolve) => {
    function tick(now) {
      // El indicador avanza con la carga real sin saltarse el tiempo mínimo.
      const byTime = Math.min(1, (now - start) / CONFIG.minLoadTime);
      const target = Math.min(byTime, realProgress);
      shown += (target - shown) * 0.25;
      if (target - shown < 0.002) shown = target;
      update(shown);

      if (shown >= 1) return resolve();
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

/* ---------- 3. Dibujar en el canvas principal (modo "cover") ---------- */

let lastW = 0;
let lastH = 0;

function canvasDpr() {
  return Math.min(window.devicePixelRatio || 1, isTouch ? CONFIG.maxDprTouch : CONFIG.maxDpr);
}

function resizeCanvas() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  // En el teléfono la barra del navegador aparece y desaparece al hacer scroll
  // y cambia la altura. Ignorar esos cambios pequeños evita que el canvas se
  // borre y parpadee. Solo se redimensiona si cambia el ancho o la altura cambia mucho.
  if (lastW && w === lastW && Math.abs(h - lastH) < 160) return;
  lastW = w;
  lastH = h;

  const dpr = canvasDpr();
  els.canvas.width = Math.round(w * dpr);
  els.canvas.height = Math.round(h * dpr);
  paintArts();
  if (heroFrames.length && scrollFrames.length) {
    drawActiveFrame();         // redibujar al instante, sin esperar al bucle
    lastDrawn = isHeroLoop ? heroFrameIndex : Math.round(currentFrame);
    lastMode = isHeroLoop ? "hero" : "scroll";
  }
}

function drawCover(img) {
  const cw = els.canvas.width;
  const ch = els.canvas.height;
  const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
}

// Dibuja el fotograma más cercano. Con CONFIG.blend = true mezcla dos vecinos.
function drawFrame(pos, sequence) {
  if (!CONFIG.blend) {
    const img = sequence[Math.min(sequence.length - 1, Math.max(0, Math.round(pos)))];
    if (img) {
      ctx.globalAlpha = 1;
      drawCover(img);
    }
    return;
  }

  const lo = Math.floor(pos);
  const hi = Math.min(sequence.length - 1, lo + 1);
  const t = pos - lo;

  if (!sequence[lo]) return;
  ctx.globalAlpha = 1;
  drawCover(sequence[lo]);

  if (t > 0.02 && hi !== lo && sequence[hi]) {
    ctx.globalAlpha = t;
    drawCover(sequence[hi]);
    ctx.globalAlpha = 1;
  }
}

/* ---------- 4. Imágenes de las secciones a partir de los fotogramas ----------
   Cada <canvas data-frame="N"> muestra el fotograma N (índice desde 0).
   Opciones: data-zoom (acercar), data-fx / data-fy (punto de enfoque de 0 a 1). */

function num(value, fallback) {
  const n = parseFloat(value);
  return isNaN(n) ? fallback : n;
}

function paintArts() {
  if (!scrollFrames.length) return;
  const dpr = canvasDpr();

  document.querySelectorAll("canvas[data-frame]").forEach((c) => {
    const index = Math.min(scrollFrames.length - 1, Math.max(0, num(c.dataset.frame, 0)));
    const img = scrollFrames[index];
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (!img || !w || !h) return;

    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);

    const zoom = num(c.dataset.zoom, 1);
    const fx = num(c.dataset.fx, 0.5);
    const fy = num(c.dataset.fy, 0.5);

    const base = Math.max(c.width / img.naturalWidth, c.height / img.naturalHeight) * zoom;
    const dw = img.naturalWidth * base;
    const dh = img.naturalHeight * base;
    const x = -(dw - c.width) * fx;
    const y = -(dh - c.height) * fy;

    c.getContext("2d").drawImage(img, x, y, dw, dh);
  });
}

/* ---------- 5. Scroll ---------- */

function getSceneProgress() {
  const rect = els.scene.getBoundingClientRect();
  const total = els.scene.offsetHeight - window.innerHeight;
  const p = -rect.top / total;
  return Math.min(1, Math.max(0, p));
}

function updateChapters(p) {
  els.chapters.forEach((ch) => {
    const start = parseFloat(ch.dataset.start);
    const end = parseFloat(ch.dataset.end);
    ch.classList.toggle("is-active", p >= start && p <= end);
  });
  els.hint.classList.toggle("is-hidden", p > 0.03);
}

function updatePageProgress() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const p = max > 0 ? window.scrollY / max : 0;
  els.progressFill.style.width = p * 100 + "%";
}

function updateTopbar() {
  const sceneBottom = els.scene.getBoundingClientRect().bottom;
  els.topbar.classList.toggle("is-solid", sceneBottom < 80);
}

function onScroll() {
  const p = getSceneProgress();
  const maxScrollFrame = Math.max(0, scrollFrames.length - 1);
  const showShop = p >= 0.94;
  isHeroLoop = p === 0;
  if (showShop && !isShopActive && scrollFrames.length) {
    currentFrame = maxScrollFrame;
    drawFrame(currentFrame, scrollFrames);
    lastDrawn = maxScrollFrame;
    lastMode = "scroll";
  }
  isShopActive = showShop;
  targetFrame = showShop ? maxScrollFrame : p * maxScrollFrame;
  els.shop.classList.toggle("is-active", showShop);
  els.shop.setAttribute("aria-hidden", String(!showShop));
  updateChapters(p);
  updatePageProgress();
  updateTopbar();
}

/* ---------- 6. Bucle de animación (suaviza el avance) ---------- */

function drawActiveFrame() {
  if (isHeroLoop) {
    drawFrame(heroFrameIndex, heroFrames);
  } else {
    drawFrame(currentFrame, scrollFrames);
  }
}

function loop(now) {
  if (isHeroLoop) {
    const elapsedFrames = Math.floor((now - heroLoopStartedAt) / (1000 / CONFIG.loopFps));
    const cycleLength = Math.max(1, 2 * (heroFrames.length - 1));
    const phase = elapsedFrames % cycleLength;
    const shown = phase < heroFrames.length
      ? heroFrames.length - 1 - phase
      : phase - (heroFrames.length - 1);
    if (lastMode !== "hero" || shown !== lastDrawn) {
      heroFrameIndex = shown;
      drawFrame(heroFrameIndex, heroFrames);
      lastDrawn = shown;
      lastMode = "hero";
    }
  } else {
    const smoothing = isTouch ? CONFIG.touchSmoothing : CONFIG.smoothing;
    currentFrame += (targetFrame - currentFrame) * smoothing;
    if (Math.abs(targetFrame - currentFrame) < 0.01) currentFrame = targetFrame;

    // Sin mezcla solo hace falta redibujar cuando cambia el fotograma entero
    const shown = CONFIG.blend ? currentFrame : Math.round(currentFrame);
    if (lastMode !== "scroll" || Math.abs(shown - lastDrawn) > (CONFIG.blend ? 0.004 : 0)) {
      drawFrame(currentFrame, scrollFrames);
      lastDrawn = shown;
      lastMode = "scroll";
    }
  }
  requestAnimationFrame(loop);
}

function getQuantity(value) {
  const quantity = Number.parseInt(value, 10);
  return Math.min(99, Math.max(1, Number.isFinite(quantity) ? quantity : 1));
}

function scrollToProducts() {
  stopProductsScroll?.();

  const sceneTop = window.scrollY + els.scene.getBoundingClientRect().top;
  const target = Math.max(0, sceneTop + els.scene.offsetHeight - window.innerHeight);
  const start = window.scrollY;
  const distance = target - start;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || Math.abs(distance) < 1) {
    window.scrollTo({ top: target, behavior: "auto" });
    return;
  }

  const root = document.documentElement;
  const previousBehavior = root.style.scrollBehavior;
  const duration = Math.min(2400, Math.max(1400, Math.abs(distance) * 0.72));
  const startTime = performance.now();
  let frameId = 0;

  root.style.scrollBehavior = "auto";

  const cleanup = () => {
    window.removeEventListener("wheel", cancel);
    window.removeEventListener("touchstart", cancel);
    window.removeEventListener("keydown", onKeyDown);
    root.style.scrollBehavior = previousBehavior;
    stopProductsScroll = null;
  };

  const cancel = () => {
    cancelAnimationFrame(frameId);
    cleanup();
  };

  const onKeyDown = (event) => {
    if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key)) cancel();
  };

  const animate = (now) => {
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = progress * progress * (3 - 2 * progress);
    window.scrollTo(0, start + distance * eased);

    if (progress < 1) {
      frameId = requestAnimationFrame(animate);
    } else {
      frameId = 0;
      cleanup();
    }
  };

  window.addEventListener("wheel", cancel, { passive: true });
  window.addEventListener("touchstart", cancel, { passive: true });
  window.addEventListener("keydown", onKeyDown);
  stopProductsScroll = cancel;
  frameId = requestAnimationFrame(animate);
}

function renderCart() {
  const entries = Array.from(cart.entries());
  const itemCount = entries.reduce((sum, [, quantity]) => sum + quantity, 0);
  const total = entries.reduce((sum, [id, quantity]) => sum + productsById.get(id).price * quantity, 0);

  els.cartCount.textContent = String(itemCount);
  els.cartCount.setAttribute("aria-label", `${itemCount} ${itemCount === 1 ? "unidad" : "unidades"}`);
  els.cartOpen.setAttribute("aria-label", `Abrir carrito, ${itemCount} ${itemCount === 1 ? "unidad" : "unidades"}`);
  els.cartTotal.textContent = formatPrice.format(total);
  els.cartEmpty.hidden = entries.length > 0;
  els.cartItems.replaceChildren();

  entries.forEach(([id, quantity]) => {
    const product = productsById.get(id);
    const row = document.createElement("article");
    row.className = "cart-item";
    row.innerHTML = `
      <img class="cart-item__image" src="${product.image}" alt="">
      <div class="cart-item__details">
        <h3>${product.name}</h3>
        <p>${formatPrice.format(product.price)} · unidad</p>
      </div>
      <div class="cart-item__controls" aria-label="Cantidad de ${product.name}">
        <button type="button" data-cart-action="decrease" data-product-id="${id}" aria-label="Quitar una unidad">−</button>
        <span>${quantity}</span>
        <button type="button" data-cart-action="increase" data-product-id="${id}" aria-label="Agregar una unidad">+</button>
        <button class="cart-item__remove" type="button" data-cart-action="remove" data-product-id="${id}">Quitar</button>
      </div>`;
    els.cartItems.append(row);
  });
}

function selectProduct(productId) {
  const product = productsById.get(productId);
  if (!product) return;

  selectedProductId = productId;
  els.shopProductImage.src = product.image;
  els.shopProductImage.alt = product.name + " de Fungi House";
  els.shopProductCategory.textContent = product.category;
  els.shopProductName.textContent = product.name;
  els.shopProductDescription.textContent = product.description;
  els.shopProduct.setAttribute("aria-labelledby", `tab-${productId}`);
  els.shopAdd.dataset.addToCart = productId;
  els.shopQuantity.textContent = "1";
  updateShopPrice();
  els.shopAdd.textContent = "Agregar al carrito";
  els.shopAdd.classList.remove("is-added");
  clearTimeout(addFeedbackTimeout);
  const productIndex = PRODUCTS.findIndex((item) => item.id === productId);
  const previousProduct = PRODUCTS[(productIndex - 1 + PRODUCTS.length) % PRODUCTS.length];
  const nextProduct = PRODUCTS[(productIndex + 1) % PRODUCTS.length];
  els.shopPreviousCategory.textContent = previousProduct.category;
  els.shopPrevious.setAttribute("aria-label", `Categoría anterior: ${previousProduct.category}`);
  els.shopNextCategory.textContent = nextProduct.category;
  els.shopNext.setAttribute("aria-label", `Siguiente categoría: ${nextProduct.category}`);

  if (els.shop.classList.contains("is-active")) {
    els.shopProduct.classList.remove("is-changing");
    void els.shopProduct.offsetWidth;
    els.shopProduct.classList.add("is-changing");
  }

  els.productTabs.querySelectorAll("[data-product-tab]").forEach((tab) => {
    const isSelected = tab.dataset.productTab === productId;
    tab.setAttribute("aria-selected", String(isSelected));
    tab.tabIndex = isSelected ? 0 : -1;
  });
}

function moveProduct(direction) {
  const productIndex = PRODUCTS.findIndex((product) => product.id === selectedProductId);
  const nextIndex = (productIndex + direction + PRODUCTS.length) % PRODUCTS.length;
  selectProduct(PRODUCTS[nextIndex].id);
}

function updateShopQuantity(change) {
  const quantity = getQuantity(els.shopQuantity.textContent);
  els.shopQuantity.textContent = String(Math.min(99, Math.max(1, quantity + change)));
  updateShopPrice();
}

function updateShopPrice() {
  const product = productsById.get(selectedProductId);
  const quantity = getQuantity(els.shopQuantity.textContent);
  els.shopProductPrice.textContent =  formatPrice.format(product.price * quantity);
}

function bindCart() {
  els.productsCta.addEventListener("click", (event) => {
    event.preventDefault();
    scrollToProducts();
  });

  els.productTabs.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-product-tab]");
    if (tab) selectProduct(tab.dataset.productTab);
  });

  els.productTabs.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const tabs = Array.from(els.productTabs.querySelectorAll("[data-product-tab]"));
    const currentIndex = tabs.indexOf(event.target);
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const nextTab = tabs[(currentIndex + offset + tabs.length) % tabs.length];
    event.preventDefault();
    selectProduct(nextTab.dataset.productTab);
    nextTab.focus();
  });

  els.shopPrevious.addEventListener("click", () => moveProduct(-1));
  els.shopNext.addEventListener("click", () => moveProduct(1));
  els.shopQuantityDecrease.addEventListener("click", () => updateShopQuantity(-1));
  els.shopQuantityIncrease.addEventListener("click", () => updateShopQuantity(1));

  let swipeStartX = null;
  els.shopProduct.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" || event.target.closest("button, input")) return;
    swipeStartX = event.clientX;
  });
  els.shopProduct.addEventListener("pointerup", (event) => {
    if (swipeStartX === null) return;
    const distance = event.clientX - swipeStartX;
    swipeStartX = null;
    if (Math.abs(distance) < 48) return;
    moveProduct(distance < 0 ? 1 : -1);
  });
  els.shopProduct.addEventListener("pointercancel", () => { swipeStartX = null; });

  els.shopAdd.addEventListener("click", () => {
    const quantity = getQuantity(els.shopQuantity.textContent);
    els.shopQuantity.textContent = String(quantity);
    cart.set(selectedProductId, Math.min(99, (cart.get(selectedProductId) || 0) + quantity));
    renderCart();
    clearTimeout(addFeedbackTimeout);
    els.shopAdd.textContent = "Agregado";
    els.shopAdd.classList.add("is-added");
    addFeedbackTimeout = setTimeout(() => {
      els.shopAdd.textContent = "Agregar al carrito";
      els.shopAdd.classList.remove("is-added");
    }, 1600);
  });

  els.cartOpen.addEventListener("click", () => els.cartDialog.showModal());
  els.cartClose.addEventListener("click", () => els.cartDialog.close());
  els.cartContinue.addEventListener("click", () => els.cartDialog.close());
  els.cartDialog.addEventListener("click", (event) => {
    if (event.target === els.cartDialog) els.cartDialog.close();
  });
  els.cartItems.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cart-action]");
    if (!button) return;

    const { cartAction, productId } = button.dataset;
    const quantity = cart.get(productId);
    if (cartAction === "remove" || (cartAction === "decrease" && quantity <= 1)) {
      cart.delete(productId);
    } else if (cartAction === "decrease") {
      cart.set(productId, quantity - 1);
    } else if (cartAction === "increase") {
      cart.set(productId, Math.min(99, quantity + 1));
    }
    renderCart();
  });

  selectProduct(selectedProductId);
  renderCart();
}

/* ---------- Inicio ---------- */

async function init() {
  resizeCanvas();   // primer dimensionado (lastW = 0 fuerza el cálculo)
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("scroll", onScroll, { passive: true });

  bindCart();
  const animation = runLoaderAnimation(); // arranca ya, avanza con la carga real

  try {
    await loadFrames();
    await animation;          // espera a que termine el recorrido del avión
    const previewRemaining = CONFIG.heroPreviewTime - (performance.now() - heroLoopStartedAt);
    if (previewRemaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, previewRemaining));
    }

    paintArts();
    onScroll();
    currentFrame = targetFrame;
    drawActiveFrame();
    lastDrawn = isHeroLoop ? heroFrameIndex : Math.round(currentFrame);
    lastMode = isHeroLoop ? "hero" : "scroll";
    els.loader.classList.add("is-done");
  } catch (err) {
    console.error(err);
    els.loaderError.hidden = false;
    els.loaderError.textContent =
      "No se pudieron cargar las imágenes de \"" + CONFIG.heroFolder + "\" o \"" +
      CONFIG.scrollFolder + "\". Revisa que ambas carpetas estén junto a index.html y que " +
      "contengan archivos desde " + CONFIG.prefix + pad(1) + " hasta " +
      CONFIG.prefix + pad(CONFIG.frameCount) + ". Detalle: " + err.message;
  }
}

init();

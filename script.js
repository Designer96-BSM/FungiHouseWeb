/* ==========================================================
   Scrollytelling con videos
   1) Reproduce "videos/fungihousev2.mp4" en bucle ping-pong en el hero
   2) Sincroniza "videos/fungihousev1.mp4" con el scroll
   ========================================================== */

const CONFIG = {
  heroVideo: "videos/fungihousev2.mp4",
  scrollVideo: "videos/fungihousev1.mp4",
  loopFps: 10,             // frecuencia de los fotogramas guardados para el tramo inverso
  scrollFps: 24,
  heroPreviewTime: 1200,   // tiempo mínimo para ver el hero detrás del loader
  minLoadTime: 1000,       // milisegundos mínimos de la animación de carga
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
const videoSeekStates = new WeakMap();
const heroFrameCache = [];
const scrollFrameCache = [];
let heroVideo = null;
let scrollVideo = null;
let heroFrameCount = 0;
let lastCachedHeroFrame = -1;
let lastDrawn = -1;
let lastMode = "";
let heroFrameIndex = 0;
let heroDirection = 1;
let heroAwaitingStart = false;
let isHeroLoop = true;
let heroLoopStartedAt = 0;
let selectedProductId = "clasico";

/* ---------- 1. Cargar videos ---------- */

let realProgress = 0; // 0 a 1, según los videos cargados
let loadedVideos = 0;
const totalVideos = 2;

function markVideoLoaded() {
  loadedVideos++;
  realProgress = loadedVideos / totalVideos;
}

function loadVideo(src) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    const onLoaded = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        reject(new Error("El video no tiene una duración válida: " + src));
        return;
      }
      resolve(video);
    };
    const onError = () => reject(new Error("No se pudo cargar el video: " + src));

    video.addEventListener("loadeddata", onLoaded, { once: true });
    video.addEventListener("error", onError, { once: true });
    video.src = src;
    video.load();
  });
}

function registerVideoSeek(video) {
  const state = { targetTime: 0, seeking: false };
  videoSeekStates.set(video, state);
  video.addEventListener("seeked", () => {
    state.seeking = false;
    if (video === scrollVideo) {
      onScroll();
    } else if (Math.abs(video.currentTime - state.targetTime) <= 0.04) {
      drawCover(video);
      if (heroAwaitingStart) {
        heroAwaitingStart = false;
        if (isHeroLoop) playHeroVideo();
      }
    } else {
      requestVideoTime(video, state.targetTime);
    }
  });
}

function requestVideoTime(video, time) {
  if (!video || video.readyState < 2) return;
  const state = videoSeekStates.get(video);
  if (!state) return;

  state.targetTime = Math.max(0, Math.min(time, video.duration - 1 / 30));
  if (state.seeking) return;

  if (Math.abs(video.currentTime - state.targetTime) <= 0.04) {
    drawCover(video);
    return;
  }

  state.seeking = true;
  video.currentTime = state.targetTime;
}

function startHeroPreview() {
  heroFrameCount = Math.max(2, Math.round(heroVideo.duration * CONFIG.loopFps) + 1);
  heroFrameIndex = heroFrameCount - 1;
  heroDirection = 1;
  heroLoopStartedAt = performance.now();
  heroVideo.currentTime = 0;
  cacheHeroFrame(0);
  playHeroVideo();
  watchHeroFrames();
  lastDrawn = -1;
  lastMode = "hero";
  requestAnimationFrame(loop);
}

function cacheHeroFrame(index) {
  if (index <= lastCachedHeroFrame || !heroVideo.videoWidth) return;
  const scale = Math.min(1, els.canvas.width / heroVideo.videoWidth);
  const frame = document.createElement("canvas");
  frame.width = Math.round(heroVideo.videoWidth * scale);
  frame.height = Math.round(heroVideo.videoHeight * scale);
  frame.getContext("2d").drawImage(heroVideo, 0, 0, frame.width, frame.height);

  for (let i = lastCachedHeroFrame + 1; i <= index; i++) {
    heroFrameCache[i] = frame;
  }
  lastCachedHeroFrame = index;
}

function playHeroVideo() {
  if (!heroVideo || !isHeroLoop || heroDirection !== 1 || !heroVideo.paused) return;
  const playback = heroVideo.play();
  if (playback) {
    playback.catch((err) => {
      console.error("No se pudo reproducir el video del hero.", err);
      els.loaderError.hidden = false;
      els.loaderError.textContent = "No se pudo reproducir el video del hero. " + err.message;
    });
  }
}

function watchHeroFrames() {
  const captureFrame = () => {
    if (heroDirection !== 1 || heroVideo.readyState < 2) return;
    const index = Math.min(
      heroFrameCount - 1,
      Math.round(heroVideo.currentTime / heroVideo.duration * (heroFrameCount - 1))
    );
    cacheHeroFrame(index);
  };

  if (typeof heroVideo.requestVideoFrameCallback === "function") {
    const drawNextFrame = () => {
      heroVideo.requestVideoFrameCallback(() => {
        captureFrame();
        if (isHeroLoop && heroDirection === 1 && heroVideo.readyState >= 2) {
          drawCover(heroVideo);
        }
        drawNextFrame();
      });
    };
    drawNextFrame();
  } else {
    heroVideo.addEventListener("timeupdate", () => {
      captureFrame();
      if (isHeroLoop && heroDirection === 1 && heroVideo.readyState >= 2) {
        drawCover(heroVideo);
      }
    });
  }

  heroVideo.addEventListener("ended", () => {
    if (!isHeroLoop) return;
    heroVideo.pause();
    heroDirection = -1;
    heroLoopStartedAt = performance.now();
    heroFrameIndex = heroFrameCount - 1;
    cacheHeroFrame(heroFrameIndex);
    drawCover(heroFrameCache[heroFrameIndex]);
    lastDrawn = heroFrameIndex;
  });
}

async function loadVideos() {
  await Promise.all([
    loadVideo(CONFIG.heroVideo).then((video) => {
      heroVideo = video;
      registerVideoSeek(heroVideo);
      markVideoLoaded();
      startHeroPreview();
    }),
    loadVideo(CONFIG.scrollVideo).then(async (video) => {
      scrollVideo = video;
      await cacheScrollFrames();
      markVideoLoaded();
    })
  ]);
}

function cacheScrollFrames() {
  return new Promise((resolve, reject) => {
    const frameCount = Math.ceil(scrollVideo.duration * CONFIG.scrollFps) + 1;
    let nextFrame = 1;
    let settled = false;

    const capture = () => {
      const scale = Math.min(1, els.canvas.width / scrollVideo.videoWidth);
      const frame = document.createElement("canvas");
      frame.width = Math.round(scrollVideo.videoWidth * scale);
      frame.height = Math.round(scrollVideo.videoHeight * scale);
      frame.getContext("2d").drawImage(scrollVideo, 0, 0, frame.width, frame.height);
      return frame;
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      scrollVideo.pause();
      resolve();
    };

    const completeFrames = () => {
      if (nextFrame < frameCount) {
        const lastFrame = capture();
        while (nextFrame < frameCount) {
          scrollFrameCache[nextFrame] = lastFrame;
          nextFrame++;
        }
      }
      finish();
    };

    scrollFrameCache[0] = capture();
    scrollVideo.addEventListener("error", () => {
      if (settled) return;
      settled = true;
      reject(new Error("No se pudo decodificar el video del scroll."));
    }, { once: true });

    const captureThrough = (mediaTime) => {
      if (settled) return true;
      if (nextFrame / CONFIG.scrollFps <= mediaTime) {
        const lastFrame = capture();
        while (nextFrame < frameCount && nextFrame / CONFIG.scrollFps <= mediaTime) {
          scrollFrameCache[nextFrame] = lastFrame;
          nextFrame++;
        }
        realProgress = (loadedVideos + nextFrame / frameCount) / totalVideos;
      }
      if (mediaTime >= scrollVideo.duration - 0.05) {
        completeFrames();
        return true;
      }
      return false;
    };

    const captureNextFrame = (_now, metadata) => {
      if (!captureThrough(metadata.mediaTime)) {
        scrollVideo.requestVideoFrameCallback(captureNextFrame);
      }
    };

    scrollVideo.addEventListener("ended", completeFrames, { once: true });
    if (typeof scrollVideo.requestVideoFrameCallback === "function") {
      scrollVideo.requestVideoFrameCallback(captureNextFrame);
    } else {
      const pollVideo = () => {
        if (!captureThrough(scrollVideo.currentTime)) requestAnimationFrame(pollVideo);
      };
      requestAnimationFrame(pollVideo);
    }
    const playback = scrollVideo.play();
    if (playback) {
      playback.catch((err) => {
        if (settled) return;
        settled = true;
        reject(new Error("No se pudo preparar el video del scroll: " + err.message));
      });
    }
  });
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
  if (heroVideo && scrollVideo) {
    drawActiveFrame();         // redibujar al instante, sin esperar al bucle
    lastDrawn = isHeroLoop ? heroFrameIndex : -1;
    lastMode = isHeroLoop ? "hero" : "scroll";
  }
}

function drawCover(video) {
  if (!video) return;
  const cw = els.canvas.width;
  const ch = els.canvas.height;
  const width = video.videoWidth || video.width;
  const height = video.videoHeight || video.height;
  const scale = Math.max(cw / width, ch / height);
  const dw = width * scale;
  const dh = height * scale;
  ctx.drawImage(video, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
}

function drawScrollFrame(progress) {
  if (!scrollFrameCache.length) return;
  const position = Math.min(scrollFrameCache.length - 1, Math.max(0, progress * (scrollFrameCache.length - 1)));
  const first = Math.floor(position);
  const second = Math.min(scrollFrameCache.length - 1, first + 1);
  const blend = position - first;

  ctx.globalAlpha = 1;
  drawCover(scrollFrameCache[first]);
  if (blend > 0 && second !== first) {
    ctx.globalAlpha = blend;
    drawCover(scrollFrameCache[second]);
    ctx.globalAlpha = 1;
  }
}

/* ---------- 4. Scroll ---------- */

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
  const reachedShop = p >= 0.94;
  isHeroLoop = p === 0;
  if (isHeroLoop) {
    playHeroVideo();
  } else if (heroVideo && heroDirection === 1) {
    heroVideo.pause();
  }
  const videoProgress = reachedShop ? 1 : Math.min(1, p / 0.94);
  if (!isHeroLoop) drawScrollFrame(videoProgress);
  const showShop = reachedShop;
  els.shop.classList.toggle("is-active", showShop);
  els.shop.setAttribute("aria-hidden", String(!showShop));
  updateChapters(p);
  updatePageProgress();
  updateTopbar();
}

/* ---------- 5. Bucle de animación ---------- */

function drawActiveFrame() {
  if (isHeroLoop) {
    if (heroDirection === 1) {
      playHeroVideo();
    } else {
      drawCover(heroFrameCache[heroFrameIndex]);
    }
  } else {
    const p = getSceneProgress();
    drawScrollFrame(Math.min(1, p / 0.94));
  }
}

function loop(now) {
  if (isHeroLoop && heroDirection === -1) {
    const elapsedFrames = Math.floor((now - heroLoopStartedAt) / (1000 / CONFIG.loopFps));
    const shown = heroFrameCount - 1 - elapsedFrames;
    if (shown < 0) {
      heroDirection = 1;
      heroAwaitingStart = true;
      requestVideoTime(heroVideo, 0);
    } else if (shown < heroFrameCount && shown !== lastDrawn) {
      heroFrameIndex = shown;
      const frame = heroFrameCache[heroFrameIndex];
      if (frame) {
        drawCover(frame);
      } else {
        requestVideoTime(heroVideo, heroFrameIndex / (heroFrameCount - 1) * heroVideo.duration);
      }
      lastDrawn = shown;
      lastMode = "hero";
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
    await loadVideos();
    await animation;          // espera a que termine el recorrido del avión
    const previewRemaining = CONFIG.heroPreviewTime - (performance.now() - heroLoopStartedAt);
    if (previewRemaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, previewRemaining));
    }

    onScroll();
    drawActiveFrame();
    lastDrawn = isHeroLoop ? heroFrameIndex : -1;
    lastMode = isHeroLoop ? "hero" : "scroll";
    els.loader.classList.add("is-done");
  } catch (err) {
    console.error(err);
    els.loaderError.hidden = false;
    els.loaderError.textContent =
      "No se pudieron cargar los videos \"" + CONFIG.heroVideo + "\" o \"" +
      CONFIG.scrollVideo + "\". Revisa que ambos archivos estén junto a index.html. " +
      "Detalle: " + err.message;
  }
}

init();

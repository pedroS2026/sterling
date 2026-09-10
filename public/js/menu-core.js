/**
 * Digitaliza Urpín - Módulo Central del Menú
 * VERSIÓN CON BOTÓN ÚNICO: PAGAR Y ENVIAR PEDIDO
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js";
import { calcularPrecios, getConfigPaisLocal } from './pricing.js';
import { PAISES, obtenerTasa, formatearPrecio } from './currency.js';
import { carrito, agregarAlCarrito, modificarCantidad, actualizarCarritoUI, pagarYEnviarPedido } from './cart.js';

// ==================== CONFIGURACIÓN DE FIREBASE ====================
const firebaseConfig = {
    apiKey: "AIzaSyAstAXcgNXevSuTbgZYQ_U9_SwhUI4tzTY",
    authDomain: "digitaliza-urpin.firebaseapp.com",
    projectId: "digitaliza-urpin",
    storageBucket: "digitaliza-urpin.firebasestorage.app",
    messagingSenderId: "634374370608",
    appId: "1:634374370608:web:91861bb040c110d560c4f5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('6LcDST0tAAAAAIsL4Py1fORj7RKUEx-u-16fU0zD'),
    isTokenAutoRefreshEnabled: true
});

// ========== OBTENER CLIENTE_ID ==========
let CLIENTE_ID = null;
const params = new URLSearchParams(window.location.search);
const idFromQuery = params.get('id');

if (idFromQuery) {
    CLIENTE_ID = idFromQuery;
} else {
    const pathSegments = window.location.pathname.split('/').filter(seg => seg !== '');
    if (pathSegments.length > 0) {
        CLIENTE_ID = pathSegments[0];
    }
}

if (!CLIENTE_ID) {
    window.location.href = "/";
}

const APP_ID = "digitaliza-urpin-2026";
let TASA_BCV = 49.50;
let productosData = [];
window.productosDataGlobal = productosData;
let categoriaActual = "Todas";
let busquedaActual = "";
let configNegocio = {};
let paisActual = 'venezuela';

// ==================== UTILIDADES ====================
function normalizeExtras(extras) {
    if (!extras) return [];
    if (Array.isArray(extras)) return extras;
    if (typeof extras === 'object') return Object.values(extras);
    if (typeof extras === 'string') {
        const items = extras.split(',');
        const result = [];
        for (const item of items) {
            if (item.trim() === "") continue;
            const parts = item.split('=');
            if (parts.length !== 2) continue;
            const nombre = parts[0].trim();
            const precio = parseFloat(parts[1].trim());
            if (nombre !== "" && !isNaN(precio)) {
                result.push({ nombre, precio });
            }
        }
        return result;
    }
    return [];
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

// ==================== TEMAS VISUALES ====================
const temas = {
    fastfood: { primary: 'orange-500', bg: 'slate-900', label: 'Pedido', icon: 'fa-shopping-cart', gradient: 'from-orange-900 via-red-900 to-slate-950', wallpaper: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1200' },
    restaurant: { primary: 'emerald-700', bg: 'stone-900', label: 'Pedido', icon: 'fa-utensils', gradient: 'from-stone-800 via-zinc-900 to-black', wallpaper: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1200' },
    gourmet: { primary: 'rose-700', bg: 'slate-900', label: 'Reserva', icon: 'fa-wine-glass-alt', gradient: 'from-rose-900 via-purple-900 to-slate-950', wallpaper: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?q=80&w=1200' },
    pizzeria: { primary: 'red-600', bg: 'slate-900', label: 'Pedido', icon: 'fa-pizza-slice', gradient: 'from-red-900 via-amber-900 to-slate-950', wallpaper: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=1200' },
    cafe: { primary: 'amber-600', bg: 'stone-900', label: 'Orden', icon: 'fa-coffee', gradient: 'from-amber-900 via-brown-900 to-stone-950', wallpaper: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=1200' },
    mariscos: { primary: 'cyan-600', bg: 'slate-900', label: 'Pedido', icon: 'fa-fish', gradient: 'from-cyan-900 via-blue-900 to-slate-950', wallpaper: 'https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?q=80&w=1200' },
    parts: { primary: 'blue-600', bg: 'slate-900', label: 'Cotización', icon: 'fa-shopping-cart', gradient: 'from-slate-800 via-zinc-900 to-black', wallpaper: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=1200' },
    bakery: { primary: 'pink-500', bg: 'rose-950', label: 'Encargo', icon: 'fa-shopping-cart', gradient: 'from-rose-950 via-pink-950 to-stone-950', wallpaper: 'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?q=80&w=1200' },
    store: { primary: 'emerald-600', bg: 'zinc-900', label: 'Compra', icon: 'fa-shopping-cart', gradient: 'from-emerald-900 via-teal-900 to-slate-950', wallpaper: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?q=80&w=1200' }
};

let unsubscribeFirestore = null;

// ==================== FUNCIONES GLOBALES ====================
window.filtrar = (c) => { categoriaActual = c; renderInterface(); };
window.buscar = (t) => { busquedaActual = t; renderInterface(); };
window.toggleCart = () => {
    const cart = document.getElementById('cart-view');
    if (cart) cart.classList.toggle('translate-y-full');
};

window.agregar = (id, extras = []) => {
    const extrasNormalizados = normalizeExtras(extras);
    agregarAlCarrito(id, productosData, actualizarCarritoUI, notificar, extrasNormalizados, configNegocio.exentoIVA);
};

window.modificar = (id, delta) => {
    modificarCantidad(id, delta, actualizarCarritoUI, configNegocio.exentoIVA);
};

// ========== BOTÓN ÚNICO: PAGAR Y ENVIAR PEDIDO ==========
window.pagarYEnviarPedido = () => {
    pagarYEnviarPedido(configNegocio, CLIENTE_ID, TASA_BCV);
};

// ==================== CARRUSEL ====================
let carruselIndice = 0;
let carruselImagenes = [];

window.verDetalle = (id) => {
    const p = window.productosDataGlobal.find(x => String(x.id) === String(id));
    if (!p) return;

    const tema = temas[configNegocio.type] || temas.store;
    const view = document.getElementById('detail-view');
    if (!view) return;

    const precios = calcularPrecios(p.price, TASA_BCV, configNegocio.exentoIVA, paisActual);

    const imagenes = p.images && p.images.length > 0 ? p.images : (p.img ? [p.img] : ['https://placehold.co/400x400/f8fafc/64748b?text=Sin+Imagen']);
    carruselImagenes = imagenes;
    carruselIndice = 0;

    const deliveryConfig = configNegocio.deliveryRecargo || { activo: false, porcentaje: 3, label: 'Con Delivery' };
    const deliveryActivo = deliveryConfig.activo === true;
    const deliveryLabel = deliveryConfig.label || 'Con Delivery';
    const deliveryMonto = deliveryConfig.porcentaje || 3;

    const nameEl = document.getElementById('detail-name');
    if (nameEl) nameEl.innerText = p.name;
    const catEl = document.getElementById('detail-cat');
    if (catEl) catEl.innerText = p.category;
    const priceUsdEl = document.getElementById('detail-price-usd');
    if (priceUsdEl) priceUsdEl.innerText = precios.usd;
    const priceBsEl = document.getElementById('detail-price-bs');
    if (priceBsEl) priceBsEl.innerText = precios.localFormateado + ' ' + precios.moneda;

    const descEl = document.getElementById('detail-desc');
    if (descEl) descEl.innerText = p.desc || '';

    const container = document.getElementById('detail-img-container');
    if (container) {
        if (carruselImagenes.length > 1) {
            container.innerHTML = `
                <img id="detail-img" class="max-h-full max-w-full object-contain p-4" src="${carruselImagenes[0]}">
                <button onclick="carruselAnterior()" class="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-8 h-8 flex items-center justify-center transition-all">
                    <i class="fas fa-chevron-left text-sm"></i>
                </button>
                <button onclick="carruselSiguiente()" class="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-8 h-8 flex items-center justify-center transition-all">
                    <i class="fas fa-chevron-right text-sm"></i>
                </button>
                <span class="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[10px] px-3 py-1 rounded-full font-bold">1 / ${carruselImagenes.length}</span>
            `;
        } else {
            container.innerHTML = `
                <img id="detail-img" class="max-h-full max-w-full object-contain p-4" src="${carruselImagenes[0]}">
            `;
        }
        const closeBtn = document.createElement('button');
        closeBtn.className = 'absolute top-4 left-4 bg-black/30 hover:bg-black/50 text-white rounded-full w-10 h-10 flex items-center justify-center transition-all';
        closeBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        closeBtn.onclick = window.cerrarDetalle;
        container.appendChild(closeBtn);
    }

    const modifiersContainer = document.getElementById('product-modifiers');
    if (modifiersContainer) {
        let extrasHTML = '';
        const extrasNormalizados = normalizeExtras(p.extras);
        if (extrasNormalizados.length > 0) {
            extrasHTML += `
                <p class="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">Personaliza tu pedido:</p>
                <div class="space-y-2.5">
                    ${extrasNormalizados.map((extra) => {
                        const nombreExtra = extra.nombre || extra.Nombre || "Extra";
                        const precioExtra = extra.precio ?? extra.Precio ?? 0;
                        const extraPrecios = calcularPrecios(precioExtra, TASA_BCV, configNegocio.exentoIVA, paisActual);
                        return `
                            <label class="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100 cursor-pointer">
                                <div class="flex items-center gap-3">
                                    <input type="checkbox" name="extra-item" data-nombre="${escapeHtml(nombreExtra)}" data-precio="${precioExtra}" class="w-4 h-4 rounded">
                                    <span class="text-xs font-bold uppercase text-slate-700">${escapeHtml(nombreExtra)}</span>
                                </div>
                                <span class="text-xs font-black text-slate-500">+$${extraPrecios.usd}</span>
                            </label>
                        `;
                    }).join('')}
                </div>
            `;
        }
        if (deliveryActivo) {
            if (extrasNormalizados.length > 0) {
                extrasHTML += `<div class="mt-4 pt-4 border-t border-slate-200"></div>`;
            }
            extrasHTML += `
                <p class="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3 mt-4">Opciones de entrega:</p>
                <div class="space-y-2.5">
                    <label class="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100 cursor-pointer">
                        <div class="flex items-center gap-3">
                            <input type="radio" name="delivery-option" value="sin-delivery" checked class="w-4 h-4 rounded-full text-emerald-600">
                            <span class="text-xs font-bold uppercase text-slate-700">Retiro en local</span>
                        </div>
                    </label>
                    <label class="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100 cursor-pointer">
                        <div class="flex items-center gap-3">
                            <input type="radio" name="delivery-option" value="con-delivery" class="w-4 h-4 rounded-full text-emerald-600">
                            <span class="text-xs font-bold uppercase text-slate-700">${deliveryLabel} (+$${deliveryMonto.toFixed(2)})</span>
                        </div>
                    </label>
                </div>
                <p class="text-[8px] text-slate-400 mt-2">El cargo de delivery se aplica una sola vez al total del pedido.</p>
            `;
        }
        modifiersContainer.innerHTML = extrasHTML;
    }

    const addBtn = document.getElementById('detail-add-btn');
    if (addBtn) {
        addBtn.onclick = () => {
            const checkboxes = document.querySelectorAll('#product-modifiers input[name="extra-item"]:checked');
            const extrasSeleccionados = Array.from(checkboxes).map(cb => ({
                nombre: cb.getAttribute('data-nombre'),
                precio: parseFloat(cb.getAttribute('data-precio')) || 0
            }));
            const deliveryOption = document.querySelector('input[name="delivery-option"]:checked');
            const conDelivery = deliveryOption && deliveryOption.value === 'con-delivery';
            if (conDelivery) {
                extrasSeleccionados.push({
                    nombre: deliveryLabel,
                    precio: 0,
                    esDelivery: true,
                    esDeliveryFlag: true
                });
            }
            window.agregar(p.id, extrasSeleccionados);
            window.cerrarDetalle();
        };
        addBtn.className = `w-full bg-${tema.primary} text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all`;
    }

    view.classList.remove('hidden');
    setTimeout(() => view.classList.remove('opacity-0'), 10);
};

window.carruselSiguiente = function() {
    carruselIndice = (carruselIndice + 1) % carruselImagenes.length;
    actualizarCarrusel();
};

window.carruselAnterior = function() {
    carruselIndice = (carruselIndice - 1 + carruselImagenes.length) % carruselImagenes.length;
    actualizarCarrusel();
};

function actualizarCarrusel() {
    const img = document.getElementById('detail-img');
    if (img) {
        img.src = carruselImagenes[carruselIndice];
    }
    const contador = document.querySelector('#detail-img-container .absolute.bottom-2');
    if (contador) {
        contador.textContent = `${carruselIndice + 1} / ${carruselImagenes.length}`;
    }
}

window.cerrarDetalle = () => {
    const view = document.getElementById('detail-view');
    if (view) {
        view.classList.add('opacity-0');
        setTimeout(() => view.classList.add('hidden'), 300);
    }
};

// ==================== RENDERIZADO ====================
function renderInterface() {
    console.log('🔄 renderInterface() ejecutándose...');
    const tipo = configNegocio.type || 'store';
    const tema = temas[tipo] || temas.store;

    const header = document.getElementById('main-header');
    if (header) {
        header.className = `p-8 pt-12 rounded-b-[3.5rem] text-white shadow-2xl transition-all duration-700 bg-gradient-to-br ${tema.gradient}`;
    }

    const body = document.getElementById('app-body');
    if (body) {
        body.className = `max-w-md mx-auto min-h-screen relative overflow-x-hidden ${['bakery', 'gourmet'].includes(tipo) ? 'bg-rose-950/10' : 'bg-slate-100'} transition-all duration-700`;
    }

    const bg = document.getElementById('dynamic-bg');
    if (bg) {
        bg.style.backgroundImage = `url('${tema.wallpaper}')`;
    }

    const shopName = document.getElementById('shop-name');
    if (shopName) {
        const nombreNegocio = escapeHtml(configNegocio.name || 'Digitaliza');
        const acentoNegocio = escapeHtml(configNegocio.accent || 'Urpín');
        shopName.innerHTML = `${nombreNegocio} <span class="text-${tema.primary}">${acentoNegocio}</span>`;
    }

    const cartIcon = document.getElementById('cart-icon');
    if (cartIcon) {
        cartIcon.className = `fas ${tema.icon} text-${tema.primary} text-xl`;
    }

    const btnSend = document.getElementById('btn-send-text');
    if (btnSend) {
        btnSend.innerText = `Enviar ${tema.label} vía WhatsApp`;
    }

    const ivaNote = document.getElementById('iva-note');
    if (ivaNote) {
        const config = getConfigPaisLocal(paisActual);
        ivaNote.innerText = configNegocio.exentoIVA ? '' : `Total en ${config.moneda} incluye IVA (${(config.ivaDefault * 100)}%)`;
    }

    const mesaContainer = document.getElementById('mesa-container');
    if (mesaContainer) {
        const tiposSinMesa = ['parts', 'store'];
        const tipoActual = configNegocio.type || 'store';
        if (tiposSinMesa.includes(tipoActual)) {
            mesaContainer.classList.add('hidden');
            console.log('🔧 Campo de mesa OCULTO para tipo:', tipoActual);
        } else {
            mesaContainer.classList.remove('hidden');
            console.log('🍽️ Campo de mesa MOSTRADO para tipo:', tipoActual);
        }
    }

    renderCategorias(tema);
    renderProductos(tema);
    actualizarCarritoUI(configNegocio.exentoIVA);
}

function renderCategorias(tema) {
    const container = document.getElementById('category-filters');
    if (!container) return;
    const cats = ["Todas", ...new Set(productosData.map(p => p.category))];
    container.innerHTML = cats.map(c => `
        <button onclick="window.filtrar('${c}')"
            class="px-6 py-3 rounded-2xl text-[10px] font-light italic tracking-wider transition-all whitespace-nowrap
            ${categoriaActual === c ? `bg-${tema.primary} text-white shadow-lg scale-105` : 'bg-white text-slate-400 border border-slate-100'}">
            ${escapeHtml(c)}
        </button>
    `).join('');
}

function renderProductos(tema) {
    const container = document.getElementById('product-list');
    if (!container) return;
    console.log('🛒 renderProductos() ejecutándose...');
    console.log('📦 productosData (longitud):', productosData.length);

    if (!productosData || productosData.length === 0) {
        container.innerHTML = `
            <div class="py-12 text-center">
                <div class="text-red-500 text-xs font-black uppercase">⚠️ NO HAY PRODUCTOS</div>
                <div class="text-slate-400 text-[10px] mt-2">Asegúrate de que el cliente tenga productos en Firestore.</div>
                <div class="text-slate-400 text-[8px] mt-1">CLIENTE_ID: ${CLIENTE_ID}</div>
                <button onclick="location.reload()" class="mt-4 bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold">Recargar</button>
            </div>
        `;
        return;
    }

    const filtrados = productosData.filter(p =>
        (categoriaActual === "Todas" || p.category === categoriaActual) &&
        p.name.toLowerCase().includes(busquedaActual.toLowerCase())
    );

    console.log('📊 Productos filtrados:', filtrados.length);

    if (filtrados.length === 0) {
        container.innerHTML = `<div class="py-12 text-center text-slate-400 text-xs font-black uppercase tracking-widest">No se encontraron productos</div>`;
        return;
    }

    container.innerHTML = filtrados.map(p => {
        const precios = calcularPrecios(p.price, TASA_BCV, configNegocio.exentoIVA, paisActual);
        const nombreEscapado = escapeHtml(p.name);
        const categoriaEscapada = escapeHtml(p.category);
        const precioUsd = precios.usd;
        const precioLocal = precios.localFormateado;
        const config = getConfigPaisLocal(paisActual);
        const cantImagenes = (p.images && p.images.length > 0) ? p.images.length : (p.img ? 1 : 0);

        return `
        <div class="bg-white p-4 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center mb-5 animate__animated animate__fadeInUp cursor-pointer" onclick="window.verDetalle('${p.id}')">
            <img src="${p.img || ''}" class="w-24 h-24 rounded-[2rem] object-cover bg-slate-50" onerror="this.src='https://placehold.co/200x200/f8fafc/64748b?text=${nombreEscapado[0]}'">
            <div class="ml-5 flex-1">
                <h3 class="text-[12px] font-light italic text-slate-800 tracking-wide">${nombreEscapado}</h3>
                <p class="text-[8px] text-slate-400 font-light italic mb-2">${categoriaEscapada}</p>
                ${cantImagenes > 1 ? `<span class="text-[8px] text-emerald-500 font-bold">📸 ${cantImagenes} imágenes</span>` : ''}
                <div class="flex justify-between items-end">
                    <div>
                        <span class="text-xl font-light italic text-slate-900">$${precioUsd}</span>
                        <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-tighter">${precioLocal} ${config.moneda}</span>
                    </div>
                </div>
            </div>
        </div>
    `}).join('');
}

function notificar(m) {
    const t = document.getElementById('toast');
    if (t) {
        t.innerText = m;
        t.classList.remove('hidden');
        setTimeout(() => t.classList.add('hidden'), 2000);
    }
}

// ==================== TASA Y FIRESTORE ====================
let reintentosTasa = 0;
let tasaTimer = null;

async function actualizarTasa() {
    const pais = paisActual || 'venezuela';
    try {
        const tasa = await obtenerTasa(pais);
        TASA_BCV = tasa;
        window.TASA_BCV = tasa;
        reintentosTasa = 0;
        renderInterface();
    } catch (e) {
        reintentosTasa++;
        if (reintentosTasa > 3) {
            console.warn('⚠️ No se pudo obtener la tasa, usando valor anterior:', TASA_BCV);
        } else {
            if (tasaTimer) clearTimeout(tasaTimer);
            tasaTimer = setTimeout(actualizarTasa, 2000);
        }
    }
}

function conectarFirestore() {
    console.log('🔍 Conectando a Firestore...');
    console.log('📌 CLIENTE_ID:', CLIENTE_ID);
    const docRef = doc(db, "artifacts", APP_ID, "public", "data", "clientes", CLIENTE_ID);
    console.log('📄 Ruta del documento:', docRef.path);

    if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
    }

    unsubscribeFirestore = onSnapshot(docRef, (snap) => {
        console.log('📦 Documento recibido. Existe:', snap.exists());
        const loader = document.getElementById('loader-global');
        if (snap.exists()) {
            const data = snap.data();
            console.log('📊 Datos completos del documento:', data);

            let productosCrudos = data.products || [];
            console.log('📦 Productos crudos (data.products):', productosCrudos);

            if (!Array.isArray(productosCrudos)) {
                console.warn('⚠️ products no es un array, convirtiendo...');
                productosCrudos = Object.values(productosCrudos);
            }

            productosData = productosCrudos.map(p => ({
                ...p,
                desc: p.desc || '',
                images: p.images && p.images.length > 0 ? p.images : (p.img ? [p.img] : []),
                extras: normalizeExtras(p.extras)
            }));

            console.log('🛒 Productos procesados (productosData):', productosData);
            console.log('📊 Cantidad de productos:', productosData.length);

            window.productosDataGlobal = productosData;

            const biz = data.business || {};
            console.log('🏢 Datos del negocio (biz):', biz);

            paisActual = biz.pais || 'venezuela';
            window.PAIS_ACTUAL = paisActual;

            const deliveryConfig = biz.deliveryRecargo || { activo: false, porcentaje: 3, label: 'Con Delivery' };

            configNegocio = {
                name: biz.name || "Digitaliza",
                accent: biz.accent || "Urpín",
                type: biz.type || "store",
                whatsapp: biz.whatsapp || "",
                exentoIVA: biz.exentoIVA === true || biz.exentoIVA === "true",
                pais: paisActual,
                deliveryRecargo: deliveryConfig
            };

            window.configNegocio = configNegocio;

            if (loader) {
                loader.style.opacity = '0';
                setTimeout(() => loader.style.display = 'none', 500);
            }

            actualizarTasa();
            renderInterface();

            if (carrito.length > 0) {
                actualizarCarritoUI(configNegocio.exentoIVA);
            }
        } else {
            console.error('❌ El documento NO existe en Firestore para:', CLIENTE_ID);
            const shopName = document.getElementById('shop-name');
            if (shopName) shopName.innerHTML = `<span class="text-red-500 text-xs">ID NO REGISTRADO</span>`;
            if (loader) loader.style.display = 'none';
        }
    }, (error) => {
        console.error('🔥 Error Firestore:', error);
        const shopName = document.getElementById('shop-name');
        if (shopName) shopName.innerHTML = `<span class="text-red-500 text-xs">Error de conexión</span>`;
    });
}

// ==================== INICIO ====================
window.addEventListener('beforeunload', () => {
    if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
    }
    if (tasaTimer) {
        clearTimeout(tasaTimer);
    }
});

conectarFirestore();

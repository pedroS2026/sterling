/**
 * Digitaliza Urpín - Módulo del Carrito
 * VERSIÓN DE UN SOLO BOTÓN: PAGAR Y ENVIAR PEDIDO
 */

import { calcularPrecios, APP_SETTINGS, getConfigPaisLocal } from './pricing.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==================== CONFIGURACIÓN ====================
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

const APP_ID = "digitaliza-urpin-2026";
const API_URL = 'https://sterling-gold.vercel.app';

export let carrito = [];

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

function obtenerProductoOriginal(idOriginal) {
    const productos = window.productosDataGlobal || [];
    return productos.find(p => String(p.id) === String(idOriginal)) || null;
}

function notificar(mensaje) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.innerText = mensaje;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    }
}

// ==================== FUNCIONES DEL CARRITO ====================

export function agregarAlCarrito(id, productosData, actualizarCarritoUI, notificarFn, extras = [], exentoIVA = false) {
    if (!productosData || !Array.isArray(productosData)) {
        console.error("productosData inválido");
        return;
    }

    const p = productosData.find(x => String(x.id) === String(id));
    if (!p) {
        console.error("Producto no encontrado:", id);
        return;
    }

    const extrasNormalizados = normalizeExtras(extras);

    const costoExtras = extrasNormalizados.reduce((sum, e) => {
        const precioValor = typeof e.precio === 'number' ? e.precio : (typeof e.Precio === 'number' ? e.Precio : 0);
        if (e.esDeliveryFlag === true) return sum;
        return sum + precioValor;
    }, 0);

    const precioBase = parseFloat(p.price || 0);
    if (isNaN(precioBase) || precioBase < 0) {
        console.error("Precio inválido para producto:", p.name, p.price);
        return;
    }

    const precioTotalUnitario = precioBase + costoExtras;
    if (isNaN(precioTotalUnitario)) {
        console.error("Precio total inválido para producto:", p.name, precioBase, costoExtras);
        return;
    }

    const tieneDelivery = extrasNormalizados.some(e => e.esDeliveryFlag === true);

    const extrasId = extrasNormalizados.filter(e => e.esDeliveryFlag !== true).map(e => (e.nombre || e.Nombre || "Extra")).sort().join('|');
    const uniqueCartId = extrasId ? `${id}_${extrasId}` : String(id);

    const existingItem = carrito.find(item => String(item.id) === String(uniqueCartId));

    if (existingItem) {
        existingItem.qty += 1;
    } else {
        let nombreParaCarrito = escapeHtml(p.name);
        const extrasParaNombre = extrasNormalizados.filter(e => e.esDeliveryFlag !== true);
        if (extrasParaNombre.length > 0) {
            const listaExtrasLabel = extrasParaNombre.map(e => `+ ${escapeHtml(e.nombre || e.Nombre || "Extra")}`).join(', ');
            nombreParaCarrito = `${escapeHtml(p.name)} (${listaExtrasLabel})`;
        }

        const extrasMapeados = extrasNormalizados.map(e => ({
            nombre: e.nombre || e.Nombre || "Extra",
            precio: typeof e.precio === 'number' ? e.precio : (typeof e.Precio === 'number' ? e.Precio : 0),
            esDelivery: e.esDelivery || false,
            esDeliveryFlag: e.esDeliveryFlag || false
        }));

        carrito.push({
            id: uniqueCartId,
            idOriginal: p.id,
            name: nombreParaCarrito,
            nameOriginal: escapeHtml(p.name),
            price: precioTotalUnitario,
            priceBase: precioBase,
            extras: extrasMapeados,
            category: p.category,
            img: p.img || '',
            qty: 1,
            tieneDelivery: tieneDelivery,
            selectedExtras: extrasNormalizados.map(e => ({
                nombre: e.nombre || e.Nombre || "Extra",
                precio: typeof e.precio === 'number' ? e.precio : (typeof e.Precio === 'number' ? e.Precio : 0),
                esDelivery: e.esDelivery || false,
                esDeliveryFlag: e.esDeliveryFlag || false
            }))
        });
    }

    actualizarCarritoUI(exentoIVA);
    if (typeof notificarFn === 'function') {
        notificarFn(`✔️ Añadido: ${escapeHtml(p.name)}`);
    } else {
        notificar(`✔️ Añadido: ${escapeHtml(p.name)}`);
    }
}

export function modificarCantidad(id, cambio, actualizarCarritoUI, exentoIVA = false) {
    const idx = carrito.findIndex(item => String(item.id) === String(id));
    if (idx !== -1) {
        const nuevaCantidad = (carrito[idx].qty || 0) + cambio;
        if (nuevaCantidad <= 0) {
            carrito.splice(idx, 1);
        } else {
            carrito[idx].qty = nuevaCantidad;
        }
        actualizarCarritoUI(exentoIVA);
    }
}

export function vaciarCarrito() {
    carrito = [];
}

// ==================== ACTUALIZAR CARRITO UI ====================
export function actualizarCarritoUI(exentoIVA = false) {
    const count = carrito.reduce((s, i) => s + (i.qty || 0), 0);
    const badge = document.getElementById('cart-count');
    if (badge) {
        badge.innerText = count;
        badge.classList.toggle('hidden', count === 0);
    }

    let totalAcumuladoUSD = 0;
    const container = document.getElementById('cart-items');
    if (!container) return;

    const pais = window.PAIS_ACTUAL || 'venezuela';
    const config = getConfigPaisLocal(pais);
    const moneda = config.moneda || 'Bs.';

    const deliveryActivo = carrito.some(item => item.tieneDelivery === true);
    const deliveryMonto = window.configNegocio?.deliveryRecargo?.porcentaje || 3;

    if (carrito.length === 0) {
        container.innerHTML = `<div class="py-12 text-center text-slate-300 text-[10px] font-bold uppercase">Carrito Vacío</div>`;
    } else {
        container.innerHTML = carrito.map(item => {
            const qty = item.qty || 0;
            const price = item.price || 0;
            const subtotalItem = price * qty;
            totalAcumuladoUSD += subtotalItem;
            const nombreEscapado = item.name || 'Producto';

            return `
                <div class="flex justify-between py-4 border-b border-slate-50 items-center">
                    <div class="pr-4 flex-1">
                        <h4 class="text-[11px] font-black uppercase text-slate-800 leading-tight">${nombreEscapado}</h4>
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-tighter italic">
                            ${qty} x $${price.toFixed(2)}
                            <span class="text-blue-500 ml-2">Sub: $${subtotalItem.toFixed(2)}</span>
                        </p>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="window.modificar('${item.id}', -1)" class="w-8 h-8 bg-slate-100 rounded-xl text-slate-500 font-bold">-</button>
                        <span class="text-xs font-black w-4 text-center">${qty}</span>
                        <button onclick="window.modificar('${item.id}', 1)" class="w-8 h-8 bg-slate-100 rounded-xl text-slate-500 font-bold">+</button>
                    </div>
                </div>`;
        }).join('');
    }

    let totalConDelivery = totalAcumuladoUSD;
    let deliveryAplicado = false;

    if (deliveryActivo && totalAcumuladoUSD > 0) {
        totalConDelivery = totalAcumuladoUSD + deliveryMonto;
        deliveryAplicado = true;
    }

    const tasaBCV = window.TASA_BCV || 0;
    const totalConIVA = exentoIVA ? totalConDelivery : totalConDelivery * (1 + config.ivaDefault);
    const totalFinalLocal = Math.ceil(totalConIVA * tasaBCV);

    const totalUsdEl = document.getElementById('total-usd');
    const totalBsEl = document.getElementById('total-bs');
    const ivaNoteEl = document.getElementById('iva-note');
    const totalMonedaLabel = document.getElementById('total-moneda-label');

    if (totalUsdEl) totalUsdEl.innerText = totalConDelivery.toFixed(2);
    if (totalBsEl) {
        totalBsEl.innerText = totalFinalLocal.toLocaleString(
            config.formatoLocal || 'es-VE',
            { minimumFractionDigits: config.decimales || 2 }
        );
    }

    if (totalMonedaLabel) {
        totalMonedaLabel.innerText = moneda;
    }

    if (ivaNoteEl) {
        let nota = exentoIVA ? '' : `Total en ${moneda} incluye IVA (${(config.ivaDefault * 100)}%)`;
        if (deliveryAplicado) {
            nota += ` • Delivery: $${deliveryMonto.toFixed(2)}`;
        }
        ivaNoteEl.innerText = nota;
    }

    // ========== MOSTRAR/OCULTAR BOTÓN ÚNICO ==========
    const btnPagar = document.getElementById('btn-pagar-wayu');
    if (btnPagar) {
        if (carrito.length === 0) {
            btnPagar.style.display = 'none';
        } else {
            btnPagar.style.display = 'flex';
        }
    }
}

// ==================== FUNCIÓN ÚNICA: PAGAR Y ENVIAR PEDIDO ====================
export async function pagarYEnviarPedido(configNegocio, CLIENTE_ID, TASA_BCV) {
    if (carrito.length === 0) {
        notificar('❌ El carrito está vacío');
        return;
    }

    const negocio = configNegocio || {};
    const exento = negocio.exentoIVA === true || negocio.exentoIVA === "true";
    const nombreNegocio = escapeHtml(negocio.name || 'Digitaliza Urpín');
    const pais = negocio.pais || 'venezuela';
    const config = getConfigPaisLocal(pais);
    const moneda = config.moneda || 'Bs.';
    const telefono = (negocio.whatsapp || '584120000000').replace(/\D/g, '');

    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    const referencia = `REF-${timestamp.slice(-4)}-${random}`;

    let totalCalculadoUSD = 0;
    let itemsDetalle = [];
    let pedidoData = {
        referencia: referencia,
        clienteId: CLIENTE_ID,
        negocio: nombreNegocio,
        pais: pais,
        fecha: new Date().toISOString(),
        items: [],
        totalUSD: 0,
        totalLocal: 0,
        exentoIVA: exento,
        tasaBCV: TASA_BCV || 0,
        estado: 'pendiente',
        moneda: moneda,
        pagoConfirmado: false,
        negocioData: {
            name: negocio.name,
            whatsapp: negocio.whatsapp,
            accent: negocio.accent,
            type: negocio.type,
            exentoIVA: exento
        }
    };

    const deliveryActivo = carrito.some(item => item.tieneDelivery === true);
    const deliveryMonto = configNegocio.deliveryRecargo?.porcentaje || 3;

    for (const item of carrito) {
        const productoOriginal = obtenerProductoOriginal(item.idOriginal);
        if (!productoOriginal) {
            console.warn("Producto original no encontrado:", item.idOriginal);
            continue;
        }

        const precioBaseOriginal = parseFloat(productoOriginal.price || 0);
        if (isNaN(precioBaseOriginal) || precioBaseOriginal < 0) continue;

        const selectedExtras = item.selectedExtras || [];
        let costoExtras = 0;
        const extrasDetalle = [];
        let deliveryInfo = null;

        for (const extra of selectedExtras) {
            const precioExtra = typeof extra.precio === 'number' ? extra.precio : 0;
            if (extra.esDeliveryFlag === true) continue;
            if (extra.esDelivery === true) {
                deliveryInfo = { nombre: extra.nombre || 'Delivery', precio: 0 };
            } else if (precioExtra > 0) {
                costoExtras += precioExtra;
                extrasDetalle.push({ nombre: extra.nombre || 'Extra', precio: precioExtra });
            } else {
                extrasDetalle.push({ nombre: extra.nombre || 'Extra', precio: 0 });
            }
        }

        const precioUnitarioReal = precioBaseOriginal + costoExtras;
        const cantidad = item.qty || 0;
        const subtotalReal = precioUnitarioReal * cantidad;
        totalCalculadoUSD += subtotalReal;

        const nombreProducto = productoOriginal.name || 'Producto';

        itemsDetalle.push({
            nombre: nombreProducto,
            cantidad: cantidad,
            precioUnitario: precioUnitarioReal,
            subtotal: subtotalReal,
            extras: extrasDetalle,
            delivery: deliveryInfo
        });

        pedidoData.items.push({
            id: productoOriginal.id,
            nombre: productoOriginal.name,
            cantidad: cantidad,
            precioBase: precioBaseOriginal,
            extras: extrasDetalle,
            delivery: deliveryInfo,
            precioUnitario: precioUnitarioReal,
            subtotal: subtotalReal
        });
    }

    if (itemsDetalle.length === 0) {
        notificar('❌ Error: productos no válidos en el carrito');
        return;
    }

    let totalConDelivery = totalCalculadoUSD;
    let deliveryAplicado = false;
    if (deliveryActivo && totalCalculadoUSD > 0) {
        totalConDelivery = totalCalculadoUSD + deliveryMonto;
        deliveryAplicado = true;
    }

    let totalConIVA = totalConDelivery;
    if (!exento) {
        totalConIVA = totalConDelivery * (1 + config.ivaDefault);
    }
    const tasaBCV = TASA_BCV || 0;
    const totalFinalLocal = Math.ceil(totalConIVA * tasaBCV);

    pedidoData.totalUSD = totalConDelivery;
    pedidoData.totalLocal = totalFinalLocal;

    // Guardar pedido en Firestore
    try {
        const docRef = doc(db, "artifacts", APP_ID, "public", "data", "pedidos", referencia);
        await setDoc(docRef, pedidoData);
        console.log("✅ Pedido guardado en Firestore:", referencia);
    } catch (error) {
        console.error("❌ Error al guardar pedido:", error);
        notificar('❌ Error al guardar el pedido. Intenta de nuevo.');
        return;
    }

    // ========== GUARDAR DATOS PARA DESPUÉS DEL PAGO ==========
    // Guardamos el ID del cliente y la referencia para que pago-exitoso.html los use
    localStorage.setItem('ultimoClienteId', CLIENTE_ID);
    localStorage.setItem('pedidoPendiente', referencia);
    localStorage.setItem('pedidoPendienteData', JSON.stringify({
        referencia,
        clienteId: CLIENTE_ID,
        negocio: nombreNegocio,
        telefono,
        moneda,
        totalUSD: totalConDelivery,
        totalLocal: totalFinalLocal,
        items: itemsDetalle,
        deliveryAplicado,
        deliveryMonto,
        exento,
        ivaDefault: config.ivaDefault,
        pais,
        configEmoji: config.emoji || '🌎',
        configNombre: config.nombre || pais,
        configFormatoLocal: config.formatoLocal || 'es-VE',
        configDecimales: config.decimales || 0
    }));

    // Generar link de pago
    const productoNombre = `Pedido ${referencia}`;
    const productoDescripcion = `Pedido para ${nombreNegocio}`;

    notificar('🔄 Generando link de pago...');

    try {
        const response = await fetch(`${API_URL}/api/crear-link-pago`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                monto: parseFloat(totalConDelivery),
                pedidoId: referencia,
                clienteId: CLIENTE_ID,
                productoNombre: productoNombre,
                productoDescripcion: productoDescripcion
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Error desconocido al generar link de pago');
        }

        // ========== REDIRIGIR AL CLIENTE A WAYU PAY ==========
        notificar('🔄 Abriendo Wayu Pay...');
        
        // Guardar el link en localStorage por si acaso
        localStorage.setItem('ultimoLinkPago', data.link);
        
        // Redirigir en la misma pestaña o abrir en nueva
        setTimeout(() => {
            window.location.href = data.link;
        }, 800);

    } catch (error) {
        console.error('❌ Error al generar link de pago:', error);
        notificar(`❌ Error al generar el link de pago: ${error.message}`);
    }
}

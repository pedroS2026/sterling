/**
 * Digitaliza Urpín - Panel Administrativo (VERSIÓN CORREGIDA)
 * Incluye: carga automática para admin normal, logs de depuración
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    collection, 
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
const auth = getAuth(app);
const APP_ID = "digitaliza-urpin-2026";

// ==================== ESTADO GLOBAL ====================
let clienteActualId = "";
let productosActuales = [];
let dirty = false;

// ==================== IMGBB CONFIG ====================
const IMGBB_API_KEY = '8cf60d8646c39f74f88271f1fb63a73e';

// Variables para múltiples archivos
let archivosMultiples = [];
let editArchivosMultiples = [];
let editImagenesExistentes = [];
let editProductIndex = -1;

// ==================== CONTROL DE PERMISOS ====================

function actualizarPermisosUI(isSuperAdmin) {
    const btnRegistrar = document.getElementById('btn-registrar-cliente');
    const roleBadge = document.getElementById('user-role-badge');
    const seccionSuscripcion = document.getElementById('seccion-suscripcion');
    const cambiarPlanContainer = document.getElementById('cambiar-plan-container');
    const seccionActivacion = document.getElementById('seccion-activacion');
    const btnToggle = document.getElementById('btn-toggle-estado');
    
    if (btnRegistrar) {
        if (isSuperAdmin) {
            btnRegistrar.classList.remove('hidden');
        } else {
            btnRegistrar.classList.add('hidden');
        }
    }
    
    if (seccionSuscripcion) {
        if (isSuperAdmin) {
            seccionSuscripcion.classList.remove('hidden');
        } else {
            seccionSuscripcion.classList.add('hidden');
        }
    }
    
    if (seccionActivacion) {
        if (isSuperAdmin) {
            seccionActivacion.classList.remove('hidden');
        } else {
            seccionActivacion.classList.add('hidden');
        }
    }
    
    if (cambiarPlanContainer) {
        if (isSuperAdmin) {
            cambiarPlanContainer.classList.remove('hidden');
        } else {
            cambiarPlanContainer.classList.add('hidden');
        }
    }
    
    if (roleBadge) {
        if (isSuperAdmin) {
            roleBadge.innerText = '👑 Super Admin';
            roleBadge.classList.remove('hidden');
        } else {
            roleBadge.innerText = '👤 Admin';
            roleBadge.classList.remove('hidden');
        }
    }
}

// ==================== SUSCRIPCIONES ====================

function obtenerPlanCliente(clienteData) {
    const raw = clienteData.suscripcion || clienteData.suscription || {};
    
    const plan = raw.plan || raw.Plan || 'basico';
    const activo = raw.activo !== undefined ? raw.activo : (raw.Activo !== undefined ? raw.Activo : true);
    const productosMax = raw.productosMax || raw.productosMax || raw["productos Max"] || 10;
    const extrasEnabled = raw.extrasEnabled !== undefined ? raw.extrasEnabled : (raw.ExtrasEnabled !== undefined ? raw.ExtrasEnabled : false);
    const dashboardEnabled = raw.dashboardEnabled !== undefined ? raw.dashboardEnabled : (raw.DashboardEnabled !== undefined ? raw.DashboardEnabled : false);
    const fechaInicio = raw.fechaInicio || raw.FechaInicio || new Date().toISOString().slice(0, 10);
    const fechaFin = raw.fechaFin || raw.FechaFin || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    return {
        plan: plan,
        activo: activo,
        productosMax: productosMax,
        extrasEnabled: extrasEnabled,
        dashboardEnabled: dashboardEnabled,
        fechaInicio: fechaInicio,
        fechaFin: fechaFin
    };
}

function sincronizarSelectorPlan(suscripcion) {
    const select = document.getElementById('select-plan');
    if (select) {
        const plan = suscripcion.plan || suscripcion.Plan || 'basico';
        select.value = plan.toLowerCase();
    }
}

// ========== ACTUALIZAR PLAN (SOLO SUPER ADMIN) ==========
window.actualizarPlan = async function() {
    if (!window.currentUserIsSuperAdmin) {
        notificar("❌ No tienes permiso para cambiar planes de suscripción. Solo el Super Admin puede hacerlo.");
        return;
    }
    
    if (!clienteActualId) {
        alert("❌ No hay cliente seleccionado.");
        return;
    }

    const select = document.getElementById('select-plan');
    const nuevoPlan = select.value;
    const btn = document.getElementById('btn-actualizar-plan');
    const status = document.getElementById('plan-update-status');

    const planes = {
        'basico': { productosMax: 10, extrasEnabled: false, dashboardEnabled: false, label: 'Básico' },
        'pro': { productosMax: 50, extrasEnabled: true, dashboardEnabled: true, label: 'Pro' },
        'business': { productosMax: 9999, extrasEnabled: true, dashboardEnabled: true, label: 'Business' }
    };

    const planData = planes[nuevoPlan];
    if (!planData) {
        alert("❌ Plan no válido.");
        return;
    }

    const confirmar = confirm(
        `¿Estás seguro de que quieres cambiar el plan a "${planData.label}"?\n\n` +
        `Productos: ${planData.productosMax === 9999 ? '∞' : planData.productosMax}\n` +
        `Extras: ${planData.extrasEnabled ? '✅ Sí' : '❌ No'}\n` +
        `Dashboard: ${planData.dashboardEnabled ? '✅ Sí' : '❌ No'}`
    );
    if (!confirmar) return;

    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner animate-spin"></i> Actualizando...`;
    status.classList.remove('hidden');
    status.className = 'text-xs font-bold mt-2 text-blue-600';
    status.innerText = '🔄 Actualizando plan...';

    try {
        const docRef = doc(db, "artifacts", APP_ID, "public", "data", "clientes", clienteActualId);
        const now = new Date().toISOString().slice(0, 10);
        const fechaFin = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        await setDoc(docRef, {
            suscripcion: {
                plan: nuevoPlan,
                activo: true,
                fechaInicio: now,
                fechaFin: fechaFin,
                productosMax: planData.productosMax,
                extrasEnabled: planData.extrasEnabled,
                dashboardEnabled: planData.dashboardEnabled
            }
        }, { merge: true });

        await setDoc(docRef, { suscription: null }, { merge: true });

        window.suscripcionActual = {
            plan: nuevoPlan,
            activo: true,
            fechaInicio: now,
            fechaFin: fechaFin,
            productosMax: planData.productosMax,
            extrasEnabled: planData.extrasEnabled,
            dashboardEnabled: planData.dashboardEnabled
        };

        const planInfo = document.getElementById('plan-info');
        const planLimite = document.getElementById('plan-limite');
        const planEstado = document.getElementById('plan-estado');

        if (planInfo) {
            const planesDisplay = {
                'basico': 'Básico',
                'pro': 'Pro',
                'business': 'Business'
            };
            planInfo.innerText = planesDisplay[nuevoPlan] || 'Básico';
        }
        if (planLimite) {
            planLimite.innerText = planData.productosMax === 9999 ? '∞' : planData.productosMax;
        }
        if (planEstado) {
            planEstado.innerText = '✅ Activo';
            planEstado.className = 'text-sm font-bold text-emerald-600';
        }

        sincronizarSelectorPlan(window.suscripcionActual);

        status.className = 'text-xs font-bold mt-2 text-emerald-600';
        status.innerText = `✅ Plan actualizado a "${planData.label}" correctamente.`;

        notificar(`✅ Plan actualizado a "${planData.label}"`);

    } catch (error) {
        console.error("Error al actualizar plan:", error);
        status.className = 'text-xs font-bold mt-2 text-red-600';
        status.innerText = `❌ Error: ${error.message}`;
        alert("❌ Ocurrió un error al actualizar el plan.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-sync-alt"></i> Actualizar Plan`;
    }
};

// ==================== ACTIVAR / DESACTIVAR NEGOCIO ====================
window.toggleEstadoNegocio = async function() {
    if (!clienteActualId) {
        notificar("❌ No hay cliente seleccionado.");
        return;
    }

    if (!window.currentUserIsSuperAdmin) {
        notificar("❌ No tienes permiso para realizar esta acción.");
        return;
    }

    const btn = document.getElementById('btn-toggle-estado');
    const estadoLabel = document.getElementById('estado-negocio');
    const estadoActual = window.suscripcionActual?.activo !== false;

    const accion = estadoActual ? 'desactivar' : 'activar';
    const confirmar = confirm(
        `¿Estás seguro de que quieres ${accion} el negocio "${document.getElementById('biz-name').value || clienteActualId}"?\n\n` +
        (estadoActual 
            ? '⚠️ Al desactivar, el menú dejará de estar visible para los clientes.' 
            : '✅ Al activar, el menú volverá a estar disponible para los clientes.')
    );
    if (!confirmar) return;

    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner animate-spin mr-1"></i> Procesando...`;

    try {
        const docRef = doc(db, "artifacts", APP_ID, "public", "data", "clientes", clienteActualId);
        const nuevoEstado = !estadoActual;
        
        await setDoc(docRef, {
            suscripcion: {
                ...window.suscripcionActual,
                activo: nuevoEstado
            }
        }, { merge: true });

        window.suscripcionActual.activo = nuevoEstado;

        if (nuevoEstado) {
            estadoLabel.innerText = '✅ Activo';
            estadoLabel.className = 'text-sm font-black text-emerald-600';
            btn.innerHTML = '<i class="fas fa-power-off mr-1"></i> Desactivar';
            btn.className = 'px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all bg-red-600 hover:bg-red-700 text-white';
            notificar('✅ Negocio activado correctamente.');
        } else {
            estadoLabel.innerText = '❌ Inactivo';
            estadoLabel.className = 'text-sm font-black text-red-600';
            btn.innerHTML = '<i class="fas fa-power-off mr-1"></i> Activar';
            btn.className = 'px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all bg-emerald-600 hover:bg-emerald-700 text-white';
            notificar('✅ Negocio desactivado correctamente.');
        }

        window.cargarClienteParaEditar();

    } catch (error) {
        console.error("Error al cambiar estado:", error);
        notificar("❌ Error al cambiar el estado del negocio.");
    } finally {
        btn.disabled = false;
    }
};

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

function extrasArrayToString(arr) {
    const normalized = normalizeExtras(arr);
    if (normalized.length === 0) return '';
    return normalized.map(e => `${e.nombre} = ${e.precio}`).join(', ');
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function updateUnsavedIndicator() {
    const el = document.getElementById('unsaved-indicator');
    if (el) {
        if (dirty) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    }
}

// ==================== AUTENTICACIÓN ====================
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    const btn = document.getElementById('btn-login');

    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner animate-spin mr-2"></i>Verificando Credenciales...`;
    loginError.classList.add('hidden');

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        notificar("¡Bienvenido al sistema!");
    } catch (err) {
        console.error(err);
        loginError.innerText = "❌ Correo o contraseña incorrectos.";
        loginError.classList.remove('hidden');
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-sign-in-alt"></i> Entrar al Sistema`;
    }
});

// ==================== AUTH STATE + CLAIMS ====================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('seccion-login').classList.add('hidden');
        document.getElementById('seccion-dashboard').classList.remove('hidden');
        document.getElementById('user-display-email').innerText = user.email;

        try {
            const tokenResult = await user.getIdTokenResult();
            const claims = tokenResult.claims || {};
            
            const clientId = claims.clientId || null;
            const isSuperAdmin = claims.isSuperAdmin === true;

            window.currentUserClientId = clientId;
            window.currentUserIsSuperAdmin = isSuperAdmin;

            actualizarPermisosUI(isSuperAdmin);

            console.log("🔐 Usuario logueado:", {
                email: user.email,
                clientId: clientId,
                isSuperAdmin: isSuperAdmin
            });

            cargarListaClientes(clientId, isSuperAdmin);

        } catch (error) {
            console.error("Error al obtener claims:", error);
            window.currentUserClientId = null;
            window.currentUserIsSuperAdmin = false;
            actualizarPermisosUI(false);
            cargarListaClientes(null, false);
        }

    } else {
        document.getElementById('seccion-login').classList.remove('hidden');
        document.getElementById('seccion-dashboard').classList.add('hidden');
        window.currentUserClientId = null;
        window.currentUserIsSuperAdmin = false;
        actualizarPermisosUI(false);
    }
});

window.cerrarSesion = async () => {
    await signOut(auth);
    location.reload();
};

// ==================== CARGA DE CLIENTES (VERSIÓN MEJORADA) ====================
async function cargarListaClientes(clientId, isSuperAdmin) {
    console.log("🔄 cargarListaClientes - clientId:", clientId, "isSuperAdmin:", isSuperAdmin);
    const selector = document.getElementById('select-cliente');
    selector.innerHTML = '<option value="" disabled selected>Escoge un cliente...</option>';
    
    try {
        if (isSuperAdmin) {
            // SUPER ADMIN: leer TODA la colección
            console.log("👑 Super Admin: cargando todos los clientes");
            const clientesRef = collection(db, "artifacts", APP_ID, "public", "data", "clientes");
            const querySnapshot = await getDocs(clientesRef);
            let clientesCargados = 0;
            querySnapshot.forEach((doc) => {
                const clienteId = doc.id;
                const option = document.createElement('option');
                option.value = clienteId;
                option.textContent = clienteId.toUpperCase();
                selector.appendChild(option);
                clientesCargados++;
            });
            if (clientesCargados === 0) {
                selector.innerHTML = '<option value="" disabled selected>No hay clientes registrados</option>';
            } else {
                // Seleccionar el primero por defecto
                selector.value = selector.options[1]?.value || '';
                if (selector.value) {
                    window.cargarClienteParaEditar();
                }
            }
        } else {
            // ADMIN NORMAL: leer SOLO su propio cliente
            if (clientId) {
                console.log("👤 Admin normal: cargando su propio cliente:", clientId);
                const docRef = doc(db, "artifacts", APP_ID, "public", "data", "clientes", clientId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    console.log("✅ Documento encontrado para:", clientId);
                    const option = document.createElement('option');
                    option.value = clientId;
                    option.textContent = clientId.toUpperCase();
                    selector.appendChild(option);
                    selector.value = clientId;
                    // Cargar automáticamente su cliente
                    window.cargarClienteParaEditar();
                } else {
                    console.error("❌ Documento no existe para:", clientId);
                    selector.innerHTML = '<option value="" disabled selected>Tu cliente no existe</option>';
                }
            } else {
                console.warn("⚠️ Admin normal sin clientId asignado");
                selector.innerHTML = '<option value="" disabled selected>No tienes cliente asignado</option>';
            }
        }
    } catch (error) {
        console.error("❌ Error al cargar lista:", error);
        alert("No se pudo cargar la lista de clientes.");
    }
}

// ==================== GESTIÓN DE NEGOCIO (MEJORADA) ====================
window.cargarClienteParaEditar = async function() {
    const select = document.getElementById('select-cliente');
    clienteActualId = select.value;
    console.log("📋 cargarClienteParaEditar - clienteActualId:", clienteActualId);
    
    if (!clienteActualId) {
        console.warn("⚠️ No hay cliente seleccionado");
        return;
    }

    // Verificar permisos para admin normal
    if (!window.currentUserIsSuperAdmin && window.currentUserClientId) {
        if (clienteActualId !== window.currentUserClientId) {
            alert("❌ No tienes permiso para editar este cliente.");
            select.value = window.currentUserClientId;
            clienteActualId = window.currentUserClientId;
            // Reintentar con el cliente correcto
            this.cargarClienteParaEditar();
            return;
        }
    }

    const statusText = document.getElementById('status-carga');
    statusText.innerText = "Sincronizando Firestore...";

    try {
        const docRef = doc(db, "artifacts", APP_ID, "public", "data", "clientes", clienteActualId);
        const snap = await getDoc(docRef);
        console.log("📄 Documento obtenido:", snap.exists() ? "✅ Existe" : "❌ No existe");

        if (snap.exists()) {
            const data = snap.data();
            
            let productosCrudos = data.products || [];
            productosActuales = productosCrudos.map(p => ({
                id: p.id,
                name: p.name || '',
                price: p.price || 0,
                category: p.category || '',
                desc: p.desc || '',
                img: p.img || '',
                images: p.images || (p.img ? [p.img] : []),
                extras: normalizeExtras(p.extras),
                active: p.active !== undefined ? p.active : true,
                createdAt: p.createdAt || new Date().toISOString(),
                updatedAt: p.updatedAt || new Date().toISOString()
            }));

            const biz = data.business || {};
            document.getElementById('biz-name').value = biz.name || "";
            document.getElementById('biz-accent').value = biz.accent || "";
            document.getElementById('biz-whatsapp').value = biz.whatsapp || "";
            document.getElementById('biz-type').value = biz.type || "store";

            const exentoIVA = biz.exentoIVA === true || biz.exentoIVA === "true";
            document.getElementById('biz-exento-iva').checked = exentoIVA;

            document.getElementById('editor-title').innerText = `Gestión: ${biz.name || clienteActualId}`;
            
            const suscripcion = obtenerPlanCliente(data);
            window.suscripcionActual = suscripcion;

            const planInfo = document.getElementById('plan-info');
            const planLimite = document.getElementById('plan-limite');
            const planEstado = document.getElementById('plan-estado');

            if (planInfo) {
                const planes = {
                    'basico': 'Básico',
                    'pro': 'Pro',
                    'business': 'Business'
                };
                planInfo.innerText = planes[suscripcion.plan] || 'Básico';
            }
            if (planLimite) {
                planLimite.innerText = suscripcion.productosMax === 9999 ? '∞' : suscripcion.productosMax;
            }
            if (planEstado) {
                planEstado.innerText = suscripcion.activo ? '✅ Activo' : '❌ Inactivo';
                planEstado.className = `text-sm font-bold ${suscripcion.activo ? 'text-emerald-600' : 'text-red-600'}`;
            }

            sincronizarSelectorPlan(suscripcion);

            actualizarEstadisticas(biz.type, exentoIVA);
            renderTablaProductos();
            document.getElementById('zona-editor').classList.remove('hidden');
            statusText.innerText = "✅ Sincronizado";
            
            dirty = false;
            updateUnsavedIndicator();

            // ========== MOSTRAR ESTADO DE ACTIVACIÓN ==========
            const estadoNegocio = document.getElementById('estado-negocio');
            const btnToggle = document.getElementById('btn-toggle-estado');
            if (estadoNegocio && btnToggle) {
                if (suscripcion.activo) {
                    estadoNegocio.innerText = '✅ Activo';
                    estadoNegocio.className = 'text-sm font-black text-emerald-600';
                    btnToggle.innerHTML = '<i class="fas fa-power-off mr-1"></i> Desactivar';
                    btnToggle.className = 'px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all bg-red-600 hover:bg-red-700 text-white';
                } else {
                    estadoNegocio.innerText = '❌ Inactivo';
                    estadoNegocio.className = 'text-sm font-black text-red-600';
                    btnToggle.innerHTML = '<i class="fas fa-power-off mr-1"></i> Activar';
                    btnToggle.className = 'px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all bg-emerald-600 hover:bg-emerald-700 text-white';
                }
            }

            cargarEstadisticas(clienteActualId);
            cargarDatosReferidos(clienteActualId);
            cargarPedidos(clienteActualId);
        } else {
            statusText.innerText = "❌ ID no existe.";
            document.getElementById('zona-editor').classList.add('hidden');
        }
    } catch (error) {
        console.error("❌ Error al cargar cliente:", error);
        statusText.innerText = "❌ Error de conexión.";
        alert("No se pudo cargar el cliente. Verifica la consola para más detalles.");
    }
};

// ==================== ESTADÍSTICAS ====================
function actualizarEstadisticas(type, exentoIVA = false) {
    document.getElementById('stat-productos').innerText = productosActuales.length;
    
    // ========== NOMBRES AMIGABLES PARA CADA TIPO ==========
    const nombresTipos = {
        fastfood: 'Comida Rápida',
        restaurant: 'Restaurante Elegante',
        gourmet: 'Gourmet',
        pizzeria: 'Pizzería',
        cafe: 'Cafetería',
        mariscos: 'Mariscos',
        parts: 'Ferretería',
        bakery: 'Repostería',
        store: 'Tienda'
    };
    document.getElementById('stat-estilo').innerText = nombresTipos[type] || type || "store";
    // ======================================================
    
    const ivaEl = document.getElementById('stat-iva');
    if (ivaEl) {
        if (exentoIVA === true || exentoIVA === "true") {
            ivaEl.innerText = "✅ Exento";
            ivaEl.className = "block text-xs font-black text-emerald-600 uppercase";
        } else {
            ivaEl.innerText = "💰 Con IVA";
            ivaEl.className = "block text-xs font-black text-amber-600 uppercase";
        }
    }
}
async function cargarEstadisticas(clienteId) {
    const seccionEstadisticas = document.getElementById('seccion-estadisticas');
    if (!clienteId) {
        if (seccionEstadisticas) seccionEstadisticas.classList.add('hidden');
        return;
    }

    try {
        const pedidosRef = collection(db, "artifacts", APP_ID, "public", "data", "pedidos");
        const q = query(pedidosRef, where("clienteId", "==", clienteId));
        const snapshot = await getDocs(q);

        const seccion = document.getElementById('seccion-estadisticas');
        if (!seccion) return;

        if (snapshot.empty) {
            document.getElementById('stat-total-pedidos').innerText = '0';
            document.getElementById('stat-ingresos-usd').innerText = '$0.00';
            document.getElementById('stat-ingresos-bs').innerText = '0,00 Bs';
            document.getElementById('stat-productos-unicos').innerText = '0';
            document.getElementById('tabla-top-productos').innerHTML = `<tr><td colspan="3" class="p-6 text-center text-slate-300 text-xs font-bold">Sin pedidos aún</td></tr>`;
            document.getElementById('tabla-top-extras').innerHTML = `<tr><td colspan="2" class="p-6 text-center text-slate-300 text-xs font-bold">Sin datos aún</td></tr>`;
            seccion.classList.remove('hidden');
            return;
        }

        let totalPedidos = 0;
        let ingresosUSD = 0;
        let ingresosBS = 0;
        const productosMap = {};
        const extrasMap = {};

        snapshot.forEach(doc => {
            const pedido = doc.data();
            totalPedidos++;
            ingresosUSD += pedido.totalUSD || 0;
            ingresosBS += pedido.totalBS || 0;

            (pedido.items || []).forEach(item => {
                const nombre = item.nombre || 'Sin nombre';
                if (!productosMap[nombre]) {
                    productosMap[nombre] = { cantidad: 0, ingresos: 0 };
                }
                productosMap[nombre].cantidad += item.cantidad || 0;
                productosMap[nombre].ingresos += item.subtotal || 0;

                (item.extras || []).forEach(extra => {
                    const extraNombre = extra.nombre || 'Extra';
                    if (!extrasMap[extraNombre]) {
                        extrasMap[extraNombre] = 0;
                    }
                    extrasMap[extraNombre] += item.cantidad || 0;
                });
            });
        });

        document.getElementById('stat-total-pedidos').innerText = totalPedidos;
        document.getElementById('stat-ingresos-usd').innerText = `$${ingresosUSD.toFixed(2)}`;
        document.getElementById('stat-ingresos-bs').innerText = `${ingresosBS.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs`;
        document.getElementById('stat-productos-unicos').innerText = Object.keys(productosMap).length;

        const topProductos = Object.entries(productosMap)
            .sort((a, b) => b[1].cantidad - a[1].cantidad)
            .slice(0, 5);

        const tablaProductos = document.getElementById('tabla-top-productos');
        if (topProductos.length === 0) {
            tablaProductos.innerHTML = `<tr><td colspan="3" class="p-6 text-center text-slate-300 text-xs font-bold">Sin datos aún</td></tr>`;
        } else {
            tablaProductos.innerHTML = topProductos.map(([nombre, data]) => `
                <tr class="border-b border-slate-100">
                    <td class="p-3 font-bold text-slate-700">${escapeHtml(nombre)}</td>
                    <td class="p-3 text-center">${data.cantidad}</td>
                    <td class="p-3 text-right font-bold text-emerald-600">$${data.ingresos.toFixed(2)}</td>
                </tr>
            `).join('');
        }

        const topExtras = Object.entries(extrasMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        const tablaExtras = document.getElementById('tabla-top-extras');
        if (topExtras.length === 0) {
            tablaExtras.innerHTML = `<tr><td colspan="2" class="p-6 text-center text-slate-300 text-xs font-bold">Sin datos aún</td></tr>`;
        } else {
            tablaExtras.innerHTML = topExtras.map(([nombre, cantidad]) => `
                <tr class="border-b border-slate-100">
                    <td class="p-3 font-bold text-slate-700">${escapeHtml(nombre)}</td>
                    <td class="p-3 text-center">${cantidad}</td>
                </tr>
            `).join('');
        }

        seccion.classList.remove('hidden');

    } catch (error) {
        console.error("Error al cargar estadísticas:", error);
        const seccion = document.getElementById('seccion-estadisticas');
        if (seccion) {
            seccion.innerHTML = `<div class="p-6 text-center text-red-500 font-bold">Error al cargar estadísticas. Intenta de nuevo.</div>`;
            seccion.classList.remove('hidden');
        }
    }
}

// ==================== REFERIDOS ====================
async function cargarDatosReferidos(clienteId) {
    if (!clienteId) {
        document.getElementById('seccion-referidos').classList.add('hidden');
        return;
    }

    try {
        const docRef = doc(db, "artifacts", APP_ID, "public", "data", "clientes", clienteId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
            document.getElementById('seccion-referidos').classList.add('hidden');
            return;
        }

        const data = snap.data();
        let referidos = data.referidos || {};

        if (!referidos.codigo) {
            const codigo = await generarCodigoReferido(clienteId);
            referidos.codigo = codigo;
            await setDoc(docRef, { referidos }, { merge: true });
        }

        document.getElementById('codigo-referido').innerText = referidos.codigo;

        const activos = referidos.referidosActivos || [];
        const pendientes = referidos.referidosPendientes || [];
        document.getElementById('stat-referidos-activos').innerText = activos.length;
        document.getElementById('stat-referidos-pendientes').innerText = pendientes.length;

        const mesesGratis = referidos.mesesGratisAcumulados || 0;
        document.getElementById('stat-meses-gratis').innerText = mesesGratis;

        const progreso = Math.min((mesesGratis / 6) * 100, 100);
        document.getElementById('barra-meses-gratis').style.width = `${progreso}%`;

        const tabla = document.getElementById('tabla-referidos');
        if (activos.length === 0 && pendientes.length === 0) {
            tabla.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-300 text-xs font-bold">Sin referidos aún</td></tr>`;
        } else {
            let filas = '';
            activos.forEach(id => {
                filas += `<tr class="border-b border-slate-100">
                    <td class="p-3 font-bold text-slate-700">${escapeHtml(id)}</td>
                    <td class="p-3"><span class="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-[10px] font-bold">Activo</span></td>
                    <td class="p-3 text-slate-500">-</td>
                    <td class="p-3 text-emerald-600 font-bold">+2 meses gratis</td>
                </tr>`;
            });
            pendientes.forEach(id => {
                filas += `<tr class="border-b border-slate-100">
                    <td class="p-3 font-bold text-slate-700">${escapeHtml(id)}</td>
                    <td class="p-3"><span class="bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-[10px] font-bold">Pendiente</span></td>
                    <td class="p-3 text-slate-500">-</td>
                    <td class="p-3 text-slate-400">En espera</td>
                </tr>`;
            });
            tabla.innerHTML = filas;
        }

        document.getElementById('seccion-referidos').classList.remove('hidden');

    } catch (error) {
        console.error("Error al cargar referidos:", error);
        document.getElementById('seccion-referidos').classList.add('hidden');
    }
}

async function generarCodigoReferido(clienteId) {
    const base = clienteId.slice(0, 4).toUpperCase();
    const aleatorio = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `REF-${base}-${aleatorio}`;
}

window.copiarCodigoReferido = function() {
    const codigo = document.getElementById('codigo-referido').innerText;
    if (codigo && codigo !== 'REF-XXXX-XXXX') {
        navigator.clipboard.writeText(codigo).then(() => {
            notificar("✅ Código copiado al portapapeles");
        }).catch(() => {
            const input = document.createElement('input');
            input.value = codigo;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            notificar("✅ Código copiado al portapapeles");
        });
    } else {
        notificar("⚠️ No hay código para copiar");
    }
};

// ==================== FUNCIONES DE SUBIDA DE IMÁGENES ====================

// ====== SELECCIONAR MÚLTIPLES ARCHIVOS ======
window.seleccionarMultiplesArchivos = function(input) {
    const files = input.files;
    if (!files || files.length === 0) return;
    
    if (files.length > 5) {
        notificar("⚠️ Máximo 5 imágenes por producto");
        input.value = '';
        return;
    }
    
    archivosMultiples = Array.from(files);
    
    const container = document.getElementById('preview-multi-container');
    container.innerHTML = '';
    
    archivosMultiples.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const div = document.createElement('div');
            div.className = 'relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200';
            div.innerHTML = `
                <img src="${e.target.result}" class="w-full h-full object-cover">
                <span class="absolute bottom-0 right-0 bg-black/70 text-white text-[8px] px-1 rounded-tl">${index + 1}</span>
            `;
            container.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
    
    document.getElementById('btn-upload-images').disabled = false;
    document.getElementById('upload-status').classList.add('hidden');
};

// ====== SUBIR IMÁGENES A IMGBB ======
window.subirMultiplesImagenes = async function() {
    if (!archivosMultiples || archivosMultiples.length === 0) {
        notificar("⚠️ Selecciona imágenes primero");
        return;
    }

    const btn = document.getElementById('btn-upload-images');
    const status = document.getElementById('upload-status');
    const urls = [];

    btn.disabled = true;
    status.classList.remove('hidden');

    try {
        for (let i = 0; i < archivosMultiples.length; i++) {
            const file = archivosMultiples[i];
            status.innerText = `🔄 Subiendo imagen ${i+1}/${archivosMultiples.length}...`;
            
            const formData = new FormData();
            formData.append('key', IMGBB_API_KEY);
            formData.append('image', file);

            const response = await fetch('https://api.imgbb.com/1/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error?.message || 'Error al subir imagen');
            }

            urls.push(data.data.url);
            status.innerText = `✅ ${urls.length}/${archivosMultiples.length} subidas...`;
            
            if (i < archivosMultiples.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        document.getElementById('new-p-images').value = JSON.stringify(urls);
        
        const container = document.getElementById('preview-multi-container');
        container.innerHTML = urls.map((url, i) => `
            <div class="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-emerald-400">
                <img src="${url}" class="w-full h-full object-cover">
                <span class="absolute bottom-0 right-0 bg-emerald-600 text-white text-[8px] px-1 rounded-tl">✅</span>
            </div>
        `).join('');

        status.innerText = `✅ ${urls.length} imágenes subidas a ImgBB`;
        notificar(`✅ ${urls.length} imágenes subidas exitosamente`);

        document.getElementById('new-p-files').value = '';
        archivosMultiples = [];

    } catch (error) {
        console.error("Error al subir imágenes:", error);
        status.innerText = `❌ Error: ${error.message}`;
        notificar(`❌ Error al subir imágenes: ${error.message}`);
    } finally {
        btn.disabled = true;
        setTimeout(() => {
            status.classList.add('hidden');
        }, 3000);
    }
};

// ====== LIMPIAR IMÁGENES ======
window.limpiarImagenes = function() {
    document.getElementById('new-p-images').value = '';
    document.getElementById('preview-multi-container').innerHTML = '';
    document.getElementById('new-p-files').value = '';
    archivosMultiples = [];
    document.getElementById('btn-upload-images').disabled = true;
    document.getElementById('upload-status').classList.add('hidden');
};

// ====== SELECCIONAR MÚLTIPLES ARCHIVOS (EDITAR) ======
window.seleccionarMultiplesArchivosEdit = function(input) {
    const files = input.files;
    if (!files || files.length === 0) return;
    
    if (files.length > 5) {
        notificar("⚠️ Máximo 5 imágenes por producto");
        input.value = '';
        return;
    }
    
    editArchivosMultiples = Array.from(files);
    
    const container = document.getElementById('edit-preview-multi-container');
    container.innerHTML = '';
    
    editArchivosMultiples.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const div = document.createElement('div');
            div.className = 'relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200';
            div.innerHTML = `
                <img src="${e.target.result}" class="w-full h-full object-cover">
                <span class="absolute bottom-0 right-0 bg-black/70 text-white text-[8px] px-1 rounded-tl">${index + 1}</span>
            `;
            container.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
    
    document.getElementById('btn-edit-upload-images').disabled = false;
    document.getElementById('edit-upload-status').classList.add('hidden');
};

// ====== SUBIR IMÁGENES (EDITAR) ======
window.subirMultiplesImagenesEdit = async function() {
    if (!editArchivosMultiples || editArchivosMultiples.length === 0) {
        notificar("⚠️ Selecciona imágenes primero");
        return;
    }

    const btn = document.getElementById('btn-edit-upload-images');
    const status = document.getElementById('edit-upload-status');
    const urls = [];

    btn.disabled = true;
    status.classList.remove('hidden');

    try {
        for (let i = 0; i < editArchivosMultiples.length; i++) {
            const file = editArchivosMultiples[i];
            status.innerText = `🔄 Subiendo imagen ${i+1}/${editArchivosMultiples.length}...`;
            
            const formData = new FormData();
            formData.append('key', IMGBB_API_KEY);
            formData.append('image', file);

            const response = await fetch('https://api.imgbb.com/1/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error?.message || 'Error al subir imagen');
            }

            urls.push(data.data.url);
            status.innerText = `✅ ${urls.length}/${editArchivosMultiples.length} subidas...`;
            
            if (i < editArchivosMultiples.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        editImagenesExistentes = [...editImagenesExistentes, ...urls];
        
        const existingContainer = document.getElementById('edit-p-existing-images');
        existingContainer.innerHTML = editImagenesExistentes.map((url, i) => `
            <div class="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 group">
                <img src="${url}" class="w-full h-full object-cover">
                <button onclick="window.eliminarImagenExistente(${i})" class="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        document.getElementById('edit-preview-multi-container').innerHTML = '';
        status.innerText = `✅ ${urls.length} imágenes agregadas`;
        notificar(`✅ ${urls.length} imágenes agregadas`);

        document.getElementById('edit-p-files').value = '';
        editArchivosMultiples = [];

    } catch (error) {
        console.error("Error al subir imágenes:", error);
        status.innerText = `❌ Error: ${error.message}`;
        notificar(`❌ Error: ${error.message}`);
    } finally {
        btn.disabled = true;
        setTimeout(() => {
            status.classList.add('hidden');
        }, 3000);
    }
};

// ====== LIMPIAR IMÁGENES (EDITAR) ======
window.limpiarImagenesEdit = function() {
    document.getElementById('edit-p-new-images').value = '';
    document.getElementById('edit-preview-multi-container').innerHTML = '';
    document.getElementById('edit-p-files').value = '';
    editArchivosMultiples = [];
    document.getElementById('btn-edit-upload-images').disabled = true;
    document.getElementById('edit-upload-status').classList.add('hidden');
};

// ==================== RENDERIZADO DE PRODUCTOS ====================
function renderTablaProductos() {
    const container = document.getElementById('tabla-productos-body');
    if (productosActuales.length === 0) {
        container.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-300 uppercase text-xs font-black">Sin Productos</td></tr>`;
        return;
    }
    
    container.innerHTML = productosActuales.map((p, index) => {
        const extrasNormalizados = normalizeExtras(p.extras);
        const extrasStr = extrasArrayToString(extrasNormalizados);
        const cantImagenes = (p.images && p.images.length > 0) ? p.images.length : (p.img ? 1 : 0);
        
        return `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
            <td class="p-3">
                <input type="text" value="${escapeHtml(p.name)}" 
                    onchange="window.actualizarDatoProducto(${index}, 'name', this.value)"
                    class="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 font-bold text-slate-800 text-xs w-full py-1 focus:bg-white px-1 outline-none uppercase transition-all">
                ${cantImagenes > 0 ? `<span class="text-[8px] text-emerald-500 block">📸 ${cantImagenes} imagen(es)</span>` : ''}
            </td>
            <td class="p-3">
                <input type="text" value="${escapeHtml(p.category)}" 
                    onchange="window.actualizarDatoProducto(${index}, 'category', this.value)"
                    class="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 font-bold text-slate-400 text-[10px] w-full py-1 focus:bg-white px-1 outline-none uppercase transition-all">
            </td>
            <td class="p-3">
                <input type="number" step="0.01" value="${escapeHtml(p.price)}" 
                    onchange="window.actualizarDatoProducto(${index}, 'price', this.value)"
                    class="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 font-black text-slate-900 text-xs py-1 focus:bg-white px-1 outline-none transition-all">
            </td>
            <td class="p-3">
                <input type="text" value="${escapeHtml(p.desc || '')}" 
                    onchange="window.actualizarDatoProducto(${index}, 'desc', this.value)"
                    placeholder="Breve descripción del producto..."
                    class="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 font-medium text-slate-500 text-[11px] w-full py-1 focus:bg-white px-1 outline-none transition-all">
            </td>
            <td class="p-3">
                <input type="text" value="${escapeHtml(extrasStr)}" 
                    onchange="window.actualizarDatoProducto(${index}, 'extras', this.value)"
                    placeholder="Ej: Con Caja = 1.50, Extra = 1.00"
                    class="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 font-medium text-slate-500 text-[11px] w-full py-1 focus:bg-white px-1 outline-none transition-all">
            </td>
            <td class="p-3 text-center">
                <div class="flex items-center justify-center gap-1">
                    <button onclick="window.abrirModalEditarProducto(${index})" class="text-blue-500 hover:text-blue-700 p-2 text-sm active:scale-90 transition-all" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="window.eliminarProducto(${index})" class="text-red-500 hover:text-red-700 p-2 text-sm active:scale-90 transition-all" title="Eliminar">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

// ==================== CRUD DE PRODUCTOS ====================
window.actualizarDatoProducto = (index, campo, valor) => {
    const producto = productosActuales[index];
    if (!producto) return;
    
    if (campo === 'price') {
        producto[campo] = Number(valor);
    } else if (campo === 'extras') {
        producto[campo] = normalizeExtras(valor);
    } else {
        producto[campo] = valor;
    }
    
    dirty = true;
    updateUnsavedIndicator();
    
    actualizarEstadisticas(document.getElementById('biz-type').value);
};

// ==================== NUEVO PRODUCTO ====================
window.abrirModalNuevoProducto = () => {
    document.getElementById('modal-producto').classList.remove('hidden');
    document.getElementById('new-p-images').value = '';
    document.getElementById('preview-multi-container').innerHTML = '';
    document.getElementById('new-p-files').value = '';
    archivosMultiples = [];
    document.getElementById('btn-upload-images').disabled = true;
};

window.cerrarModalNuevoProducto = () => {
    document.getElementById('modal-producto').classList.add('hidden');
    document.getElementById('new-p-name').value = "";
    document.getElementById('new-p-cat').value = "";
    document.getElementById('new-p-price').value = "";
    document.getElementById('new-p-desc').value = "";
    document.getElementById('new-p-files').value = "";
    document.getElementById('new-p-images').value = "";
    document.getElementById('new-p-extras').value = "";
    document.getElementById('preview-multi-container').innerHTML = '';
    archivosMultiples = [];
    document.getElementById('btn-upload-images').disabled = true;
    document.getElementById('upload-status').classList.add('hidden');
};

window.confirmarNuevoProducto = () => {
    const suscripcion = window.suscripcionActual || { productosMax: 10 };
    const limite = suscripcion.productosMax || 10;

    if (productosActuales.length >= limite) {
        const mensaje = limite === 9999 
            ? 'Tu plan Business no tiene límite de productos.'
            : `❌ Has alcanzado el límite de ${limite} productos de tu plan.\n` +
              `Contacta al administrador para actualizar tu plan.`;
        alert(mensaje);
        return;
    }

    const name = document.getElementById('new-p-name').value.trim();
    const category = document.getElementById('new-p-cat').value.trim();
    const price = parseFloat(document.getElementById('new-p-price').value);
    const desc = document.getElementById('new-p-desc').value.trim();
    const extrasRaw = document.getElementById('new-p-extras').value.trim();
    const extras = normalizeExtras(extrasRaw);
    
    let images = [];
    const imagesField = document.getElementById('new-p-images').value;
    if (imagesField) {
        try {
            images = JSON.parse(imagesField);
        } catch(e) {
            images = [];
        }
    }
    
    if (images.length === 0) {
        images = ["https://placehold.co/400x400/f8fafc/64748b?text=Sin+Imagen"];
    }

    if (!name) { alert("❌ El nombre del producto es obligatorio."); return; }
    if (!category) { alert("❌ La categoría es obligatoria."); return; }
    if (isNaN(price) || price <= 0) { alert("❌ El precio debe ser un número mayor que 0."); return; }

    const id = 'prod_' + Math.random().toString(36).slice(2, 11);
    const now = new Date().toISOString();
    
    productosActuales.push({
        id,
        name,
        price,
        category,
        desc,
        img: images[0],
        images: images,
        extras,
        active: true,
        createdAt: now,
        updatedAt: now
    });

    dirty = true;
    updateUnsavedIndicator();
    renderTablaProductos();
    actualizarEstadisticas(document.getElementById('biz-type').value);
    window.cerrarModalNuevoProducto();
    notificar("✅ Producto añadido a la lista");
};

// ==================== EDITAR PRODUCTO ====================
window.abrirModalEditarProducto = function(index) {
    const producto = productosActuales[index];
    if (!producto) return;
    
    editProductIndex = index;
    editImagenesExistentes = producto.images && producto.images.length > 0 ? [...producto.images] : (producto.img ? [producto.img] : []);
    
    document.getElementById('edit-product-index').value = index;
    document.getElementById('edit-p-name').value = producto.name || '';
    document.getElementById('edit-p-cat').value = producto.category || '';
    document.getElementById('edit-p-price').value = producto.price || '';
    document.getElementById('edit-p-desc').value = producto.desc || '';
    document.getElementById('edit-p-extras').value = extrasArrayToString(producto.extras) || '';
    
    const container = document.getElementById('edit-p-existing-images');
    container.innerHTML = editImagenesExistentes.map((url, i) => `
        <div class="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 group">
            <img src="${url}" class="w-full h-full object-cover">
            <button onclick="window.eliminarImagenExistente(${i})" class="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
    
    document.getElementById('edit-p-new-images').value = '';
    document.getElementById('edit-preview-multi-container').innerHTML = '';
    document.getElementById('edit-p-files').value = '';
    editArchivosMultiples = [];
    document.getElementById('btn-edit-upload-images').disabled = true;
    document.getElementById('edit-upload-status').classList.add('hidden');
    
    document.getElementById('modal-editar-producto').classList.remove('hidden');
};

window.cerrarModalEditarProducto = function() {
    document.getElementById('modal-editar-producto').classList.add('hidden');
    editProductIndex = -1;
    editImagenesExistentes = [];
    editArchivosMultiples = [];
};

window.eliminarImagenExistente = function(index) {
    if (editImagenesExistentes.length <= 1) {
        notificar("⚠️ Debes mantener al menos una imagen");
        return;
    }
    editImagenesExistentes.splice(index, 1);
    const container = document.getElementById('edit-p-existing-images');
    container.innerHTML = editImagenesExistentes.map((url, i) => `
        <div class="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 group">
            <img src="${url}" class="w-full h-full object-cover">
            <button onclick="window.eliminarImagenExistente(${i})" class="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
};

window.guardarEdicionProducto = function() {
    const index = parseInt(document.getElementById('edit-product-index').value);
    if (isNaN(index) || index < 0 || index >= productosActuales.length) {
        alert("❌ Producto no encontrado");
        return;
    }

    const name = document.getElementById('edit-p-name').value.trim();
    const category = document.getElementById('edit-p-cat').value.trim();
    const price = parseFloat(document.getElementById('edit-p-price').value);
    const desc = document.getElementById('edit-p-desc').value.trim();
    const extrasRaw = document.getElementById('edit-p-extras').value.trim();
    const extras = normalizeExtras(extrasRaw);

    if (!name) { alert("❌ El nombre del producto es obligatorio."); return; }
    if (!category) { alert("❌ La categoría es obligatoria."); return; }
    if (isNaN(price) || price <= 0) { alert("❌ El precio debe ser un número mayor que 0."); return; }

    const producto = productosActuales[index];
    producto.name = name;
    producto.category = category;
    producto.price = price;
    producto.desc = desc;
    producto.extras = extras;
    producto.images = editImagenesExistentes;
    producto.img = editImagenesExistentes[0] || '';
    producto.updatedAt = new Date().toISOString();

    dirty = true;
    updateUnsavedIndicator();
    renderTablaProductos();
    actualizarEstadisticas(document.getElementById('biz-type').value);
    window.cerrarModalEditarProducto();
    notificar("✅ Producto actualizado");
};

window.eliminarProducto = (index) => {
    const p = productosActuales[index];
    if (!p) return;
    if (confirm(`¿Estás seguro de que quieres eliminar "${p.name}"?`)) {
        productosActuales.splice(index, 1);
        dirty = true;
        updateUnsavedIndicator();
        renderTablaProductos();
        actualizarEstadisticas(document.getElementById('biz-type').value);
        notificar("Producto removido de la lista");
    }
};

// ==================== GUARDAR EN FIRESTORE ====================
window.guardarCambiosFirestore = async () => {
    if (!window.currentUserIsSuperAdmin && window.currentUserClientId) {
        clienteActualId = window.currentUserClientId;
        document.getElementById('select-cliente').value = clienteActualId;
    }
    if (!clienteActualId) {
        alert("❌ No hay cliente seleccionado.");
        return;
    }

    const btn = document.getElementById('btn-guardar');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i class="fas fa-spinner animate-spin"></i> Guardando...`;
    btn.disabled = true;

    const name = document.getElementById('biz-name').value;
    const accent = document.getElementById('biz-accent').value;
    const whatsapp = document.getElementById('biz-whatsapp').value;
    const type = document.getElementById('biz-type').value;
    const exentoIVA = document.getElementById('biz-exento-iva').checked;

    const now = new Date().toISOString();
    
    const productosParaGuardar = productosActuales.map(p => ({
        id: p.id,
        name: p.name || '',
        price: p.price || 0,
        category: p.category || '',
        desc: p.desc || '',
        img: p.img || '',
        images: p.images && p.images.length > 0 ? p.images : [p.img || ''],
        extras: normalizeExtras(p.extras),
        active: p.active !== undefined ? p.active : true,
        createdAt: p.createdAt || now,
        updatedAt: now
    }));

    try {
        const docRef = doc(db, "artifacts", APP_ID, "public", "data", "clientes", clienteActualId);
        await setDoc(docRef, {
            business: { name, accent, whatsapp, type, exentoIVA },
            products: productosParaGuardar
        }, { merge: true });

        dirty = false;
        updateUnsavedIndicator();
        notificar("✅ ¡Cambios guardados exitosamente!");
    } catch (error) {
        console.error("Error al guardar:", error);
        alert("Ocurrió un error al intentar guardar los datos.");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

// ==================== REGISTRO DE NUEVO CLIENTE (SOLO SUPER ADMIN) ====================

let qrCodeInstance = null;

window.abrirModalRegistroCliente = function() {
    if (!window.currentUserIsSuperAdmin) {
        notificar("❌ No tienes permiso para registrar nuevos clientes. Solo el Super Admin puede hacerlo.");
        return;
    }

    document.getElementById('reg-cliente-id').value = '';
    document.getElementById('reg-nombre').value = '';
    document.getElementById('reg-accent').value = '';
    document.getElementById('reg-whatsapp').value = '';
    document.getElementById('reg-type').value = 'food';
    document.getElementById('reg-exento-iva').checked = false;
    document.getElementById('reg-codigo-referido').value = '';
    document.getElementById('qr-registro-container').classList.add('hidden');
    document.getElementById('qr-registro').innerHTML = '';
    qrCodeInstance = null;
    document.getElementById('modal-registro-cliente').classList.remove('hidden');
};

window.cerrarModalRegistroCliente = function() {
    document.getElementById('modal-registro-cliente').classList.add('hidden');
};

window.registrarCliente = async function() {
    if (!window.currentUserIsSuperAdmin) {
        notificar("❌ No tienes permiso para registrar nuevos clientes. Solo el Super Admin puede hacerlo.");
        return;
    }

    const btn = document.querySelector('#modal-registro-cliente button:last-child');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner animate-spin mr-1"></i> Registrando...';

    try {
        const clienteId = document.getElementById('reg-cliente-id').value.trim().toLowerCase().replace(/\s/g, '');
        const nombre = document.getElementById('reg-nombre').value.trim();
        const accent = document.getElementById('reg-accent').value.trim();
        const whatsapp = document.getElementById('reg-whatsapp').value.trim().replace(/\D/g, '');
        const type = document.getElementById('reg-type').value;
        const exentoIVA = document.getElementById('reg-exento-iva').checked;
        const codigoReferido = document.getElementById('reg-codigo-referido').value.trim().toUpperCase();

        if (!clienteId) { alert("❌ El ID del cliente es obligatorio."); btn.disabled = false; btn.innerHTML = originalText; return; }
        if (!/^[a-z0-9]+$/.test(clienteId)) { alert("❌ El ID solo puede contener letras minúsculas y números (sin espacios)."); btn.disabled = false; btn.innerHTML = originalText; return; }
        if (!nombre) { alert("❌ El nombre del negocio es obligatorio."); btn.disabled = false; btn.innerHTML = originalText; return; }
        if (!accent) { alert("❌ La palabra resaltada es obligatoria."); btn.disabled = false; btn.innerHTML = originalText; return; }
        if (!whatsapp || whatsapp.length < 10) { alert("❌ Ingresa un número de WhatsApp válido (solo dígitos)."); btn.disabled = false; btn.innerHTML = originalText; return; }

        const docRef = doc(db, "artifacts", APP_ID, "public", "data", "clientes", clienteId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            alert("❌ El ID '" + clienteId + "' ya está en uso. Elige otro.");
            btn.disabled = false; btn.innerHTML = originalText; return;
        }

        let referenteId = null;
        if (codigoReferido) {
            const clientesRef = collection(db, "artifacts", APP_ID, "public", "data", "clientes");
            const q = query(clientesRef, where("referidos.codigo", "==", codigoReferido));
            const querySnap = await getDocs(q);
            if (!querySnap.empty) {
                referenteId = querySnap.docs[0].id;
            } else {
                alert("⚠️ El código de referido no es válido. Se registrará sin referido.");
            }
        }

        const nuevoCodigo = await generarCodigoReferido(clienteId);

        const newClientData = {
            business: {
                name: nombre,
                accent: accent,
                whatsapp: whatsapp,
                type: type,
                exentoIVA: exentoIVA
            },
            products: [],
            referidos: {
                codigo: nuevoCodigo,
                referidosActivos: [],
                referidosPendientes: [],
                mesesGratisAcumulados: 0,
                mesesGratisUsados: 0
            },
            suscripcion: {
                plan: 'basico',
                activo: true,
                fechaInicio: new Date().toISOString().slice(0, 10),
                fechaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                productosMax: 10,
                extrasEnabled: false,
                dashboardEnabled: false
            }
        };

        await setDoc(docRef, newClientData);
        console.log("✅ Cliente registrado:", clienteId);

        if (referenteId) {
            const referenteRef = doc(db, "artifacts", APP_ID, "public", "data", "clientes", referenteId);
            const referenteSnap = await getDoc(referenteRef);
            if (referenteSnap.exists()) {
                const referenteData = referenteSnap.data();
                const pendientes = referenteData.referidos?.referidosPendientes || [];
                if (!pendientes.includes(clienteId)) {
                    pendientes.push(clienteId);
                    await setDoc(referenteRef, {
                        referidos: {
                            ...(referenteData.referidos || {}),
                            referidosPendientes: pendientes
                        }
                    }, { merge: true });
                    console.log("🔗 Cliente asociado al referente:", referenteId);
                }
            }
        }

        const qrContainer = document.getElementById('qr-registro');
        qrContainer.innerHTML = '';
        const qrUrl = `https://digitaliza-urpin.web.app/${clienteId}`;
        
        if (typeof QRCode !== 'undefined') {
            qrCodeInstance = new QRCode(qrContainer, {
                text: qrUrl,
                width: 200,
                height: 200,
                colorDark: '#1e293b',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            });
        } else {
            qrContainer.innerHTML = `<p class="text-xs text-slate-500">QR: ${qrUrl}</p>`;
        }

        document.getElementById('qr-registro-url').innerText = qrUrl;
        document.getElementById('qr-registro-container').classList.remove('hidden');

        await cargarListaClientes(window.currentUserClientId, window.currentUserIsSuperAdmin);

        notificar(`✅ Cliente "${nombre}" registrado correctamente. QR generado.`);

        document.getElementById('reg-cliente-id').value = '';
        document.getElementById('reg-nombre').value = '';
        document.getElementById('reg-accent').value = '';
        document.getElementById('reg-whatsapp').value = '';
        document.getElementById('reg-codigo-referido').value = '';

    } catch (error) {
        console.error("Error al registrar cliente:", error);
        alert("❌ Ocurrió un error al registrar el cliente: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};

window.descargarQRRegistro = function() {
    const qrContainer = document.getElementById('qr-registro');
    const canvas = qrContainer.querySelector('canvas');
    if (canvas) {
        const link = document.createElement('a');
        link.download = `qr_${document.getElementById('reg-cliente-id').value || 'cliente'}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } else {
        notificar("⚠️ No hay QR para descargar.");
    }
};

// ==================== PEDIDOS ====================

let pedidosCache = [];
let filtroActualPedidos = 'todos';

async function cargarPedidos(clienteId) {
    if (!clienteId) {
        document.getElementById('seccion-pedidos').classList.add('hidden');
        return;
    }

    try {
        const seccion = document.getElementById('seccion-pedidos');
        const container = document.getElementById('lista-pedidos');
        
        seccion.classList.remove('hidden');
        container.innerHTML = `<div class="text-center text-slate-400 text-xs font-bold uppercase py-12">
            <i class="fas fa-spinner animate-spin text-2xl block mb-4"></i>
            Cargando pedidos...
        </div>`;

        const pedidosRef = collection(db, "artifacts", APP_ID, "public", "data", "pedidos");
        const q = query(pedidosRef, where("clienteId", "==", clienteId));
        const snapshot = await getDocs(q);

        pedidosCache = [];
        snapshot.forEach(doc => {
            const pedido = doc.data();
            pedido.id = doc.id;
            pedidosCache.push(pedido);
        });

        pedidosCache.sort((a, b) => {
            if (!a.fecha) return 1;
            if (!b.fecha) return -1;
            return new Date(b.fecha) - new Date(a.fecha);
        });

        renderPedidos(pedidosCache);

    } catch (error) {
        console.error("Error al cargar pedidos:", error);
        document.getElementById('lista-pedidos').innerHTML = `
            <div class="text-center text-red-500 text-xs font-bold uppercase py-12">
                ❌ Error al cargar pedidos: ${error.message}
            </div>
        `;
    }
}

function renderPedidos(pedidos) {
    const container = document.getElementById('lista-pedidos');
    
    let pedidosFiltrados = pedidos;
    if (filtroActualPedidos !== 'todos') {
        pedidosFiltrados = pedidos.filter(p => p.estado === filtroActualPedidos);
    }

    if (pedidosFiltrados.length === 0) {
        container.innerHTML = `
            <div class="text-center text-slate-400 text-xs font-bold uppercase py-12">
                <i class="fas fa-inbox text-4xl block mb-4 text-slate-300"></i>
                No hay pedidos ${filtroActualPedidos !== 'todos' ? `con estado "${filtroActualPedidos}"` : 'aún'}
            </div>
        `;
        return;
    }

    container.innerHTML = pedidosFiltrados.map(pedido => {
        const fecha = pedido.fecha ? new Date(pedido.fecha).toLocaleString('es-VE') : 'Fecha no disponible';
        const estado = pedido.estado || 'pendiente';
        const estadoColors = {
            pendiente: 'bg-amber-100 text-amber-700',
            pagado: 'bg-emerald-100 text-emerald-700',
            entregado: 'bg-blue-100 text-blue-700',
            cancelado: 'bg-red-100 text-red-700'
        };
        const estadoColor = estadoColors[estado] || estadoColors.pendiente;

        const items = pedido.items || [];
        const resumenItems = items.map(item => 
            `${item.cantidad}x ${escapeHtml(item.nombre || 'Producto')}`
        ).join(', ');

        return `
        <div class="bg-slate-50 rounded-2xl p-6 border border-slate-100 hover:shadow-md transition-all">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-3 flex-wrap">
                        <span class="font-black text-sm text-slate-800">📋 ${escapeHtml(pedido.referencia || 'Sin referencia')}</span>
                        <span class="text-xs text-slate-400">${fecha}</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${estadoColor}">${estado}</span>
                    </div>
                    <p class="text-xs text-slate-500 mt-1 truncate">${resumenItems}</p>
                </div>
                <div class="flex items-center gap-4 w-full md:w-auto">
                    <div class="text-right">
                        <p class="text-sm font-bold text-emerald-600">$${pedido.totalUSD?.toFixed(2) || '0.00'}</p>
                        <p class="text-[10px] text-slate-400">${(pedido.totalBS || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs</p>
                    </div>
                    <div class="flex gap-1">
                        <button onclick="window.verDetallePedido('${pedido.id}')" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all">
                            <i class="fas fa-eye"></i>
                        </button>
                        <select onchange="window.cambiarEstadoPedido('${pedido.id}', this.value)" class="text-[10px] font-bold uppercase px-2 py-1.5 bg-slate-100 border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all cursor-pointer">
                            <option value="pendiente" ${estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                            <option value="pagado" ${estado === 'pagado' ? 'selected' : ''}>Pagado</option>
                            <option value="entregado" ${estado === 'entregado' ? 'selected' : ''}>Entregado</option>
                            <option value="cancelado" ${estado === 'cancelado' ? 'selected' : ''}>Cancelado</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

window.cambiarEstadoPedido = async function(pedidoId, nuevoEstado) {
    try {
        const pedidoRef = doc(db, "artifacts", APP_ID, "public", "data", "pedidos", pedidoId);
        await setDoc(pedidoRef, { estado: nuevoEstado }, { merge: true });
        notificar(`✅ Pedido actualizado a "${nuevoEstado}"`);
        cargarPedidos(clienteActualId);
    } catch (error) {
        console.error("Error al cambiar estado:", error);
        alert("❌ Error al cambiar el estado del pedido.");
    }
};

window.filtrarPedidos = function() {
    const select = document.getElementById('filtro-estado-pedidos');
    filtroActualPedidos = select.value;
    renderPedidos(pedidosCache);
};

window.recargarPedidos = function() {
    cargarPedidos(clienteActualId);
};

window.verDetallePedido = function(pedidoId) {
    const pedido = pedidosCache.find(p => p.id === pedidoId);
    if (!pedido) {
        notificar("⚠️ Pedido no encontrado");
        return;
    }

    const items = pedido.items || [];
    const fecha = pedido.fecha ? new Date(pedido.fecha).toLocaleString('es-VE') : 'Fecha no disponible';

    let html = `
    <div class="bg-white rounded-2xl max-w-2xl w-full mx-auto p-6 max-h-[80vh] overflow-y-auto">
        <div class="flex justify-between items-start mb-6">
            <div>
                <h3 class="text-xl font-black text-slate-800">📋 ${escapeHtml(pedido.referencia || 'Sin referencia')}</h3>
                <p class="text-xs text-slate-400">${fecha}</p>
                <p class="text-xs font-bold mt-1">Estado: <span class="uppercase ${pedido.estado === 'pagado' ? 'text-emerald-600' : 'text-amber-600'}">${pedido.estado || 'pendiente'}</span></p>
            </div>
            <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600 text-xl">
                <i class="fas fa-times"></i>
            </button>
        </div>

        <div class="space-y-3">
            ${items.map(item => `
            <div class="border-b border-slate-100 pb-3">
                <div class="flex justify-between items-start">
                    <div>
                        <p class="font-bold text-sm text-slate-800">${escapeHtml(item.nombre || 'Producto')}</p>
                        <p class="text-xs text-slate-500">Cantidad: ${item.cantidad || 0} x $${item.precioUnitario?.toFixed(2) || '0.00'}</p>
                        ${item.extras && item.extras.length > 0 ? `
                            <p class="text-[10px] text-slate-400">Extras: ${item.extras.map(e => escapeHtml(e.nombre)).join(', ')}</p>
                        ` : ''}
                    </div>
                    <p class="font-bold text-emerald-600 text-sm">$${item.subtotal?.toFixed(2) || '0.00'}</p>
                </div>
            </div>
            `).join('')}
        </div>

        <div class="mt-6 pt-4 border-t border-slate-200">
            <div class="flex justify-between items-center">
                <div>
                    <p class="text-xs text-slate-400">Total USD</p>
                    <p class="text-2xl font-black text-emerald-600">$${pedido.totalUSD?.toFixed(2) || '0.00'}</p>
                </div>
                <div class="text-right">
                    <p class="text-xs text-slate-400">Total Bs</p>
                    <p class="text-2xl font-black text-slate-800">${(pedido.totalBS || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs</p>
                </div>
            </div>
            <p class="text-[10px] text-slate-400 mt-2">Tasa BCV: ${pedido.tasaBCV?.toFixed(2) || 'N/A'} Bs/USD</p>
        </div>

        <div class="mt-6 flex gap-2">
            <button onclick="window.cambiarEstadoPedido('${pedido.id}', 'pagado')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase">Marcar como Pagado</button>
            <button onclick="window.cambiarEstadoPedido('${pedido.id}', 'entregado')" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase">Marcar como Entregado</button>
            <button onclick="this.closest('.fixed').remove()" class="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold uppercase">Cerrar</button>
        </div>
    </div>
    `;

    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[999] flex items-center justify-center px-4';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
};

// ==================== NOTIFICACIONES ====================
function notificar(msg) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

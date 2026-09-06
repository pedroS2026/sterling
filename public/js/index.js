/**
 * Digitaliza Urpín - Script de index.html (Landing Page)
 * Versión corregida - Botón de presupuesto funcional con mensajes personalizados
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js";

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

// ========== APP CHECK ==========
const appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('6LcDST0tAAAAAIsL4Py1fORj7RKUEx-u-16fU0zD'),
    isTokenAutoRefreshEnabled: true
});
// =================================

// ==================== FUNCIÓN PRINCIPAL ====================
function enviarPresupuesto() {
    console.log("🔄 Botón 'Pedir Presupuesto' presionado");
    
    const select = document.getElementById('opcion-servicio');
    let servicio = "";
    
    if (select) {
        servicio = select.value;
        console.log("📋 Servicio seleccionado:", servicio);
    } else {
        console.error("❌ No se encontró el elemento 'opcion-servicio'");
    }
    
    const numero = "584266662491";
    
    const mensajesPersonalizados = {
        "Menú Digital QR": `👋 ¡Hola! Estoy interesado en el servicio de *Menú Digital con QR* para mi negocio.

Me gustaría recibir más información, precios y saber cómo funciona.

Quedo atento a tu respuesta. 🙏`,

        "Catálogo Interactivo": `👋 ¡Hola! Estoy interesado en el servicio de *Catálogo Interactivo* para mi negocio.

Me gustaría recibir más información, precios y saber cómo funciona.

Quedo atento a tu respuesta. 🙏`,

        "Posicionamiento Maps": `👋 ¡Hola! Estoy interesado en el servicio de *Google Maps Pro* (posicionamiento en Maps) para mi negocio.

Me gustaría recibir más información, precios y saber cómo funciona.

Quedo atento a tu respuesta. 🙏`
    };
    
    let mensaje = "";
    
    if (servicio && mensajesPersonalizados[servicio]) {
        mensaje = mensajesPersonalizados[servicio];
        console.log("✅ Mensaje personalizado para:", servicio);
    } else {
        mensaje = `👋 ¡Hola! Estoy interesado en los servicios de Digitaliza Urpín para mi negocio.

Me gustaría recibir más información, precios y saber cómo funciona.

Quedo atento a tu respuesta. 🙏`;
        console.log("ℹ️ Usando mensaje genérico");
    }
    
    const mensajeCodificado = encodeURIComponent(mensaje);
    const urlWhatsApp = `https://wa.me/${numero}?text=${mensajeCodificado}`;
    console.log("📱 URL de WhatsApp:", urlWhatsApp);
    
    try {
        const ventana = window.open(urlWhatsApp, '_blank');
        if (!ventana || ventana.closed || typeof ventana.closed === 'undefined') {
            console.log("⚠️ Ventana emergente bloqueada, usando fallback...");
            window.location.href = urlWhatsApp;
        } else {
            console.log("✅ WhatsApp abierto correctamente");
        }
    } catch (error) {
        console.error("❌ Error al abrir WhatsApp:", error);
        window.location.href = urlWhatsApp;
    }
}

// ========== EXPONER FUNCIÓN GLOBALMENTE ==========
window.enviarPresupuesto = enviarPresupuesto;

console.log('✅ Digitaliza Urpín - index.js cargado correctamente');
console.log('📱 Función enviarPresupuesto disponible:', typeof window.enviarPresupuesto === 'function');

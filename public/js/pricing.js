/**
 * Digitaliza Urpín - Módulo de Precios e IVA (VERSIÓN EXTENDIDA)
 * Soporte para moneda local y formateo
 */

import { formatearPrecio, getConfigPais } from './currency.js';

export const APP_SETTINGS = {
    impuestoIVA: 0.16,
    aplicarIVA: true,
    redondearBs: true
};

export function calcularPrecios(precioBase, tasaBCV = 1, exentoIVA = false, pais = 'venezuela') {
    const precioNumerico = parseFloat(precioBase);
    if (isNaN(precioNumerico) || precioNumerico < 0) {
        return {
            usd: "0.00",
            bs: "0,00",
            localFormateado: "0",
            moneda: "Bs.",
            pais: pais
        };
    }

    const config = getConfigPais(pais);
    const tasaValida = typeof tasaBCV === 'number' && tasaBCV > 0 ? tasaBCV : 1;

    let usdMostrado = precioNumerico;
    let precioConIVA = usdMostrado;

    if (!exentoIVA && APP_SETTINGS.aplicarIVA) {
        precioConIVA = usdMostrado * (1 + config.ivaDefault);
    }

    let montoLocal = precioConIVA * tasaValida;

    if (APP_SETTINGS.redondearBs) {
        montoLocal = Math.ceil(montoLocal);
    }

    const localFormateado = formatearPrecio(montoLocal, pais);

    return {
        usd: usdMostrado.toFixed(2),
        bs: montoLocal.toLocaleString('es-VE', { minimumFractionDigits: 2 }),
        localFormateado: localFormateado,
        moneda: config.moneda,
        pais: pais
    };
}

export function getConfigPaisLocal(pais) {
    return getConfigPais(pais);
}

export function getEmojiPaisLocal(pais) {
    const config = getConfigPais(pais);
    return config.emoji || '🌎';
}

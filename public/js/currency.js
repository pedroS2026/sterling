/**
 * Digitaliza Urpín - Módulo de Monedas y Tasas
 */

export const PAISES = {
    venezuela: {
        id: 'venezuela',
        nombre: 'Venezuela',
        moneda: 'Bs.',
        codigoMoneda: 'VES',
        tasaAPI: 'https://ve.dolarapi.com/v1/dolares/oficial',
        tasaCampo: 'promedio',
        ivaDefault: 0.16,
        mostrarTasa: true,
        etiquetaTasa: '🇻🇪 TASA BCV',
        formatoLocal: 'es-VE',
        decimales: 2,
        emoji: '🇻🇪'
    },
    colombia: {
        id: 'colombia',
        nombre: 'Colombia',
        moneda: 'COP',
        codigoMoneda: 'COP',
        tasaAPI: 'https://www.datos.gov.co/resource/ceyp-9c7c.json',
        tasaCampo: 'valor',
        ivaDefault: 0.19,
        mostrarTasa: true,
        etiquetaTasa: '🇨🇴 TRM (USD/COP)',
        formatoLocal: 'es-CO',
        decimales: 0,
        emoji: '🇨🇴'
    }
};

export async function obtenerTasa(pais = 'venezuela') {
    const config = PAISES[pais] || PAISES.venezuela;
    try {
        const response = await fetch(config.tasaAPI);
        if (!response.ok) throw new Error('API no responde');
        const data = await response.json();
        let tasa = 0;
        if (pais === 'venezuela') {
            tasa = data.promedio || data.price || 0;
        } else if (pais === 'colombia') {
            if (Array.isArray(data) && data.length > 0) {
                tasa = parseFloat(data[0]?.valor || 0);
            } else if (data.valor) {
                tasa = parseFloat(data.valor);
            }
        }
        if (tasa <= 0) throw new Error('Tasa inválida');
        return tasa;
    } catch (error) {
        console.error('Error tasa:', error);
        const respaldo = { venezuela: 50, colombia: 4000 };
        return respaldo[pais] || 50;
    }
}

export function formatearPrecio(monto, pais = 'venezuela') {
    const config = PAISES[pais] || PAISES.venezuela;
    const decimales = config.decimales || 2;
    const formato = config.formatoLocal || 'es-VE';
    try {
        return monto.toLocaleString(formato, {
            minimumFractionDigits: decimales,
            maximumFractionDigits: decimales
        });
    } catch (e) {
        return monto.toFixed(decimales);
    }
}

export function getConfigPais(pais) {
    return PAISES[pais] || PAISES.venezuela;
}

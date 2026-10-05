// backend-api/index.js
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const WayuPay = require('wayu-js-sdk');
require('dotenv').config();

// ========== INICIALIZAR FIREBASE ==========
let serviceAccount;

if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('✅ Firebase inicializado con variable de entorno (Vercel)');
} else {
  try {
    serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase inicializado con archivo local');
  } catch (error) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    console.log('✅ Firebase inicializado con applicationDefault (fallback)');
  }
}

const db = admin.firestore();
const APP_ID = 'digitaliza-urpin-2026';

// ========== INICIALIZAR WAYU PAY ==========
const wayu = new WayuPay({
  publicKey: process.env.WAYU_PUBLIC_KEY,
  secretKey: process.env.WAYU_SECRET_KEY,
  sandbox: true, // Cambiar a false en producción
});

const app = express();
app.use(cors());
app.use(express.json());

// ========== CONFIGURACIÓN DE PAÍSES ==========
const PAISES = {
  venezuela: {
    moneda: 'Bs.',
    ivaDefault: 0.16,
    formatoLocal: 'es-VE',
    decimales: 2,
    emoji: '🇻🇪',
    nombre: 'Venezuela',
    zonaHoraria: 'America/Caracas'
  },
  colombia: {
    moneda: 'COP',
    ivaDefault: 0.19,
    formatoLocal: 'es-CO',
    decimales: 0,
    emoji: '🇨🇴',
    nombre: 'Colombia',
    zonaHoraria: 'America/Bogota'
  }
};

// ========== FUNCIÓN: OBTENER FECHA EN ZONA HORARIA LOCAL ==========
function obtenerFechaLocal(zonaHoraria = 'America/Caracas') {
  const ahora = new Date();
  const formato = new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const fechaISO = formato.format(ahora); // YYYY-MM-DD
  const [year, month, day] = fechaISO.split('-');
  return {
    fechaISO,                             // 2026-10-05
    fechaCompacta: `${year}${month}${day}`, // 20261005
    year, month, day
  };
}

// ========== FUNCIÓN: GENERAR REFERENCIA CON CONTADOR DIARIO ==========
async function generarReferenciaContador(clienteId, zonaHoraria = 'America/Caracas') {
  const { fechaISO, fechaCompacta } = obtenerFechaLocal(zonaHoraria);
  const contadorId = `${clienteId}_${fechaISO}`;
  
  const contadorRef = db
    .collection('artifacts').doc(APP_ID)
    .collection('public').doc('data')
    .collection('contadores').doc(contadorId);
  
  // Transacción para evitar duplicados cuando hay pedidos simultáneos
  const nuevoNumero = await db.runTransaction(async (transaction) => {
    const contadorDoc = await transaction.get(contadorRef);
    
    let ultimoNumero = 0;
    if (contadorDoc.exists) {
      ultimoNumero = contadorDoc.data().ultimoNumero || 0;
    }
    
    const siguienteNumero = ultimoNumero + 1;
    
    transaction.set(contadorRef, {
      clienteId: clienteId,
      fecha: fechaISO,
      fechaCompacta: fechaCompacta,
      ultimoNumero: siguienteNumero,
      actualizadoEn: new Date().toISOString()
    }, { merge: true });
    
    return siguienteNumero;
  });
  
  const numeroFormateado = String(nuevoNumero).padStart(3, '0');
  
  return {
    referencia: `${fechaCompacta}-${numeroFormateado}`,
    numero: nuevoNumero,
    fechaISO: fechaISO,
    fechaCompacta: fechaCompacta
  };
}

// ========== RUTA PARA GENERAR LINK DE PAGO ==========
app.post('/api/crear-link-pago', async (req, res) => {
  try {
    const { items, clienteId, mesa, tasaBCV } = req.body;

    // ========== 1. VALIDACIONES BÁSICAS ==========
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'No hay items en el pedido' });
    }

    if (!clienteId) {
      return res.status(400).json({ success: false, error: 'clienteId es requerido' });
    }

    console.log('📥 Pedido recibido para cliente:', clienteId);

    // ========== 2. CONSULTAR EL NEGOCIO EN FIRESTORE ==========
    const clienteRef = db
      .collection('artifacts').doc(APP_ID)
      .collection('public').doc('data')
      .collection('clientes').doc(clienteId);

    const clienteSnap = await clienteRef.get();

    if (!clienteSnap.exists) {
      return res.status(404).json({ success: false, error: 'Cliente no encontrado' });
    }

    const clienteData = clienteSnap.data();
    const productosCatalogo = clienteData.products || [];
    const business = clienteData.business || {};
    
    const pais = business.pais || 'venezuela';
    const configPais = PAISES[pais] || PAISES.venezuela;
    const exentoIVA = business.exentoIVA === true || business.exentoIVA === 'true';
    const deliveryRecargo = business.deliveryRecargo || { activo: false, porcentaje: 3, label: 'Con Delivery' };

    console.log(`🏢 Negocio: ${business.name || clienteId} | País: ${pais}`);

    // ========== 3. GENERAR REFERENCIA CON CONTADOR DIARIO ==========
    const refData = await generarReferenciaContador(clienteId, configPais.zonaHoraria);
    const referencia = refData.referencia;
    
    console.log(`📋 Referencia generada: ${referencia} (pedido #${refData.numero} del día)`);

    // ========== 4. VALIDAR Y CALCULAR TOTAL EN EL SERVIDOR ==========
    let totalCalculadoUSD = 0;
    let tieneDelivery = false;
    const itemsValidados = [];

    for (const itemCliente of items) {
      const productoCatalogo = productosCatalogo.find(
        p => String(p.id) === String(itemCliente.idOriginal)
      );

      if (!productoCatalogo) {
        console.warn(`⚠️ Producto no encontrado: ${itemCliente.idOriginal}`);
        continue;
      }

      const precioBase = parseFloat(productoCatalogo.price || 0);
      if (isNaN(precioBase) || precioBase < 0) {
        console.warn(`⚠️ Precio inválido para: ${productoCatalogo.name}`);
        continue;
      }

      const cantidad = parseInt(itemCliente.cantidad) || 0;
      if (cantidad <= 0 || cantidad > 100) {
        console.warn(`⚠️ Cantidad inválida: ${cantidad}`);
        continue;
      }

      let costoExtras = 0;
      const extrasDetalle = [];
      const extrasCatalogo = Array.isArray(productoCatalogo.extras) ? productoCatalogo.extras : [];
      const extrasCliente = Array.isArray(itemCliente.extras) ? itemCliente.extras : [];

      for (const extraCliente of extrasCliente) {
        if (extraCliente.esDeliveryFlag === true) {
          tieneDelivery = true;
          continue;
        }

        const extraCatalogo = extrasCatalogo.find(
          e => (e.nombre || e.Nombre) === extraCliente.nombre
        );

        if (extraCatalogo) {
          const precioExtra = parseFloat(extraCatalogo.precio ?? extraCatalogo.Precio ?? 0);
          costoExtras += precioExtra;
          extrasDetalle.push({
            nombre: extraCatalogo.nombre || extraCatalogo.Nombre,
            precio: precioExtra
          });
        }
      }

      const precioUnitario = precioBase + costoExtras;
      const subtotal = precioUnitario * cantidad;
      totalCalculadoUSD += subtotal;

      itemsValidados.push({
        id: productoCatalogo.id,
        nombre: productoCatalogo.name,
        cantidad: cantidad,
        precioBase: precioBase,
        extras: extrasDetalle,
        precioUnitario: precioUnitario,
        subtotal: subtotal
      });
    }

    if (itemsValidados.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No hay productos válidos en el pedido' 
      });
    }

    // ========== 5. APLICAR DELIVERY ==========
    let totalConDelivery = totalCalculadoUSD;
    let deliveryAplicado = false;
    let deliveryMonto = 0;

    if (tieneDelivery && deliveryRecargo.activo === true) {
      deliveryMonto = parseFloat(deliveryRecargo.porcentaje) || 3;
      totalConDelivery = totalCalculadoUSD + deliveryMonto;
      deliveryAplicado = true;
    }

    // ========== 6. APLICAR IVA ==========
    let totalConIVA = totalConDelivery;
    if (!exentoIVA) {
      totalConIVA = totalConDelivery * (1 + configPais.ivaDefault);
    }

    // ========== 7. CALCULAR TOTAL EN MONEDA LOCAL ==========
    const tasaValida = parseFloat(tasaBCV) > 0 ? parseFloat(tasaBCV) : 1;
    const totalFinalLocal = Math.ceil(totalConIVA * tasaValida);

    console.log(`💰 Total validado: $${totalConIVA.toFixed(2)} | Bs. ${totalFinalLocal}`);

    // ========== 8. CREAR EL PEDIDO EN FIRESTORE ==========
    const pedidoData = {
      referencia: referencia,
      numeroDia: refData.numero,
      clienteId: clienteId,
      negocio: business.name || clienteId,
      pais: pais,
      fecha: new Date().toISOString(),
      fechaLocal: refData.fechaISO,
      items: itemsValidados,
      totalUSD: parseFloat(totalConIVA.toFixed(2)),
      totalLocal: totalFinalLocal,
      exentoIVA: exentoIVA,
      tasaBCV: tasaValida,
      estado: 'pendiente',
      paymentStatus: 'pending',
      moneda: configPais.moneda,
      mesa: mesa || null,
      deliveryAplicado: deliveryAplicado,
      deliveryMonto: deliveryMonto,
      negocioData: {
        name: business.name,
        whatsapp: business.whatsapp,
        accent: business.accent,
        type: business.type,
        exentoIVA: exentoIVA
      }
    };

    const pedidoRef = db
      .collection('artifacts').doc(APP_ID)
      .collection('public').doc('data')
      .collection('pedidos').doc(referencia);

    await pedidoRef.set(pedidoData);
    console.log(`✅ Pedido creado: ${referencia}`);

    // ========== 9. GENERAR LINK DE PAGO ==========
    const result = await wayu.checkout.generatePaymentUrl({
      amount: {
        value: parseFloat(totalConIVA.toFixed(2)),
        currency: 'USD',
      },
      product_name: `Pedido ${referencia}`,
      product_description: `Pedido para ${business.name || clienteId}`,
    });

    await pedidoRef.update({
      transactionId: result.transactionId
    });

    console.log(`✅ Link de pago generado para ${referencia}`);

    // ========== 10. RESPONDER AL CLIENTE ==========
    res.json({
      success: true,
      referencia: referencia,
      link: result.generatePaymentLink,
      transactionId: result.transactionId,
      totalValidado: parseFloat(totalConIVA.toFixed(2)),
      totalLocal: totalFinalLocal,
      numeroDia: refData.numero
    });

  } catch (error) {
    console.error('❌ Error al generar link de pago:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== RUTA WEBHOOK PARA CONFIRMAR PAGOS ==========
app.post('/api/webhook-wayu', async (req, res) => {
  const isValid = wayu.validateWebhook(
    req.headers,
    req.body,
    process.env.WAYU_WEBHOOK_SECRET
  );

  if (!isValid) {
    return res.status(401).json({ error: 'Firma inválida' });
  }

  const { event, transactionId, data } = req.body;
  console.log('📩 Evento recibido:', event, 'Transaction:', transactionId);

  if (event === 'payment.completed') {
    try {
      const pedidosRef = db
        .collection('artifacts').doc(APP_ID)
        .collection('public').doc('data')
        .collection('pedidos');

      const querySnapshot = await pedidosRef.where('transactionId', '==', transactionId).get();

      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        await doc.ref.update({
          paymentStatus: 'completed',
          estado: 'pagado',
          pagoConfirmado: true,
          paymentData: data,
          fechaPago: new Date().toISOString(),
        });
        console.log(`✅ Pedido ${doc.id} actualizado a PAGADO`);
      }
    } catch (error) {
      console.error('❌ Error al actualizar pedido:', error);
    }
  }

  res.status(200).json({ received: true });
});

// ========== RUTA DE PRUEBA ==========
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ========== INICIAR SERVIDOR ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

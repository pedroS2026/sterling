// backend-api/index.js
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const WayuPay = require('wayu-js-sdk');
require('dotenv').config();

// ========== INICIALIZAR FIREBASE (UNA SOLA VEZ) ==========
let serviceAccount;

// Prioridad 1: Variable de entorno (Vercel)
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('✅ Firebase inicializado con variable de entorno (Vercel)');
} else {
  // Prioridad 2: Archivo local (desarrollo)
  try {
    serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase inicializado con archivo local');
  } catch (error) {
    // Prioridad 3: Fallback a applicationDefault (útil para otros entornos)
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

// ========== RUTA PARA GENERAR LINK DE PAGO ==========
app.post('/api/crear-link-pago', async (req, res) => {
  try {
    const { monto, pedidoId, productoNombre, productoDescripcion } = req.body;

    const result = await wayu.checkout.generatePaymentUrl({
      amount: {
        value: parseFloat(monto),
        currency: 'USD',
      },
      product_name: productoNombre || `Pedido #${pedidoId}`,
      product_description: productoDescripcion || 'Pago en Digitaliza Urpín',
    });

    // Guardar transactionId en Firestore
    const pedidoRef = db
      .collection('artifacts')
      .doc(APP_ID)
      .collection('public')
      .doc('data')
      .collection('pedidos')
      .doc(pedidoId);

    await pedidoRef.set({
      transactionId: result.transactionId,
      paymentStatus: 'pending',
    }, { merge: true });

    res.json({
      success: true,
      link: result.generatePaymentLink,
      transactionId: result.transactionId,
    });

  } catch (error) {
    console.error('Error al generar link de pago:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== RUTA WEBHOOK PARA CONFIRMAR PAGOS ==========
app.post('/api/webhook-wayu', async (req, res) => {
  // Validar firma del webhook
  const isValid = wayu.validateWebhook(
    req.headers,
    req.body,
    process.env.WAYU_WEBHOOK_SECRET
  );

  if (!isValid) {
    return res.status(401).json({ error: 'Firma inválida' });
  }

  const { event, transactionId, data } = req.body;
  console.log('Evento recibido:', event, 'Transaction:', transactionId);

  if (event === 'payment.completed') {
    try {
      const pedidosRef = db
        .collection('artifacts')
        .doc(APP_ID)
        .collection('public')
        .doc('data')
        .collection('pedidos');

      const querySnapshot = await pedidosRef.where('transactionId', '==', transactionId).get();

      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        await doc.ref.update({
          paymentStatus: 'completed',
          estado: 'pagado',
          paymentData: data,
          fechaPago: new Date().toISOString(),
        });
        console.log(`✅ Pedido ${doc.id} actualizado a PAGADO`);
      }
    } catch (error) {
      console.error('Error al actualizar pedido:', error);
    }
  }

  res.status(200).json({ received: true });
});

// ========== RUTA DE PRUEBA ==========
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ========== INICIAR SERVIDOR (para desarrollo local) ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const WayuPay = require('wayu-js-sdk');

admin.initializeApp();

// Inicializar Wayu Pay (usando variables de entorno)
const wayu = new WayuPay({
    publicKey: functions.config().wayu.public_key,
    secretKey: functions.config().wayu.secret_key,
    sandbox: true, // ¡Muy importante! Cambiar a false en producción
});

// ========== FUNCIÓN PARA GENERAR LINK DE PAGO ==========
exports.crearLinkPagoWayu = functions.https.onCall(async (data, context) => {
    const { monto, pedidoId, productoNombre, productoDescripcion } = data;

    try {
        const result = await wayu.checkout.generatePaymentUrl({
            amount: {
                value: parseFloat(monto),
                currency: 'USD', // o 'VES'
            },
            product_name: productoNombre || `Pedido #${pedidoId}`,
            product_description: productoDescripcion || 'Pago en Digitaliza Urpín',
        });

        // Guardar transactionId en Firestore para referencia
        await admin.firestore()
            .collection('artifacts')
            .doc('digitaliza-urpin-2026')
            .collection('public')
            .doc('data')
            .collection('pedidos')
            .doc(pedidoId)
            .set({
                transactionId: result.transactionId,
                paymentStatus: 'pending',
            }, { merge: true });

        return {
            success: true,
            link: result.generatePaymentLink,
            transactionId: result.transactionId,
        };

    } catch (error) {
        console.error('Error al generar link de pago:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// ========== FUNCIÓN WEBHOOK PARA CONFIRMAR PAGOS ==========
exports.webhookWayu = functions.https.onRequest(async (req, res) => {
    // Validar firma (opcional, pero recomendado)
    const isValid = wayu.validateWebhook(
        req.headers,
        req.body,
        functions.config().wayu.webhook_secret || 'mi_secreto_temporal'
    );

    if (!isValid) {
        return res.status(401).json({ error: 'Firma inválida' });
    }

    const { event, transactionId, data } = req.body;
    console.log('Evento recibido:', event, 'Transaction:', transactionId);

    if (event === 'payment.completed') {
        try {
            const pedidosRef = admin.firestore()
                .collection('artifacts')
                .doc('digitaliza-urpin-2026')
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

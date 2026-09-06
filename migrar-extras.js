const admin = require('firebase-admin');

// Ruta a tu nueva clave de servicio (la que ya tienes en el proyecto)
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const APP_ID = "digitaliza-urpin-2026";

async function migrarExtras() {
  console.log("🔍 Buscando documentos en clientes...");
  
  const clientesRef = db.collection("artifacts").doc(APP_ID).collection("public").doc("data").collection("clientes");
  const snapshot = await clientesRef.get();
  console.log("Clientes encontrados:", snapshot.docs.map(doc => doc.id)); 
 
  let actualizados = 0;
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    let cambio = false;
    
    if (data.products && Array.isArray(data.products)) {
      const nuevosProductos = data.products.map(p => {
        if (p.extras && !Array.isArray(p.extras) && typeof p.extras === 'object') {
          cambio = true;
          // Convertir objeto a array (ignoramos las claves numéricas)
          const extrasArray = Object.values(p.extras);
          // Verificar que cada extra tenga al menos 'nombre' y 'precio'
          const extrasLimpios = extrasArray.map(e => ({
            nombre: e.nombre || e.Nombre || "Extra",
            precio: typeof e.precio !== 'undefined' ? e.precio : (typeof e.Precio !== 'undefined' ? e.Precio : 0)
          }));
          return { ...p, extras: extrasLimpios };
        }
        return p;
      });
      
      if (cambio) {
        await doc.ref.update({ products: nuevosProductos });
        actualizados++;
        console.log(`✅ Migrado: ${doc.id} (${nuevosProductos.length} productos)`);
      }
    }
  }
  
  console.log(`\n🎉 Migración completada. Documentos actualizados: ${actualizados}`);
  process.exit(0);
}

migrarExtras().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});

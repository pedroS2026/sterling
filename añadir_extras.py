import firebase_admin
from firebase_admin import credentials, firestore
import json
import os

# Configuración
SERVICE_ACCOUNT_PATH = "serviceAccountKey.json"
APP_ID = "digitaliza-urpin-2026"

# ========== AQUÍ DEFINES LOS EXTRAS PARA CADA CLIENTE ==========
# Estructura: { "id_cliente": { id_producto: [{"nombre": "...", "precio": ...}, ...] } }
EXTRAS_CONFIG = {
    "burgers": {
        101: [
            {"nombre": "Extra carne", "precio": 2.5},
            {"nombre": "Extra pollo", "precio": 2.0}
        ],
        104: [
            {"nombre": "Extra carne", "precio": 2.5},
            {"nombre": "Extra pollo", "precio": 2.0},
            {"nombre": "Extra queso", "precio": 1.0}
        ]
    },                                            
    #"esthermendoza": {
    #    101: [
    #        {"nombre": "Extra tocineta", "precio": 1.5}
    #    ]
        # Agrega más productos si es necesario
    #},
    #"lanona": {   # Ejemplo para pizzerías
    #    201: [
    #        {"nombre": "Extra queso", "precio": 1.5},
    #        {"nombre": "Pepperoni", "precio": 2.0}
    #    ]
    #}
    # Puedes añadir más clientes: "flor": {...}, "gourmet": {...}, etc.
}
# ===============================================================

def inicializar_firebase():
    """Inicializa la conexión con Firestore usando la service account."""
    if not firebase_admin._apps:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred)
    return firestore.client()

def actualizar_extras(db):
    """Añade o reemplaza los extras en los productos especificados."""
    for cliente_id, productos_extras in EXTRAS_CONFIG.items():
        print(f"\n📦 Procesando cliente: {cliente_id}")
        doc_ref = db.collection("artifacts").document(APP_ID).collection("public").document("data").collection("clientes").document(cliente_id)
        doc = doc_ref.get()
        if not doc.exists:
            print(f"⚠️ Cliente {cliente_id} no existe en Firestore. Se omite.")
            continue

        data = doc.to_dict()
        productos_originales = data.get("products", [])
        # Convertir lista a diccionario por id para fácil modificación
        productos_dict = {p.get("id"): p for p in productos_originales}

        modificados = 0
        for prod_id, extras_list in productos_extras.items():
            if prod_id in productos_dict:
                # Añadir o reemplazar el campo 'extras'
                productos_dict[prod_id]["extras"] = extras_list
                print(f"   ✅ Producto ID {prod_id} -> Extras añadidos: {extras_list}")
                modificados += 1
            else:
                print(f"   ❌ Producto ID {prod_id} no encontrado en {cliente_id}")

        if modificados == 0:
            print("   No se modificó ningún producto.")
            continue

        # Reconstruir la lista actualizada
        productos_actualizados = list(productos_dict.values())
        # Actualizar solo el campo 'products' en Firestore
        doc_ref.update({"products": productos_actualizados})
        print(f"   ✅ Cliente {cliente_id} actualizado correctamente en Firestore.")

if __name__ == "__main__":
    if not os.path.exists(SERVICE_ACCOUNT_PATH):
        print(f"❌ Error: No se encuentra el archivo {SERVICE_ACCOUNT_PATH}")
    else:
        db = inicializar_firebase()
        actualizar_extras(db)
        print("\n🎉 Proceso completado.")

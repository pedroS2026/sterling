#!/usr/bin/env python3
"""
Digitaliza Urpín - Renombrar ID de un cliente en Firestore
Copia el documento completo (business + products + referidos + suscripcion)
"""

import firebase_admin
from firebase_admin import credentials, firestore
import sys
import os

# ==================== CONFIGURACIÓN ====================
SERVICE_ACCOUNT_PATH = "serviceAccountKey.json"
APP_ID = "digitaliza-urpin-2026"
# ======================================================

def inicializar_firebase():
    if not firebase_admin._apps:
        if not os.path.exists(SERVICE_ACCOUNT_PATH):
            print(f"❌ Error: No se encuentra {SERVICE_ACCOUNT_PATH}")
            sys.exit(1)
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred)
        print("✅ Firebase inicializado")
    return firestore.client()


def renombrar_cliente(db, id_antiguo, id_nuevo, eliminar_antiguo=True):
    """Renombra el ID de un cliente copiando TODOS sus datos."""
    
    # 1. Verificar que el cliente antiguo existe
    ref_antiguo = db.collection("artifacts").document(APP_ID) \
                    .collection("public").document("data") \
                    .collection("clientes").document(id_antiguo)
    
    doc_antiguo = ref_antiguo.get()
    
    if not doc_antiguo.exists:
        print(f"❌ El cliente '{id_antiguo}' no existe.")
        return False
    
    data = doc_antiguo.to_dict()
    
    # Mostrar resumen
    business = data.get('business', {})
    productos = data.get('products', [])
    
    print(f"\n📋 Datos del cliente '{id_antiguo}':")
    print(f"   • Nombre:       {business.get('name', 'N/A')}")
    print(f"   • WhatsApp:     {business.get('whatsapp', 'N/A')}")
    print(f"   • Tipo:         {business.get('type', 'N/A')}")
    print(f"   • Productos:    {len(productos)}")
    print(f"   • Logo:         {'✅ Configurado' if business.get('logo') else '❌ Sin logo'}")
    print(f"   • Campos:       {', '.join(data.keys())}")
    
    # 2. Verificar que el nuevo ID esté disponible
    ref_nuevo = db.collection("artifacts").document(APP_ID) \
                  .collection("public").document("data") \
                  .collection("clientes").document(id_nuevo)
    
    if ref_nuevo.get().exists:
        print(f"\n❌ El ID '{id_nuevo}' ya está en uso. Elige otro.")
        return False
    
    # 3. Crear el nuevo documento con TODOS los datos
    ref_nuevo.set(data)
    print(f"\n✅ Documento copiado a '{id_nuevo}'")
    print(f"   • business, products, referidos, suscripcion: todos copiados")
    
    # 4. Actualizar pedidos existentes
    print(f"\n🔄 Actualizando pedidos...")
    pedidos_ref = db.collection("artifacts").document(APP_ID) \
                    .collection("public").document("data") \
                    .collection("pedidos")
    
    pedidos = list(pedidos_ref.where("clienteId", "==", id_antiguo).stream())
    
    for pedido in pedidos:
        pedido.reference.update({"clienteId": id_nuevo})
    
    if pedidos:
        print(f"   ✅ {len(pedidos)} pedido(s) actualizado(s)")
    else:
        print(f"   ℹ️ Sin pedidos asociados")
    
    # 5. Eliminar el documento antiguo
    if eliminar_antiguo:
        ref_antiguo.delete()
        print(f"\n🗑️ Documento antiguo '{id_antiguo}' eliminado")
    
    return True


def main():
    print("\n" + "="*60)
    print("🔧 RENOMBRAR CLIENTE EN FIRESTORE")
    print("="*60)
    
    db = inicializar_firebase()
    
    # Pedir datos
    print("\n📝 Datos del cambio:\n")
    id_antiguo = input("   ID actual (ej: emmanuel): ").strip().lower()
    if not id_antiguo:
        print("❌ ID antiguo vacío.")
        return
    
    id_nuevo = input("   ID nuevo (ej: onhealthyfood): ").strip().lower()
    if not id_nuevo:
        print("❌ ID nuevo vacío.")
        return
    
    if id_antiguo == id_nuevo:
        print("❌ Los IDs son iguales.")
        return
    
    if not all(c.isalnum() or c in '-._' for c in id_nuevo):
        print("❌ Solo se permiten letras minúsculas, números, guiones y puntos.")
        return
    
    # Confirmar
    print("\n" + "="*60)
    print(f"   Cambiar: {id_antiguo}  →  {id_nuevo}")
    print(f"   Eliminar antiguo: Sí")
    print("="*60)
    
    if input("\n¿Confirmas? (s/n): ").strip().lower() != 's':
        print("❌ Cancelado.")
        return
    
    # Ejecutar
    if renombrar_cliente(db, id_antiguo, id_nuevo, eliminar_antiguo=True):
        print("\n" + "="*60)
        print("🎉 CAMBIO COMPLETADO")
        print("="*60)
        print(f"\n🔗 Nueva URL:")
        print(f"   https://digitaliza-urpin.web.app/{id_nuevo}")
        print("\n⚠️ Comparte la nueva URL con el cliente.")
        print("="*60)
    else:
        print("\n❌ No se pudo completar el cambio.")


if __name__ == "__main__":
    main()

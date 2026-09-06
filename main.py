import firebase_admin
from firebase_admin import credentials, firestore
import json
import os
import qrcode
import random
import string
from datetime import datetime, timedelta

# --- CONFIGURACIÓN ---
SERVICE_ACCOUNT_PATH = "serviceAccountKey.json"
APP_ID = "digitaliza-urpin-2026"

# ==================== PAÍSES SOPORTADOS ====================
PAISES = {
    "1": {
        "id": "venezuela",
        "nombre": "Venezuela",
        "moneda": "Bs.",
        "iva": 0.16,
        "emoji": "🇻🇪",
        "tasa_label": "BCV"
    },
    "2": {
        "id": "colombia",
        "nombre": "Colombia",
        "moneda": "COP",
        "iva": 0.19,
        "emoji": "🇨🇴",
        "tasa_label": "TRM"
    }
}

def inicializar_firebase():
    if not firebase_admin._apps:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred)
    return firestore.client()

def generar_qr_automatico(cliente_id):
    url_menu = f"https://digitaliza-urpin.web.app/{cliente_id}"
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=4)
    qr.add_data(url_menu)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    if not os.path.exists("qrcodes"):
        os.makedirs("qrcodes")
    nombre_archivo = f"qrcodes/qr_{cliente_id}.png"
    img.save(nombre_archivo)
    return nombre_archivo, url_menu

def generar_codigo_referido(cliente_id):
    base = cliente_id[:4].upper()
    aleatorio = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"REF-{base}-{aleatorio}"

def obtener_tipo_negocio():
    print("\n--- PERSONALIDAD VISUAL DEL NEGOCIO ---")
    opciones = {"1": "food", "2": "parts", "3": "bakery", "4": "store"}
    print("1. Food (Pizzerías, Comida)\n2. Parts (Ferreterías, Repuestos)")
    print("3. Bakery (Panaderías, Postres)\n4. Store (Tiendas, Bodegones)")
    sel = input("Seleccione una opción (1-4): ")
    return opciones.get(sel, "food")

def seleccionar_pais():
    print("\n--- SELECCIÓN DE PAÍS ---")
    print("1. 🇻🇪 Venezuela (Bs. - BCV - IVA 16%)")
    print("2. 🇨🇴 Colombia (COP - TRM - IVA 19%)")
    while True:
        opcion = input("Seleccione el país (1-2): ").strip()
        if opcion in PAISES:
            return PAISES[opcion]
        print("❌ Opción inválida. Seleccione 1 o 2.")

def procesar_registro(db):
    print("\n=== DIGITALIZA URPÍN: REGISTRO DE CLIENTE ===")
    
    pais = seleccionar_pais()
    print(f"\n🌎 País seleccionado: {pais['emoji']} {pais['nombre']}")
    print(f"💰 Moneda: {pais['moneda']} | IVA: {int(pais['iva']*100)}%")
    print("-" * 40)
    
    cliente_id = input("ID del Cliente: ").strip().lower().replace(" ", "")
    nombre_principal = input("Nombre del Negocio: ")
    nombre_acento = input("Palabra resaltada: ")
    whatsapp = input("WhatsApp (ej: 584120000000): ")
    tipo_negocio = obtener_tipo_negocio()
    exento_input = input("¿Exento de IVA? (s/n): ").strip().lower()
    exento_iva = exento_input == 's'

    productos = []
    if os.path.exists("database"):
        archivos = [f for f in os.listdir("database") if f.endswith('.json')]
        if archivos:
            print("\nArchivos disponibles en /database:")
            for i, f in enumerate(archivos, 1): print(f"{i}. {f}")
            sel = input("Seleccione número de archivo (Enter para saltar): ")
            if sel.isdigit() and 1 <= int(sel) <= len(archivos):
                with open(os.path.join("database", archivos[int(sel)-1]), "r", encoding="utf-8") as f:
                    data = json.load(f)
                    productos = data.get("products", data)

    codigo_referido = generar_codigo_referido(cliente_id)

    data_cliente = {
        "business": {
            "name": nombre_principal,
            "accent": nombre_acento,
            "whatsapp": whatsapp,
            "type": tipo_negocio,
            "exentoIVA": exento_iva,
            "pais": pais["id"]
        },
        "products": productos,
        "referidos": {
            "codigo": codigo_referido,
            "referidosActivos": [],
            "referidosPendientes": [],
            "mesesGratisAcumulados": 0,
            "mesesGratisUsados": 0
        },
        "suscripcion": {
            "plan": "basico",
            "activo": True,
            "fechaInicio": datetime.now().strftime("%Y-%m-%d"),
            "fechaFin": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
            "productosMax": 10,
            "extrasEnabled": False,
            "dashboardEnabled": False
        }
    }

    try:
        doc_ref = db.collection("artifacts").document(APP_ID).collection("public") \
                    .document("data").collection("clientes").document(cliente_id)
        doc_ref.set(data_cliente)
        print("\n✅ ¡Sincronización Exitosa con Firestore!")
    except Exception as e:
        print(f"\n❌ Error al guardar en Firebase: {e}")
        return

    archivo_qr, url = generar_qr_automatico(cliente_id)
    
    print("\n" + "="*50)
    print("🎉 REGISTRO COMPLETADO")
    print("="*50)
    print(f"📋 Cliente:     {nombre_principal}")
    print(f"🌎 País:        {pais['emoji']} {pais['nombre']}")
    print(f"💰 Moneda:      {pais['moneda']}")
    print(f"📊 IVA:         {int(pais['iva']*100)}% {'(EXENTO)' if exento_iva else ''}")
    print(f"📌 Estado:      ✅ Activo")
    print(f"🔗 URL:         {url}")
    print(f"🖼️ QR guardado: {archivo_qr}")
    print(f"🔑 Código ref:  {codigo_referido}")
    print(f"📦 Productos:   {len(productos)}")
    print("="*50)
    print(f"\n✅ El menú ya está activo en: {url}")

# ==================== FUNCIÓN PARA ACTIVAR/DESACTIVAR CLIENTE ====================
def toggle_cliente(cliente_id, activar):
    """Activa o desactiva un cliente existente."""
    db = inicializar_firebase()
    doc_ref = db.collection("artifacts").document(APP_ID).collection("public") \
                  .document("data").collection("clientes").document(cliente_id)
    
    doc = doc_ref.get()
    if not doc.exists:
        print(f"❌ Cliente '{cliente_id}' no encontrado.")
        return False
    
    data = doc.to_dict()
    suscripcion = data.get("suscripcion", {})
    
    # Actualizar estado
    suscripcion["activo"] = activar
    
    # Si no tiene campos de suscripción, agregar valores por defecto
    if "plan" not in suscripcion:
        suscripcion["plan"] = "basico"
        suscripcion["fechaInicio"] = datetime.now().strftime("%Y-%m-%d")
        suscripcion["fechaFin"] = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        suscripcion["productosMax"] = 10
        suscripcion["extrasEnabled"] = False
        suscripcion["dashboardEnabled"] = False
    
    # Guardar cambios
    doc_ref.set({"suscripcion": suscripcion}, merge=True)
    
    estado = "ACTIVADO" if activar else "DESACTIVADO"
    print(f"✅ Cliente '{cliente_id}' {estado} correctamente.")
    return True

# ==================== MENÚ PRINCIPAL ====================
if __name__ == "__main__":
    if not os.path.exists(SERVICE_ACCOUNT_PATH):
        print(f"Error: No se encuentra el archivo {SERVICE_ACCOUNT_PATH}")
    else:
        db = inicializar_firebase()
        
        while True:
            print("\n" + "="*50)
            print("🚀 DIGITALIZA URPÍN - GESTIÓN DE CLIENTES")
            print("="*50)
            print("1. Registrar nuevo cliente")
            print("2. Activar/Desactivar cliente existente")
            print("3. Salir")
            print("-"*50)
            
            opcion = input("Seleccione una opción (1-3): ").strip()
            
            if opcion == "1":
                procesar_registro(db)
            elif opcion == "2":
                cliente_id = input("ID del cliente a modificar: ").strip().lower()
                if not cliente_id:
                    print("❌ ID no válido.")
                    continue
                
                # Verificar estado actual
                doc_ref = db.collection("artifacts").document(APP_ID).collection("public") \
                              .document("data").collection("clientes").document(cliente_id)
                doc = doc_ref.get()
                if not doc.exists:
                    print(f"❌ Cliente '{cliente_id}' no encontrado.")
                    continue
                
                data = doc.to_dict()
                suscripcion = data.get("suscripcion", {})
                estado_actual = suscripcion.get("activo", False)
                estado_texto = "ACTIVO" if estado_actual else "INACTIVO"
                
                print(f"\n📌 Estado actual de '{cliente_id}': {estado_texto}")
                print("¿Qué deseas hacer?")
                print("1. Activar")
                print("2. Desactivar")
                accion = input("Seleccione (1-2): ").strip()
                
                if accion == "1":
                    toggle_cliente(cliente_id, True)
                elif accion == "2":
                    toggle_cliente(cliente_id, False)
                else:
                    print("❌ Opción inválida.")
            elif opcion == "3":
                print("👋 ¡Hasta luego!")
                break
            else:
                print("❌ Opción inválida. Seleccione 1, 2 o 3.")

import firebase_admin
from firebase_admin import credentials, auth

# Ruta a tu clave de servicio (la nueva que generaste)
SERVICE_ACCOUNT_PATH = "serviceAccountKey.json"

# Inicializar Firebase Admin SDK
cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
firebase_admin.initialize_app(cred)

# ========== CONFIGURACIÓN ==========
# Define aquí los UIDs de los usuarios y sus claims
USERS = [
    # Super-admin (tú)
    {
        "uid": "EnF8UmvJSubOKYAC3OiqkP9IhJh2",  # <-- REEMPLAZA CON TU UID REAL
        "clientId": "",
        "isSuperAdmin": True
    },
    # Usuario para esthermendoza
    {
        "uid": "3HdC45voftQsJqeViodcSDAwMa32",        # <-- REEMPLAZA CON EL UID DE esther
        "clientId": "esthermendoza",
        "isSuperAdmin": False
    },
    # Agrega más usuarios aquí siguiendo el mismo formato
    {
        "uid": "VaLdRcMTY9TDWJkUGoMqasAg83f1",        # <-- REEMPLAZA CON EL UID DE cliente
        "clientId": "anahisv",
        "isSuperAdmin": False
    },
]
# ===================================

# Asignar claims
for user in USERS:
    try:
        claims = {
            "clientId": user["clientId"],
            "isSuperAdmin": user["isSuperAdmin"],
            "role": "admin"  # Rol básico para todos los administradores
        }
        auth.set_custom_user_claims(user["uid"], claims)
        print(f"✅ Claims asignados a {user['uid']}: {claims}")
    except Exception as e:
        print(f"❌ Error con {user['uid']}: {e}")

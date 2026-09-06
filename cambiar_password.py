#!/usr/bin/env python3
"""
Digitaliza Urpín - Script para cambiar la contraseña de un usuario existente en Firebase Auth
"""

import firebase_admin
from firebase_admin import credentials, auth
import getpass
import sys
import os

# ==================== CONFIGURACIÓN ====================
SERVICE_ACCOUNT_PATH = "serviceAccountKey.json"
# ======================================================

def inicializar_firebase():
    """Inicializa Firebase Admin SDK"""
    if not firebase_admin._apps:
        if not os.path.exists(SERVICE_ACCOUNT_PATH):
            print(f"❌ Error: No se encuentra el archivo {SERVICE_ACCOUNT_PATH}")
            print("📌 Asegúrate de tener tu archivo de credenciales en la misma carpeta.")
            sys.exit(1)
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred)
        print("✅ Firebase inicializado correctamente")
    return firebase_admin.get_app()

def cambiar_password(email, nueva_password):
    """
    Cambia la contraseña de un usuario existente.
    
    Args:
        email (str): Correo electrónico del usuario
        nueva_password (str): Nueva contraseña (mínimo 6 caracteres)
    
    Returns:
        bool: True si se actualizó exitosamente, False en caso contrario
    """
    try:
        print(f"\n🔄 Buscando usuario: {email}")
        
        # Verificar si el usuario existe
        user = auth.get_user_by_email(email)
        print(f"✅ Usuario encontrado: {user.uid}")
        
        # Actualizar la contraseña
        auth.update_user(
            user.uid,
            password=nueva_password
        )
        print(f"✅ Contraseña actualizada para {email}")
        return True
        
    except auth.UserNotFoundError:
        print(f"❌ Error: No existe un usuario con el email {email}")
        return False
    except auth.InvalidPasswordError:
        print("❌ Error: La contraseña debe tener al menos 6 caracteres.")
        return False
    except Exception as e:
        print(f"❌ Error inesperado: {e}")
        return False

def listar_usuarios():
    """Lista todos los usuarios (útil para saber qué emails existen)"""
    try:
        print("\n📋 LISTA DE USUARIOS REGISTRADOS")
        print("-" * 60)
        page = auth.list_users()
        usuarios = list(page.users)
        if not usuarios:
            print("   No hay usuarios registrados.")
            return
        for user in usuarios:
            print(f"📧 {user.email}")
            print(f"   UID: {user.uid}")
            print(f"   Creado: {user.user_metadata.creation_timestamp}")
            print("-" * 60)
        return True
    except Exception as e:
        print(f"❌ Error al listar usuarios: {e}")
        return False

def mostrar_ayuda():
    print("""
📖 DIGITALIZA URPÍN - CAMBIAR CONTRASEÑA DE USUARIO

COMANDOS:
  python cambiar_password.py cambiar
  python cambiar_password.py listar
  python cambiar_password.py ayuda

CAMBIAR CONTRASEÑA:
  El script te pedirá interactivamente:
  - Email del usuario
  - Nueva contraseña (mínimo 6 caracteres)

EJEMPLO:
  python cambiar_password.py cambiar
  > Email: admin@esther.com
  > Nueva contraseña: ********
  > Repetir contraseña: ********

LISTAR USUARIOS:
  Muestra todos los usuarios registrados con sus emails y UIDs.
""")

def main():
    # Inicializar Firebase
    inicializar_firebase()
    
    # Argumentos desde línea de comandos
    if len(sys.argv) > 1:
        comando = sys.argv[1].lower()
        if comando == 'listar':
            listar_usuarios()
            return
        elif comando == 'ayuda':
            mostrar_ayuda()
            return
        elif comando != 'cambiar':
            print(f"❌ Comando desconocido: {comando}")
            print("   Usa 'cambiar', 'listar' o 'ayuda'")
            return
    
    # Modo interactivo para cambiar contraseña
    print("\n" + "="*50)
    print("🔑 CAMBIAR CONTRASEÑA DE USUARIO")
    print("="*50)
    
    # Email
    email = input("\n📧 Correo electrónico del usuario: ").strip()
    if not email or '@' not in email:
        print("❌ Ingresa un email válido (ej: usuario@dominio.com)")
        return
    
    # Verificar que el usuario existe antes de pedir la contraseña
    try:
        auth.get_user_by_email(email)
    except auth.UserNotFoundError:
        print(f"❌ Error: No existe un usuario con el email {email}")
        return
    except Exception as e:
        print(f"❌ Error al verificar usuario: {e}")
        return
    
    # Nueva contraseña
    while True:
        nueva_password = getpass.getpass("🔑 Nueva contraseña (mínimo 6 caracteres): ")
        if len(nueva_password) >= 6:
            repetir = getpass.getpass("🔑 Repetir nueva contraseña: ")
            if nueva_password == repetir:
                break
            else:
                print("❌ Las contraseñas no coinciden")
        else:
            print("❌ La contraseña debe tener al menos 6 caracteres")
    
    # Mostrar resumen
    print("\n" + "="*50)
    print("📋 RESUMEN DE CAMBIO")
    print("="*50)
    print(f"📧 Email:       {email}")
    print(f"🔑 Contraseña:  {'*' * len(nueva_password)}")
    print("="*50)
    
    confirmar = input("\n¿Actualizar contraseña? (s/n): ").strip().lower()
    if confirmar != 's' and confirmar != 'si':
        print("❌ Operación cancelada.")
        return
    
    # Cambiar la contraseña
    exito = cambiar_password(email, nueva_password)
    
    if exito:
        print("\n" + "="*50)
        print("🎉 CONTRASEÑA ACTUALIZADA EXITOSAMENTE")
        print("="*50)
        print(f"📧 Usuario: {email}")
        print("\n⚠️  Recuerda informar al usuario su nueva contraseña de forma segura.")
        print("="*50)
    else:
        print("\n❌ No se pudo cambiar la contraseña. Revisa los errores arriba.")

if __name__ == "__main__":
    main()

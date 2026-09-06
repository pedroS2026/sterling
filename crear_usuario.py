#!/usr/bin/env python3
"""
Digitaliza Urpín - Script para crear usuarios en Firebase Auth
Asigna automáticamente el clientId para que solo vean su negocio
"""

import firebase_admin
from firebase_admin import credentials, auth
import getpass
import sys
import os

# ==================== CONFIGURACIÓN ====================
# Ruta a tu archivo de credenciales (debe estar en la misma carpeta)
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

def crear_usuario(email, password, client_id, nombre_negocio=""):
    """
    Crea un usuario en Firebase Authentication y le asigna un Custom Claim
    para que solo pueda ver su cliente específico.
    
    Args:
        email (str): Correo electrónico del usuario
        password (str): Contraseña (mínimo 6 caracteres)
        client_id (str): ID del cliente en Firestore (ej: "oscarsanchez")
        nombre_negocio (str): Nombre del negocio (opcional, para el reporte)
    
    Returns:
        bool: True si se creó exitosamente, False en caso contrario
    """
    try:
        print(f"\n🔄 Creando usuario: {email}")
        
        # 1. Verificar si el usuario ya existe
        try:
            user = auth.get_user_by_email(email)
            print(f"⚠️ El usuario {email} ya existe.")
            print(f"   UID: {user.uid}")
            print("   ¿Quieres actualizar sus permisos?")
            respuesta = input("   Actualizar claims? (s/n): ").strip().lower()
            if respuesta == 's':
                # Actualizar claims del usuario existente
                auth.set_custom_user_claims(user.uid, {
                    'clientId': client_id,
                    'isSuperAdmin': False
                })
                print(f"✅ Claims actualizados para {email}")
                print(f"   clientId: {client_id}")
                print(f"   isSuperAdmin: False")
                return True
            else:
                print("❌ Operación cancelada.")
                return False
        except auth.UserNotFoundError:
            # El usuario no existe, crearlo
            pass
        
        # 2. Crear el usuario
        user = auth.create_user(
            email=email,
            password=password,
            display_name=nombre_negocio or client_id
        )
        print(f"✅ Usuario creado con UID: {user.uid}")
        
        # 3. Asignar Custom Claims
        auth.set_custom_user_claims(user.uid, {
            'clientId': client_id,
            'isSuperAdmin': False
        })
        print(f"✅ Claims asignados:")
        print(f"   clientId: {client_id}")
        print(f"   isSuperAdmin: False")
        
        return True
        
    except auth.EmailAlreadyExistsError:
        print(f"❌ Error: El email {email} ya está registrado.")
        return False
    except auth.InvalidPasswordError:
        print("❌ Error: La contraseña debe tener al menos 6 caracteres.")
        return False
    except Exception as e:
        print(f"❌ Error inesperado: {e}")
        return False

def listar_usuarios():
    """Lista todos los usuarios con sus claims"""
    try:
        print("\n📋 LISTA DE USUARIOS")
        print("-" * 60)
        page = auth.list_users()
        for user in page.users:
            claims = user.custom_claims or {}
            client_id = claims.get('clientId', 'N/A')
            is_admin = claims.get('isSuperAdmin', False)
            print(f"📧 {user.email}")
            print(f"   UID: {user.uid}")
            print(f"   Cliente: {client_id}")
            print(f"   Super Admin: {'✅' if is_admin else '❌'}")
            print("-" * 60)
        return True
    except Exception as e:
        print(f"❌ Error al listar usuarios: {e}")
        return False

def mostrar_ayuda():
    print("""
📖 DIGITALIZA URPÍN - GESTIÓN DE USUARIOS

COMANDOS:
  python crear_usuario.py crear
  python crear_usuario.py listar
  python crear_usuario.py ayuda

CREAR USUARIO:
  El script te pedirá interactivamente:
  - Email del usuario
  - Contraseña (mínimo 6 caracteres)
  - ID del cliente en Firestore (ej: "oscarsanchez")
  - Nombre del negocio (opcional)

EJEMPLO:
  python crear_usuario.py crear
  > Email: oscar@sanchez.com
  > Contraseña: ********
  > ID del cliente: oscarsanchez
  > Nombre del negocio: Multitienda Sánchez

LISTAR USUARIOS:
  Muestra todos los usuarios creados con sus clientes asignados.
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
        elif comando != 'crear':
            print(f"❌ Comando desconocido: {comando}")
            print("   Usa 'crear', 'listar' o 'ayuda'")
            return
    
    # Modo interactivo para crear usuario
    print("\n" + "="*50)
    print("🚀 CREAR USUARIO PARA PANEL ADMIN")
    print("="*50)
    
    # Email
    while True:
        email = input("\n📧 Correo electrónico: ").strip()
        if email and '@' in email:
            break
        print("❌ Ingresa un email válido (ej: usuario@dominio.com)")
    
    # Contraseña
    while True:
        password = getpass.getpass("🔑 Contraseña (mínimo 6 caracteres): ")
        if len(password) >= 6:
            password2 = getpass.getpass("🔑 Repetir contraseña: ")
            if password == password2:
                break
            else:
                print("❌ Las contraseñas no coinciden")
        else:
            print("❌ La contraseña debe tener al menos 6 caracteres")
    
    # ID del cliente
    while True:
        client_id = input("\n🏪 ID del cliente en Firestore (ej: oscarsanchez): ").strip().lower()
        if client_id:
            # Validar que solo tenga letras minúsculas, números y guiones
            if all(c.isalnum() or c in '._-' for c in client_id):
                break
            else:
                print("❌ Solo usa letras minúsculas, números, puntos, guiones bajos o medios")
        else:
            print("❌ El ID del cliente es obligatorio")
    
    # Nombre del negocio (opcional)
    nombre_negocio = input("\n📋 Nombre del negocio (opcional): ").strip()
    
    # Mostrar resumen antes de crear
    print("\n" + "="*50)
    print("📋 RESUMEN DE CREACIÓN")
    print("="*50)
    print(f"📧 Email:       {email}")
    print(f"🏪 Cliente ID:  {client_id}")
    print(f"📋 Negocio:     {nombre_negocio or '(No especificado)'}")
    print("="*50)
    
    confirmar = input("\n¿Crear usuario? (s/n): ").strip().lower()
    if confirmar != 's' and confirmar != 'si':
        print("❌ Operación cancelada.")
        return
    
    # Crear el usuario
    exito = crear_usuario(email, password, client_id, nombre_negocio)
    
    if exito:
        print("\n" + "="*50)
        print("🎉 USUARIO CREADO EXITOSAMENTE")
        print("="*50)
        print(f"📧 Email:       {email}")
        print(f"🏪 Cliente ID:  {client_id}")
        print(f"📋 Negocio:     {nombre_negocio or '(No especificado)'}")
        print("\n🔗 Acceso al admin:")
        print(f"   https://digitaliza-urpin.web.app/admin")
        print("\n⚠️  IMPORTANTE: Envía al usuario estas credenciales de forma segura.")
        print("="*50)
    else:
        print("\n❌ No se pudo crear el usuario. Revisa los errores arriba.")

if __name__ == "__main__":
    main()

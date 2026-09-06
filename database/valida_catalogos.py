import json
import os

# Configuración de colores para la terminal de Linux Mint
GREEN = '\033[92m'
RED = '\033[91m'
BLUE = '\033[94m'
BOLD = '\033[1m'
ENDC = '\033[0m'

def validar_catalogos():
    # Lista de archivos proporcionada
    archivos = [
        "squadra_pizzeria.json",
        "repuestos_demo.json",
        "gourmet_urpin.json",
        "flor_urpin.json",
        "ferreteria_urpin.json",
        "burguer_demo.json",
        "boutique_urpin.json"
    ]
    
    carpeta = "database"
    
    print(f"\n{BOLD}{BLUE}=== Verificador de Base de Datos - Av. Urpín ==={ENDC}")
    print(f"Buscando en: {os.path.abspath(carpeta)}\n")

    if not os.path.exists(carpeta):
        print(f"{RED}[ERROR]{ENDC} La carpeta '{carpeta}' no existe.")
        return

    print(f"{'ARCHIVO':<30} | {'ESTADO':<10} | {'DETALLES'}")
    print("-" * 60)

    for nombre_archivo in archivos:
        ruta_completa = os.path.join(carpeta, nombre_archivo)
        
        # 1. Verificar existencia
        if not os.path.exists(ruta_completa):
            estado = f"{RED}NO EXISTE{ENDC}"
            detalles = "Crea el archivo en la carpeta database"
        else:
            # 2. Verificar sintaxis JSON
            try:
                with open(ruta_completa, 'r', encoding='utf-8') as f:
                    json.load(f)
                estado = f"{GREEN}OK{ENDC}"
                detalles = "Sintaxis válida"
            except json.JSONDecodeError as e:
                estado = f"{RED}ERROR{ENDC}"
                detalles = f"Error de línea {e.lineno}"
            except Exception as e:
                estado = f"{RED}ERROR{ENDC}"
                detalles = str(e)

        print(f"{nombre_archivo:<30} | {estado:<20} | {detalles}")

    print(f"\n{BOLD}Proceso finalizado.{ENDC}\n")

if __name__ == "__main__":
    validar_catalogos()

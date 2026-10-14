# Crea el paquete para el streamer: dist/Luxanita-overlay-y-alertas.zip
# Solo lleva lo que hace falta para instalar (alertas, overlay e instrucciones);
# deja fuera scripts, sonidos de trabajo, capturas y archivos fuente.
#
#   python crear_paquete.py

import pathlib, zipfile

BASE = pathlib.Path(__file__).parent
SALIDA = BASE / "dist" / "Luxanita-overlay-y-alertas.zip"
RAIZ = "Luxanita"                                   # carpeta que aparece al descomprimir
CARPETAS = ["grandes", "compactas", "overlay"]
FUERA_EXT = {".py", ".pyc", ".wav"}
FUERA_CARPETAS = {"__pycache__", "overlay/animales/fuentes"}   # dibujos de origen de la orca (no se usan)
CORTE_INSTRUCCIONES = "PARA QUIEN MANTIENE LAS ALERTAS"         # esa parte es solo para quien edita el proyecto


def fuera(p):
    rel = p.relative_to(BASE).as_posix()
    return p.suffix in FUERA_EXT or any(rel == c or rel.startswith(c + "/") or f"/{c}/" in f"/{rel}/"
                                        for c in FUERA_CARPETAS)


def instrucciones():
    txt = (BASE / "INSTRUCCIONES.txt").read_text(encoding="utf-8")
    i = txt.find(CORTE_INSTRUCCIONES)
    if i != -1:
        txt = txt[:txt.rfind("\n", 0, txt.rfind("---", 0, i))].rstrip() + "\n"
    return txt.replace("\r\n", "\n").replace("\n", "\r\n")   # que se vea bien en el Bloc de notas


SALIDA.parent.mkdir(exist_ok=True)
n = 0
with zipfile.ZipFile(SALIDA, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    z.writestr(f"{RAIZ}/INSTRUCCIONES.txt", instrucciones().encode("utf-8-sig"))   # con BOM: acentos bien en cualquier Bloc de notas
    for c in CARPETAS:
        for p in sorted((BASE / c).rglob("*")):
            if p.is_file() and not fuera(p):
                z.write(p, f"{RAIZ}/{p.relative_to(BASE).as_posix()}")
                n += 1
print(f"{SALIDA} ({n + 1} archivos, {SALIDA.stat().st_size / 1e6:.1f} MB)")

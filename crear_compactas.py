# Crea las versiones compactas (compactas/arriba y compactas/centro) a partir de las
# alertas normales. Las originales no se tocan. Vuelve a ejecutarlo si cambias alguna.
#
#   python crear_compactas.py
#
# Qué cambia en las compactas:
#   - la alerta se ve más pequeña (TAMANO) y colocada arriba o en el centro
#   - burbujas, nieve, rayos y auroras se apagan lejos de la tarjeta (no ocupan la pantalla)
#   - la de sub va más rápida (SUB_RITMO) para durar unos 8 s, sonido incluido

import re, shutil, subprocess, pathlib

BASE = pathlib.Path(__file__).parent
OUT = BASE / "compactas"
ALERTAS = {"follow": ".ocean", "sub": ".snowscape", "gift": ".lux", "raid": ".aurora-raid"}
TAMANO = 0.6                                  # 1 = como la normal
POSICIONES = {"arriba": "20vh", "centro": "50vh"}   # dónde queda el centro de la tarjeta
SUB_RITMO = 0.73                              # la sub dura 11 s * 0.73 = 8 s

CSS_COMPACTA = """
/* ===== Versión compacta ({pos}) — creada por crear_compactas.py ===== */
{root} {{
  --s: {s};                      /* tamaño (1 = pantalla completa) */
  --y: {y};                     /* altura del centro de la tarjeta */
  transform: translateY(calc(var(--y) - var(--s) * 50vh)) scale(var(--s));
  transform-origin: 50% 0;
  /* los efectos se apagan al alejarse de la tarjeta */
  -webkit-mask-image: radial-gradient(ellipse 50% 50% at 50% 50%, #000 58%, transparent 100%);
          mask-image: radial-gradient(ellipse 50% 50% at 50% 50%, #000 58%, transparent 100%);
}}
"""

# fitScene mide la escena para recolocarla; tiene que medirla sin la reducción
JS_ANTES = "    var r = root.getBoundingClientRect();\n"
JS_DESPUES = ("    var tf = root.style.transform;\n"
              "    root.style.transform = 'none';          // medir sin la reducción de la versión compacta\n"
              "    var r = root.getBoundingClientRect();\n"
              "    root.style.transform = tf;\n")


def acelerar_tiempos(texto, f):
    """Multiplica por f todos los tiempos en segundos (1.2s, .035s...)."""
    return re.sub(r"(?<![\w.-])(\d*\.?\d+)s\b",
                  lambda m: f"{float(m.group(1)) * f:.3f}".rstrip("0").rstrip(".") + "s", texto)


def crear(pos, y):
    for a, root in ALERTAS.items():
        src, dst = BASE / a, OUT / pos / a
        dst.mkdir(parents=True, exist_ok=True)

        css = (src / "alerta.css").read_text(encoding="utf-8")
        html = (src / "alerta.html").read_text(encoding="utf-8")
        js = (src / "alerta.js").read_text(encoding="utf-8")
        prev = (src / "preview.html").read_text(encoding="utf-8")

        if a == "sub":
            css = acelerar_tiempos(css, SUB_RITMO)
            css = css.replace('Duración total: ~10-11 s. Pon "Alert Duration" = 11',
                              'Duración total: ~8 s. Pon "Alert Duration" = 8')
            html = re.sub(r'style="[^"]*"', lambda m: acelerar_tiempos(m.group(0), SUB_RITMO), html)

        css += CSS_COMPACTA.format(pos=pos, root=root, s=TAMANO, y=y)
        assert JS_ANTES in js, a
        js = js.replace(JS_ANTES, JS_DESPUES, 1)

        prev = re.sub(r'<template id="tpl">.*?</template>',
                      lambda m: '<template id="tpl">\n' + html + '</template>', prev, count=1, flags=re.S)
        prev = prev.replace(f"'../sonidos/{a}.mp3'", "'sonido.mp3'")

        (dst / "alerta.css").write_text(css, encoding="utf-8")
        (dst / "alerta.html").write_text(html, encoding="utf-8")
        (dst / "alerta.js").write_text(js, encoding="utf-8")
        (dst / "preview.html").write_text(prev, encoding="utf-8")

        mp3 = BASE / "sonidos" / f"{a}.mp3"
        if a == "sub":
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp3),
                            "-filter:a", f"atempo={1 / SUB_RITMO:.4f}", "-b:a", "192k",
                            str(dst / "sonido.mp3")], check=True)
        else:
            shutil.copyfile(mp3, dst / "sonido.mp3")


if OUT.exists():
    for pos in POSICIONES:
        shutil.rmtree(OUT / pos, ignore_errors=True)
for pos, y in POSICIONES.items():
    crear(pos, y)
print("compactas creadas en", OUT)

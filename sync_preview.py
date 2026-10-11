# Copia alerta.html dentro de preview.html (para que la prueba funcione con doble clic)
import re, pathlib
base = pathlib.Path(__file__).parent
for v in ["follow", "sub", "gift", "raid"]:
    tpl = (base / v / "alerta.html").read_text(encoding="utf-8")
    p = (base / v / "preview.html").read_text(encoding="utf-8")
    p = re.sub(r'<template id="tpl">.*?</template>', lambda m: '<template id="tpl">\n' + tpl + '</template>', p, count=1, flags=re.S)
    (base / v / "preview.html").write_text(p, encoding="utf-8")
print("previews sincronizadas")

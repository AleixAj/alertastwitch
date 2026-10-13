# Genera las texturas de cáusticas (la red de luz que se ve bajo el agua) del overlay.
#   python generar_causticas.py
# Crea fondo/causticas1.png y fondo/causticas2.png: 512x512, se pueden repetir sin cortes,
# en blanco rosado con transparencia. Basado en el efecto "tileable water caustic" (Dave Hoskins).
import pathlib
import numpy as np
from PIL import Image

TAM = 512
OUT = pathlib.Path(__file__).parent / "fondo"
OUT.mkdir(exist_ok=True)


def causticas(tiempo, iter=5, inten=0.005):
    tau = 2 * np.pi
    u = (np.arange(TAM) + .5) / TAM
    x, y = np.meshgrid(u, u)
    px = np.mod(x * tau, tau) - 250.0
    py = np.mod(y * tau, tau) - 250.0
    ix, iy = px.copy(), py.copy()
    c = np.ones_like(px)
    for n in range(iter):
        t = tiempo * (1.0 - (3.5 / (n + 1)))
        ix, iy = (px + np.cos(t - ix) + np.sin(t + iy),
                  py + np.sin(t - iy) + np.cos(t + ix))
        c += 1.0 / np.hypot(px / (np.sin(ix + t) / inten), py / (np.cos(iy + t) / inten))
    c /= iter
    c = 1.17 - np.power(c, 1.4)
    return np.clip(np.power(np.abs(c), 8.0), 0, 1)


for nombre, t in (("causticas1.png", 23.0), ("causticas2.png", 31.5)):
    v = causticas(t)
    a = (np.power(np.clip(v, 0, 1), 1.5) * 255).astype(np.uint8)   # transparencia: solo se ven las líneas finas de luz
    rgb = np.zeros((TAM, TAM, 3), np.uint8)
    rgb[..., 0], rgb[..., 1], rgb[..., 2] = 255, 214, 236         # blanco rosado
    Image.fromarray(np.dstack([rgb, a]), "RGBA").save(OUT / nombre, optimize=True)
    print("ok", nombre, (OUT / nombre).stat().st_size // 1024, "KB")

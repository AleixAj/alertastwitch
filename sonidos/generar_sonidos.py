# Genera los sonidos de las alertas (sintetizados, sin samples externos).
# Uso: python generar_sonidos.py   -> crea follow.wav/.mp3 y sub.wav/.mp3
# Estilo: ambiente suave de fondo (nada de campanas fuertes).
import numpy as np, wave, subprocess, shutil, pathlib

SR = 44100
OUT = pathlib.Path(__file__).parent if "__file__" in globals() else pathlib.Path(".")
rng = np.random.default_rng(7)

PEAK = 0.25   # nivel interno de trabajo (el volumen final lo fija TARGET_LUFS)
TARGET_LUFS = -20.0   # volumen final: sonoridad del momento más fuerte.
                      # Un directo suele ir a -14/-16 LUFS; -20 se oye claro sin tapar la voz.
                      # Más alto: -18. Más bajo: -23.


def buf(seconds):
    return np.zeros((int(seconds * SR), 2))


def place(mix, t0, mono, pan=0.0, gain=1.0):
    """Mezcla un sonido mono en estéreo. pan: -1 izq, 1 der."""
    i = int(t0 * SR)
    if i >= len(mix):
        return
    s = mono[: len(mix) - i] * gain
    l = np.cos((pan + 1) * np.pi / 4)
    r = np.sin((pan + 1) * np.pi / 4)
    mix[i:i + len(s), 0] += s * l
    mix[i:i + len(s), 1] += s * r


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def lowpass(x, cutoff):
    """Filtro paso bajo de 1 polo; cutoff puede ser array (barrido)."""
    cutoff = np.broadcast_to(cutoff, x.shape)
    a = 1 - np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for n in range(len(x)):
        acc += a[n] * (x[n] - acc)
        y[n] = acc
    return y


def noise(dur):
    return rng.standard_normal(int(dur * SR))


def fade_shape(dur, fin, fout):
    t = tt(dur)
    return np.clip(t / fin, 0, 1) * np.clip((dur - t) / fout, 0, 1)


# ---------- burbujas ----------
def bubble(freq, dur=None):
    """Burbuja real: tono que sube un poco mientras se apaga (tipo 'blup')."""
    dur = dur or np.clip(18 / freq, 0.03, 0.09)
    t = tt(dur)
    f = freq * (1 + 1.8 * t / dur)                 # sube al final
    ph = 2 * np.pi * np.cumsum(f) / SR
    e = np.clip(t / 0.004, 0, 1) * np.exp(-t / (dur * 0.35))
    return np.sin(ph) * e


def soft_pop(freq=500):
    """'Plop' redondo y suave (burbuja que revienta)."""
    d = 0.12
    t = tt(d)
    f = freq * (1 + 2.5 * t / d)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.clip(t / 0.003, 0, 1) * np.exp(-t / 0.03)
    return lowpass(body, 2500)


def underwater(dur):
    """Ambiente submarino: rumor grave muy suave."""
    n = lowpass(lowpass(noise(dur), 350), 350)
    return n / np.abs(n).max() * fade_shape(dur, 0.4, 0.8)


def bubble_stream(mix, t0, dur, count, fmin, fmax, gain, pan=(-.6, .6), accel=1.0):
    for k in range(count):
        tk = t0 + dur * (k / count) ** accel + rng.uniform(-.015, .015)
        place(mix, max(tk, 0), bubble(rng.uniform(fmin, fmax)), rng.uniform(*pan), gain * rng.uniform(.6, 1))


# ---------- nieve ----------
def wind(dur, lo, hi, swell=0.5):
    """Viento suave (ruido filtrado que crece y se apaga)."""
    n = noise(dur)
    t = tt(dur)
    x = lowpass(n, hi) - lowpass(n, lo)
    shape = np.where(t / dur < swell, (t / dur / swell) ** 1.5, ((1 - t / dur) / (1 - swell)) ** 1.5)
    x = x * shape
    return x / (np.abs(x).max() + 1e-9)


def snow_puff():
    """'Puf' de nieve: ruido grave y apagado, como un montón de nieve que cae."""
    d = 0.5
    x = lowpass(lowpass(noise(d), 900), 900)
    x *= np.clip(tt(d) / 0.01, 0, 1) * np.exp(-tt(d) / 0.12)
    return x / np.abs(x).max()


def glisten(dur, density, gain_db=-30):
    """Brillo de copos: chispitas agudas muy flojitas (no campanas)."""
    out = np.zeros(int(dur * SR))
    for _ in range(int(dur * density)):
        f = rng.uniform(4000, 8000)
        d = rng.uniform(.04, .1)
        s = np.sin(2 * np.pi * f * tt(d)) * np.exp(-tt(d) / (d / 4)) * np.clip(tt(d) / .002, 0, 1)
        i = rng.integers(0, max(1, len(out) - len(s)))
        out[i:i + len(s)] += s * rng.uniform(.4, 1)
    return out * 10 ** (gain_db / 20) * 8


def crunch(dur=0.35):
    """Crujido de hielo/nieve pisada muy suave."""
    out = np.zeros(int(dur * SR))
    for _ in range(40):
        d = 0.006
        c = lowpass(noise(d), 4000) * np.exp(-tt(d) / 0.0015)
        i = rng.integers(0, len(out) - len(c))
        out[i:i + len(c)] += c * rng.uniform(.3, 1)
    return out / np.abs(out).max() * fade_shape(dur, .02, .1)


def frost(dur=1.1):
    """Congelación suave: escarcha que se forma (cristalitos que suben + aire fino).
    Todo con entrada lenta, sin golpes ni graves."""
    n = int(dur * SR)
    t = tt(dur)
    out = np.zeros(n)
    # 1) brillo de hielo: varios tonos que suben despacio y se abren
    for f0 in (1400, 1750, 2100, 2650, 3150):
        f = f0 * (1 + 0.35 * t / dur)
        ph = 2 * np.pi * np.cumsum(f) / SR + rng.uniform(0, 6.28)
        e = np.clip(t / 0.18, 0, 1) ** 2 * np.exp(-t / (dur * 0.45))
        trem = 0.8 + 0.2 * np.sin(2 * np.pi * rng.uniform(5, 8) * t)
        out += np.sin(ph) * e * trem * 0.18
    # 2) cristalitos que se extienden (cada vez más agudos y seguidos)
    for k in range(34):
        pos = (k / 34) ** 0.8
        f = 2200 + 3200 * pos + rng.uniform(-200, 200)
        d = 0.09
        s = np.sin(2 * np.pi * f * tt(d)) * np.clip(tt(d) / 0.008, 0, 1) * np.exp(-tt(d) / 0.025)
        i = int(pos * min(0.75, dur - 0.1) * SR)                         # cabe en cualquier duración
        out[i:i + len(s)] += s[: n - i] * rng.uniform(.05, .11)
    # 3) aire muy fino (sin graves)
    nz = noise(dur)
    air = lowpass(nz, 9000) - lowpass(nz, 3500)
    air *= np.clip(t / 0.25, 0, 1) * np.exp(-t / 0.35) * 0.35
    out += air
    return out / (np.abs(out).max() + 1e-9)


def epiano(midi, dur=2.4, vel=1.0):
    """Nota de piano eléctrico cálido (tipo Rhodes), con vaivén de cinta lo-fi."""
    t = tt(dur)
    f = 440 * 2 ** ((midi - 69) / 12)
    wobble = 1 + 0.0025 * np.sin(2 * np.pi * 0.7 * t + rng.uniform(0, 6.28))   # cinta
    ph = 2 * np.pi * np.cumsum(f * wobble) / SR
    body = np.sin(ph) + 0.25 * np.sin(2 * ph) * np.exp(-t / 0.4)
    tine = 0.12 * np.sin(4 * ph) * np.exp(-t / 0.08)                           # "ding" suave del Rhodes
    env = np.clip(t / 0.012, 0, 1) * np.exp(-t / 0.9)
    return (body + tine) * env * vel


def lofi(x, cutoff=2600, drive=1.6):
    """Toque lo-fi: sin agudos duros y un poco saturado."""
    x = lowpass(lowpass(x, cutoff), cutoff)
    return np.tanh(x * drive) / np.tanh(drive)


def lofi_chord(notes=(52, 63, 66, 68, 71), motif=((0.55, 78), (0.82, 75))):
    """Acorde rasgueado (por defecto Mi maj9) + notitas arriba."""
    out = np.zeros(int(3.2 * SR))
    for k, m in enumerate(notes):
        s = epiano(m, 2.6, 0.9 if k else 0.7)
        i = int(k * 0.055 * SR)
        out[i:i + len(s)] += s[: len(out) - i]
    for t0, m in motif:
        s = epiano(m, 1.8, 0.45)
        i = int(t0 * SR)
        out[i:i + len(s)] += s[: len(out) - i]
    out = lofi(out / np.abs(out).max())
    return out / np.abs(out).max()


def charge_swell(dur=0.65):
    """Carga de energía suave: tonos que suben despacio (sin graves ni golpes)."""
    t = tt(dur)
    out = np.zeros_like(t)
    for f0 in (330, 440, 554, 660):
        f = f0 * (1 + 1.2 * (t / dur) ** 1.5)
        out += np.sin(2 * np.pi * np.cumsum(f) / SR)
    env = (t / dur) ** 2 * np.clip((dur - t) / 0.03, 0, 1)
    return lowpass(out * env, 3000) / 4


def beam_pad(dur=1.2):
    """El rayo: un acorde brillante y sostenido que se abre y se apaga (tipo pad)."""
    t = tt(dur)
    out = np.zeros_like(t)
    for m in (69, 76, 81, 85, 88):
        f = 440 * 2 ** ((m - 69) / 12)
        for det in (-0.004, 0.004):                                        # dos voces un poco desafinadas = coro
            out += np.sin(2 * np.pi * f * (1 + det) * t + rng.uniform(0, 6.28))
    env = np.clip(t / 0.06, 0, 1) * np.exp(-t / (dur * 0.45))
    return lowpass(out * env, 4200) / 10


def zip_up(dur=0.75):
    """La esfera sale disparada: tono que sube rápido, suave."""
    t = tt(dur)
    f = 500 * (4 ** (t / dur))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.clip(t / 0.05, 0, 1) * np.clip((dur - t) / 0.25, 0, 1)
    return lowpass(x, 3500)


# ---------- efectos globales ----------
def reverb(mix, seconds=1.6, wet=0.25):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-t / (seconds / 5))[:, None]
    ir[: int(0.012 * SR)] = 0
    ir /= np.sqrt((ir ** 2).sum(axis=0))
    L = len(mix) + n
    size = 1 << (L - 1).bit_length()
    out = np.empty((L, 2))
    for c in range(2):
        out[:, c] = np.fft.irfft(np.fft.rfft(mix[:, c], size) * np.fft.rfft(ir[:, c], size), size)[:L]
    dry = np.vstack([mix, np.zeros((n, 2))])
    return dry + out * wet * 6


def master(mix, fade_start, fade_end, peak=None):
    """Normaliza y apaga el sonido poco a poco (curva suave) entre fade_start y fade_end."""
    mix = mix[: int(fade_end * SR)]
    mix = mix / np.abs(mix).max() * (peak or PEAK)
    t = np.arange(len(mix)) / SR
    k = np.clip((t - fade_start) / (fade_end - fade_start), 0, 1)
    mix *= (0.5 + 0.5 * np.cos(np.pi * k))[:, None] ** 1.5
    return mix


def write_wav(path, mix):
    data = (np.clip(mix, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(data.tobytes())


def loudest_lufs(path):
    """Sonoridad máxima (ventanas de 3 s, EBU R128) medida con ffmpeg."""
    import re
    out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    return max(float(x) for x in re.findall(r"S:\s*(-?[0-9]+\.[0-9])", out))


def save(name, mix):
    wav = OUT / f"{name}.wav"
    write_wav(wav, mix)
    if shutil.which("ffmpeg"):
        # ajustar al volumen objetivo sin pasar de -3 dB de pico
        gain = 10 ** ((TARGET_LUFS - loudest_lufs(wav)) / 20)
        gain = min(gain, 0.7 / np.abs(mix).max())
        mix = mix * gain
        write_wav(wav, mix)
        print(f"   {name}: {loudest_lufs(wav):.1f} LUFS, pico {20 * np.log10(np.abs(mix).max()):.1f} dB")
    if shutil.which("ffmpeg"):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-b:a", "192k", str(OUT / f"{name}.mp3")], check=True)
    print("ok", name, f"{len(mix) / SR:.1f}s")


# ================= FOLLOW (burbujas bajo el agua) =================
def make_follow():
    # Tiempos de la animación (6 s): plop 0.9 | panel 0.95 | letras a burbuja 3.6
    # | revientan ~4.57 | tarjeta->burbuja 4.0 | pop final 5.0 | se desvanece 5.4-5.9
    mix = buf(6.2)
    bubble_stream(mix, 0.0, 0.85, 34, 300, 900, 0.22, accel=0.7)           # columna de burbujas
    place(mix, 0.9, soft_pop(380), 0, 0.3)                                 # revienta la burbuja grande
    bubble_stream(mix, 0.95, 0.5, 14, 600, 1300, 0.12, pan=(-.9, .9))      # gotitas del plop
    for k in range(10):                                                    # letras entrando (1.05 s -> 1.65 s)
        place(mix, 1.05 + k / 10 * 0.6 + 0.12, bubble(rng.uniform(900, 1400)), -0.6 + k * 0.13, 0.06)
    for t0 in np.arange(1.8, 3.4, 0.45):                                   # burbujeo suave de fondo
        bubble_stream(mix, t0, 0.3, 3, 350, 800, 0.05, pan=(-.9, .9))
    for k in range(10):                                                    # 3.6 s: cada letra se mete en su burbuja
        place(mix, 3.6 + k / 10 * 0.4, bubble(rng.uniform(400, 650)), -0.6 + k * 0.13, 0.12)
    for k in range(10):                                                    # ~4.57 s: las letras revientan arriba
        place(mix, 4.57 + k / 10 * 0.4, soft_pop(rng.uniform(600, 900)), -0.6 + k * 0.13, 0.16)
    place(mix, 4.0, bubble(300, 0.12), 0, 0.12)                            # 4.0 s: la tarjeta se hace burbuja
    place(mix, 5.0, soft_pop(420), 0, 0.35)                                # 5.0 s: pop final
    bubble_stream(mix, 5.02, 0.35, 8, 700, 1400, 0.08, pan=(-.9, .9))
    mix *= 0.3                                                             # burbujas de fondo (como los brillos del sub)
    place(mix, 0.95, lofi_chord((50, 61, 64, 66, 69), ((0.5, 76), (0.75, 73))), 0, 0.8)   # acorde lo-fi al salir el panel
    # la alerta se desvanece de 5.4 s a 5.9 s -> el sonido se apaga suave de 5.1 s a 6.0 s
    mix = reverb(mix, 1.4, 0.2)
    for ch in range(2):                                                    # toque lo-fi a todo (cálido, sin agudos duros)
        mix[:, ch] = lowpass(lowpass(mix[:, ch], 3800), 3800)
    return master(mix, 5.1, 6.0)


# ================= SUB (nieve y viento) =================
def make_sub():
    mix = buf(11)
    place(mix, 0.0, glisten(1.1, 20, -30), 0, 0.25)                         # brillos acercándose
    place(mix, 1.05, lofi_chord(), 0, 1.0)                                 # acorde lo-fi al salir el panel
    place(mix, 1.07, glisten(1.4, 26, -28), 0.2, 0.25)                      # polvo de nieve brillante
    place(mix, 1.07, glisten(1.4, 26, -28), -0.2, 0.25)
    place(mix, 2.0, glisten(5.0, 4, -34), 0, 0.25)                          # destellos muy flojos de fondo
    place(mix, 9.57, glisten(1.0, 24, -30), 0, 0.25)
    # la alerta se desvanece de 9.95 s a 10.55 s -> el sonido se apaga suave de 9.8 s a 10.8 s
    return master(reverb(mix, 2.0, 0.25), 9.8, 10.8)


# ================= SUBS REGALADAS (Lux, Chispa Final) =================
# Sonidos oficiales opcionales: si dejas clips en la carpeta sonidos/lux/ con estos
# nombres (.wav, .mp3 u .ogg), se usan en vez de los sintetizados. El script busca el
# momento más fuerte de cada clip y lo hace coincidir con el instante de la animación.
LUX_CLIPS = {
    # archivo          momento de la animación (s)   volumen
    "carga":         (1.10, 0.9),   # la luz se carga (su punto fuerte cae justo antes del rayo)
    "chispa_final":  (1.50, 1.0),   # el disparo del rayo
    "salida":        (6.90, 0.7),   # estallido final
}


def load_clip(name, folder_name="lux"):
    """Carga sonidos/<carpeta>/<name>.* como mono 44.1 kHz (con ffmpeg). None si no existe."""
    folder = OUT / folder_name
    for ext in ("wav", "mp3", "ogg"):
        f = folder / f"{name}.{ext}"
        if f.exists() and shutil.which("ffmpeg"):
            raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(f), "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
                                 capture_output=True, check=True).stdout
            x = np.frombuffer(raw, "<i2").astype(float) / 32768
            return x / (np.abs(x).max() + 1e-9)
    return None


def place_official(mix, name, folder_name="lux", table=None):
    """Coloca un clip oficial con su punto más fuerte en el instante indicado. True si lo usó."""
    table = table or LUX_CLIPS
    clip = load_clip(name, folder_name)
    if clip is None:
        return False
    at, gain = table[name]
    env = np.convolve(clip ** 2, np.ones(441) / 441, mode="same")        # energía en ventanas de 10 ms
    peak = np.argmax(env) / SR
    start = at - peak
    if start < 0:                                                        # si empieza antes del 0, se recorta
        clip = clip[int(-start * SR):]
        start = 0
    place(mix, start, clip, 0, gain)
    print(f"   (usando clip oficial: {folder_name}/{name})")
    return True


def make_gift():
    # Tiempos: carga 0.2-1.5 | CHISPA FINAL 1.5 | panel 1.6 | letras se deshacen 6.3
    # | estallido 6.9 | se desvanece 7.3-7.9
    mix = buf(8.2)
    if not place_official(mix, "carga"):
        place(mix, 0.3, charge_swell(1.2), 0, 0.5)                         # la luz se carga
        place(mix, 0.3, glisten(1.2, 16, -30), 0, 0.25)
    if not place_official(mix, "chispa_final"):
        place(mix, 1.5, beam_pad(1.3), 0, 0.55)                            # el rayo
        place(mix, 1.5, glisten(1.2, 26, -28), 0.3, 0.3)
        place(mix, 1.5, glisten(1.2, 26, -28), -0.3, 0.3)
    place(mix, 2.3, glisten(3.6, 3, -34), 0, 0.25)                         # brillitos de fondo
    place(mix, 6.3, glisten(0.6, 20, -30), 0, 0.3)                         # letras se deshacen en luz
    if not place_official(mix, "salida"):
        place(mix, 6.9, glisten(0.9, 30, -28), 0, 0.35)                    # estallido de estrellas
    mix *= 0.6
    place(mix, 1.6, lofi_chord((57, 68, 71, 73, 76), ((0.5, 81), (0.75, 80))), 0, 0.8)   # acorde lo-fi (La maj9)
    mix = reverb(mix, 1.8, 0.25)
    return master(mix, 7.1, 7.95)                                          # se apaga con la imagen (7.3-7.9 s)


# ================= RAID (noche nevada con auroras) =================
def aurora_pad(dur=2.0, notes=(60, 67, 71, 74)):
    """Fondo suave tipo aurora: acorde que entra muy despacio, con coro y un leve vaivén."""
    t = tt(dur)
    out = np.zeros_like(t)
    for m in notes:
        f = 440 * 2 ** ((m - 69) / 12)
        for det in (-0.005, 0.0, 0.005):
            out += np.sin(2 * np.pi * f * (1 + det) * t + rng.uniform(0, 6.28))
    shimmer = 0.85 + 0.15 * np.sin(2 * np.pi * 0.8 * t)
    env = np.clip(t / (dur * 0.6), 0, 1) ** 2 * np.clip((dur - t) / 0.4, 0, 1)
    return lowpass(out * env * shimmer, 2600) / 12


def shooting_star(dur=0.7):
    """Estrella fugaz: brillito que baja de tono, muy suave."""
    t = tt(dur)
    f = 5200 * (0.45 ** (t / dur))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.clip(t / 0.02, 0, 1) * np.exp(-t / 0.22)
    return x


def glide(f0, f1, dur, attack=0.08):
    """Tono suave que se desliza de f0 a f1 (brillo que se abre o se cierra)."""
    t = tt(dur)
    f = f0 * (f1 / f0) ** (t / dur)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR)
    x += 0.35 * np.sin(2 * np.pi * np.cumsum(f * 2.01) / SR)             # armónico suave = más brillo
    env = np.clip(t / attack, 0, 1) * np.clip((dur - t) / (dur * 0.5), 0, 1) ** 1.5
    return lowpass(x * env, 5000) / 1.35


def place_wide(mix, t0, mono, gain, spread=0.8, delay=0.012):
    """Coloca un sonido abierto en estéreo (un lado un pelín retrasado = más espacio)."""
    place(mix, t0, mono, -spread, gain * 0.75)
    place(mix, t0 + delay, mono, spread, gain * 0.75)


def make_raid():
    # Tiempos de la animación:
    #  0-2.4 la aurora aparece | fugaces 0.4 (izq.) 1.0 (der.) 3.4 (izq.) 5.2 (der.) 7.3 (centro)
    #  1.45 pilar de luz | 1.5 línea de luz | 1.75 se abre la banda | 2.0-3.2 contador
    #  6.1 letras se van | 6.85 banda se cierra | 7.05-7.6 la línea se encoge | 7.55 punto de luz
    #  6.9-8.2 la aurora se apaga | 8.3-8.8 todo se funde
    mix = buf(9.0)
    # --- la aurora aparece: coro que crece poco a poco
    place_wide(mix, 0.0, aurora_pad(2.6, (60, 67, 71, 74)), 0.9, spread=0.6)
    place(mix, 0.3, glisten(2.0, 6, -34), 0, 0.2)
    # --- estrellas fugaces, cada una en su lado
    for t0, pan in [(0.4, -0.8), (1.0, 0.8), (3.4, -0.4), (5.2, 0.6), (7.3, 0.0)]:
        place(mix, t0, shooting_star(), pan, 0.16)
    # --- pilar + línea de luz que se estira de lado a lado
    place(mix, 1.45, glisten(0.9, 22, -28), 0, 0.28)
    line = glide(900, 2400, 0.4, attack=0.03)
    place(mix, 1.5, line, -0.7, 0.12)
    place(mix, 1.52, line, 0.7, 0.12)
    # --- contador: notitas que suben mientras cuenta
    for k, m in enumerate([72, 74, 76, 79, 81, 84, 86, 88]):
        at = 2.0 + 1.2 * (1 - (1 - (k + 1) / 8) ** 0.33) - 0.12
        place(mix, at, epiano(m, 0.9, 0.35), -0.5 + k * 0.14, 0.11)
    # --- fondo mientras se lee
    place_wide(mix, 3.0, aurora_pad(3.6, (64, 71, 74, 79)), 0.32, spread=0.7)
    # --- final: letras que se van, la línea se cierra hacia el centro, punto de luz
    place(mix, 6.1, glisten(0.6, 18, -30), 0, 0.25)
    close = glide(2200, 700, 0.55, attack=0.05)
    place(mix, 7.05, close, -0.6, 0.1)
    place(mix, 7.07, close, 0.6, 0.1)
    place(mix, 7.55, epiano(91, 1.4, 0.5), 0, 0.12)                        # "ting" suave del punto de luz
    place(mix, 7.56, glisten(0.5, 20, -30), 0, 0.2)
    # --- la aurora se apaga: el coro baja
    place_wide(mix, 6.9, aurora_pad(1.6, (67, 64, 60, 55)), 0.38, spread=0.6)
    mix *= 0.6
    # --- acorde lo-fi justo cuando se abre la banda
    place(mix, 1.75, lofi_chord((48, 64, 67, 71, 74), ((0.5, 79), (0.75, 76))), 0, 0.8)   # Do maj9
    mix = reverb(mix, 2.6, 0.32)                                           # más espacio (cielo abierto)
    return master(mix, 7.9, 8.85)                                          # se apaga con la imagen (8.3-8.8 s)


if __name__ == "__main__" or True:
    save("follow", make_follow())
    save("sub", make_sub())
    save("gift", make_gift())
    save("raid", make_raid())

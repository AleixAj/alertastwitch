(function () {
  // ===== Ajustes de esta alerta =====
  var ROOT = '.aurora-raid';     // contenedor de toda la escena
  var MAX_FONT = 74;       // tamaño máximo del nombre (px)
  var SIDE = 80;          // relleno lateral del panel (px), para calcular el hueco del nombre

  var tries = 0;
  var root = null;             // la escena de ESTA alerta (aunque haya otra en pantalla)

  // Busca dentro de esta alerta (nunca en otra que siga en pantalla)
  function $(id) { return root ? root.querySelector('#' + id) : null; }

  // Texto de una variable de Streamlabs; vacío si no la ha rellenado ({algo})
  function real(id) {
    var el = $(id);
    var t = el ? el.textContent.trim() : '';
    return t && t.charAt(0) !== '{' ? t : '';
  }

  // Número de una variable, aceptando "1,234", "1.234" o "1 234"
  function num(id) {
    var t = real(id).replace(/[^\d]/g, '');
    return t ? parseInt(t, 10) : NaN;
  }

  // Separa el nombre en letras "de verdad" (un emoji compuesto como 👩‍🚀 cuenta como una)
  function letters(s) {
    if (window.Intl && Intl.Segmenter) {
      return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s), function (x) { return x.segment; });
    }
    return Array.from(s);
  }

  // Momento en que empezó la animación de la escena (el mismo reloj que usa el CSS).
  // Así lo que se mueve con JS va sincronizado aunque el código cargue un poco tarde.
  function sceneStart() {
    var a = root && root.getAnimations ? root.getAnimations()[0] : null;
    return a && a.startTime != null ? a.startTime : performance.now();
  }

  // Si Streamlabs mete la alerta dentro de su propia caja (con animación de entrada),
  // la escena quedaría encerrada en esa caja. Aquí se recoloca para ocupar toda la pantalla.
  function fitScene() {
    root.style.left = '0px';
    root.style.top = '0px';
    root.style.width = '';
    root.style.height = '';
    var r = root.getBoundingClientRect();
    if (Math.abs(r.left) > 1 || Math.abs(r.top) > 1 ||
        Math.abs(r.width - window.innerWidth) > 1 || Math.abs(r.height - window.innerHeight) > 1) {
      root.style.left = (-r.left) + 'px';
      root.style.top = (-r.top) + 'px';
      root.style.right = 'auto';
      root.style.bottom = 'auto';
      root.style.width = window.innerWidth + 'px';
      root.style.height = window.innerHeight + 'px';
    }
  }

  // Ajusta el tamaño del nombre midiendo lo que ocupa de verdad
  // (nombres largos, emojis, japonés, coreano...)
  function fitName(el) {
    el.style.fontSize = MAX_FONT + 'px';
    var room = Math.min(window.innerWidth * 0.86, 1200) - SIDE * 2 - 20;   // hueco dentro del panel
    var w = el.scrollWidth;
    if (w > room) el.style.fontSize = Math.max(22, Math.floor(MAX_FONT * room / w)) + 'px';
  }

  function build(el, parts) {
    parts.forEach(function (c, i) {
      var s = document.createElement('span');
      s.className = 'ch';
      s.style.setProperty('--i', i);
      perLetter(s, i);
      var inner = document.createElement('i');
      var t = c === ' ' ? '\u00A0' : c;
      // capas: contorno/brillo detrás (.o), destello (.g) y la letra de color delante (.f)
      ['o', 'g', 'f'].forEach(function (cls) {
        var b = document.createElement('b');
        b.className = cls;
        b.textContent = t;
        inner.appendChild(b);
      });
      s.appendChild(inner);
      el.appendChild(s);
    });
  }

  function setup() {
    // la escena más reciente que aún no se ha preparado
    var roots = document.querySelectorAll(ROOT + ':not([data-init])');
    root = roots.length ? roots[roots.length - 1] : null;
    var el = root ? root.querySelector('#sub-name') : null;
    if (!el) {                                  // el HTML aún no está: reintentar un momento
      if (tries++ < 40) setTimeout(setup, 25);
      return;
    }
    root.setAttribute('data-init', '1');

    var name = getName(el);
    var parts = letters(name);
    el.setAttribute('data-split', '1');
    el.textContent = '';
    root.style.setProperty('--n', Math.max(1, parts.length));
    build(el, parts);
    extras();

    fitName(el);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitName(el); });

    fitScene();
    [150, 600, 1200].forEach(function (ms) { setTimeout(fitScene, ms); });
    window.addEventListener('resize', function () { fitScene(); fitName(el); });
  }

  // ===== Aurora boreal en tiempo real =====
  // Ruido "value noise" con varias capas (fbm): da formas orgánicas que cambian solas.
  function makeNoise(seed) {
    var p = [];
    for (var i = 0; i < 512; i++) { seed = (seed * 16807) % 2147483647; p.push((seed % 1000) / 1000); }
    return function (x) {
      var i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
      var a = p[i & 511], b = p[(i + 1) & 511];
      return a + (b - a) * u;                       // 0..1
    };
  }
  function smooth(x) { return x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x); }   // curva suave 0 -> 1
  function fbm(nz, x) { return nz(x) * .55 + nz(x * 2.1 + 17) * .3 + nz(x * 4.3 + 41) * .15; }

  // Colores de abajo (borde) hacia arriba: fleco rosa -> verde brillante -> turquesa -> violeta
  function lut(stops) {
    var out = [];
    for (var k = 0; k < 64; k++) {
      var h = k / 63, j = 0;
      while (j < stops.length - 2 && h > stops[j + 1][0]) j++;
      var s0 = stops[j], s1 = stops[j + 1], t = (h - s0[0]) / (s1[0] - s0[0]);
      out.push([0, 1, 2, 3].map(function (c) { return s0[1][c] + (s1[1][c] - s0[1][c]) * t; }));
    }
    return out;
  }

  function aurora(canvas, start) {
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    // Media resolución + trazos suaves con la tarjeta gráfica: nítida pero sin píxeles
    var SCALE = 2;
    var W, H;
    function size() {
      W = Math.max(160, Math.round(canvas.clientWidth / SCALE));
      H = Math.max(90, Math.round(canvas.clientHeight / SCALE));
      canvas.width = W; canvas.height = H;
    }
    size();

    // Cada cortina tiene una "tira" de color vertical (de abajo a arriba) que se estira
    // para dibujar cada columna de luz: rápido y perfectamente suave.
    var PAD = .08;                                   // parte de la tira que queda bajo el borde (se funde)
    function strip(stops) {
      var cv = document.createElement('canvas');
      cv.width = 1; cv.height = 256;
      var g = cv.getContext('2d'), L = lut(stops);
      for (var py = 0; py < 256; py++) {
        var f = 1 - py / 255;                          // 0 = abajo del todo, 1 = arriba
        var c, a;
        var base = L[4];                                                     // color justo en el borde
        if (f < PAD) { c = base; a = base[3] * Math.pow(f / PAD, 2); }        // se funde por debajo del borde (sin cortes)
        else {
          var hgt = (f - PAD) / (1 - PAD);
          c = L[Math.max(4, Math.round(hgt * 63))]; a = c[3];
        }
        g.fillStyle = 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a.toFixed(3) + ')';
        g.fillRect(0, py, 1, 1);
      }
      return cv;
    }

    // Estilo de la referencia: columnas anchas y difuminadas, casi blancas/doradas abajo,
    // rosa y magenta en el centro, franjas turquesa, y se desvanecen arriba.
    var curtains = [
      // base: dónde nace la luz (0 arriba, 1 abajo) · len: altura · ray: nº de columnas
      { nz: makeNoise(11), rz: makeNoise(12), hz: makeNoise(13), base: .74, tilt: -.14, amp: .15, len: .8, ray: 15, speed: .025, from: 0, to: 1, bright: 1,
        img: strip([[0, [255, 235, 170, 0]], [.05, [255, 230, 160, .9]], [.18, [255, 120, 190, .95]], [.45, [240, 80, 190, .7]], [.75, [170, 80, 220, .35]], [1, [120, 60, 200, 0]]]) },
      { nz: makeNoise(21), rz: makeNoise(22), hz: makeNoise(23), base: .66, tilt: .16, amp: .13, len: .75, ray: 12, speed: .035, from: .15, to: 1, bright: 1.1,
        img: strip([[0, [210, 255, 245, 0]], [.08, [170, 255, 235, .85]], [.3, [70, 235, 225, .85]], [.65, [70, 170, 255, .4]], [1, [120, 110, 255, 0]]]) },
      { nz: makeNoise(31), rz: makeNoise(32), hz: makeNoise(33), base: .6, tilt: -.1, amp: .12, len: .65, ray: 18, speed: .02, from: 0, to: .75, bright: .6,
        img: strip([[0, [255, 150, 210, 0]], [.1, [255, 140, 210, .7]], [.5, [200, 100, 230, .45]], [1, [140, 80, 220, 0]]]) }
    ];

    var last = -1;
    function frame(now) {
      var t = (now - start) / 1000;
      // solo mientras dura la alerta y mientras esté en pantalla
      if (t < 9.5 && canvas.isConnected) requestAnimationFrame(frame);
      else return;
      // se mueve despacio: con 30 fotogramas por segundo va igual de suave y gasta la mitad
      if (last >= 0 && now - last < 32) return;
      last = now;
      // Aparición gradual (unos 2.4 s): nace tenue en el centro, se extiende hacia los lados,
      // las columnas crecen hacia arriba y va ganando brillo. Luego pulso al salir el panel y apagado.
      var reveal = smooth(t / 2.4);                   // hasta dónde se ha extendido
      var grow = .2 + .8 * smooth(t / 2.2);           // altura de las columnas
      var appear = smooth(t / 1.8);                   // brillo general
      var pulse = 1 + .4 * Math.exp(-Math.pow((t - 1.7) / .4, 2));
      var fade = 1 - smooth((t - 6.9) / 1.3);        // al final: se apaga y las columnas bajan
      if (Math.round(canvas.clientWidth / SCALE) !== W || Math.round(canvas.clientHeight / SCALE) !== H) size();   // si la escena cambió de tamaño
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';       // la luz se suma, como la luz real
      var STEP = 3, CW = 8;                           // una columna cada 3 px, de 8 px de ancho (se solapan)
      for (var c = 0; c < curtains.length; c++) {
        var C = curtains[c];
        var x0 = C.from * W, x1 = C.to * W;
        for (var x = x0; x < x1; x += STEP) {
          var u = x / W;
          var edge = Math.min(1, (x - x0) / (W * .12), (x1 - x) / (W * .12));   // extremos difuminados
          var open = smooth((reveal * .85 - Math.abs(u - .5) + .12) / .3);                  // se extiende desde el centro
          if (edge <= 0 || open <= 0) continue;
          // borde de abajo: diagonal + pliegues que se desplazan muy despacio
          var yb = (C.base + C.tilt * (u - .5) + (fbm(C.nz, u * 3.2 + t * C.speed) - .5) * 2 * C.amp
                    + (C.hz(u * 22 + t * .1) - .5) * .06) * H;
          // columnas de luz que se mueven, brillan y se apagan
          var ray = fbm(C.rz, u * C.ray + t * .12);
          ray = Math.max(0, ray * 1.9 - .65);
          ray = Math.min(1, ray * 1.4) * (.7 + .3 * C.rz(u * 90 + t * .25));
          var inten = ray * edge * open * appear * C.bright * pulse * fade;
          if (inten < .01) continue;
          var len = (C.len * (.6 + .5 * fbm(C.hz, u * 4 - t * .08))) * H * grow * (.35 + .65 * fade);
          var full = len / (1 - PAD);                  // altura total de la tira (incluye la parte que se funde)
          ctx.globalAlpha = Math.min(1, inten * STEP / CW * 1.2);   // las columnas se solapan: se reparte la luz
          ctx.drawImage(C.img, 0, 0, 1, 256, x - CW / 2, yb + full * PAD - full, CW, full);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    requestAnimationFrame(frame);
  }

  // ===== Propio de la alerta de RAID =====
  function getName(el) { return el.textContent.trim(); }
  function perLetter() {}
  function extras() {
    var start = sceneStart();
    aurora(root.querySelector('.aurora-canvas'), start);

    // Streamlabs cambia {amount} por el nº de espectadores de la raid.
    // El número sube de 0 al total entre los 2.0 s y los 3.2 s de la animación.
    var n = num('raid-amount');
    var t = $('raid-text');
    if (!t || !(n > 0)) return;
    t.innerHTML = 'llega con <b class="count">0</b> ' + (n === 1 ? 'persona' : 'personas');
    var count = t.querySelector('.count');
    count.style.minWidth = String(n).length + 'ch';   // reserva el ancho: el texto no "baila" al contar
    function step(now) {
      var p = Math.min(1, Math.max(0, (now - start - 2000) / 1200));
      count.textContent = Math.round(n * (1 - Math.pow(1 - p, 3)));   // sube rápido y frena al final
      if (p < 1 && count.isConnected) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }


  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();

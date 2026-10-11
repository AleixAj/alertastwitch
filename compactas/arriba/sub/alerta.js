(function () {
  // ===== Ajustes de esta alerta =====
  var ROOT = '.snowscape';     // contenedor de toda la escena
  var MAX_FONT = 76;       // tamaño máximo del nombre (px)
  var SIDE = 64;          // relleno lateral del panel (px), para calcular el hueco del nombre

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
    var tf = root.style.transform;
    root.style.transform = 'none';          // medir sin la reducción de la versión compacta
    var r = root.getBoundingClientRect();
    root.style.transform = tf;
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

  // ===== Propio de la alerta de SUB =====
  function getName(el) { return el.textContent.trim(); }
  function perLetter(s) {
    // el viento se lleva cada letra hacia la derecha
    s.style.setProperty('--dx', (380 + Math.random() * 320).toFixed(0) + 'px');
    s.style.setProperty('--dy', (-160 + Math.random() * 260).toFixed(0) + 'px');
    s.style.setProperty('--rot', (180 + Math.random() * 360).toFixed(0) + 'deg');
  }
  function extras() {
    // Resuscripción: Streamlabs cambia {months} por el nº de meses.
    // Si es 1, no viene o no es un número, se deja "se ha unido a la familia".
    var n = num('sub-months');
    var t = $('sub-thanks');
    if (t && n > 1) t.textContent = '¡' + n + ' meses en la familia!';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();

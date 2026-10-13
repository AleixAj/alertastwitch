/* Overlay submarino de Luxanita: código común a todas las escenas.
   Cada escena (overlay.html, charla.html, empezando.html...) llama a montarEscena({ ... }).

   Opciones de montarEscena:
     huecos:  huecos transparentes con marco (aquí van el juego y la cámara en OBS):
              [{ tipo: 'game' | 'cam', x, y, w, h }]   (píxeles de una pantalla 1920x1080)
     paneles: marcos con contenido propio:
              [{ x, y, w, h, arte: 'escenas/x.jpg', mensaje: 'texto', sub: 'texto', puntos: true,
                 etiqueta: 'texto', notas: { cabecera: 'texto', lineas: [['🧋', 'texto'], ...] } }]
     ventana: true = ventana del acuario en el hueco de encima del marco pequeño de la derecha.
     titulo:  { cx, y, escala } (por defecto arriba en el centro, tamaño normal).
     fondo:   false = sin fondo marino (para jugar a pantalla completa).
*/
(function () {
  var R = 28;          // redondeo de las esquinas de los huecos
  var BORDER = 7;      // grosor del marco

  // ===== Distribución común (la misma en todas las escenas, para que al cambiar de escena todo encaje) =====
  window.GRANDE  = { x: 32,   y: 182, w: 1392, h: 783 };   // marco grande (16:9)
  window.PEQUENO = { x: 1448, y: 485, w: 440,  h: 480 };   // marco pequeño de la derecha

  var SKELETON =
    '<div id="stage">' +
    '  <div class="sea"><div class="sun"></div><div class="rays"></div><div class="bokeh"></div><div class="bubbles"></div></div>' +
    '  <div id="demo-layer"></div>' +
    '  <div id="deco" style="position:absolute;inset:0">' +
    '    <div class="porthole"><div class="ring"></div>' +
    '      <div class="water"><div class="rays"></div><div class="bokeh pbokeh"></div><div class="swimmers"></div><div class="pbub"></div></div>' +
    '      <div class="glass"></div></div>' +
    '    <div id="paneles"></div>' +
    '    <div id="frames"></div>' +
    '  </div>' +
    // el título va fuera del recorte: puede quedar por encima del marco del juego
    '  <div class="title"><div class="title-esc"><div class="title-card"><div class="clip"><div class="scales"></div><div class="shine"></div></div>' +
    '    <div class="name">Luxanita</div></div>' +
    '    <svg class="flake l"><use href="#flake"/></svg><svg class="flake r"><use href="#flake"/></svg></div></div>' +
    '</div>' +
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
    '  <symbol id="flake" viewBox="-52 -52 104 104"><g stroke="currentColor" stroke-width="7" stroke-linecap="round" fill="none">' +
    [0, 60, 120, 180, 240, 300].map(function (a) {
      return '<g transform="rotate(' + a + ')"><path d="M0 0V-44M0-24L-12-35M0-24L12-35M0-37L-7-45M0-37L7-45"/></g>';
    }).join('') +
    '  </g><circle r="8" fill="currentColor"/></symbol>' +
    '</defs></svg>';

  // ----- animales de la ventana -----
  // Dibujos: Fluent Emoji de Microsoft (MIT) y la orca de Twemoji retocada (CC BY 4.0). Ver animales/LICENCIA.txt.
  // w: ancho en px (para una ventana de 300 px) · s: segundos que tardan en cruzar · mira: hacia dónde mira el dibujo
  // up: suben desde abajo · fondo: caminan por abajo
  var CRIATURAS = [
    { img: 'animales/fish.png',          peso: 14, w: [95, 115],  s: [8, 11],   mira: 'izq' },
    { img: 'animales/tropical_fish.png', peso: 14, w: [95, 115],  s: [8, 11],   mira: 'izq' },
    { img: 'animales/blowfish.png',      peso: 10, w: [90, 105],  s: [10, 13],  mira: 'izq' },
    { img: 'animales/jellyfish.png',     peso: 9,  w: [115, 130], s: [13, 16],  up: true, pulse: true },
    { img: 'animales/octopus.png',       peso: 9,  w: [140, 155], s: [12, 15],  up: true, pulse: true },
    { img: 'animales/squid.png',         peso: 8,  w: [150, 165], s: [11, 14],  up: true, pulse: true },
    { img: 'animales/turtle.png',        peso: 9,  w: [175, 195], s: [14, 17],  mira: 'izq' },
    { img: 'animales/dolphin.png',       peso: 10, w: [230, 250], s: [7, 9],    mira: 'izq', fast: true, arc: 30 },
    { img: 'animales/shark.png',         peso: 10, w: [270, 295], s: [12, 15],  mira: 'izq', giro: 14 },
    { img: 'animales/whale.png',         peso: 7,  w: [470, 520], s: [22, 26],  mira: 'izq', giro: 6 },
    { img: 'animales/orca.png',          peso: 8,  w: [230, 255], s: [11, 14],  mira: 'izq', giro: 12 },
    { img: 'animales/seal.png',          peso: 7,  w: [160, 180], s: [9, 12],   mira: 'izq' },
    { img: 'animales/otter.png',         peso: 6,  w: [150, 170], s: [12, 15],  mira: 'izq', giro: 10 },
    { img: 'animales/shrimp.png',        peso: 8,  w: [85, 100],  s: [8, 11],   mira: 'izq' },
    { img: 'animales/penguin.png',       peso: 6,  w: [110, 125], s: [8, 10],   up: true, fast: true },
    { img: 'animales/lobster.png',       peso: 5,  w: [125, 140], s: [12, 15],  up: true },
    { img: 'animales/crab.png',          peso: 6,  w: [90, 105],  s: [12, 15],  fondo: true, fast: true }
  ];
  CRIATURAS.forEach(function (c) { c.id = c.img.replace(/^.*\/|\.png$/g, ''); });

  var COMETA_VEL = 110;   // velocidad de los destellos del borde, en px por segundo

  // números aleatorios repetibles (el fondo siempre sale igual)
  function mulberry(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  window.montarEscena = function (cfg) {
    var huecos = cfg.huecos || [];
    var paneles = cfg.paneles || [];
    var conFondo = cfg.fondo !== false;
    var demo = /[?&]demo\b/.test(location.search);
    // En OBS (existe window.obsstudio) los huecos son transparentes de verdad.
    // Abierto en un navegador normal se marcan con cuadritos para que se vea que son transparentes.
    var enOBS = !!window.obsstudio;
    if (!enOBS) document.documentElement.classList.add('preview');
    if (!conFondo) document.documentElement.classList.add('sin-fondo');

    document.body.insertAdjacentHTML('afterbegin', SKELETON);
    var stage = document.getElementById('stage');
    var frames = document.getElementById('frames');
    var rnd = mulberry(11);
    var html, i;

    // escala el escenario de 1920x1080 a la ventana, centrado (por si no es 16:9)
    // tamaño del lienzo: pantalla completa (1920x1080) o el que pida la escena (p. ej. solo el marco de la cámara)
    var LW = cfg.lienzo ? cfg.lienzo.w : 1920, LH = cfg.lienzo ? cfg.lienzo.h : 1080;
    stage.style.width = LW + 'px';
    stage.style.height = LH + 'px';
    function fit() {
      var s = Math.min(window.innerWidth / LW, window.innerHeight / LH);
      var x = (window.innerWidth - LW * s) / 2, y = (window.innerHeight - LH * s) / 2;
      stage.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + s + ')';
    }
    window.addEventListener('resize', fit);
    fit();

    // ----- recorte: el fondo y la decoración nunca pintan dentro de los huecos -----
    function rr(b) {
      var x = b.x, y = b.y, w = b.w, h = b.h, r = R;
      return 'M' + (x + r) + ' ' + y + 'H' + (x + w - r) + 'A' + r + ' ' + r + ' 0 0 1 ' + (x + w) + ' ' + (y + r) +
             'V' + (y + h - r) + 'A' + r + ' ' + r + ' 0 0 1 ' + (x + w - r) + ' ' + (y + h) +
             'H' + (x + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + x + ' ' + (y + h - r) +
             'V' + (y + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + (x + r) + ' ' + y + 'Z';
    }
    if (huecos.length) {
      var path = 'M0 0H' + LW + 'V' + LH + 'H0Z' + huecos.map(rr).join('');
      document.querySelector('.sea').style.clipPath = "path(evenodd, '" + path + "')";
      document.getElementById('deco').style.clipPath = "path(evenodd, '" + path + "')";
    }

    // ----- marcos con destellos -----
    function place(el, b, grow) {
      el.style.left = (b.x - grow) + 'px';
      el.style.top = (b.y - grow) + 'px';
      el.style.width = (b.w + grow * 2) + 'px';
      el.style.height = (b.h + grow * 2) + 'px';
    }
    function marco(b, desfase) {
      var f = document.createElement('div');
      f.className = conFondo ? 'frame' : 'frame solo';
      place(f, b, BORDER);
      if (!conFondo) {
        // cámara sola dentro del juego: un destello que gira siguiendo las esquinas redondeadas
        // (un degradado cónico que rota, recortado a la forma del borde)
        var d = Math.ceil(Math.hypot(b.w, b.h)) + 40;
        f.innerHTML = '<div class="luz-giro"><div class="ring-luz"><div class="giro" style="width:' + d +
          'px;height:' + d + 'px;margin:' + (-d / 2) + 'px 0 0 ' + (-d / 2) + 'px"></div></div></div>';
        frames.appendChild(f);
        return;
      }
      f.innerHTML = '<div class="ring-luz"></div>';
      frames.appendChild(f);
      // dos destellos por marco, siempre en lados opuestos (media vuelta de diferencia)
      cometa(f.querySelector('.ring-luz'), b, desfase);
      cometa(f.querySelector('.ring-luz'), b, desfase + .5);
    }
    // destello que recorre el borde: 4 barritas (una por lado) encadenadas.
    // Solo se desplazan y se encienden/apagan: lo hace la tarjeta gráfica.
    function cometa(ring, b, desfase) {
      var W = b.w + BORDER * 2, H = b.h + BORDER * 2, o = 12 - BORDER;   // o: donde empieza el borde dentro del anillo
      var per = 2 * (W + H), total = per / COMETA_VEL * 1000;
      var L = Math.round(Math.max(300, Math.min(720, per * .16)));         // largo de cada estela
      // [clase, x0, y0, x1, y1, largo del lado]: cada barrita entra con la punta en una esquina y sigue
      // hasta que su cola ha pasado la siguiente (lo que sobresale lo tapa la máscara del anillo)
      var lados = [
        ['h',  o - L,     o,          o + W,     o,          W],    // arriba: de izquierda a derecha
        ['v',  o + W - 7, o - L,      o + W - 7, o + H,      H],    // derecha: de arriba abajo
        ['hi', o + W,     o + H - 7,  o - L,     o + H - 7,  W],    // abajo: de derecha a izquierda
        ['vi', o,         o + H,      o,         o - L,      H]     // izquierda: de abajo arriba
      ];
      var hecho = 0;
      lados.forEach(function (ld) {
        var el = document.createElement('div');
        el.className = 'cometa ' + ld[0];
        if (ld[0] === 'h' || ld[0] === 'hi') el.style.width = L + 'px'; else el.style.height = L + 'px';
        ring.appendChild(el);
        var fin = Math.min(1, (ld[5] + L) / per);
        el.animate([
          { offset: 0,          transform: 'translate(' + ld[1] + 'px,' + ld[2] + 'px)', opacity: 1 },
          { offset: fin * .999, transform: 'translate(' + ld[3] + 'px,' + ld[4] + 'px)', opacity: 1 },
          { offset: fin,        transform: 'translate(' + ld[3] + 'px,' + ld[4] + 'px)', opacity: 0 },
          { offset: 1,          transform: 'translate(' + ld[3] + 'px,' + ld[4] + 'px)', opacity: 0 }
        ], { duration: total, iterations: Infinity, delay: hecho / COMETA_VEL * 1000 - total * (1 + desfase) });
        hecho += ld[5];
      });
    }

    // huecos transparentes
    huecos.forEach(function (b, k) {
      if (demo || !enOBS) {
        var d = document.createElement('div');
        d.className = demo ? 'demo ' + b.tipo : 'transp';
        if (!conFondo) d.className += ' cuadrada';       // así se ve como queda la cámara real (rectangular) debajo del marco
        place(d, b, 0);
        document.getElementById('demo-layer').appendChild(d);
      }
      marco(b, k * .5);
      // nombre mínimo encima del marco (fuera del recorte, no tapa el hueco)
      if (b.nombre) {
        var nm = document.createElement('div');
        nm.className = 'nombre-mini';
        var copo = '<svg class="copo"><use href="#flake"/></svg>';
        nm.innerHTML = copo + b.nombre.toUpperCase() + copo;
        nm.style.left = (b.x + b.w / 2) + 'px';
        nm.style.top = (b.y - BORDER / 2) + 'px';           // centrado sobre el borde de arriba, como una pestaña
        nm.style.transform = 'translate(-50%, -50%)';
        stage.appendChild(nm);
      }
    });
    if (!conFondo && demo) {
      var full = document.createElement('div');
      full.className = 'demo game full';
      full.style.cssText = 'left:0;top:0;width:1920px;height:1080px';
      var capa = document.getElementById('demo-layer');
      capa.insertBefore(full, capa.firstChild);          // el juego de ejemplo va detrás de la cámara de ejemplo
    }

    // paneles con contenido
    paneles.forEach(function (p, k) {
      var el = document.createElement('div');
      el.className = 'panel' + (p.notas ? ' notas' : '') + (p.chat ? ' chat' : '');
      place(el, p, 0);
      var h = '';
      if (p.arte) h += '<div class="arte" style="background-image:url(\'' + p.arte + '\')"></div><div class="velo"></div>';
      if (p.mensaje) h += '<div class="mensaje"><div class="pill">' + p.mensaje +
                          (p.puntos ? '<span class="puntos"><i>.</i><i>.</i><i>.</i></span>' : '') + '</div>' +
                          (p.sub ? '<div class="sub">' + p.sub + '</div>' : '') + '</div>';
      if (p.etiqueta) h += '<div class="etiqueta">' + p.etiqueta + '</div>';
      if (p.chat) {
        h += '<div class="cabecera-chat"><i></i>CHAT<i></i></div>';
        if (demo) h += '<div class="ejemplo">' +
          '<p><b style="color:#ff8cc4">sirenita_rosa</b>: holaaa Lux 💖</p>' +
          '<p><b style="color:#7ff3e6">marea_alta</b>: qué bonito el directo</p>' +
          '<p><b style="color:#c9a8ff">Burbujita</b>: ¿qué vas a jugar hoy?</p>' +
          '<p><b style="color:#ffd56b">CoralQueen</b>: buenas tardes a todos</p></div>';
      }
      if (p.notas) {
        h += '<div class="cabecera">' + p.notas.cabecera + '</div>' +
             p.notas.lineas.map(function (l) { return '<div class="linea"><b>' + l[0] + '</b><span>' + l[1] + '</span></div>'; }).join('');
      }
      el.innerHTML = h;
      document.getElementById('paneles').appendChild(el);
      marco(p, (huecos.length + k) * .5);
    });

    // ----- pantalla de espera: imagen a pantalla completa, nombre grande, mensaje y recordatorios -----
    if (cfg.pantalla) {
      var pt = cfg.pantalla;
      var fondoArte = document.createElement('div');
      fondoArte.className = 'pantalla';
      fondoArte.innerHTML = '<div class="arte" style="background-image:url(\'' + pt.arte + '\')"></div><div class="velo"></div>';
      var sea0 = document.querySelector('.sea');
      sea0.insertBefore(fondoArte, sea0.firstChild);            // las burbujas y reflejos van por encima de la imagen
      var txt = document.createElement('div');
      txt.className = 'pantalla';
      var minutos = parseFloat((location.search.match(/[?&]minutos=([\d.]+)/) || [])[1]);
      txt.innerHTML = '<div class="texto">' +
        '<div class="logo">Luxanita</div>' +
        '<div class="linea-rosa"></div>' +
        '<div class="titular">' + pt.mensaje + (pt.puntos ? '<span class="puntos"><i>.</i><i>.</i><i>.</i></span>' : '') + '</div>' +
        (pt.sub ? '<div class="sub">' + pt.sub + '</div>' : '') +
        (minutos > 0 ? '<div class="reloj"><small>' + (pt.textoReloj || 'Empezamos en') + '</small><span>--:--</span></div>'
                     : (pt.carga ? '<div class="carga"><i></i></div>' : '')) +
        (pt.notas ? '<div class="notas">' + pt.notas.map(function (n) { return '<div class="nota"><b>' + n[0] + '</b>' + n[1] + '</div>'; }).join('') + '</div>' : '') +
        '</div>';
      stage.appendChild(txt);
      // cuenta atrás opcional: escena.html?minutos=5
      if (minutos > 0) {
        var fin = Date.now() + minutos * 60000, span = txt.querySelector('.reloj span');
        (function tic() {
          var s = Math.max(0, Math.round((fin - Date.now()) / 1000));
          span.textContent = s > 0 ? Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2) : '¡ya!';
          if (s > 0) setTimeout(tic, 250);
        })();
      }
      // marco fino de neón alrededor de toda la pantalla, con sus dos destellos
      marco({ x: 24, y: 24, w: 1872, h: 1032 }, 0);
    }

    // ----- título -----
    var title = document.querySelector('.title');
    if (cfg.titulo === false) title.remove();
    var t = cfg.titulo || {};
    if (t.cx != null) title.style.left = t.cx + 'px';
    if (t.y != null) title.style.top = t.y + 'px';
    if (t.escala) {
      var esc = title.querySelector('.title-esc');
      esc.style.transform = 'scale(' + t.escala + ')';
      esc.style.transformOrigin = '50% 0';
    }

    // ----- fondo: luces difuminadas, burbujas y perlitas -----
    var tints = ['rgba(255,110,181,.5)', 'rgba(255,180,220,.4)', 'rgba(255,80,170,.42)', 'rgba(127,243,230,.22)', 'rgba(190,120,255,.35)'];
    // luces: se desplazan y "respiran" despacio (solo transform y opacidad: lo hace la tarjeta gráfica)
    function luces(cont, mov, dmin, dvar) {
      cont.querySelectorAll('span').forEach(function (el) {
        var d = (dmin + rnd() * dvar) * 1000, dx = (rnd() - .5) * mov, dy = (rnd() - .5) * mov * .75;
        el.animate([{ transform: 'translate(0,0)', opacity: .45 }, { transform: 'translate(' + dx + 'px,' + dy + 'px)', opacity: 1 }],
                   { duration: d, delay: -rnd() * d, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
      });
    }
    if (conFondo) {
      var bokeh = document.querySelector('.sea .bokeh'); html = '';
      for (i = 0; i < 10; i++) {
        html += '<span style="--x:' + (rnd() * 100).toFixed(1) + '%;--y:' + (rnd() * 100).toFixed(1) + '%;--s:' + (60 + rnd() * 160 | 0) + 'px;--c:' + tints[i % tints.length] + '"></span>';
      }
      bokeh.innerHTML = html;
      luces(bokeh, 160, 18, 16);

      var bubbles = document.querySelector('.bubbles'); html = '';
      for (i = 0; i < 30; i++) {
        html += '<span style="--x:' + (rnd() * 100).toFixed(1) + '%;--s:' + (6 + Math.pow(rnd(), 2) * 44 | 0) + 'px;--d:' + (20 + rnd() * 16).toFixed(1) + 's;--t:' + (-rnd() * 36).toFixed(1) + 's"><i></i></span>';
      }
      bubbles.innerHTML = html;
      // balanceo de cada burbuja, aparte de la subida (así no hay tirones)
      bubbles.querySelectorAll('i').forEach(function (el) {
        var w = 6 + rnd() * 16, d = (2.5 + rnd() * 2.5) * 1000;
        el.animate([{ transform: 'translateX(' + (-w) + 'px)' }, { transform: 'translateX(' + w + 'px)' }],
                   { duration: d, delay: -rnd() * d, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
      });

      var sea = document.querySelector('.sea');
      [[640, 70, 12], [1280, 64, 14], [560, 100, 9], [1360, 104, 10], [1896, 40, 12], [16, 80, 10], [10, 520, 9], [1904, 420, 10]].forEach(function (p, k) {
        var s = document.createElement('div');
        s.className = 'pearl';
        s.style.left = p[0] + 'px';
        s.style.top = p[1] + 'px';
        s.style.setProperty('--s', p[2] + 'px');
        s.style.setProperty('--t', (k * .41).toFixed(2) + 's');
        s.style.setProperty('--d', (2.6 + (k % 3) * .7) + 's');
        sea.appendChild(s);
      });
    }

    // ----- ventana del acuario, en el hueco de encima del marco pequeño -----
    var ph = document.querySelector('.porthole');
    if (!cfg.ventana) { ph.remove(); return; }
    var P = window.PEQUENO;
    // el aro (18 px) empieza a la altura del cartel del título y deja HUECO px (más su sombra) hasta el marco
    var ARO = 18, SOMBRA = 8, HUECO = 14, TITULO_ARRIBA = 43;
    var aroArriba = TITULO_ARRIBA, aroAbajo = P.y - BORDER - HUECO - SOMBRA;
    var D = Math.min(400, aroAbajo - aroArriba - ARO * 2, P.w - 40);
    ph.style.width = ph.style.height = D + 'px';
    ph.style.left = (P.x + P.w / 2 - D / 2) + 'px';
    ph.style.top = (aroArriba + ARO + (aroAbajo - aroArriba - ARO * 2 - D) / 2) + 'px';
    var ring = ph.querySelector('.ring');
    for (i = 0; i < 12; i++) {
      var a = i / 12 * Math.PI * 2, rv = document.createElement('div');
      rv.className = 'rivet';
      rv.style.left = (D / 2 + 18 + Math.cos(a) * (D / 2 + 9)) + 'px';
      rv.style.top = (D / 2 + 18 + Math.sin(a) * (D / 2 + 9)) + 'px';
      ring.appendChild(rv);
    }
    html = '';
    for (i = 0; i < 12; i++) {
      html += '<span style="--x:' + (10 + rnd() * 80).toFixed(0) + '%;--s:' + (5 + rnd() * 12 | 0) + 'px"></span>';
    }
    ph.querySelector('.pbub').innerHTML = html;
    ph.querySelectorAll('.pbub span').forEach(function (el) {
      var d = (6 + rnd() * 4) * 1000, w = (rnd() - .5) * 30;
      el.animate([{ transform: 'translate(0,0)', opacity: 0 }, { opacity: 1, offset: .1 }, { transform: 'translate(' + w + 'px,-340px)', opacity: 0 }],
                 { duration: d, delay: -rnd() * d, iterations: Infinity, easing: 'ease-in' });
    });
    html = '';
    for (i = 0; i < 5; i++) {
      html += '<span style="--x:' + (rnd() * 100).toFixed(0) + '%;--y:' + (rnd() * 100).toFixed(0) + '%;--s:' + (50 + rnd() * 70 | 0) + 'px;--c:' + tints[i % tints.length] + '"></span>';
    }
    ph.querySelector('.pbokeh').innerHTML = html;
    luces(ph.querySelector('.pbokeh'), 60, 8, 8);

    // animales al azar (como mucho 2 a la vez); crecen con la ventana
    var K = D / 300;
    var swimmers = ph.querySelector('.swimmers'), activos = 0, ultimo = '';
    function entre(r) { return r[0] + Math.random() * (r[1] - r[0]); }
    function elegir() {   // al azar según su peso, sin repetir el último
      var total = 0, k;
      for (k = 0; k < CRIATURAS.length; k++) if (CRIATURAS[k].id !== ultimo) total += CRIATURAS[k].peso;
      var r = Math.random() * total;
      for (k = 0; k < CRIATURAS.length; k++) {
        if (CRIATURAS[k].id === ultimo) continue;
        if ((r -= CRIATURAS[k].peso) < 0) return CRIATURAS[k];
      }
      return CRIATURAS[0];
    }
    function lim(v, m) { return Math.max(-m, Math.min(m, v)); }
    function soltar(forzado) {
      var c = forzado ? CRIATURAS.filter(function (x) { return x.id === forzado; })[0] : elegir(); ultimo = c.id; activos++;
      var w = entre(c.w) * K, h = w;
      var izq = !c.up && !c.fondo && Math.random() < .5;     // ¿va hacia la izquierda?
      var girar = c.mira === 'izq' ? !izq : false;            // los dibujos miran a la izquierda
      var el = document.createElement('div');
      el.className = 'swimmer' + (girar ? ' left' : '') + (c.fast ? ' fast' : '') + (c.pulse ? ' pulse' : '');
      el.style.width = w + 'px';
      el.style.height = h + 'px';
      el.innerHTML = '<div class="flip"><div class="body"><img src="' + c.img + '" alt=""></div></div>';
      swimmers.appendChild(el);

      var dur = entre(c.s) * Math.sqrt(K) * 1000, x0, y0, x1, y1, ang;
      if (c.fondo) {
        // el cangrejo camina de lado por la parte de abajo
        var izqF = Math.random() < .5;
        x0 = izqF ? D + 10 : -w - 10; x1 = izqF ? -w - 10 : D + 10;
        y0 = y1 = D - h * .95;
        ang = 0;
      } else if (c.up) {
        // suben desde abajo, rectos o en diagonal, inclinándose hacia donde van
        x0 = -w * .3 + Math.random() * (D - w * .4);
        x1 = -w * .3 + Math.random() * (D - w * .4);
        y0 = D + 10; y1 = -h - 10;
        ang = lim(Math.atan2(x1 - x0, y0 - y1) * 180 / Math.PI, 20);
      } else {
        // entran por la izquierda o la derecha, a cualquier altura y en diagonal; el morro apunta hacia donde van
        x0 = izq ? D + 10 : -w - 10; x1 = izq ? -w - 10 : D + 10;
        y0 = -h * .4 + Math.random() * (D - h * .2);
        y1 = -h * .4 + Math.random() * (D - h * .2);
        var dx = x1 - x0, dy = y1 - y0;
        ang = lim((izq ? Math.atan2(-dy, -dx) : Math.atan2(dy, dx)) * 180 / Math.PI, c.giro || 22);
      }
      var anim = el.animate([
        { transform: 'translate(' + x0 + 'px,' + y0 + 'px) rotate(' + ang + 'deg)' },
        { transform: 'translate(' + (x0 + x1) / 2 + 'px,' + ((y0 + y1) / 2 - (c.arc || 0) * K) + 'px) rotate(' + ang + 'deg)' },
        { transform: 'translate(' + x1 + 'px,' + y1 + 'px) rotate(' + ang + 'deg)' }
      ], { duration: dur, easing: 'linear' });

      // burbujitas mientras nada
      var burb = setInterval(function () {
        var m = new DOMMatrix(getComputedStyle(el).transform);
        var b = document.createElement('div');
        b.className = 'trail';
        b.style.setProperty('--s', (4 + Math.random() * 6) + 'px');
        b.style.left = (m.e + (c.up ? w / 2 : (izq ? w * .9 : w * .1))) + 'px';
        b.style.top = (m.f + (c.up ? h * .9 : h * .4)) + 'px';
        swimmers.appendChild(b);
        b.animate([{ transform: 'translate(0,0) scale(.6)', opacity: 1 }, { transform: 'translate(' + ((Math.random() - .5) * 20) + 'px,-60px) scale(1)', opacity: 0 }],
                  { duration: 1600, easing: 'ease-out', fill: 'forwards' }).onfinish = function () { b.remove(); };
      }, 450 + Math.random() * 300);

      anim.onfinish = function () { clearInterval(burb); el.remove(); activos--; };
    }
    function programar(espera) {
      setTimeout(function () {
        if (activos < 2) soltar();
        programar(5000 + Math.random() * 5000);      // el siguiente, entre 5 y 10 s después
      }, espera);
    }
    programar(800);
    window.soltarCriatura = soltar;   // para probar: soltarCriatura('shark')
  };
})();

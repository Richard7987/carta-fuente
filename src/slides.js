// ─────────────────────────────────────────────────────────────
//  CONTENIDO DE LA CARTA  (edita aquí textos, fotos y posiciones)
//  Coordenadas en un escenario de 1280×720. El papel va de x 40..1240, y 30..690.
//  Orden de cada hoja con gráficos:
//    1) se escribe el texto   2) el obstáculo "hero" hace su animación y se queda en su sitio
//    3) aparecen las demás fotos/dibujos y el texto se acomoda alrededor (Pretext)
//  hero.keys = [[progreso 0..1, x, y, rotación], ...]  (la última debe ser su posición final)
// ─────────────────────────────────────────────────────────────
import fr from './lang/fr.js'
const T = fr.t

const IMG = (f) => `img/${f}.webp`   // fotos locales optimizadas (carpeta /img)

const INK = (px) => `400 ${px}px "Homemade Apple"`   // una sola letra manuscrita en toda la carta
const drift = (ax = 26, ay = 16, fx = 0.7, fy = 0.5, ph = 0) => ({ ax, ay, fx, fy, ph })

export const slides = [
  // 1 ── Hola...
  {
    blocks: [{ text: T.hola, font: INK(150), lh: 200, align: 'center', valign: 'middle',
      box: { x: 120, y: 90, w: 1040, h: 540 }, speed: 3.2 }],
    flourish: { vb: '0 0 520 40', x: 380, y: 520, w: 520, h: 40,
      d: 'M4 24C90 4 170 40 270 18S440 22 516 8' },
  },

  // 2 ── Mi nombre es Alejandro…   (hero: el paste que rebota por la hoja)
  {
    blocks: [{
      text: T.s2,
      font: INK(37), lh: 66, box: { x: 120, y: 96, w: 1040, h: 520 }, speed: 15 }],
    obstacles: [
      { kind: 'doodle', id: 'paste', w: 230, h: 188, x: 470, y: 440, rot: -4, cap: T.pastes,
        drift: drift(20, 12, 0.55, 0.8, 0.7),
        hero: { dur: 4200, settle: 'pulse', keys: [[0, 90, 560, -40], [0.22, 230, 230, 20], [0.42, 330, 450, -14], [0.62, 420, 300, 12], [0.82, 450, 450, -6], [1, 470, 440, -4]] } },
      { kind: 'photo', src: IMG('mineral-del-chico'), w: 250, h: 235, x: 905, y: 48, rot: 4, cap: T.chico, from: [420, -520], delay: 0, drift: drift(22, 14, 0.6, 0.45) },
      { kind: 'doodle', id: 'topo', w: 225, h: 215, x: 945, y: 355, rot: -5, cap: T.min20, from: [500, 160], delay: 300, drift: drift(18, 22, 0.5, 0.7, 1.4) },
      { kind: 'photo', src: IMG('hongos'), w: 215, h: 205, x: 135, y: 395, rot: -3, cap: T.hongos, from: [-500, 200], delay: 600, drift: drift(14, 12, 0.8, 0.6, 2.2) },
      { kind: 'doodle', id: 'pines', w: 160, h: 142, x: 740, y: 470, rot: 3, from: [0, 420], delay: 900, drift: drift(10, 10, 0.6, 0.5, 3) },
    ],
  },

  // 3 ── Pero… ¿y quién soy yo?
  {
    blocks: [{ text: T.s3, font: INK(72), lh: 120, align: 'center', valign: 'middle',
      box: { x: 140, y: 90, w: 1000, h: 540 }, speed: 7 }],
  },

  // 4 ── pregunta filosófica
  {
    paper: 'coffee',   // marca de taza de café
    blocks: [{ text: T.s4, font: INK(60), lh: 100, align: 'center', valign: 'middle',
      box: { x: 160, y: 90, w: 960, h: 540 }, speed: 9 }],
    flourish: { vb: '0 0 420 40', x: 430, y: 520, w: 420, h: 40,
      d: 'M4 22C70 6 130 38 210 20S350 24 416 10' },
  },

  // 5 ── Estudiante de Física   (hero: el asteroide cruza la hoja girando)
  {
    blocks: [{
      text: T.s5,
      font: INK(29), lh: 54, box: { x: 120, y: 96, w: 1040, h: 520 }, speed: 15 }],
    obstacles: [
      { kind: 'doodle', id: 'asteroid', w: 270, h: 270, x: 880, y: 110, rot: 8,
        drift: drift(26, 18, 0.55, 0.4),
        hero: { dur: 5600, settle: 'detect', trail: 'dust', keys: [[0, 40, 640, -30], [0.14, 200, 470, 90], [0.3, 420, 560, 230], [0.46, 640, 330, 380], [0.62, 520, 190, 520], [0.8, 760, 120, 640], [1, 880, 110, 728]] } },
      { kind: 'doodle', id: 'orbit', w: 300, h: 170, x: 120, y: 478, rot: -3, cap: T.orbitas, from: [-500, 300], delay: 0, drift: drift(24, 12, 0.5, 0.7, 1) },
      // los cuatro cuadros donde mi programa encontró NHU0001 (figura 2 del informe de AsteroidPipeline)
      { kind: 'photo', src: IMG('nhu0001'), sci: true, w: 210, h: 232, x: 520, y: 442, rot: -2, pad: 16, cap: T.deteccion, from: [0, 480], delay: 200, drift: drift(12, 10, 0.6, 0.5, 0.8) },
      { kind: 'doodle', id: 'constellation', w: 200, h: 134, x: 960, y: 500, rot: 2, from: [400, 400], delay: 450, drift: drift(16, 12, 0.7, 0.5, 2) },
    ],
    // en vertical la imagen de detección va grande en el hueco bajo el texto
    portrait: { obstacles: { 1: { x: 40, y: 1065 }, 2: { w: 300, h: 328, x: 210, y: 712, rot: 3 }, 3: { x: 500, y: 1085 } } },
  },

  // 6 ── ¿Y qué me interesa?
  {
    blocks: [{ text: T.s6, font: INK(90), lh: 140, align: 'center', valign: 'middle',
      box: { x: 140, y: 90, w: 1000, h: 540 }, speed: 7 }],
  },

  // 7 ── Intereses   (hero: la cámara llega, hace "clic" y destella)
  {
    paper: 'dogear',   // esquina doblada
    blocks: [{
      text: T.s7,
      font: INK(28), lh: 48, box: { x: 120, y: 90, w: 1040, h: 540 }, speed: 24 }],
    obstacles: [
      { kind: 'doodle', id: 'camera', w: 130, h: 98, x: 790, y: 84, rot: -6,
        drift: drift(14, 10, 0.8, 0.6, 2),
        hero: { dur: 4000, settle: 'flash', keys: [[0, 80, 560, -35], [0.3, 320, 320, 14], [0.55, 560, 230, -16], [0.8, 720, 140, 8], [1, 790, 84, -6]] } },
      { kind: 'photo', src: IMG('new-york'), w: 190, h: 215, x: 965, y: 52, rot: 3, cap: 'New York', from: [400, -500], delay: 0, drift: drift(16, 12, 0.6, 0.5) },
      { kind: 'photo', src: IMG('real-del-monte'), w: 175, h: 200, x: 125, y: 430, rot: -4, cap: 'Real del Monte', from: [-500, 200], delay: 250, drift: drift(12, 10, 0.7, 0.6, 1.6) },
      { kind: 'doodle', id: 'book', w: 120, h: 90, x: 345, y: 520, rot: 5, from: [-400, 300], delay: 500, drift: drift(12, 10, 0.5, 0.7, 0.4) },
      { kind: 'doodle', id: 'violin', w: 110, h: 150, x: 1060, y: 300, rot: 14, from: [500, 100], delay: 700, drift: drift(10, 14, 0.6, 0.45, 2.6) },
      { kind: 'doodle', id: 'cat', w: 130, h: 130, x: 640, y: 500, rot: -5, from: [0, 450], delay: 900, drift: drift(18, 10, 0.5, 0.8, 1) },
      { kind: 'doodle', id: 'tardigrade', w: 170, h: 132, x: 860, y: 500, rot: 4, cap: T.tardigrado, from: [400, 400], delay: 1100, drift: drift(16, 8, 0.7, 0.5, 3) },
      { kind: 'doodle', id: 'code', w: 120, h: 72, x: 490, y: 580, rot: -3, from: [0, 450], delay: 1300, drift: drift(14, 8, 0.6, 0.8, 0.2) },
    ],
  },

  // 8 ── ¿Qué busco?
  {
    blocks: [{ text: T.s8, font: INK(70), lh: 120, align: 'center', valign: 'middle',
      box: { x: 140, y: 90, w: 1000, h: 540 }, speed: 7 }],
  },

  // 9 ── Conocerte   (hero: la pluma cae mecida; después los demás dibujos, la firma y el sello)
  {
    blocks: [
      {
        text: T.s9,
        font: INK(33), lh: 58, box: { x: 120, y: 80, w: 1040, h: 450 }, speed: 19 },
      { text: T.firma, font: INK(58), lh: 90, align: 'left', avoid: false, after: true,
        box: { x: 740, y: 548, w: 400, h: 100 }, speed: 4.2 },
    ],
    obstacles: [
      { kind: 'doodle', id: 'feather', w: 120, h: 170, x: 1040, y: 70, rot: 18,
        drift: drift(22, 16, 0.55, 0.4),
        hero: { dur: 6400, settle: 'burst', trail: 'petal', keys: [[0, 90, 620, -50], [0.12, 230, 520, 35], [0.26, 160, 380, -40], [0.4, 420, 330, 40], [0.55, 640, 420, -35], [0.7, 760, 250, 35], [0.86, 960, 190, -20], [1, 1040, 70, 18]] } },
      { kind: 'doodle', id: 'stars', w: 150, h: 90, x: 120, y: 540, rot: -4, from: [-400, 300], delay: 0, drift: drift(18, 10, 0.5, 0.7, 1) },
    ],
    seal: { x: 1170, y: 600 }, rain: true,
    portrait: { blocks: [{ box: { x: 70, y: 84, w: 580, h: 960 } }, { box: { x: 110, y: 1100, w: 420, h: 110 }, f: 1 }], seal: { x: 618, y: 1172 } },
  },
]

// ─────────────────────────────────────────────────────────────
//  VERSIÓN VERTICAL (móvil): escenario de 720×1280, papel de x 20..700, y 30..1250.
//  Cada hoja se traslada sola desde la horizontal; `portrait` en una hoja permite
//  corregir a mano cajas de texto (blocks[i].box, blocks[i].f = factor de letra) o el sello.
// ─────────────────────────────────────────────────────────────
const PW = 720, PH = 1280, K = 0.8   // K: los objetos se encogen un poco para dejar sitio al texto
const PX = (x) => 20 + (x - 40) * (680 / 1200)
const PY = (y) => 30 + (y - 30) * (1220 / 660)

function portraitOf(s) {
  const p = s.portrait || {}
  const blocks = s.blocks.map((b, i) => {
    const o = p.blocks?.[i] || {}
    const centered = b.align === 'center'
    const px = +b.font.match(/([\d.]+)px/)[1]
    const f = o.f ?? (centered ? (px > 100 ? 0.6 : 0.8) : 1)
    const box = o.box || (centered ? { x: 70, y: 110, w: 580, h: 1060 } : { x: 70, y: 84, w: 580, h: 1120 })
    return { ...b, font: INK(+(px * f).toFixed(1)), lh: b.lh * f, box }
  })
  const obstacles = (s.obstacles || []).map((o, i) => {
    const w = o.w * K, h = o.h * K
    // se traslada el centro del objeto y se mantiene dentro del papel
    const at = (x, y) => [
      Math.min(Math.max(PX(x + o.w / 2) - w / 2, 28), PW - 28 - w),
      Math.min(Math.max(PY(y + o.h / 2) - h / 2, 40), PH - 40 - h),
    ]
    const [x, y] = at(o.x, o.y)
    const q = { ...o, w, h, x, y, pad: (o.pad ?? (o.kind === 'photo' ? 30 : 22)) * K }
    if (o.from) q.from = [o.from[0] * 0.6, o.from[1] * 1.4]
    if (o.drift) q.drift = { ...o.drift, ax: o.drift.ax * 0.6, ay: o.drift.ay * 0.6 }
    if (o.hero) q.hero = { ...o.hero, keys: o.hero.keys.map(([t, kx, ky, r]) => [t, ...at(kx, ky), r]) }
    return Object.assign(q, p.obstacles?.[i])
  })
  const fl = s.flourish && { ...s.flourish, w: s.flourish.w * 0.6, x: PW / 2 - s.flourish.w * 0.3, y: PH / 2 + 95 }
  const seal = p.seal || (s.seal && { x: PX(s.seal.x), y: PY(s.seal.y) })
  return { ...s, blocks, obstacles, flourish: fl, seal, paperW: PW }
}

export const slidesFor = (portrait) => (portrait ? slides.map(portraitOf) : slides)

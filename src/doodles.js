// Dibujos a mano (SVG propios, trazos que se "dibujan" solos).
// Cada path lleva pathLength="1" para animar stroke-dashoffset.
// sketch() los pasa por rough.js: trazo doble de lápiz y sombreado a rayas de color en las formas cerradas.
import rough from 'roughjs'

// color de relleno para cada forma cerrada del dibujo, en orden ('' = sin relleno)
const FILLS = {
  asteroid: ['#a8927a', '#6d5c4b', '#6d5c4b', '#6d5c4b'],
  orbit: ['', '#e3a03c', '#7fa3c9'],
  violin: ['#b4682f'],
  cat: ['#e8a24e', '#d46a6a'],
  tardigrade: ['#e2aab0'],
  book: ['#e6d3a0'],
  camera: ['#6f7d9c', '#2b3350', '#9cc3e6'],
  paste: ['#d9a441'],
  feather: ['#b9a2e0'],
  pines: ['#5f8f5c', '#4b7a52'],
}
const closed = (d) => /z\s*$/i.test(d) || /^M[^a-zA-Z]*a[^a-zA-Z]*a[^a-zA-Z]*$/.test(d)

export function sketch(svgEl, id) {
  if (id === 'topo') return   // el mapa topográfico queda con líneas finas y precisas
  const rc = rough.svg(svgEl), fills = FILLS[id] || []
  let fi = 0
  svgEl.querySelectorAll('path.dd').forEach((p) => {
    const d = p.getAttribute('d'), acc = p.classList.contains('acc')
    const fill = closed(d) ? fills[fi++] || '' : ''
    const g = rc.path(d, {
      roughness: 1.1, bowing: 1.4, stroke: '#000', strokeWidth: 3,
      fill: fill || undefined, fillStyle: 'hachure', hachureGap: 5, fillWeight: 1.6, hachureAngle: -50 + Math.random() * 25,
    })
    g.querySelectorAll('path').forEach((q) => {
      const isFill = fill && q.getAttribute('stroke') === fill
      q.setAttribute('pathLength', 1)
      q.setAttribute('class', 'dd' + (isFill ? ' hatch' : acc ? ' acc' : ''))
      if (isFill) q.style.stroke = fill
      q.removeAttribute('stroke'); q.removeAttribute('stroke-width')
    })
    p.replaceWith(g)
  })
}
const P = (d, cls = '') => `<path class="dd ${cls}" pathLength="1" d="${d}"/>`
const svg = (vb, body) =>
  `<svg viewBox="${vb}" fill="none" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`

function crimp(cx, cy, rx, ry, a0, a1, n, r0 = 0.97, r1 = 0.8) {
  let d = ''
  for (let i = 0; i <= n; i++) {
    const t = (a0 + ((a1 - a0) * i) / n) * (Math.PI / 180)
    const c = Math.cos(t), s = Math.sin(t)
    d += `M${(cx + rx * c * r0).toFixed(1)} ${(cy - ry * s * r0).toFixed(1)}L${(cx + rx * c * r1).toFixed(1)} ${(cy - ry * s * r1).toFixed(1)}`
  }
  return d
}


// Curvas de nivel generadas (no son datos reales de elevación): un macizo con tres cumbres
function ring(cx, cy, r, k, ph) {
  const n = 30, pts = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const w = 1 + 0.2 * Math.sin(2 * a + ph) + 0.11 * Math.sin(3 * a + ph * 2.3) + 0.06 * Math.sin(5 * a + ph * 1.7 + k * 0.4)
    pts.push([cx + Math.cos(a) * r * w * 1.12 + k * 1.2, cy + Math.sin(a) * r * w * 0.86])
  }
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return d + 'Z'
}
const TK = '#141414'
const TP = (d, w = 1.5) => `<path class="dd" style="stroke:${TK};stroke-width:${w}" pathLength="1" d="${d}"/>`
function topo() {
  let c = ''
  ;[[96, 108, 8, 13, 0.4], [152, 132, 5, 11, 2.1], [66, 160, 4, 10, 4.0]].forEach(([cx, cy, n, st, ph]) => {
    for (let k = 1; k <= n; k++) c += TP(ring(cx + k * 0.8, cy - k * 0.5, k * st * 0.62 + 4, k, ph + k * 0.05), k % 4 === 0 ? 2.4 : 1.3)
  })
  return svg('0 0 225 215',
    '<defs><clipPath id="tclip"><rect x="10" y="10" width="205" height="195" rx="6"/></clipPath></defs>' +
    `<g clip-path="url(#tclip)">${c}</g>` +
    TP('M10 16Q10 10 16 10H209Q215 10 215 16V199Q215 205 209 205H16Q10 205 10 199Z', 3.2) +
    TP('M96 96l-6 12h12z', 2.2) + TP('M196 40v26M196 40l-6 9M196 40l6 9', 2.2) +
    TP('M22 192h50M22 187v10M72 187v10', 2))
}

export const doodles = {
  topo,
  asteroid: () =>
    svg('0 0 200 200',
      P('M52 70C60 40 100 28 128 40C160 46 178 78 170 108C176 140 150 170 118 168C90 182 52 168 42 138C28 116 36 86 52 70Z') +
      P('M78 78a16 12 -10 1 0 28 4a16 12 -10 1 0 -28 -4') +
      P('M118 120a12 9 20 1 0 22 6a12 9 20 1 0 -22 -6') +
      P('M68 128a8 6 0 1 0 14 2a8 6 0 1 0 -14 -2') +
      P('M8 52L34 62M4 84L28 90M12 112L32 114', 'acc') +
      P('M178 22v16M170 30h16', 'acc')),

  orbit: () =>
    svg('0 0 300 170',
      P('M20 104C20 44 150 14 250 54C292 74 270 124 170 144C90 158 20 140 20 104Z') +
      P('M140 78a10 10 0 1 0 20 0a10 10 0 1 0 -20 0', 'acc') +
      P('M150 58v-10M150 108v10M126 78h-10M174 78h10M133 61l-7-7M167 61l7-7', 'acc') +
      P('M246 46a8 8 0 1 0 16 0a8 8 0 1 0 -16 0') +
      P('M270 24l6 -10M282 30l12 -4')),

  constellation: () =>
    svg('0 0 240 160',
      P('M20 120L60 70L110 92L150 40L210 62') +
      P('M20 114v12M14 120h12M60 64v12M54 70h12M110 86v12M104 92h12M150 34v12M144 40h12M210 56v12M204 62h12', 'acc')),

  violin: () =>
    svg('0 0 200 200',
      P('M100 70C70 70 60 90 70 105C52 112 48 140 62 156C76 172 124 172 138 156C152 140 148 112 130 105C140 90 130 70 100 70Z') +
      P('M100 70V20M96 28V140M104 28V140') +
      P('M100 20C92 14 94 6 102 8C108 10 106 18 100 16') +
      P('M82 118c-4 8 4 14 0 22M118 118c4 8 -4 14 0 22M88 142H112') +
      P('M26 176L176 108M26 176l8 -2', 'acc')),

  cat: () =>
    svg('0 0 200 200',
      P('M45 100C45 60 70 48 100 48C130 48 155 60 155 100C155 138 130 156 100 156C70 156 45 138 45 100Z') +
      P('M52 74L48 28L84 52M148 74L152 28L116 52') +
      P('M78 100q6 -8 12 0M110 100q6 -8 12 0') +
      P('M94 116h12l-6 8Z', 'acc') +
      P('M100 124v6M100 130q-8 8 -16 2M100 130q8 8 16 2') +
      P('M62 118L24 110M62 126L22 130M138 118L176 110M138 126L178 130')),

  tardigrade: () =>
    svg('0 0 220 170',
      P('M30 80C30 40 90 22 140 30C190 38 205 70 190 100C176 128 110 138 70 128C40 120 30 100 30 80Z') +
      P('M80 30C70 55 72 100 84 132M120 26C112 55 114 105 124 136M160 34C154 60 156 100 164 124') +
      P('M55 126q-6 16 4 22q10 4 12 -10M95 134q-6 16 4 22q10 4 12 -10M135 135q-4 16 6 22q10 2 10 -12M172 121q2 16 12 18q10 -2 6 -14') +
      P('M46 64a2 2 0 1 0 .1 0', 'acc') +
      P('M30 84q-8 2 -10 8', 'acc')),

  code: () =>
    svg('0 0 200 120',
      P('M70 20L24 60L70 100M130 20L176 60L130 100', 'acc') + P('M112 14L88 106')),

  book: () =>
    svg('0 0 200 150',
      P('M100 40C70 26 40 26 14 36V124C40 114 70 114 100 128C130 114 160 114 186 124V36C160 26 130 26 100 40Z') +
      P('M100 40V128') +
      P('M30 56C46 52 62 54 82 60M30 74C46 70 62 72 82 78M30 92C46 88 62 90 82 96') +
      P('M118 60C138 54 154 52 170 56M118 78C138 72 154 70 170 74', 'acc')),

  camera: () =>
    svg('0 0 200 150',
      P('M20 50H56L66 32H134L144 50H180V128H20Z') +
      P('M70 88a30 30 0 1 0 60 0a30 30 0 1 0 -60 0') +
      P('M86 88a14 14 0 1 0 28 0a14 14 0 1 0 -28 0', 'acc') +
      P('M150 64h16')),

  paste: () =>
    svg('0 0 220 180',
      P('M18 138A92 88 0 0 1 202 138Q110 160 18 138Z') +
      P(crimp(110, 138, 92, 88, 8, 172, 22), 'acc') +
      P('M96 70q-8 -12 2 -22q8 -10 -2 -22M126 74q-8 -12 2 -22q8 -10 -2 -22')),

  feather: () =>
    svg('0 0 140 200',
      P('M112 12C62 30 26 84 30 142C34 152 40 160 50 168C104 130 122 66 112 12Z') +
      P('M112 12C82 62 52 110 50 168L24 196') +
      P('M96 44l-26 6M84 68l-30 8M72 92l-30 8M62 116l-24 6M56 140l-18 4', 'acc')),

  stars: () =>
    svg('0 0 150 90',
      P('M20 46v26M7 59h26') + P('M78 14v18M69 23h18', 'acc') + P('M120 40v30M105 55h30') + P('M52 20l4 8M100 78l4 8', 'acc')),

  pines: () =>
    svg('0 0 180 160',
      P('M50 150V122M50 122L22 122L50 84L30 84L50 46L70 84L50 84L78 122Z') +
      P('M126 150V128M126 128L104 128L126 98L110 98L126 66L142 98L126 98L148 128Z')),
}

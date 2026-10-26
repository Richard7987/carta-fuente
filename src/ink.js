// Escritura a mano real: se leen los contornos de cada letra de la fuente (opentype.js)
// y una máscara recorre cada contorno como lo haría la punta de la pluma.
import * as opentype from 'opentype.js'

const NS = 'http://www.w3.org/2000/svg'
let font = null
let uid = 0

/* la misma fuente sirve a la vez al navegador (FontFace) y al trazado (opentype) */
export async function loadFont(b64) {
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  font = opentype.parse(bin.buffer)
  const face = new FontFace('Homemade Apple', bin.buffer, { display: 'block' })
  document.fonts.add(await face.load())
}

const el = (tag, attrs, parent) => {
  const n = document.createElementNS(NS, tag)
  for (const k in attrs) n.setAttribute(k, attrs[k])
  if (parent) parent.append(n)
  return n
}

/* Trazos de una línea en el orden en que se escribirían:
   dentro de cada letra primero el cuerpo de izquierda a derecha y al final puntos y acentos. */
function strokesOf(text, x, baseline, size) {
  const glyphs = []
  let i = 0
  font.forEachGlyph(text, x, baseline, size, { kerning: true, features: { liga: false, rlig: false } }, (g, gx, gy, gs) => {
    const ch = text[i++] || ''
    const cmds = g.getPath(gx, gy, gs).commands
    const contours = []
    let cur = null
    for (const c of cmds) {
      if (c.type === 'M') { cur = { d: '', minX: c.x, minY: c.y, maxY: c.y }; contours.push(cur) }
      if (!cur) continue
      cur.d += c.type === 'Z' ? 'Z' : c.type + [c.x1, c.y1, c.x2, c.y2, c.x, c.y].filter((v) => v != null).map((v) => v.toFixed(1)).join(' ')
      if (c.x != null) { cur.minX = Math.min(cur.minX, c.x); cur.minY = Math.min(cur.minY, c.y); cur.maxY = Math.max(cur.maxY, c.y) }
    }
    const tall = Math.max(0, ...contours.map((c) => c.maxY - c.minY))
    contours.sort((a, b) => {
      const sa = a.maxY - a.minY < tall * 0.3, sb = b.maxY - b.minY < tall * 0.3
      return sa !== sb ? sa - sb : a.minX - b.minX
    })
    glyphs.push({ ch, contours })
  })
  return glyphs
}

/* Prepara el SVG de una línea. Devuelve un objeto con draw(t) para avanzar la escritura. */
export function inkLine(parent, text, x, baseline, size, speed) {
  const glyphs = strokesOf(text, x, baseline, size)
  const id = 'ink' + uid++
  const svg = el('svg', { class: 'inkline', width: 1280, height: 720, viewBox: '0 0 1280 720' }, parent)
  const mask = el('mask', { id, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 1280, height: 720 }, el('defs', {}, svg))
  const all = glyphs.flatMap((g) => g.contours.map((c) => c.d)).join('')
  el('path', { d: all, class: 'inkfill', mask: `url(#${id})` }, svg)

  // la máscara: un trazo ancho que recorre cada contorno
  const width = size * 0.17
  const strokes = []
  const base = 1000 / speed               // ms por letra "media"
  let t = 0
  glyphs.forEach((g, gi) => {
    const lens = g.contours.map((c) => {
      const p = el('path', { d: c.d, fill: 'none', stroke: '#fff', 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, mask)
      const len = p.getTotalLength()
      p.style.strokeDasharray = `${len} ${len + 1}`; p.style.strokeDashoffset = len
      return { p, len }
    })
    const sum = lens.reduce((a, s) => a + s.len, 0) || 1
    const gdur = base * (0.85 + Math.random() * 0.3)
    lens.forEach((s, k) => {
      const dur = gdur * (s.len / sum)
      strokes.push({ ...s, t0: t, t1: t + dur })
      t += dur + (k < lens.length - 1 ? 45 : 0)   // levanta la pluma entre trazos de la misma letra
    })
    const n = text[gi + 1]
    let gap = 15 + Math.random() * 25
    if (g.ch === ' ') gap = base * 0.5
    else if (',;'.includes(g.ch)) gap = 220
    else if (g.ch === ':') gap = 250
    else if (g.ch === '.') gap = n === '.' ? 150 : 400
    else if ('?!'.includes(g.ch)) gap = 340
    t += gap
  })
  const total = t

  let done = 0   // trazos ya completos (el bucle no los vuelve a tocar)
  return {
    total,
    /* avanza la tinta hasta t ms y devuelve dónde está la punta: {x, y, lift} */
    draw(t) {
      while (done < strokes.length && t >= strokes[done].t1) { strokes[done].p.style.strokeDashoffset = 0; done++ }
      const s = strokes[done]
      if (!s) { const l = strokes[strokes.length - 1]; return l ? { ...pt(l, 1), lift: 1 } : null }
      if (t >= s.t0) {
        const f = (t - s.t0) / (s.t1 - s.t0)
        s.p.style.strokeDashoffset = s.len * (1 - f)
        return { ...pt(s, f), lift: 0 }
      }
      // pluma en el aire entre dos trazos
      const prev = strokes[done - 1]
      if (!prev) return { ...pt(s, 0), lift: 1 }
      const a = pt(prev, 1), b = pt(s, 0), k = (t - prev.t1) / Math.max(1, s.t0 - prev.t1)
      const e = k * k * (3 - 2 * k)
      return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, lift: Math.sin(k * Math.PI) }
    },
    remove() { svg.remove() },
  }
}
const pt = (s, f) => { const q = s.p.getPointAtLength(s.len * Math.min(1, f)); return { x: q.x, y: q.y } }

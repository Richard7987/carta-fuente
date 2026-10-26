import { prepareWithSegments, layoutNextLineRange, materializeLineRange } from '@chenglou/pretext'
import { slidesFor } from './slides.js'
import { doodles, sketch } from './doodles.js'
import { loadFont, inkLine } from './ink.js'
import * as audio from './audio.js'

const stage = document.getElementById('stage')
const pagesEl = document.getElementById('pages')
const dotsEl = document.getElementById('dots')
const hintEl = document.getElementById('hint')
const coverEl = document.getElementById('cover')
const slotEl = document.getElementById('slot')
const mctx = document.createElement('canvas').getContext('2d')

const mk = (cls, parent, tag = 'div') => {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (parent) parent.append(n)
  return n
}
const clamp01 = (v) => Math.max(0, Math.min(1, v))
const easeOutBack = (t) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2) }
const smooth = (t) => t * t * (3 - 2 * t)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ───────── escala del escenario: hoja horizontal (1280×720) o vertical en móvil (720×1280) ───────── */
let scale = 1, portrait = null, W = 1280, H = 720, slides = slidesFor(false)
function fit() {
  const p = innerHeight > innerWidth * 1.1
  if (p !== portrait) {
    portrait = p; W = p ? 720 : 1280; H = p ? 1280 : 720; slides = slidesFor(p)
    document.body.classList.toggle('portrait', p)
    // al girar el teléfono la hoja actual se recompone ya escrita en el nuevo formato
    if (current && !opening) go(idx, 1, true)
  }
  scale = Math.min(innerWidth / W, innerHeight / H)
  stage.style.transform = `translate(-50%,-50%) scale(${scale})`
}
const toStage = (ev) => {
  const r = stage.getBoundingClientRect()
  return { x: (ev.clientX - r.left) / scale, y: (ev.clientY - r.top) / scale }
}

/* ───────── flujo de texto alrededor de obstáculos (Pretext) ───────── */
const MIN_W = 150
const SCALES = [1, 0.93, 0.86, 0.79, 0.72, 0.65]
function freeSegments(x0, x1, y0, y1, rects) {
  let segs = [[x0, x1]]
  for (const r of rects) {
    if (r.y + r.h <= y0 || r.y >= y1) continue
    const a = r.x, b = r.x + r.w, next = []
    for (const [s, e] of segs) {
      if (b <= s || a >= e) { next.push([s, e]); continue }
      if (a > s) next.push([s, a])
      if (b < e) next.push([b, e])
    }
    segs = next
  }
  return segs.map(([s, e]) => ({ x: s, w: e - s }))
}
function flow(sc, block, rects, top) {
  const { prepared, lh } = sc
  const { box, align } = block
  const lines = []
  let cursor = { segmentIndex: 0, graphemeIndex: 0 }
  let y = top
  const maxY = top + lh * 40
  while (y < maxY && lines.length < 120) {
    const segs = freeSegments(box.x, box.x + box.w, y, y + lh, rects)
    let best = null
    for (const s of segs) if (!best || s.w > best.w) best = s
    if (!best || best.w < MIN_W) { y += lh; continue }
    const range = layoutNextLineRange(prepared, best.w - 8, cursor)
    if (!range) break
    const line = materializeLineRange(prepared, range)
    const x = align === 'center' ? best.x + (best.w - line.width) / 2 : best.x
    lines.push({ text: line.text, x, y, width: line.width })
    cursor = range.end
    y += lh
  }
  return lines
}

/* ───────── pluma estilográfica (la punta está en 0,0 y el cuerpo va hacia +x) ───────── */
const PEN_SVG = `<svg viewBox="-4 -16 244 32" width="244" height="32">
  <defs>
    <linearGradient id="pnib" x1="0" y1="-1" x2="0" y2="1" gradientUnits="objectBoundingBox"><stop offset="0" stop-color="#fff2c4"/><stop offset=".45" stop-color="#d9a640"/><stop offset="1" stop-color="#8a5c12"/></linearGradient>
    <linearGradient id="pbody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a23a48"/><stop offset=".35" stop-color="#6e1a28"/><stop offset="1" stop-color="#2e070f"/></linearGradient>
  </defs>
  <path d="M0 0L24 -7Q33 -8 40 -6.5V6.5Q33 8 24 7Z" fill="url(#pnib)"/>
  <path d="M3 0H23" stroke="#3a2608" stroke-width="1"/><circle cx="24" cy="0" r="1.7" fill="#3a2608"/>
  <rect x="40" y="-8" width="26" height="16" rx="3" fill="#18151c"/><rect x="42" y="-6" width="22" height="2" rx="1" fill="#fff" opacity=".18"/>
  <rect x="66" y="-10" width="5" height="20" fill="#d9a640"/>
  <path d="M71 -10H222Q238 -10 238 0Q238 10 222 10H71Z" fill="url(#pbody)"/>
  <rect x="74" y="-6.5" width="150" height="2.6" rx="1.3" fill="#fff" opacity=".28"/>
  <path d="M150 -13H212Q216 -13 216 -10.5H150Z" fill="#e4b552"/>
  <rect x="146" y="-10" width="4" height="20" fill="#d9a640"/>
</svg>`

/* trayectoria por fotogramas clave [t, x, y, rot]: curva Catmull-Rom que pasa por todos ellos */
function along(keys, p) {
  if (p <= keys[0][0]) return keys[0]
  const n = keys.length
  for (let i = 1; i < n; i++) {
    if (p > keys[i][0]) continue
    const k0 = keys[Math.max(0, i - 2)], k1 = keys[i - 1], k2 = keys[i], k3 = keys[Math.min(n - 1, i + 1)]
    const u = (p - k1[0]) / (k2[0] - k1[0]), u2 = u * u, u3 = u2 * u
    const cr = (a, b, c, d) => 0.5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (3 * b - a - 3 * c + d) * u3)
    return [p, cr(k0[1], k1[1], k2[1], k3[1]), cr(k0[2], k1[2], k2[2], k3[2]), cr(k0[3], k1[3], k2[3], k3[3])]
  }
  return keys[n - 1]
}

/* ───────── una diapositiva ───────── */
class Slide {
  constructor(def, index) {
    this.def = def; this.index = index
    this.page = mk('page')
    // ninguna hoja queda perfectamente recta; algunas traen su propia historia (café, esquina doblada)
    this.page.style.rotate = ((index * 0.37) % 0.8 - 0.4).toFixed(2) + 'deg'
    const paper = mk('paper' + (def.paper ? ' p-' + def.paper : ''), mk('sheet', this.page))
    if (def.paper === 'coffee') mk('coffee', paper)
    if (def.paper === 'dogear') mk('fold', this.page)
    this.stuff = mk('stuff', this.page)
    this.state = 'idle'; this.dead = false; this.skip = false
    this.calm = false; this.reflow = false; this.driftOn = false
    this.sig = ''
    this.obstacles = (def.obstacles || []).map((o) => this.makeObstacle(o))
    this.blocks = def.blocks.map((b) => ({
      def: b, box: b.box, align: b.align || 'left', written: false,
      avoid: b.avoid !== false, scales: [], si: 0, cur: null, spans: [], lines: [],
    }))
  }

  /* un bloque puede encogerse un poco si los obstáculos le dejan sin sitio */
  scaleAt(block, j) {
    if (!block.scales[j]) {
      const k = SCALES[j]
      const px = parseFloat(block.def.font.match(/(\d+(?:\.\d+)?)px/)[1]) * k
      const font = block.def.font.replace(/(\d+(?:\.\d+)?)px/, px.toFixed(1) + 'px')
      block.scales[j] = { font, lh: block.def.lh * k, pad: Math.round(px * 0.55), prepared: prepareWithSegments(block.def.text, font) }
    }
    return block.scales[j]
  }

  /* ── obstáculos: fotos y dibujos ── */
  makeObstacle(o) {
    const node = mk('obst ' + o.kind + (o.sci ? ' sci' : ''), this.stuff)
    node.style.width = o.w + 'px'; node.style.height = o.h + 'px'
    if (o.kind === 'photo') {
      mk('tape', node)
      const img = mk('', node, 'img')
      img.alt = o.cap || ''; img.decoding = 'async'; img.src = o.src
      img.onerror = () => node.classList.add('nophoto')
      mk('gloss', node)
      if (o.cap) mk('cap', node).textContent = o.cap
    } else {
      const wrap = mk('art', node); wrap.innerHTML = doodles[o.id]()
      sketch(wrap.firstElementChild, o.id)
      // primero los contornos, después el sombreado a rayas
      const lines = [...wrap.querySelectorAll('.dd:not(.hatch)')], hatch = [...wrap.querySelectorAll('.dd.hatch')]
      lines.forEach((p, i) => p.style.setProperty('--i', i * 0.5))
      hatch.forEach((p, i) => p.style.setProperty('--i', lines.length * 0.5 + 3 + i * 2))
      if (o.cap) mk('cap', node).textContent = o.cap
    }
    node.style.opacity = 0
    const ob = {
      def: o, node, w: o.w, h: o.h, rot: o.rot || 0, pad: o.pad ?? (o.kind === 'photo' ? 30 : 22),
      hero: !!o.hero, state: 'hidden', t0: 0,
      bx: o.x, by: o.y, x: o.x, y: o.y, vx: o.x, vy: o.y, vr: o.rot || 0, op: 0,
      drag: false, lastDrift: [0, 0], dirty: true,
    }
    this.bindDrag(ob)
    return ob
  }
  startLanding(ob) {
    if (this.skip) { this.settleNow(ob); return }
    ob.state = 'landing'; ob.t0 = performance.now() + (ob.def.delay || 0)
  }
  settleNow(ob) {
    ob.state = 'rest'; ob.op = 1; ob.vx = ob.x; ob.vy = ob.y; ob.vr = ob.rot; ob.dirty = true
    ob.node.classList.add('drawn')
  }
  playHero(ob) {
    return new Promise((res) => {
      if (this.skip) { this.settleNow(ob); return res() }
      ob.state = 'hero'; ob.t0 = performance.now(); ob.onDone = res
      ob.node.classList.add('drawn')
      audio.sfx.pencil(1.6)
    })
  }
  /* actualiza la posición visual de cada obstáculo en cada fotograma */
  stepObstacles(now) {
    const t = (now - (this.t0 || now)) / 1000
    for (const o of this.obstacles) {
      if (o.state === 'hidden') continue
      let vx = o.vx, vy = o.vy, vr = o.vr, op = o.op
      let lift = 0, tx = 0, ty = 0
      if (o.state === 'landing') {
        // cae desde fuera de la hoja: llega en arco, gira y (si es foto) se mece como papel en el aire
        const p = this.skip ? 1 : clamp01((now - o.t0) / 1300)
        const back = easeOutBack(p), from = o.def.from || [0, -520]
        vx = o.x + (1 - back) * from[0]; vy = o.y + (1 - back) * from[1] - Math.sin(p * Math.PI) * 60
        vr = o.rot + (1 - back) * (from[0] >= 0 ? 28 : -28); op = Math.min(1, p * 2.2)
        lift = 1 - p * p
        if (o.def.kind === 'photo') { tx = Math.sin(p * 11) * (1 - p) * 38; ty = Math.cos(p * 8) * (1 - p) * 30 }
        if (p >= 1) { o.state = 'rest'; o.node.classList.add('drawn'); this.land(o, now) }
      } else if (o.state === 'hero') {
        const h = o.def.hero
        const p = this.skip ? 1 : clamp01((now - o.t0) / h.dur)
        const k = along(h.keys, p)
        vx = k[1]; vy = k[2]; vr = k[3]; op = Math.min(1, p * 7)
        lift = p < 0.88 ? 1 : 1 - smooth((p - 0.88) / 0.12)
        if (p >= 1) o.impact = now
        if (h.trail && !this.skip && now - (o.lastTrail || 0) > 38) {
          o.lastTrail = now
          const cx = vx + o.w / 2, cy = vy + o.h / 2
          if (h.trail === 'petal') this.spark('petal', cx, cy, 30 + Math.random() * 50, 40 + Math.random() * 60, 1.6 + Math.random())
          else { this.spark('dot', cx + (Math.random() - .5) * 40, cy + (Math.random() - .5) * 40, -20 + Math.random() * 40, -20 + Math.random() * 40, 1.2 + Math.random() * .6); if (Math.random() < .35) this.spark('dot acc', cx, cy, (Math.random() - .5) * 90, (Math.random() - .5) * 90, 1.4) }
        }
        if (p >= 1) {
          o.state = 'rest'; vx = o.x; vy = o.y; vr = o.rot
          o.node.classList.add('pulse'); this.onSettle(o, h.settle)
          o.onDone && o.onDone()
        }
      } else if (o.state === 'rest' && !o.drag) {
        const d = o.def.drift
        if (this.driftOn && d && !this.calm) o.lastDrift = [d.ax * Math.sin(t * d.fx), d.ay * Math.sin(t * d.fy + d.ph)]
        o.x = o.bx + o.lastDrift[0]; o.y = o.by + o.lastDrift[1]
        vx = o.x; vy = o.y; vr = o.rot; op = 1
      } else if (o.drag) { vx = o.x; vy = o.y; vr = o.rot; op = 1; lift = 0.6 }
      // al arrastrar, el objeto se inclina en 3D hacia donde se mueve y vuelve despacio al soltarlo
      if (o.state === 'rest') {
        o.tiltX = (o.tiltX || 0) + (Math.max(-28, Math.min(28, -(o.dvy || 0) * 2.2)) - (o.tiltX || 0)) * 0.18
        o.tiltY = (o.tiltY || 0) + (Math.max(-28, Math.min(28, (o.dvx || 0) * 2.2)) - (o.tiltY || 0)) * 0.18
        o.dvx = (o.dvx || 0) * 0.82; o.dvy = (o.dvy || 0) * 0.82
        tx = o.tiltX; ty = o.tiltY
      }
      // rebote amortiguado al tocar el papel (se aplasta y recupera)
      let sx = 1, sy = 1
      if (o.impact) {
        const k = (now - o.impact) / 520
        if (k >= 1) o.impact = 0
        else { const q = Math.sin(k * Math.PI * 2.6) * (1 - k) * 0.07; sx = 1 + q; sy = 1 - q }
      }
      const sc = 1 + lift * 0.12
      const key = `${vx.toFixed(1)},${vy.toFixed(1)},${vr.toFixed(2)},${op},${lift.toFixed(3)},${sx.toFixed(3)},${tx.toFixed(1)},${ty.toFixed(1)}`
      if (key !== o.key) {
        o.key = key; o.vx = vx; o.vy = vy; o.vr = vr; o.op = op
        o.node.style.transform = `translate(${vx.toFixed(1)}px,${vy.toFixed(1)}px) perspective(900px) rotate(${vr.toFixed(2)}deg) rotateX(${tx.toFixed(1)}deg) rotateY(${ty.toFixed(1)}deg) scale(${(sc * sx).toFixed(3)},${(sc * sy).toFixed(3)})`
        o.node.style.opacity = op
        o.node.style.setProperty('--lift', lift.toFixed(3))
      }
    }
  }
  /* aterrizaje: rebote y una nube de polvo de papel bajo el borde inferior */
  land(o, now) {
    o.impact = now
    if (this.skip) return
    audio.sfx.tap(o.def.kind === 'photo')
    if (o.def.kind === 'doodle') audio.sfx.pencil(1.5, 0.1)
    const y = o.y + o.h
    for (let i = 0; i < 12; i++) {
      const side = i % 2 ? 1 : -1, x = o.x + o.w / 2 + side * (o.w * 0.2 + Math.random() * o.w * 0.3)
      this.spark('puff', x, y - 6, side * (30 + Math.random() * 70), -10 - Math.random() * 30, 0.9 + Math.random() * 0.5, 0)
    }
  }
  spark(cls, x, y, dx, dy, t = 1, r) {
    const e = mk('spark ' + cls, this.stuff)
    e.style.cssText = `left:${x}px;top:${y}px;--dx:${dx}px;--dy:${dy}px;--r:${r ?? (Math.random() * 360 - 180)}deg;--t:${t}s`
    setTimeout(() => e.remove(), t * 1000 + 100)
  }
  ring(x, y, size, delay = 0) {
    const e = mk('ring', this.stuff)
    e.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;animation-delay:${delay}s`
    setTimeout(() => e.remove(), 2600 + delay * 1000)
  }
  onSettle(o, kind) {
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2
    if (kind === 'detect') {
      for (let i = 0; i < 3; i++) this.ring(cx, cy, 300, i * 0.35)
      const r = mk('reticle', this.stuff)
      r.style.cssText = `left:${cx}px;top:${cy}px`
      r.innerHTML = '<svg viewBox="-100 -100 200 200" fill="none" stroke-linecap="round"><circle r="88" stroke-dasharray="4 9"/><path d="M-100 0h-40M100 0h40M0 -100v-40M0 100v40" transform="scale(.7)"/><path d="M-62 -30v-32h32M62 -30v-32h-32M-62 30v32h32M62 30v32h-32"/></svg>'
      setTimeout(() => r.remove(), 3200)
      for (let i = 0; i < 14; i++) this.spark('dot acc', cx, cy, Math.cos(i) * 150, Math.sin(i) * 150, 1.3)
    }
    if (kind === 'burst') {
      for (let i = 0; i < 3; i++) this.ring(cx, cy, 260, i * 0.3)
      for (let i = 0; i < 34; i++) { const a = (i / 34) * 6.283, d = 90 + Math.random() * 170
        this.spark(i % 3 ? 'petal' : 'dot acc', cx, cy, Math.cos(a) * d, Math.sin(a) * d + 40, 1.8 + Math.random()) }
    }
    if (kind !== 'flash') audio.sfx.tap()
    if (kind === 'flash') {
      audio.sfx.shutter()
      const f = mk('flash', this.page)
      setTimeout(() => f.remove(), 900)
    }
  }
  rects() {
    return this.obstacles.filter((o) => o.state !== 'hidden')
      .map((o) => ({ x: o.vx - o.pad, y: o.vy - o.pad, w: o.w + o.pad * 2, h: o.h + o.pad * 2 }))
  }
  bindDrag(ob) {
    ob.node.addEventListener('pointerdown', (ev) => {
      if (this.state !== 'done' || ob.state !== 'rest') return
      ev.preventDefault(); ev.stopPropagation()
      ob.drag = true; ob.node.setPointerCapture(ev.pointerId); ob.node.classList.add('held')
      const p = toStage(ev); ob.gx = p.x - ob.x; ob.gy = p.y - ob.y
    })
    ob.node.addEventListener('pointermove', (ev) => {
      if (!ob.drag) return
      const p = toStage(ev), nx = p.x - ob.gx, ny = p.y - ob.gy
      ob.dvx = (ob.dvx || 0) * 0.5 + (nx - ob.x) * 0.5; ob.dvy = (ob.dvy || 0) * 0.5 + (ny - ob.y) * 0.5
      ob.x = nx; ob.y = ny
    })
    const up = () => {
      if (!ob.drag) return
      ob.drag = false; ob.node.classList.remove('held')
      ob.bx = ob.x - ob.lastDrift[0]; ob.by = ob.y - ob.lastDrift[1]
    }
    ob.node.addEventListener('pointerup', up); ob.node.addEventListener('pointercancel', up)
  }

  /* ── líneas de texto ── */
  layoutBlock(block) {
    const rects = block.avoid ? this.rects() : []
    const limit = block.box.y + block.box.h
    const attempt = (j) => {
      const sc = this.scaleAt(block, j)
      let lines = flow(sc, block, rects, block.box.y)
      if (block.def.valign === 'middle') {
        const top = block.box.y + (block.box.h - lines.length * sc.lh) / 2
        lines = flow(sc, block, rects, top)
      }
      return { lines, sc, bottom: lines.length ? lines[lines.length - 1].y + sc.lh : 0 }
    }
    let i = block.si, r = attempt(i)
    while (r.bottom > limit && i < SCALES.length - 1) r = attempt(++i)
    if (i > 0) { const up = attempt(i - 1); if (up.bottom <= limit - 40) { i--; r = up } }
    block.si = i
    return r
  }
  ensureSpans(block, n) {
    while (block.spans.length < n) block.spans.push(mk('ln', this.stuff, 'span'))
    block.spans.forEach((s, i) => { s.style.display = i < n ? '' : 'none' })
  }
  paint(block, r) {
    const { lines, sc } = r
    this.ensureSpans(block, lines.length)
    const resized = block.cur !== sc
    block.cur = sc
    lines.forEach((L, i) => {
      const sp = block.spans[i]
      if (resized || !sp.style.font) { sp.style.font = sc.font; sp.style.lineHeight = sc.lh + 'px'; sp.style.padding = `${sc.pad}px 22px` }
      if (sp.dataset.t !== L.text) { sp.textContent = L.text; sp.dataset.t = L.text }
      sp.style.left = (L.x - 22) + 'px'; sp.style.top = (L.y - sc.pad) + 'px'
    })
    block.lines = lines
  }
  setMask(s, px) {
    const m = px == null ? 'none' : `linear-gradient(90deg,#000 ${px + 22}px,transparent ${px + 46}px)`
    s.style.webkitMaskImage = m; s.style.maskImage = m
  }

  /* esperas que respetan "saltar" */
  wait(ms) {
    return new Promise((res) => {
      const t0 = performance.now()
      const f = (now) => { if (this.dead || this.skip || now - t0 >= ms) res(); else requestAnimationFrame(f) }
      requestAnimationFrame(f)
    })
  }

  /* ── secuencia de la hoja ──
     1) el texto se escribe  2) una animación dinámica (hero) que termina en su sitio
     3) aparecen las demás imágenes y dibujos  4) firma / sello si los hay */
  async run(instant = false) {
    this.state = 'writing'
    if (instant) this.skip = true
    this.t0 = performance.now()
    const loop = (now) => { if (this.dead) return; this.frame(now); this.raf = requestAnimationFrame(loop) }
    this.raf = requestAnimationFrame(loop)

    await this.wait(this.def.startDelay ?? 400)
    for (const b of this.blocks.filter((b) => !b.def.after)) { if (this.dead) return; await this.writeBlock(b) }
    this.reflow = true
    if (this.obstacles.length) {
      await this.wait(600)
      const hero = this.obstacles.find((o) => o.hero)
      if (hero) { await this.playHero(hero); await this.wait(500) }
      const rest = this.obstacles.filter((o) => !o.hero)
      rest.forEach((o) => this.startLanding(o))
      await this.wait(Math.max(0, ...rest.map((o) => o.def.delay || 0)) + 1500)
    }
    for (const b of this.blocks.filter((b) => b.def.after)) { if (this.dead) return; await this.wait(250); await this.writeBlock(b) }
    this.finish()
  }

  async writeBlock(block) {
    const r = this.layoutBlock(block)
    this.paint(block, r)
    block.spans.forEach((s, i) => { if (i < r.lines.length) this.setMask(s, -60) })
    for (let i = 0; i < r.lines.length; i++) {
      if (this.dead) return
      await this.writeLine(block, r.lines[i], block.spans[i])
    }
    block.written = true
    this.penAt(null)
    await this.wait(200)
  }

  /* la línea se traza letra a letra en un SVG; al terminar se cambia por el texto normal
     (mismo sitio, misma fuente) para que pueda volver a fluir alrededor de las fotos */
  writeLine(block, L, span) {
    return new Promise((res) => {
      if (this.skip) { this.revealFull(span); return res() }
      mctx.font = block.cur.font
      const m = mctx.measureText(L.text)
      const px = parseFloat(block.cur.font.match(/([\d.]+)px/)[1])
      const asc = m.fontBoundingBoxAscent, desc = m.fontBoundingBoxDescent
      const baseline = L.y + (block.cur.lh - asc - desc) / 2 + asc
      // las gotas de tinta solo caen en textos que no se recolocan (si no, quedarían fuera de su letra)
      const still = !block.avoid || !this.obstacles.length
      const line = inkLine(this.stuff, L.text, L.x, baseline, px, block.def.speed || 14, still ? 0.2 : 0)
      this.penSize = Math.min(1.6, Math.max(0.85, px / 36))
      const t0 = performance.now() + 90
      let bi = 0
      const end = () => { line.remove(); this.revealFull(span); res() }
      const step = (now) => {
        if (this.dead) { line.remove(); audio.pen(0); return res() }
        if (this.skip) { this.penAt(null); return end() }
        const t = now - t0
        while (bi < line.blots.length && t >= line.blots[bi].t) this.blot(line.blots[bi++], px)
        this.penAt(line.draw(Math.max(0, t)), now)
        if (t >= line.total) return end()
        requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    })
  }
  revealFull(span) { this.setMask(span, null); setTimeout(() => span.classList.add('dry'), 400) }

  /* pluma estilográfica que sigue la punta de la tinta; se eleva (sombra más lejana) entre trazos */
  penAt(tip, now = 0) {
    if (!this.pen) {
      this.pen = mk('pen', this.stuff)
      this.pen.innerHTML = PEN_SVG
    }
    const p = this.pen
    if (!tip) { p.classList.add('away'); audio.pen(0); this.lastTip = null; return }
    p.classList.remove('away')
    // el roce suena más cuanto más rápido corre la punta, y calla cuando se levanta
    const lt = this.lastTip
    const speed = lt && now > lt.now ? Math.hypot(tip.x - lt.x, tip.y - lt.y) / (now - lt.now) : 0
    audio.pen(tip.lift > 0.3 ? 0 : Math.min(1, speed / 0.35))
    this.lastTip = { x: tip.x, y: tip.y, now }
    const lift = tip.lift, s = this.penSize
    const ang = 36 + Math.sin(now / 210) * 2.5 - lift * 4
    p.style.transform = `translate(${tip.x.toFixed(1)}px,${(tip.y - lift * 10 * s).toFixed(1)}px) rotate(${ang.toFixed(2)}deg) scale(${(s * (1 + lift * 0.05)).toFixed(3)})`
    const d = (3 + lift * 12).toFixed(1)
    p.style.filter = `drop-shadow(${d}px ${(+d * 1.6).toFixed(1)}px ${(2 + lift * 5).toFixed(1)}px rgba(30,18,6,${(0.38 - lift * 0.14).toFixed(2)}))`
  }

  /* gota de tinta: se extiende un instante en el papel; a veces salpica una gotita al lado */
  blot(b, px) {
    const r = px * (0.06 + Math.random() * 0.05)
    const add = (x, y, s) => {
      const e = mk('blot', this.stuff)
      const br = Array.from({ length: 4 }, () => 40 + Math.round(Math.random() * 25) + '%').join(' ')
      e.style.cssText = `left:${(x - s).toFixed(1)}px;top:${(y - s).toFixed(1)}px;width:${(s * 2).toFixed(1)}px;height:${(s * 2 * (0.8 + Math.random() * 0.3)).toFixed(1)}px;border-radius:${br};rotate:${Math.round(Math.random() * 180)}deg`
    }
    add(b.x, b.y, r)
    if (Math.random() < 0.5) { const a = Math.random() * 6.283, d = r * (1.8 + Math.random()); add(b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, r * 0.3) }
  }

  finish() {
    if (this.dead) return
    this.state = 'done'
    this.blocks.forEach((b) => b.spans.forEach((s) => this.revealFull(s)))
    this.page.classList.add('done')
    const fl = this.def.flourish
    if (fl) {
      const svg = mk('flourish', this.stuff)
      svg.style.cssText = `left:${fl.x}px;top:${fl.y}px;width:${fl.w}px;height:${fl.h}px`
      svg.innerHTML = `<svg viewBox="${fl.vb}" fill="none" stroke-linecap="round"><path class="dd" pathLength="1" d="${fl.d}"/></svg>`
      requestAnimationFrame(() => svg.classList.add('go'))
    }
    if (this.def.seal) {
      const s = mk('seal stamp', this.stuff)
      s.style.left = this.def.seal.x + 'px'; s.style.top = this.def.seal.y + 'px'; s.textContent = 'A'
      setTimeout(() => { if (this.dead) return
        audio.sfx.stamp()
        this.ring(this.def.seal.x, this.def.seal.y, 220)
        for (let i = 0; i < 18; i++) { const a = (i / 18) * 6.283; this.spark('dot acc', this.def.seal.x, this.def.seal.y, Math.cos(a) * 120, Math.sin(a) * 120, 1.2) } }, 750)
    }
    if (this.def.rain) {
      for (let i = 0; i < 18; i++) {
        const e = mk('petal fall', this.stuff)
        e.style.cssText = `left:${60 + Math.random() * (W - 160)}px;--sx:${(Math.random() - .5) * 160}px;--fy:${H + 60}px;animation-duration:${(7 + Math.random() * 6) * H / 720}s;animation-delay:${-Math.random() * 12}s`
      }
    }
    hintEl.classList.toggle('show', this.index === 0)
    if (this.index === slides.length - 1) {
      // última hoja: se recuerda que la carta ya se leyó y se ofrece leerla otra vez desde el principio
      try { localStorage.setItem('carta-lue', '1') } catch {}
      setTimeout(() => { if (!this.dead) rereadEl.classList.add('show') }, this.skip ? 300 : 2600)
    }
    this.t0 = performance.now()
    this.driftOn = true
  }

  frame(now) {
    this.stepObstacles(now)
    if (!this.reflow) return
    const rs = this.rects()
    const sig = rs.map((r) => `${Math.round(r.x * 2)},${Math.round(r.y * 2)}`).join('|')
    if (sig === this.sig) return
    this.sig = sig
    for (const b of this.blocks) if (b.avoid && b.written) this.paint(b, this.layoutBlock(b))
  }

  destroy() { this.dead = true; cancelAnimationFrame(this.raf); audio.pen(0) }
  leave(dir) {
    this.destroy(); this.page.classList.add(dir > 0 ? 'out-left' : 'out-right')
    setTimeout(() => this.page.remove(), 900)
  }
}

/* ───────── navegación ───────── */
let current = null, idx = -1, opening = false, calm = false
addEventListener('resize', fit); fit()

// si ya la leyó otra vez, al volver todo aparece escrito sin esperar (el botón "Relire" la anima de nuevo)
let fast = false
try { fast = localStorage.getItem('carta-lue') === '1' } catch {}

const rereadEl = document.getElementById('reread'), muteEl = document.getElementById('mute')
rereadEl.addEventListener('click', () => { rereadEl.classList.remove('show'); fast = false; go(0, -1) })
const paintMute = () => muteEl.classList.toggle('off', audio.isMuted())
muteEl.addEventListener('click', () => { audio.start(); audio.setMuted(!audio.isMuted()); paintMute() })
paintMute()

for (let i = 0; i < slides.length; i++) mk('dot', dotsEl, 'i')
const dotNodes = [...dotsEl.children]
const setDots = (n) => dotNodes.forEach((d, i) => { d.classList.toggle('on', i === n); d.classList.toggle('seen', i < n) })

/* las fotos se piden ya mientras se abre el sobre, así llegan antes que su hoja */
for (const s of slides) for (const o of s.obstacles || []) if (o.kind === 'photo') new Image().src = o.src

async function go(n, dir = 1, instant = false) {
  if (n < 0 || n >= slides.length) return
  instant = instant || fast
  if (current) { current.leave(dir); audio.sfx.page() }
  const s = new Slide(slides[n], n)
  s.calm = calm
  pagesEl.append(s.page)
  s.page.classList.add(dir > 0 ? 'in-right' : 'in-left')
  current = s; idx = n; setDots(n)
  hintEl.classList.remove('show'); rereadEl.classList.remove('show')
  await sleep(instant ? 30 : 620)
  if (!s.dead) s.run(instant)
}
function next() {
  if (opening) return
  if (idx === -1) return openEnvelope()
  if (current && current.state !== 'done') { current.skip = true; return }
  go(idx + 1, 1)
}
function prev() {
  if (opening || idx <= 0) return
  go(idx - 1, -1, true)
}

/* el sello de lacre se rompe en esquirlas que saltan y caen */
function burst(x, y) {
  for (let i = 0; i < 18; i++) {
    const e = mk('shard', document.body), a = Math.random() * 6.283, d = (50 + Math.random() * 130) * scale
    e.style.cssText = `left:${x}px;top:${y}px;--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d * 0.6).toFixed(0)}px;--fall:${(140 + Math.random() * 120) * scale}px;--r:${Math.random() * 900 - 450}deg;--s:${((5 + Math.random() * 9) * scale).toFixed(1)}px`
    setTimeout(() => e.remove(), 1500)
  }
}

/* La primera hoja ya está DENTRO del sobre: sube, sale y crece hasta ocupar la pantalla. */
async function openEnvelope() {
  opening = true
  audio.start(); audio.music(); muteEl.classList.add('show')
  const s = new Slide(slides[0], 0)
  slotEl.append(s.page)
  current = s; idx = 0; setDots(0)
  coverEl.classList.add('open')            // se rompe el sello y se abre la solapa
  audio.sfx.crack()
  const r = coverEl.querySelector('.env .seal').getBoundingClientRect()
  burst((r.left + r.right) / 2, (r.top + r.bottom) / 2)
  await sleep(950)
  coverEl.classList.add('rise')            // la carta asoma por arriba
  audio.sfx.slide(1.2)
  await sleep(1250)
  coverEl.classList.add('grow')            // crece hasta el tamaño real mientras el sobre cae
  audio.sfx.slide(0.9, 0.1)
  await sleep(1300)
  pagesEl.append(s.page)                   // pasa a la capa normal de hojas
  s.page.style.removeProperty('transform')
  coverEl.remove()
  opening = false
  s.run(fast)
}

addEventListener('keydown', (e) => {
  if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); next() }
  else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); prev() }
  else if (e.key === 'Home' && idx > 0 && !opening) go(0, -1, true)
  else if (e.key === 'End' && !opening && idx >= 0) go(slides.length - 1, 1, true)
  else if (e.key === 'f' || e.key === 'F') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()
  else if (e.key === 'm' || e.key === 'M') { calm = !calm; if (current) current.calm = calm }
})
let sx = null
addEventListener('pointerdown', (e) => { sx = e.clientX })
addEventListener('pointerup', (e) => {
  if (sx == null || e.target.closest('button')) return
  const dx = e.clientX - sx; sx = null
  if (Math.abs(dx) > 70) dx < 0 ? next() : prev()
  else if (!e.target.closest('.obst')) next()
})

/* ───────── polvo / luz de vela ───────── */
const dust = document.getElementById('dust'), dctx = dust.getContext('2d')
// motas finas y unas pocas "bokeh" grandes y desenfocadas, más cerca de la cámara
const motes = Array.from({ length: 90 }, (_, i) => {
  const big = i < 12
  return { x: Math.random(), y: Math.random(), r: big ? 6 + Math.random() * 14 : Math.random() * 1.6 + 0.4,
    s: (big ? 0.012 : 0.02) * Math.random() + 0.006, p: Math.random() * 6.28, big }
})
let dw = 0, dh = 0, dpr = 1
function dustLoop(now) {
  if (dw !== innerWidth || dh !== innerHeight || dpr !== devicePixelRatio) {
    dw = innerWidth; dh = innerHeight; dpr = devicePixelRatio || 1
    dust.width = dw * dpr; dust.height = dh * dpr; dust.style.width = dw + 'px'; dust.style.height = dh + 'px'
  }
  dctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  dctx.clearRect(0, 0, dw, dh)
  for (const m of motes) {
    m.y -= m.s * 0.004; m.x += Math.sin(now / 4000 + m.p) * 0.00012
    if (m.y < -0.04) { m.y = 1.04; m.x = Math.random() }
    const tw = 0.5 + 0.5 * Math.sin(now / 900 + m.p)
    const x = m.x * dw + (lx - 0.5) * (m.big ? -40 : -8), y = m.y * dh + (ly - 0.5) * (m.big ? -30 : -6)   // paralaje
    if (m.big) {
      const g = dctx.createRadialGradient(x, y, 0, x, y, m.r)
      g.addColorStop(0, `rgba(255,210,140,${0.05 + 0.05 * tw})`); g.addColorStop(1, 'rgba(255,210,140,0)')
      dctx.fillStyle = g
    } else dctx.fillStyle = `rgba(255,224,160,${0.12 + 0.18 * tw})`
    dctx.beginPath(); dctx.arc(x, y, m.r, 0, 6.283); dctx.fill()
  }
  requestAnimationFrame(dustLoop)
}

/* la luz de la vela se inclina suavemente hacia el puntero */
let lx = 0.5, ly = 0.5, tlx = 0.5, tly = 0.5
addEventListener('pointermove', (e) => { tlx = e.clientX / innerWidth; tly = e.clientY / innerHeight })
function lightLoop() {
  lx += (tlx - lx) * 0.05; ly += (tly - ly) * 0.05
  document.body.style.setProperty('--lx', (35 + lx * 30).toFixed(1) + '%')
  document.body.style.setProperty('--ly', (33 + ly * 30).toFixed(1) + '%')
  requestAnimationFrame(lightLoop)
}
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) { requestAnimationFrame(dustLoop); requestAnimationFrame(lightLoop) }

/* ───────── arranque (espera la fuente manuscrita) ───────── */
loadFont(__FONT__).then(() => document.fonts.ready).then(() => {
  document.body.classList.add('ready')
  const h = new URLSearchParams(location.search).get('s')   // ?s=N abre directamente la hoja N
  if (h != null) {
    coverEl.remove(); go(+h, 1, true); muteEl.classList.add('show')
    addEventListener('pointerdown', () => { audio.start(); audio.music() }, { once: true })
  }
})

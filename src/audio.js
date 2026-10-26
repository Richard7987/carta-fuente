// Sonido sintetizado con Web Audio (sin archivos): papel, lacre, pluma, lápiz y una música suave.
// El navegador solo deja sonar audio tras un gesto, por eso start() se llama al tocar el sobre.

let ctx = null, master = null, sfxBus = null, musicBus = null, verb = null, noiseBuf = null
let penGain = null, penBand = null
let muted = false
try { muted = localStorage.getItem('carta-muted') === '1' } catch {}

const now = () => ctx.currentTime
const rnd = (a, b) => a + Math.random() * (b - a)

export function start() {
  if (ctx) { ctx.resume?.(); return }
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return
  ctx = new AC()
  master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination)
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master)
  musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master)

  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const d = noiseBuf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1

  // reverberación: respuesta al impulso generada (ruido que se apaga en ~3 s)
  verb = ctx.createConvolver()
  const len = ctx.sampleRate * 3, ir = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) { const ch = ir.getChannelData(c); for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3) }
  verb.buffer = ir
  const wet = ctx.createGain(); wet.gain.value = 0.5
  verb.connect(wet).connect(musicBus)

  // la pluma: ruido continuo filtrado cuyo volumen sigue la velocidad de la punta
  const src = noiseSrc(true)
  penBand = ctx.createBiquadFilter(); penBand.type = 'bandpass'; penBand.frequency.value = 3200; penBand.Q.value = 0.8
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200
  penGain = ctx.createGain(); penGain.gain.value = 0
  src.connect(penBand).connect(hp).connect(penGain).connect(sfxBus)
  src.start()
}

export const isMuted = () => muted
export function setMuted(m) {
  muted = m
  try { localStorage.setItem('carta-muted', m ? '1' : '0') } catch {}
  if (master) master.gain.setTargetAtTime(m ? 0 : 1, now(), 0.08)
}

function noiseSrc(loop = false) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = loop
  return s
}
/* ráfaga de ruido filtrado con envolvente: la base de casi todos los efectos */
function burst({ type = 'bandpass', f = 1000, f2, q = 1, t = 0, a = 0.005, dur = 0.2, vol = 0.3, out = sfxBus }) {
  const s = noiseSrc(), flt = ctx.createBiquadFilter(), g = ctx.createGain()
  flt.type = type; flt.Q.value = q
  const t0 = now() + t
  flt.frequency.setValueAtTime(f, t0)
  if (f2) flt.frequency.exponentialRampToValueAtTime(f2, t0 + dur)
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(vol, t0 + a)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  s.connect(flt).connect(g).connect(out)
  s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.05)
}
function thump(f, f2, dur, vol, t = 0) {
  const o = ctx.createOscillator(), g = ctx.createGain(), t0 = now() + t
  o.frequency.setValueAtTime(f, t0); o.frequency.exponentialRampToValueAtTime(f2, t0 + dur)
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.connect(g).connect(sfxBus); o.start(t0); o.stop(t0 + dur + 0.02)
}

export const sfx = {
  /* el sello de lacre se quiebra: chasquido seco, crujidos y un golpe grave */
  crack() {
    if (!ctx) return
    burst({ f: 2400, q: 1.5, dur: 0.09, vol: 0.9 })
    for (let i = 0; i < 6; i++) burst({ f: rnd(1500, 4500), q: 4, t: 0.03 + i * rnd(0.02, 0.05), dur: 0.03, vol: rnd(0.2, 0.5) })
    thump(140, 55, 0.18, 0.5)
  },
  /* papel que se desliza (la carta saliendo del sobre) */
  slide(dur = 1.1, t = 0) {
    if (!ctx) return
    burst({ f: 900, f2: 2600, q: 0.7, t, a: dur * 0.4, dur, vol: 0.16 })
    for (let i = 0; i < 8; i++) burst({ f: rnd(2000, 5000), q: 3, t: t + rnd(0, dur), dur: 0.05, vol: 0.05 })
  },
  /* pasar página: un barrido de aire con un pequeño chasquido del papel al final */
  page() {
    if (!ctx) return
    burst({ f: 500, f2: 3000, q: 0.6, a: 0.18, dur: 0.55, vol: 0.22 })
    burst({ f: 3500, q: 2, t: 0.34, dur: 0.06, vol: 0.12 })
  },
  /* una foto o un dibujo que se posa sobre el papel */
  tap(big = false) {
    if (!ctx) return
    burst({ type: 'lowpass', f: big ? 700 : 1200, q: 0.5, dur: 0.12, vol: big ? 0.35 : 0.2 })
    thump(big ? 120 : 180, 70, 0.1, big ? 0.25 : 0.12)
  },
  /* lápiz sobre papel mientras se dibuja un boceto: trazos cortos de ruido agudo */
  pencil(dur = 1.6, t = 0) {
    if (!ctx) return
    for (let x = 0; x < dur; x += rnd(0.12, 0.3)) burst({ f: rnd(3500, 6000), q: 1.2, t: t + x, a: 0.03, dur: rnd(0.08, 0.22), vol: 0.07 })
  },
  /* destello de la cámara: obturador */
  shutter() {
    if (!ctx) return
    burst({ f: 3000, q: 2, dur: 0.04, vol: 0.5 }); burst({ f: 2000, q: 2, t: 0.07, dur: 0.05, vol: 0.4 })
  },
  /* sello de cera sobre la última hoja */
  stamp() { if (ctx) { thump(90, 45, 0.25, 0.6); burst({ type: 'lowpass', f: 600, dur: 0.15, vol: 0.3 }) } },
}

/* la punta de la pluma: level 0..1 (0 = en el aire) */
export function pen(level) {
  if (!ctx) return
  const v = level * 0.11 * (0.75 + Math.random() * 0.5)   // las fibras del papel hacen que el roce no sea uniforme
  penGain.gain.setTargetAtTime(v, now(), 0.012)
  penBand.frequency.setTargetAtTime(2600 + level * 1600 + Math.random() * 500, now(), 0.02)
}

/* ── música: acordes suaves (pad) y notas sueltas de caja de música, en Fa mayor ── */
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12)
const CHORDS = [[53, 57, 60, 64], [50, 57, 60, 65], [46, 53, 57, 62], [48, 55, 60, 64]]   // Fmaj7 Dm7 Bbmaj9 C6
let musicOn = false
export function music() {
  if (!ctx || musicOn) return
  musicOn = true
  musicBus.gain.setTargetAtTime(0.5, now(), 3)
  let i = 0
  const chord = () => {
    const notes = CHORDS[i++ % CHORDS.length], t0 = now(), dur = 9
    for (const m of notes) for (const det of [-6, 5]) {
      const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter()
      o.type = 'triangle'; o.frequency.value = hz(m); o.detune.value = det
      lp.type = 'lowpass'; lp.frequency.value = 900
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.022, t0 + 3); g.gain.setValueAtTime(0.022, t0 + dur - 2); g.gain.linearRampToValueAtTime(0, t0 + dur + 1.5)
      o.connect(lp).connect(g); g.connect(musicBus); g.connect(verb)
      o.start(t0); o.stop(t0 + dur + 1.6)
    }
    // caja de música: unas notas de la escala por encima del acorde
    for (let k = 0; k < 6; k++) {
      if (Math.random() < 0.35) continue
      const m = notes[Math.floor(Math.random() * 4)] + 24, t = t0 + 0.6 + k * 1.4 + Math.random() * 0.3
      for (const [mult, vol] of [[1, 0.05], [4, 0.012]]) {
        const o = ctx.createOscillator(), g = ctx.createGain()
        o.type = 'sine'; o.frequency.value = hz(m) * mult
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2)
        o.connect(g); g.connect(musicBus); g.connect(verb)
        o.start(t); o.stop(t + 2.3)
      }
    }
    setTimeout(chord, dur * 1000)
  }
  chord()
}

import { build } from 'esbuild'
import fs from 'node:fs'
import lang from './src/lang/fr.js'

// La fuente va incrustada en base64 (una sola copia): la usan el navegador y el trazado de opentype.js.
const font = fs.readFileSync('node_modules/@fontsource/homemade-apple/files/homemade-apple-latin-400-normal.woff').toString('base64')

const r = await build({ entryPoints: ['src/app.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020', legalComments: 'none', define: { __FONT__: JSON.stringify(font) } })
const js = r.outputFiles[0].text.replaceAll('</script', '<\\/script')
let out = fs.readFileSync('src/template.html', 'utf8').replace('/*APP*/', () => js)
for (const [k, v] of Object.entries(lang.ui)) out = out.replaceAll(`{{${k}}}`, v)
fs.writeFileSync('index.html', out)
console.log('index.html', (out.length / 1024).toFixed(0) + ' KB')

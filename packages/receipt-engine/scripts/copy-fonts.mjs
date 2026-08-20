import { copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const src = join(root, '..', 'src', 'fonts')
const out = join(root, '..', 'dist', 'fonts')
mkdirSync(out, { recursive: true })
for (const f of ['Mukta-Regular.ttf', 'Mukta-Medium.ttf', 'Mukta-SemiBold.ttf', 'Mukta-Bold.ttf']) {
  const s = join(src, f)
  if (!existsSync(s)) {
    console.error(`Missing font: ${s}`)
    process.exit(1)
  }
  copyFileSync(s, join(out, f))
}
console.log('fonts copied to dist/fonts')
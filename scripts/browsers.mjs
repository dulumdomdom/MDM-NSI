// Chromium для e2e (Playwright) в репозитории: GitHub не принимает файлы > 100 МБ, поэтому браузеры
// хранятся zip-архивом, нарезанным на части по 90 МБ, в vendor/playwright-browsers/.
//
//   node scripts/browsers.mjs pack      — упаковать node_modules/playwright-core/.local-browsers в части
//   node scripts/browsers.mjs restore   — собрать части и распаковать обратно (npm run e2e:restore)

import { execFileSync } from 'node:child_process'
import { closeSync, createReadStream, createWriteStream, existsSync, mkdirSync, openSync, readdirSync, readSync, rmSync, statSync, writeSync } from 'node:fs'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'

const root = process.cwd()
const target = join(root, 'node_modules', 'playwright-core')
const browsers = join(target, '.local-browsers')
const vendor = join(root, 'vendor', 'playwright-browsers')
const zip = join(root, 'release', 'playwright-browsers-win64.zip')
const PART = 90 * 1024 * 1024

// На Windows — системный bsdtar (умеет zip); в Git Bash первым в PATH стоит GNU tar без zip
const tar = process.platform === 'win32' ? join(process.env['SystemRoot'] ?? 'C:\\Windows', 'System32', 'tar.exe') : 'tar'

const parts = () => (existsSync(vendor) ? readdirSync(vendor).filter((f) => /\.zip\.\d{3}$/.test(f)).sort() : [])

async function pack() {
  if (!existsSync(browsers)) throw new Error(`Нет ${browsers} — сначала npm run e2e:install`)
  mkdirSync(join(root, 'release'), { recursive: true })
  rmSync(zip, { force: true })
  execFileSync(tar, ['-a', '-c', '-f', zip, '-C', target, '.local-browsers'], { stdio: 'inherit' })
  rmSync(vendor, { recursive: true, force: true })
  mkdirSync(vendor, { recursive: true })
  // Нарезка на части
  const size = statSync(zip).size
  const fd = openSync(zip, 'r')
  const buf = Buffer.alloc(8 * 1024 * 1024)
  let pos = 0
  for (let n = 1; pos < size; n++) {
    const out = openSync(join(vendor, `playwright-browsers-win64.zip.${String(n).padStart(3, '0')}`), 'w')
    let written = 0
    while (written < PART && pos < size) {
      const read = readSync(fd, buf, 0, Math.min(buf.length, PART - written, size - pos), pos)
      writeSync(out, buf, 0, read)
      written += read
      pos += read
    }
    closeSync(out)
  }
  closeSync(fd)
  console.info(`Готово: ${parts().length} част(и) в vendor/playwright-browsers (${Math.round(size / 1048576)} МБ)`)
}

async function restore() {
  const list = parts()
  if (list.length === 0) throw new Error('Нет частей в vendor/playwright-browsers')
  mkdirSync(join(root, 'release'), { recursive: true })
  const out = createWriteStream(zip)
  for (const p of list) await pipeline(createReadStream(join(vendor, p)), out, { end: false })
  out.end()
  await new Promise((resolve) => out.on('close', resolve))
  rmSync(browsers, { recursive: true, force: true })
  execFileSync(tar, ['-x', '-f', zip, '-C', target], { stdio: 'inherit' })
  rmSync(zip, { force: true })
  console.info(`Chromium для e2e восстановлен: ${browsers}`)
}

const cmd = process.argv[2]
if (cmd === 'pack') await pack()
else if (cmd === 'restore') await restore()
else {
  console.error('Использование: node scripts/browsers.mjs pack | restore')
  process.exitCode = 1
}

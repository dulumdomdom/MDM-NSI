// Офлайн-пакет для компьютера без интернета: готовая сборка (dist) + скрипты запуска + инструкции → zip.
// Запуск: npm run bundle:offline (сначала собирает приложение). Результат: release/mdm-nsi-offline-<версия>.zip

import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const name = `mdm-nsi-offline-${version}`
const out = join(root, 'release', name)
const zip = join(root, 'release', `${name}.zip`)

if (!existsSync(join(root, 'dist', 'index.html'))) {
  console.error('Нет сборки dist/ — выполните npm run bundle:offline (он собирает сам)')
  process.exit(1)
}

rmSync(out, { recursive: true, force: true })
rmSync(zip, { force: true })
mkdirSync(out, { recursive: true })

// Приложение без source map — пакет меньше, исходники в нём не нужны
cpSync(join(root, 'dist'), join(out, 'app'), { recursive: true, filter: (src) => !src.endsWith('.map') })

for (const f of ['serve.ps1', 'start-windows.cmd', 'serve.py', 'start-linux.sh', 'nginx.conf', 'web.config']) {
  cpSync(join(root, 'deploy', f), join(out, f))
}
cpSync(join(root, 'docs'), join(out, 'docs'), { recursive: true })

// Короткая памятка — в UTF-8 с BOM, чтобы Блокнот открыл кириллицу без вопросов
const readme = `MDM НСИ ${version} — офлайн-пакет
==============================================

Windows: дважды щёлкните start-windows.cmd — откроется браузер с адресом http://localhost:8080/.
         Окно сервера не закрывайте, пока работаете. Порт занят: start-windows.cmd -Port 8081
Linux:   ./start-linux.sh  (нужен python3, есть в большинстве дистрибутивов)

Вход (пароль = логин): admin, sokolov, petrov, kuznetsova, orlov, zakharova, belova, volkova, user.
LDAP-вход («Войти через домен»): ivanov / ldap, nikitina / ldap.

Это демо-стенд: данные живут в браузере этого компьютера и сохраняются между запусками.
Сбросить: Администрирование → «Сбросить демо-данные».

Подробно:
  docs/DEPLOY_OFFLINE.md — установка, обновление, неполадки
  docs/USAGE.md          — руководство пользователя по ролям
  docs/CONFIGURATION.md  — настройка справочников, классификаторов, ролей, обходных листов
  docs/ARCHITECTURE.md   — как устроено приложение
  docs/SCALING.md        — переход на реальный сервер и масштабирование
`
writeFileSync(join(out, 'ПРОЧТИ.txt'), '\uFEFF' + readme.replace(/\n/g, '\r\n'), 'utf8')

// zip: на Windows 10+ есть системный bsdtar (tar -a). Путь явный: в Git Bash первым стоит GNU tar без zip
if (process.platform === 'win32') {
  const tar = join(process.env['SystemRoot'] ?? 'C:\\Windows', 'System32', 'tar.exe')
  execFileSync(tar, ['-a', '-c', '-f', zip, '-C', join(root, 'release'), name], { stdio: 'inherit' })
} else {
  execFileSync('zip', ['-qr', zip, name], { cwd: join(root, 'release'), stdio: 'inherit' })
}

console.info(`\nГотово: ${zip}`)

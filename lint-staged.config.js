// lint-staged: ESLint только для своих файлов. node_modules и vendor лежат в репозитории,
// но проверять их не нужно — иначе коммит обновления зависимостей гоняет линтер по тысячам файлов.

const own = (files) => files.filter((f) => !/[\\/](node_modules|vendor)[\\/]/.test(f))

export default {
  '*.{ts,vue,js}': (files) => {
    const list = own(files)
    return list.length ? [`eslint --max-warnings 0 --no-warn-ignored ${list.map((f) => JSON.stringify(f)).join(' ')}`] : []
  },
}

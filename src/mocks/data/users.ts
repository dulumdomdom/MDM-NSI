// Роли, пользователи с назначениями по областям, учётные данные, парольная политика.
// Демо-входы (пароль = логин): admin, sokolov, petrov, kuznetsova, orlov, zakharova, belova, volkova, user; LDAP: ivanov/ldap.
// Орлов в отпуске — его строки заявок и уведомления получает Захарова. Подразделения — как на машиностроительном заводе: ОГК, ОГТ, ОГМет, ОМТС, бухгалтерия.

import type { PasswordPolicy, Role, StoredCredential, User } from '@/types'

const ALL = '*'

/**
 * Три основные роли. Где действует роль, решает назначение (вся система / справочник / классификатор):
 *  Администратор — назначает роли и области, настраивает структуры и обходные листы, видит все заявки;
 *  Модератор     — ведёт доступные справочники и классификаторы, отвечает за строки заявок в своей области
 *                  (шифрует элементы по своему классификатору, согласует);
 *  Пользователь  — видит доступные справочники и классификаторы, создаёт заявки на пополнение и корректировку.
 * Плюс прикладные роли предприятия: руководитель НСИ, нормоконтролёр, бухгалтер, кладовщик (без цен —
 * ограничение колонок), аудитор. Журнал действий (ресурс audit) видят администратор, руководитель НСИ и аудитор.
 */
export const roles: Role[] = [
  {
    id: 'role-admin',
    name: 'Администратор',
    description: 'Пользователи, роли и области доступа; структура справочников и классификаторов; все заявки',
    system: true,
    scopes: ['global'],
    permissions: [
      { resource: 'catalog', resourceId: ALL, actions: ['read', 'create', 'update', 'delete', 'approve', 'configure'], columnIds: '*' },
      { resource: 'classifier', resourceId: ALL, actions: ['read', 'create', 'update', 'delete', 'approve', 'configure'], columnIds: '*' },
      { resource: 'request', resourceId: ALL, actions: ['read', 'create', 'approve'], columnIds: '*' },
      { resource: 'admin', resourceId: ALL, actions: ['read', 'create', 'update', 'delete'], columnIds: '*' },
      { resource: 'audit', resourceId: ALL, actions: ['read'], columnIds: '*' },
    ],
  },
  {
    id: 'role-nsi-head',
    name: 'Руководитель службы НСИ',
    description: 'Согласует любые строки заявок, правит данные во всех справочниках, видит все заявки и журнал действий. Без администрирования',
    scopes: ['global'],
    permissions: [
      { resource: 'catalog', resourceId: ALL, actions: ['read', 'create', 'update', 'approve'], columnIds: '*' },
      { resource: 'classifier', resourceId: ALL, actions: ['read', 'create', 'approve'], columnIds: '*' },
      { resource: 'request', resourceId: ALL, actions: ['read', 'create', 'approve'], columnIds: '*' },
      { resource: 'audit', resourceId: ALL, actions: ['read'], columnIds: '*' },
    ],
  },
  {
    id: 'role-normcontrol',
    name: 'Нормоконтролёр',
    description: 'Проверяет документацию на соответствие ЕСКД (ГОСТ 2.111): согласует строки «Нормоконтроль», данные не правит',
    permissions: [
      { resource: 'catalog', resourceId: ALL, actions: ['read', 'approve'], columnIds: '*' },
      { resource: 'classifier', resourceId: ALL, actions: ['read'], columnIds: '*' },
      { resource: 'request', resourceId: ALL, actions: ['read', 'approve'], columnIds: '*' },
    ],
  },
  {
    id: 'role-moderator',
    name: 'Модератор',
    description: 'Ведёт доступные справочники и классификаторы, шифрует и согласует строки заявок',
    system: true,
    permissions: [
      { resource: 'catalog', resourceId: ALL, actions: ['read', 'create', 'update', 'delete', 'approve'], columnIds: '*' },
      { resource: 'classifier', resourceId: ALL, actions: ['read', 'create', 'approve'], columnIds: '*' },
      { resource: 'request', resourceId: ALL, actions: ['read', 'create', 'approve'], columnIds: '*' },
    ],
  },
  {
    id: 'role-user',
    name: 'Пользователь',
    description: 'Видит доступные справочники и классификаторы, создаёт заявки на пополнение и корректировку',
    system: true,
    permissions: [
      { resource: 'catalog', resourceId: ALL, actions: ['read'], columnIds: '*' },
      { resource: 'classifier', resourceId: ALL, actions: ['read'], columnIds: '*' },
      { resource: 'request', resourceId: ALL, actions: ['read', 'create'], columnIds: '*' },
    ],
  },
  {
    id: 'role-accountant',
    name: 'Бухгалтер',
    description: 'Регистрирует и проводит счета-фактуры, отмечает оплату',
    permissions: [
      { resource: 'catalog', resourceId: ALL, actions: ['read', 'create', 'update'], columnIds: '*' },
      { resource: 'request', resourceId: ALL, actions: ['read', 'create'], columnIds: '*' },
    ],
  },
  {
    id: 'role-storekeeper',
    name: 'Кладовщик',
    description: 'Видит номенклатуру без цен, создаёт заявки на пополнение',
    permissions: [
      { resource: 'catalog', resourceId: ALL, actions: ['read'], columnIds: ['article', 'name', 'unit', 'standard', 'minBatch'] },
      { resource: 'request', resourceId: ALL, actions: ['read', 'create'], columnIds: '*' },
    ],
  },
  {
    id: 'role-auditor',
    name: 'Аудитор',
    description: 'Только просмотр справочников, классификаторов и заявок во всей системе (внутренний контроль)',
    scopes: ['global'],
    permissions: [
      { resource: 'catalog', resourceId: ALL, actions: ['read'], columnIds: '*' },
      { resource: 'classifier', resourceId: ALL, actions: ['read'], columnIds: '*' },
      { resource: 'request', resourceId: ALL, actions: ['read'], columnIds: '*' },
      { resource: 'audit', resourceId: ALL, actions: ['read'], columnIds: '*' },
    ],
  },
]

export const users: User[] = [
  {
    id: 'u-admin',
    login: 'admin',
    fullName: 'Администратор системы',
    email: 'admin@uzpm.local',
    position: 'Группа ведения НСИ, служба ИТ',
    assignments: [{ roleId: 'role-admin', scope: { type: 'global' } }],
    status: 'active',
    provider: 'local',
    passwordChangedAt: '2026-10-01T09:00:00Z',
  },
  {
    id: 'u-petrov',
    login: 'petrov',
    fullName: 'Петров Пётр Петрович',
    email: 'petrov@uzpm.local',
    phone: 'доб. 2-14',
    position: 'Ведущий инженер-технолог, ОГТ',
    // Отвечает за номенклатуру и шифрует инструмент
    assignments: [
      { roleId: 'role-moderator', scope: { type: 'catalog', id: 'cat-nomenclature' } },
      { roleId: 'role-moderator', scope: { type: 'classifier', id: 'cls-tool' } },
    ],
    status: 'active',
    provider: 'local',
    expiresAt: '2027-12-31T23:59:59Z',
    passwordChangedAt: '2026-10-15T09:00:00Z',
  },
  {
    id: 'u-kuznetsova',
    login: 'kuznetsova',
    fullName: 'Кузнецова Ольга Викторовна',
    email: 'kuznetsova@uzpm.local',
    phone: 'доб. 3-07',
    position: 'Инженер-металловед, отдел главного металлурга',
    // Шифрует материалы; номенклатуру только видит
    assignments: [
      { roleId: 'role-moderator', scope: { type: 'classifier', id: 'cls-material' } },
      { roleId: 'role-user', scope: { type: 'catalog', id: 'cat-nomenclature' } },
    ],
    status: 'active',
    provider: 'local',
    passwordChangedAt: '2026-10-10T09:00:00Z',
  },
  {
    id: 'u-orlov',
    login: 'orlov',
    fullName: 'Орлов Дмитрий Николаевич',
    email: 'orlov@uzpm.local',
    phone: 'доб. 1-05',
    position: 'Начальник бюро стандартизации, ОГК',
    // Нормоконтроль: обозначения ЕСКД, крепёж по ГОСТ, ОКПД2; ведёт спецификации
    assignments: [
      { roleId: 'role-moderator', scope: { type: 'classifier', id: 'cls-eskd' } },
      { roleId: 'role-moderator', scope: { type: 'classifier', id: 'cls-fastener' } },
      { roleId: 'role-moderator', scope: { type: 'classifier', id: 'cls-okpd2' } },
      { roleId: 'role-moderator', scope: { type: 'catalog', id: 'cat-specifications' } },
      { roleId: 'role-moderator', scope: { type: 'catalog', id: 'cat-spec-lines' } },
      { roleId: 'role-user', scope: { type: 'catalog', id: 'cat-nomenclature' } },
    ],
    status: 'active',
    provider: 'local',
    passwordChangedAt: '2026-10-05T09:00:00Z',
    absence: { from: '2026-11-03T00:00:00Z', until: '2026-11-30T23:59:59Z', deputyId: 'u-zakharova', reason: 'Ежегодный отпуск' },
  },
  {
    id: 'u-zakharova',
    login: 'zakharova',
    fullName: 'Захарова Ирина Олеговна',
    email: 'zakharova@uzpm.local',
    phone: 'доб. 1-07',
    position: 'Инженер-нормоконтролёр, бюро стандартизации ОГК',
    // Нормоконтроль спецификаций; на время отпуска Орлова — его заместитель
    assignments: [
      { roleId: 'role-normcontrol', scope: { type: 'catalog', id: 'cat-specifications' } },
      { roleId: 'role-user', scope: { type: 'catalog', id: 'cat-nomenclature' } },
      { roleId: 'role-user', scope: { type: 'classifier', id: 'cls-eskd' } },
    ],
    status: 'active',
    provider: 'local',
    passwordChangedAt: '2026-10-20T09:00:00Z',
  },
  {
    id: 'u-sokolov',
    login: 'sokolov',
    fullName: 'Соколов Андрей Викторович',
    email: 'sokolov@uzpm.local',
    phone: 'доб. 1-01',
    position: 'Руководитель службы НСИ',
    assignments: [{ roleId: 'role-nsi-head', scope: { type: 'global' } }],
    status: 'active',
    provider: 'local',
    passwordChangedAt: '2026-09-01T09:00:00Z',
  },
  {
    id: 'u-belova',
    login: 'belova',
    fullName: 'Белова Марина Игоревна',
    email: 'belova@uzpm.local',
    phone: 'доб. 4-21',
    position: 'Ведущий специалист, ОМТС',
    // Ведёт контрагентов, проверяет новых поставщиков
    assignments: [
      { roleId: 'role-moderator', scope: { type: 'catalog', id: 'cat-counterparties' } },
      { roleId: 'role-user', scope: { type: 'catalog', id: 'cat-nomenclature' } },
      { roleId: 'role-user', scope: { type: 'catalog', id: 'cat-invoices' } },
    ],
    status: 'active',
    provider: 'local',
    passwordChangedAt: '2026-09-28T09:00:00Z',
  },
  {
    id: 'u-volkova',
    login: 'volkova',
    fullName: 'Волкова Татьяна Петровна',
    email: 'volkova@uzpm.local',
    phone: 'доб. 5-10',
    position: 'Бухгалтер по учёту ТМЦ',
    assignments: [
      { roleId: 'role-accountant', scope: { type: 'catalog', id: 'cat-invoices' } },
      { roleId: 'role-user', scope: { type: 'catalog', id: 'cat-counterparties' } },
      { roleId: 'role-user', scope: { type: 'catalog', id: 'cat-nomenclature' } },
    ],
    status: 'active',
    provider: 'local',
    passwordChangedAt: '2026-08-14T09:00:00Z',
  },
  {
    id: 'u-user',
    login: 'user',
    fullName: 'Сидорова Анна Сергеевна',
    email: 'sidorova@uzpm.local',
    phone: 'доб. 1-32',
    position: 'Инженер-конструктор 1 категории, ОГК',
    assignments: [
      { roleId: 'role-user', scope: { type: 'catalog', id: 'cat-nomenclature' } },
      { roleId: 'role-user', scope: { type: 'catalog', id: 'cat-units' } },
      { roleId: 'role-user', scope: { type: 'catalog', id: 'cat-specifications' } },
      { roleId: 'role-user', scope: { type: 'catalog', id: 'cat-spec-lines' } },
      { roleId: 'role-user', scope: { type: 'classifier', id: 'cls-tool' } },
      { roleId: 'role-user', scope: { type: 'classifier', id: 'cls-material' } },
      { roleId: 'role-user', scope: { type: 'classifier', id: 'cls-fastener' } },
      { roleId: 'role-user', scope: { type: 'classifier', id: 'cls-eskd' } },
    ],
    status: 'active',
    provider: 'local',
    passwordChangedAt: '2026-09-20T09:00:00Z',
  },
  {
    id: 'u-ivanov',
    login: 'ivanov',
    fullName: 'Иванов Иван Иванович',
    email: 'ivanov@uzpm.local',
    position: 'Специалист по закупкам, ОМТС',
    assignments: [
      { roleId: 'role-user', scope: { type: 'catalog', id: 'cat-counterparties' } },
      { roleId: 'role-user', scope: { type: 'catalog', id: 'cat-invoices' } },
      { roleId: 'role-user', scope: { type: 'classifier', id: 'cls-okpd2' } },
    ],
    status: 'active',
    provider: 'ldap',
  },
  {
    id: 'u-nikitina',
    login: 'nikitina',
    fullName: 'Никитина Елена Владимировна',
    position: 'Кладовщик центрального склада',
    assignments: [{ roleId: 'role-storekeeper', scope: { type: 'catalog', id: 'cat-nomenclature' } }],
    status: 'active',
    provider: 'ldap',
  },
  {
    id: 'u-gromov',
    login: 'gromov',
    fullName: 'Громов Сергей Алексеевич',
    position: 'Ведущий специалист службы внутреннего контроля',
    assignments: [{ roleId: 'role-auditor', scope: { type: 'global' } }],
    status: 'blocked',
    provider: 'ldap',
  },
  // Служебные учётные записи интеграций: авторы входящих заявок. Пароля нет — войти нельзя
  {
    id: 'u-int-imbase',
    login: 'integration.imbase',
    fullName: 'Интеграция: Imbase',
    position: 'Служебная учётная запись',
    assignments: [{ roleId: 'role-user', scope: { type: 'catalog', id: 'cat-nomenclature' } }],
    status: 'active',
    provider: 'local',
  },
  {
    id: 'u-int-1c',
    login: 'integration.1c',
    fullName: 'Интеграция: 1С',
    position: 'Служебная учётная запись',
    assignments: [{ roleId: 'role-user', scope: { type: 'catalog', id: 'cat-counterparties' } }],
    status: 'active',
    provider: 'local',
  },
  {
    id: 'u-old',
    login: 'kovalev',
    fullName: 'Ковалёв Павел Андреевич',
    position: 'Инженер-технолог, ОГТ (уволен 30.06.2026)',
    assignments: [],
    status: 'deleted',
    provider: 'local',
  },
]

/** SHA-512(salt + password) — значения посчитаны заранее, см. тест в lib/__tests__ */
const baseCredentials: StoredCredential[] = [
  {
    userId: 'u-admin',
    salt: 'a1f3c9e2',
    hash: '1b0dd4d66ba175982df63450b22a8ec6b6fe214554bc4ce74e2f6752ae884e3c9b867227bb189a505ecd810d19abdda79f11bb9523f97d6a92931249b8a7aaa2',
    history: [],
  },
  {
    userId: 'u-petrov',
    salt: '9a7c21e4',
    hash: 'bcff793a921122ed6ee7cfd6f68d72cb1eb209852eb2f05f70c220a7969b62089cbcada67363ae3c34886b43aa14b1e21ad2cd05b30cbee38a11930949e9ec38',
    history: [],
  },
  {
    userId: 'u-kuznetsova',
    salt: '3f8b6d02',
    hash: 'cf54d96e0646f71242b2eb36b0525161ef14095c5672b042dc06b5e283fb44af0216026074d8df71722f7eadcbc4b584762c89bdd6f8d6e8be6a46337a427206',
    history: [],
  },
  {
    userId: 'u-user',
    salt: '6e0c94ab',
    hash: '63cdbeae186b63dd041bf7eb317dee8d44f3fdb44f8f8607c7060cd297017eb074165c75a1d5274fa2d66712aa42596123b33e58ecc6efbe7e3e105faeb5eb8f',
    history: [],
  },
  {
    userId: 'u-orlov',
    salt: '5b1e7c20',
    hash: '4ee6ad66d9c0cb2f55d561f97e6283a1d571a70c36145d7f3dbf2333867fcb9fb514b76e561fd758d737378e11dbd884d56a49f1f351c138b94bba150c6bc71b',
    history: [],
  },
  {
    userId: 'u-belova',
    salt: 'c2a94d17',
    hash: '21f271c1e8596bb80a72cbe66f42dbfe457ab84d0e932af0c6b236af16fb4c5d5d0397636bcea80ecb38704f78206ffe64a865a9b8ba758705ff0421f5af39b9',
    history: [],
  },
  {
    userId: 'u-volkova',
    salt: '8d03f6e9',
    hash: '0dffc895e08e378509ea05d41bf749ecc681e714ede1f03b6084dc4e1d833f080b21ad31e728ea532c82109355804c4b43a04a848c58c308b10565824cbfe0a7',
    history: [],
  },
]

/** Мок LDAP-каталога: логин → пароль (в реальности проверяет LDAP-сервер) */
const extraCredentials: StoredCredential[] = [
  {
    userId: 'u-zakharova',
    salt: '4c7a19e0',
    hash: 'c4043430e371e025c735d5f2983cbf14e8397cb964904dc1443d5d66632c6f6d1ab9ee3a4286e7b4ea2aebd1c81c85deabeec4e81183a7f21e076dcfb2736f09',
    history: [],
  },
  {
    userId: 'u-sokolov',
    salt: 'e61b2f85',
    hash: '0ca67557d005c7312414fef899a5e17523f02b3521bc537ab61aeef3e48ac7a3154743a1a0ced90b86e4c91f6915aa4ad5d2977915565859228a6df66bc54daa',
    history: [],
  },
]

export const credentials: StoredCredential[] = [...baseCredentials, ...extraCredentials]

export const ldapDirectory: Record<string, string> = { ivanov: 'ldap', nikitina: 'ldap', gromov: 'ldap' }

export const passwordPolicy: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireDigits: true,
  requireSpecial: false,
  maxAgeDays: 90,
  uniqueHistoryCount: 5,
}

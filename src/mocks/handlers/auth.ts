// Моки: вход (local SHA-512+соль / LDAP), смена пароля, администрирование пользователей и ролей.

import { http, HttpResponse } from 'msw'
import { endpoints, fullUrl } from '@/api/endpoints'
import type { AbsenceDto, AuditQuery, ChangePasswordDto, CreateUserDto, UserBrief } from '@/api/auth'
import { generateSalt, hashPassword, isPasswordExpired, isPasswordReused, validatePassword } from '@/lib/security/password'
import { delegationsOf } from '@/lib/rbac'
import type { AuditEntry, LoginRequest, PasswordPolicy, Role, Session, User } from '@/types'
import { db, nextId, nowIso } from '../db'
import { audit } from '../audit'
import { resetPersisted } from '../persist'
import { apiError, forbidden, latency, makeToken, notFound, unauthorized, userCanGlobally, userFromRequest, userIsAdmin } from '../utils'

function sessionFor(user: User): Session {
  return {
    token: makeToken(user.id),
    user,
    roles: db.roles.filter((r) => user.assignments.some((a) => a.roleId === r.id)),
    passwordExpired: user.provider === 'local' && isPasswordExpired(user.passwordChangedAt, db.passwordPolicy),
    delegations: delegationsOf(user.id, db.users),
  }
}

const isAdmin = userIsAdmin

export const authHandlers = [
  http.post<never, LoginRequest>(fullUrl(endpoints.auth.login), async ({ request }) => {
    await latency()
    const { login, password, provider } = await request.json()
    const user = db.users.find((u) => u.login === login && u.provider === provider)
    const denied = () => apiError(401, 'BAD_CREDENTIALS', 'Неверный логин или пароль')
    if (!user) return denied()
    if (user.status !== 'active') return apiError(403, 'USER_INACTIVE', 'Учётная запись заблокирована или удалена')
    if (user.expiresAt && new Date(user.expiresAt) < new Date()) return apiError(403, 'USER_EXPIRED', 'Срок действия учётной записи истёк')

    if (provider === 'ldap') {
      // Внешняя авторизация: пароль проверяет LDAP, у нас он не хранится
      if (db.ldap[login] !== password) return denied()
    } else {
      const cred = db.credentials.find((c) => c.userId === user.id)
      if (!cred || (await hashPassword(password, cred.salt)) !== cred.hash) return denied()
    }
    audit(user, 'Вход в систему', 'session', undefined, undefined, provider === 'ldap' ? 'LDAP' : undefined)
    return HttpResponse.json(sessionFor(user))
  }),

  http.get(fullUrl(endpoints.auth.me), async ({ request }) => {
    await latency()
    const user = userFromRequest(request)
    return user ? HttpResponse.json(sessionFor(user)) : unauthorized()
  }),

  http.post(fullUrl(endpoints.auth.logout), () => new HttpResponse(null, { status: 204 })),

  /** Своё отсутствие: строки заявок и уведомления на это время уходят заместителю */
  http.put<never, AbsenceDto>(fullUrl(endpoints.auth.absence), async ({ request }) => {
    const user = userFromRequest(request)
    if (!user) return unauthorized()
    const dto = await request.json()
    const from = dto.from ?? nowIso()
    const deputy = db.users.find((u) => u.id === dto.deputyId)
    if (!deputy || deputy.status !== 'active' || deputy.id === user.id) return apiError(400, 'DEPUTY', 'Выберите действующего заместителя')
    if (deputy.absence && deputy.absence.deputyId === user.id) return apiError(400, 'DEPUTY_LOOP', 'Заместитель сам передал дела вам')
    if (!(Date.parse(dto.until) > Date.parse(from))) return apiError(400, 'DATES', 'Дата окончания должна быть позже начала')
    user.absence = { from, until: dto.until, deputyId: deputy.id, reason: dto.reason.trim() || 'Отпуск' }
    audit(user, 'Назначен заместитель', 'user', user.id, user.fullName, `${deputy.fullName} до ${dto.until.slice(0, 10)}`)
    return HttpResponse.json(sessionFor(user))
  }),

  http.delete(fullUrl(endpoints.auth.absence), ({ request }) => {
    const user = userFromRequest(request)
    if (!user) return unauthorized()
    delete user.absence
    audit(user, 'Отсутствие отменено', 'user', user.id, user.fullName)
    return HttpResponse.json(sessionFor(user))
  }),

  /** Демо-стенд: исходные данные. Только администратор */
  http.post(fullUrl(endpoints.demoReset), ({ request }) => {
    const user = userFromRequest(request)
    if (!user) return unauthorized()
    if (!isAdmin(user)) return forbidden()
    resetPersisted()
    return new HttpResponse(null, { status: 204 })
  }),

  /** Журнал действий: администратор, аудитор, руководитель НСИ */
  http.get(fullUrl(endpoints.audit), ({ request }) => {
    const user = userFromRequest(request)
    if (!user) return unauthorized()
    if (!userCanGlobally(user, 'audit', 'read')) return forbidden('Журнал действий доступен администратору и аудитору')
    const url = new URL(request.url)
    const q: AuditQuery = {
      ...(url.searchParams.get('userId') ? { userId: url.searchParams.get('userId') ?? '' } : {}),
      ...(url.searchParams.get('q') ? { q: url.searchParams.get('q') ?? '' } : {}),
    }
    const type = url.searchParams.get('objectType')
    const text = q.q?.toLowerCase()
    const rows: AuditEntry[] = db.audit.filter(
      (e) =>
        (!q.userId || e.userId === q.userId) &&
        (!type || e.objectType === type) &&
        (!text || `${e.action} ${e.objectName ?? ''} ${e.details ?? ''}`.toLowerCase().includes(text)),
    )
    return HttpResponse.json(rows.slice(0, 500))
  }),

  http.post<never, ChangePasswordDto>(fullUrl(endpoints.auth.changePassword), async ({ request }) => {
    const user = userFromRequest(request)
    if (!user) return unauthorized()
    if (user.provider !== 'local') return apiError(400, 'LDAP_USER', 'Пароль LDAP-пользователя меняется в домене')
    const { oldPassword, newPassword } = await request.json()
    const cred = db.credentials.find((c) => c.userId === user.id)
    if (!cred || (await hashPassword(oldPassword, cred.salt)) !== cred.hash) return apiError(400, 'BAD_OLD_PASSWORD', 'Текущий пароль неверен')
    const errors = validatePassword(newPassword, db.passwordPolicy)
    if (errors.length > 0) return apiError(400, 'POLICY', errors.join('; '))
    const newHash = await hashPassword(newPassword, cred.salt)
    if (isPasswordReused(newHash, [...cred.history, cred.hash], db.passwordPolicy))
      return apiError(400, 'REUSED', `Нельзя повторять ${db.passwordPolicy.uniqueHistoryCount} последних паролей`)
    // Новая соль на каждый пароль; история хранит хэши со своей солью — для мока упрощено
    cred.history.push(cred.hash)
    cred.hash = newHash
    user.passwordChangedAt = nowIso()
    return new HttpResponse(null, { status: 204 })
  }),

  /* ------------------------------ admin ------------------------------ */

  http.get(fullUrl(endpoints.admin.users), ({ request }) => {
    const user = userFromRequest(request)
    if (!user) return unauthorized()
    return HttpResponse.json(db.users)
  }),

  http.post<never, CreateUserDto>(fullUrl(endpoints.admin.users), async ({ request }) => {
    const actor = userFromRequest(request)
    if (!actor) return unauthorized()
    if (!isAdmin(actor)) return forbidden()
    const { password, ...dto } = await request.json()
    if (db.users.some((u) => u.login === dto.login)) return apiError(409, 'LOGIN_TAKEN', 'Логин занят')
    if (dto.provider === 'local') {
      const errors = validatePassword(password, db.passwordPolicy)
      if (errors.length > 0) return apiError(400, 'POLICY', errors.join('; '))
    }
    const user: User = { ...dto, id: nextId('u'), passwordChangedAt: nowIso() }
    db.users.push(user)
    audit(actor, 'Создан пользователь', 'user', user.id, user.fullName)
    if (dto.provider === 'local') {
      const salt = generateSalt()
      db.credentials.push({ userId: user.id, salt, hash: await hashPassword(password, salt), history: [] })
    }
    return HttpResponse.json(user, { status: 201 })
  }),

  http.put<{ id: string }, User>(fullUrl(endpoints.admin.user(':id')), async ({ request, params }) => {
    const actor = userFromRequest(request)
    if (!actor) return unauthorized()
    if (!isAdmin(actor)) return forbidden()
    const idx = db.users.findIndex((u) => u.id === params.id)
    if (idx === -1) return notFound('Пользователь')
    const updated = { ...(await request.json()), id: params.id }
    db.users[idx] = updated
    audit(actor, 'Изменён пользователь', 'user', updated.id, updated.fullName, `назначений: ${updated.assignments.length}, статус: ${updated.status}`)
    return HttpResponse.json(updated)
  }),

  http.delete<{ id: string }>(fullUrl(endpoints.admin.user(':id')), ({ request, params }) => {
    const actor = userFromRequest(request)
    if (!actor) return unauthorized()
    if (!isAdmin(actor)) return forbidden()
    // ТЗ: удалить можно, только если пользователь не фигурирует в логах
    const inLogs =
      db.requests.some((r) => r.createdBy === params.id || r.steps.some((s) => s.decidedBy === params.id)) ||
      db.elements.some((e) => e.history.some((h) => h.userId === params.id))
    if (inLogs) return apiError(409, 'USER_IN_LOGS', 'Пользователь фигурирует в журналах — переведите его в статус «удалён»')
    audit(actor, 'Удалён пользователь', 'user', params.id, db.users.find((u) => u.id === params.id)?.fullName)
    db.users = db.users.filter((u) => u.id !== params.id)
    db.credentials = db.credentials.filter((c) => c.userId !== params.id)
    return new HttpResponse(null, { status: 204 })
  }),

  http.post<{ id: string }>(fullUrl(endpoints.admin.resetPassword(':id')), async ({ request, params }) => {
    const actor = userFromRequest(request)
    if (!actor) return unauthorized()
    if (!isAdmin(actor)) return forbidden()
    const cred = db.credentials.find((c) => c.userId === params.id)
    if (!cred) return notFound('Локальная учётная запись')
    const temporaryPassword = `Tmp-${generateSalt(4)}A1`
    cred.history.push(cred.hash)
    cred.salt = generateSalt()
    cred.hash = await hashPassword(temporaryPassword, cred.salt)
    // Временный пароль сразу «истёкший» — пользователь сменит его при входе
    const user = db.users.find((u) => u.id === params.id)
    if (user) user.passwordChangedAt = '1970-01-01T00:00:00Z'
    audit(actor, 'Сброшен пароль', 'user', params.id, user?.fullName)
    return HttpResponse.json({ temporaryPassword })
  }),

  http.get(fullUrl(endpoints.admin.roles), ({ request }) => (userFromRequest(request) ? HttpResponse.json(db.roles) : unauthorized())),

  http.post<never, Role>(fullUrl(endpoints.admin.roles), async ({ request }) => {
    const actor = userFromRequest(request)
    if (!actor) return unauthorized()
    if (!isAdmin(actor)) return forbidden()
    const role = await request.json()
    if (db.roles.some((r) => r.id === role.id)) return apiError(409, 'ROLE_EXISTS', 'Роль с таким идентификатором уже есть')
    const created: Role = { ...role, system: false }
    db.roles.push(created)
    audit(actor, 'Создана роль', 'role', created.id, created.name)
    return HttpResponse.json(created, { status: 201 })
  }),

  http.put<{ id: string }, Role>(fullUrl(endpoints.admin.role(':id')), async ({ request, params }) => {
    const actor = userFromRequest(request)
    if (!actor) return unauthorized()
    if (!isAdmin(actor)) return forbidden()
    const idx = db.roles.findIndex((r) => r.id === params.id)
    const current = db.roles[idx]
    if (!current) return notFound('Роль')
    // Системность и id не меняются через API
    const updated: Role = { ...(await request.json()), id: current.id, ...(current.system ? { system: true } : {}) }
    db.roles[idx] = updated
    audit(actor, 'Изменена роль', 'role', updated.id, updated.name)
    return HttpResponse.json(updated)
  }),

  http.delete<{ id: string }>(fullUrl(endpoints.admin.role(':id')), ({ request, params }) => {
    const actor = userFromRequest(request)
    if (!actor) return unauthorized()
    if (!isAdmin(actor)) return forbidden()
    const role = db.roles.find((r) => r.id === params.id)
    if (!role) return notFound('Роль')
    if (role.system) return apiError(409, 'SYSTEM_ROLE', 'Системную роль удалить нельзя')
    const holders = db.users.filter((u) => u.assignments.some((a) => a.roleId === role.id))
    if (holders.length > 0) return apiError(409, 'ROLE_IN_USE', `Роль назначена пользователям: ${holders.map((u) => u.login).join(', ')}`)
    if (db.workflows.some((w) => w.steps.some((s) => s.roleId === role.id))) return apiError(409, 'ROLE_IN_WORKFLOW', 'Роль используется в обходных листах')
    db.roles = db.roles.filter((r) => r.id !== role.id)
    return new HttpResponse(null, { status: 204 })
  }),

  /** Краткий справочник пользователей — для подписей в заявках; без контактов и прав */
  http.get(fullUrl(endpoints.admin.directory), ({ request }) => {
    if (!userFromRequest(request)) return unauthorized()
    const list: UserBrief[] = db.users.map((u) => ({ id: u.id, fullName: u.fullName, ...(u.position ? { position: u.position } : {}) }))
    return HttpResponse.json(list)
  }),

  http.get(fullUrl(endpoints.admin.passwordPolicy), ({ request }) =>
    userFromRequest(request) ? HttpResponse.json(db.passwordPolicy) : unauthorized(),
  ),

  http.put<never, PasswordPolicy>(fullUrl(endpoints.admin.passwordPolicy), async ({ request }) => {
    const actor = userFromRequest(request)
    if (!actor) return unauthorized()
    if (!isAdmin(actor)) return forbidden()
    db.passwordPolicy = await request.json()
    return HttpResponse.json(db.passwordPolicy)
  }),
]

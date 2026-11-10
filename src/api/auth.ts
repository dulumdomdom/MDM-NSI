// Контракты: аутентификация и администрирование пользователей.

import type { Absence, AuditEntry, AuditObjectType, LoginRequest, PasswordPolicy, Role, Session, User } from '@/types'
import { api } from './client'
import { endpoints } from './endpoints'

export interface ChangePasswordDto {
  oldPassword: string
  newPassword: string
}

export type CreateUserDto = Omit<User, 'id' | 'passwordChangedAt'> & { password: string }

/** Краткая карточка пользователя для подписей (кто создал заявку, кто согласовал) */
export interface UserBrief {
  id: string
  fullName: string
  position?: string
}

export const authApi = {
  login: (dto: LoginRequest) => api.post<Session>(endpoints.auth.login, dto),
  logout: () => api.post<void>(endpoints.auth.logout),
  me: () => api.get<Session>(endpoints.auth.me),
  changePassword: (dto: ChangePasswordDto) => api.post<void>(endpoints.auth.changePassword, dto),
  setAbsence: (dto: AbsenceDto) => api.put<Session>(endpoints.auth.absence, dto),
  clearAbsence: () => api.delete<Session>(endpoints.auth.absence),
}

export type AbsenceDto = Omit<Absence, 'from'> & { from?: string }

export interface AuditQuery {
  userId?: string
  objectType?: AuditObjectType
  q?: string
}

export const auditApi = {
  list: (q: AuditQuery = {}) => api.get<AuditEntry[]>(endpoints.audit, { params: q }),
}

export const adminApi = {
  users: () => api.get<User[]>(endpoints.admin.users),
  createUser: (dto: CreateUserDto) => api.post<User>(endpoints.admin.users, dto),
  updateUser: (user: User) => api.put<User>(endpoints.admin.user(user.id), user),
  /** Физическое удаление — сервер разрешит, только если пользователь не фигурирует в логах */
  deleteUser: (id: string) => api.delete(endpoints.admin.user(id)),
  resetPassword: (id: string) => api.post<{ temporaryPassword: string }>(endpoints.admin.resetPassword(id)),
  roles: () => api.get<Role[]>(endpoints.admin.roles),
  createRole: (r: Role) => api.post<Role>(endpoints.admin.roles, r),
  saveRole: (r: Role) => api.put<Role>(endpoints.admin.role(r.id), r),
  /** Удалить можно только несистемную роль, которая никому не назначена */
  deleteRole: (id: string) => api.delete(endpoints.admin.role(id)),
  directory: () => api.get<UserBrief[]>(endpoints.admin.directory),
  demoReset: () => api.post<void>(endpoints.demoReset),
  passwordPolicy: () => api.get<PasswordPolicy>(endpoints.admin.passwordPolicy),
  savePasswordPolicy: (p: PasswordPolicy) => api.put<PasswordPolicy>(endpoints.admin.passwordPolicy, p),
}

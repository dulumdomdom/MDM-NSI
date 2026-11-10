import { describe, expect, it } from 'vitest'
import type { Request, Role, RoleAssignment } from '@/types'
import { can, canAny, canDecideStep, canGlobally, effectiveRoles, filterColumns, requestScope } from '../rbac'
import { newCatalog, newAttribute, validateCatalog } from '../catalogSchema'
import { slugify, uniqueId } from '../ids'
import { addChild, facetUsage, newClassifier, newFacet, newFacetNode, removeNode, validateClassifier } from '../classifier/edit'
import { toolClassifier } from '@/mocks/data/classifiers/tool'
import { materialClassifier } from '@/mocks/data/classifiers/material'

const editor: Role = {
  id: 'role-editor',
  name: 'Редактор',
  permissions: [
    { resource: 'catalog', resourceId: '*', actions: ['read', 'create', 'update'], columnIds: '*' },
    { resource: 'classifier', resourceId: '*', actions: ['read', 'create'], columnIds: '*' },
    { resource: 'request', resourceId: '*', actions: ['read', 'create'], columnIds: '*' },
  ],
}
const methodologist: Role = {
  id: 'role-method',
  name: 'Методолог',
  permissions: [{ resource: 'catalog', resourceId: '*', actions: ['read', 'configure'], columnIds: '*' }],
}
const restricted: Role = {
  id: 'role-tech',
  name: 'Технолог',
  permissions: [{ resource: 'catalog', resourceId: '*', actions: ['read'], columnIds: ['name'] }],
}
const roles = [editor, methodologist, restricted, { id: 'role-admin', name: 'Админ', permissions: [] }, { id: 'role-approver', name: 'Согласующий', permissions: [] }]

describe('назначения ролей по областям', () => {
  it('роль на справочник действует только на этот справочник', () => {
    const eff = effectiveRoles([{ roleId: 'role-editor', scope: { type: 'catalog', id: 'cat-a' } }], roles)
    expect(can(eff, 'catalog', 'cat-a', 'update')).toBe(true)
    expect(can(eff, 'catalog', 'cat-b', 'update')).toBe(false)
    // права на классификаторы в области справочника не действуют
    expect(can(eff, 'classifier', 'cls-x', 'read')).toBe(false)
    expect(canAny(eff, 'request', 'create')).toBe(true)
  })

  it('глобальная роль действует везде; создавать новые справочники можно только глобально', () => {
    const scoped = effectiveRoles([{ roleId: 'role-method', scope: { type: 'catalog', id: 'cat-a' } }], roles)
    const global = effectiveRoles([{ roleId: 'role-method', scope: { type: 'global' } }], roles)
    expect(canGlobally(scoped, 'catalog', 'configure')).toBe(false)
    expect(canGlobally(global, 'catalog', 'configure')).toBe(true)
  })

  it('ограничение колонок роли сохраняется в области', () => {
    const eff = effectiveRoles([{ roleId: 'role-tech', scope: { type: 'catalog', id: 'cat-a' } }], roles)
    expect(filterColumns(eff, 'cat-a', [{ id: 'name' }, { id: 'price' }]).map((c) => c.id)).toEqual(['name'])
  })
})

describe('обходной лист', () => {
  const req = (sequential: boolean): Request => ({
    id: 'r1',
    title: 't',
    targetType: 'element-code',
    targetId: 'cat-a',
    payload: {},
    status: 'in_review',
    sequential,
    createdBy: 'u',
    createdAt: '2026-01-01T00:00:00Z',
    steps: [
      { id: 's1', order: 1, kind: 'review', name: 'Технолог', roleId: 'role-editor', attributeIds: [], status: 'pending' },
      { id: 's2', order: 2, kind: 'review', name: 'НСИ', roleId: 'role-approver', attributeIds: [], status: 'pending' },
    ],
  })
  const approverGlobal: RoleAssignment[] = [{ roleId: 'role-approver', scope: { type: 'global' } }]
  const approverOther: RoleAssignment[] = [{ roleId: 'role-approver', scope: { type: 'catalog', id: 'cat-b' } }]

  it('параллельно: каждый решает свою строку в любом порядке', () => {
    const r = req(false)
    expect(canDecideStep(approverGlobal, r, r.steps[1]!)).toBe(true)
    expect(canDecideStep(approverGlobal, r, r.steps[0]!)).toBe(false)
  })

  it('последовательно: только первая неподписанная строка', () => {
    const r = req(true)
    expect(canDecideStep(approverGlobal, r, r.steps[1]!)).toBe(false)
  })

  it('роль в чужой области не даёт права решать', () => {
    const r = req(false)
    expect(canDecideStep(approverOther, r, r.steps[1]!)).toBe(false)
    expect(requestScope({ targetType: 'classifier-entry', targetId: 'c' })).toEqual({ type: 'classifier', id: 'c' })
  })

  it('администратор может решить любую строку', () => {
    const r = req(false)
    expect(canDecideStep([{ roleId: 'role-admin', scope: { type: 'global' } }], r, r.steps[0]!)).toBe(true)
  })
})

describe('id и схемы', () => {
  it('slugify и уникальность', () => {
    expect(slugify('Длина рабочей части')).toBe('dlina-rabochei-chasti')
    expect(uniqueId('f', 'Тип', ['f-tip'])).toBe('f-tip-2')
  })

  it('новый справочник валиден; ошибки схемы находятся', () => {
    const c = newCatalog('cat-new', 'Новый')
    expect(validateCatalog(c)).toEqual([])
    const broken = { ...c, attributes: [...c.attributes, { ...newAttribute('Ссылка', ['name'], 'reference') }], states: [] }
    const msgs = validateCatalog(broken).map((i) => i.message)
    expect(msgs).toContain('Не выбран справочник для ссылки')
    expect(msgs).toContain('Нет ни одного состояния')
  })
})

describe('редактирование классификатора', () => {
  it('мок-конфиги проходят проверку целостности', () => {
    expect(validateClassifier(toolClassifier)).toEqual([])
    expect(validateClassifier(materialClassifier)).toEqual([])
  })

  it('добавление фасета и ноды, удаление ноды', () => {
    let c = newClassifier('cls-new', 'Новый')
    const f = newFacet(c, 'Группа')
    c = { ...c, facets: [f] }
    const node = newFacetNode(c, f.id)
    c = { ...c, tree: addChild(c.tree, 'cat-main', node) }
    expect(facetUsage(c, f.id)).toBe(1)
    expect(validateClassifier(c)).toEqual([])
    c = { ...c, tree: removeNode(c.tree, node.id) }
    expect(facetUsage(c, f.id)).toBe(0)
  })

  it('остаток шифра не может быть в середине ветки', () => {
    const c = newClassifier('x', 'X')
    const a = { ...newFacet(c, 'А'), lengthMode: 'remainder' as const }
    const b = newFacet({ ...c, facets: [a] }, 'Б')
    const withFacets = { ...c, facets: [a, b] }
    const nb = newFacetNode(withFacets, b.id)
    const na = { ...newFacetNode(withFacets, a.id), children: [nb] }
    const tree = addChild(withFacets.tree, 'cat-main', na)
    expect(validateClassifier({ ...withFacets, tree }).some((i) => i.message.includes('остаток'))).toBe(true)
  })
})

// Заявки как ОБХОДНОЙ ЛИСТ. Строки листа двух видов:
//  review — согласование («да / нет»);
//  encode — шифрование элемента по классификатору: модератор этого классификатора подбирает шифр прямо в заявке.
// Заявка обработана, когда пройдены все строки; отклонение любой строки отклоняет заявку.
// Изменения в справочник вносятся только после обработки заявки (отложенное применение).

import type { AttributeValue } from './catalog'
import type { IsoDateTime } from './common'

/**
 * Что согласуется (targetId — id справочника, для classifier-entry — id классификатора):
 *  catalog-element  — пополнение: новый элемент справочника;
 *  element-edit     — корректировка существующего элемента (при необходимости — с перешифровкой);
 *  element-code     — присвоение шифра элементу из карточки элемента;
 *  classifier-entry — новая запись (шифр) классификатора.
 */
export type RequestTargetType = 'catalog-element' | 'element-edit' | 'element-code' | 'classifier-entry'

export type RequestStatus = 'in_review' | 'approved' | 'rejected'

export type RequestStepStatus = 'pending' | 'approved' | 'rejected' | 'skipped'

export type RequestStepKind = 'review' | 'encode'

/** Шифр, подобранный в строке шифрования */
export interface StepCode {
  classifierId: string
  catalogId: string
  code: string
  decoded: string
  shortName: string
}

/** Строка обходного листа */
export interface RequestStep {
  id: string
  order: number
  kind: RequestStepKind
  /** Что делает ответственный («Шифрование по классификатору инструмента», «Проверка службы НСИ») */
  name: string
  /** Роль ответственного. Право — у владельцев роли в области справочника заявки (или классификатора строки) */
  roleId: string
  /** Для encode: по какому классификатору шифровать */
  classifierId?: string
  /** Для encode: шифр необязателен — строку можно пропустить («не применимо») */
  optional?: boolean
  /** Атрибуты, на которые обращает внимание ответственный */
  attributeIds: string[]
  status: RequestStepStatus
  decidedBy?: string
  decidedAt?: IsoDateTime
  comment?: string
  /** Для encode: подобранный шифр */
  result?: StepCode
  /** Строка нужна только для позиций из этих групп справочника (с подгруппами); пусто — для всех */
  groupIds?: string[]
  /** Нормативный срок решения строки, ч */
  dueHours?: number
  /** Срок решения строки (создание заявки + dueHours) */
  dueAt?: IsoDateTime
  /** Решено заместителем за отсутствующего */
  onBehalfOf?: string
}

/** Шаблон обходного листа: настраивается для справочника / классификатора и типа заявки */
export interface WorkflowConfig {
  id: string
  targetType: RequestTargetType
  /** id справочника или классификатора, '*' — по умолчанию для всех */
  targetId: string
  /** true — строгий порядок; false — все ответственные работают параллельно */
  sequential: boolean
  steps: Omit<RequestStep, 'status' | 'decidedBy' | 'decidedAt' | 'comment' | 'result' | 'dueAt' | 'onBehalfOf'>[]
}

/** Данные заявки. Набор полей зависит от типа */
export interface RequestPayload {
  /** Наименование элемента — для подписи заявки */
  name?: string
  /** Корректировка / шифр элемента: какой элемент */
  elementId?: string
  /** Пополнение: все атрибуты нового элемента; корректировка: только изменённые */
  attributes?: Record<string, AttributeValue>
  parentId?: string
  /** Что пользователь вводил в поиске — для контекста модератору */
  query?: string
  /** Позиция пришла из внешней системы (импорт): после утверждения у элемента будет её идентификатор */
  source?: { systemId: string; externalId: string }
  /** Корректировка: классификаторы, по которым элемент нужно перешифровать */
  recode?: string[]
  /** Шифр (element-code / classifier-entry) */
  catalogId?: string
  classifierId?: string
  code?: string
  decoded?: string
  shortName?: string
}

export interface Request {
  id: string
  title: string
  targetType: RequestTargetType
  targetId: string
  payload: RequestPayload
  status: RequestStatus
  sequential: boolean
  steps: RequestStep[]
  createdBy: string
  createdAt: IsoDateTime
  closedAt?: IsoDateTime
}

export interface CreateRequestDto {
  title: string
  targetType: RequestTargetType
  targetId: string
  payload: RequestPayload
}

/** Результат создания: заявка ушла по обходному листу или (если лист пуст) изменения применены сразу */
export interface CreateRequestResult {
  request: Request | null
  applied: boolean
  /** Элемент, созданный / изменённый при немедленном применении */
  elementId?: string
}

export interface DecideStepDto {
  /** skipped — «не применимо» для необязательной строки шифрования */
  decision: 'approved' | 'rejected' | 'skipped'
  comment?: string
  /** Для encode + approved */
  code?: StepCode
}

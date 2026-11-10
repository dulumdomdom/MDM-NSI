import { authHandlers } from './auth'
import { catalogHandlers } from './catalog'
import { classifierHandlers } from './classifier'
import { requestHandlers } from './request'
import { integrationHandlers } from './integration'

export const handlers = [...authHandlers, ...catalogHandlers, ...classifierHandlers, ...requestHandlers, ...integrationHandlers]

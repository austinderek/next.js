import { value } from './module.js'
export const something = 'inner'
;(globalThis.order ??= []).push('inner')

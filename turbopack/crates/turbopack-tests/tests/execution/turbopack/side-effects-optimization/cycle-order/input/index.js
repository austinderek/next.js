import { something } from './main'

it('correct order', () => {
  expect(something).toBe('inner')
  expect(globalThis.order).toEqual([
    // TODO Order should be 'inner throws', 'module'
    'module',
    'inner no-throws',
    'main',
  ])
})

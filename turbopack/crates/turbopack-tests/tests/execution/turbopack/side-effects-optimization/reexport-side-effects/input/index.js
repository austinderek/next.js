import { a as a6 } from 'package-reexport-side-effect'
import { effects as effects6 } from 'package-reexport-side-effect/check-side-effect'
it('should run side effects of a reexporting module with side effects', () => {
  expect(a6).toBe('a')
  expect(effects6).toEqual(['side-effect.js', 'side-effect2.js', 'index.js'])
})

import { a as a7 } from 'package-reexport-tla-side-effect'
import { effects as effects7 } from 'package-reexport-tla-side-effect/check-side-effect'
it('should run side effects of a reexporting module with side effects (async modules)', () => {
  expect(a7).toBe('a')
  expect(effects7).toEqual(['side-effect.js', 'side-effect2.js', 'index.js'])
})

import { effects as effects8 } from 'package-require-side-effect/check-side-effect'
it('should run side effects of a reexporting module with side effects (async modules)', () => {
  expect(effects8).toEqual([])
  require('package-require-side-effect')
  expect(effects8).toEqual(['side-effect.js', 'side-effect2.js', 'index.js'])
})

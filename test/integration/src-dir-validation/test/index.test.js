/* eslint-env jest */

import fs from 'fs-extra'
import { join } from 'path'
import { nextBuild, nextStart, findPort, killApp } from 'next-test-utils'

const appDir = join(__dirname, '../')

describe('Src Directory Validation', () => {
  beforeEach(async () => {
    await fs.remove(join(appDir, 'middleware.js')).catch(() => {})
    await fs.remove(join(appDir, 'instrumentation.js')).catch(() => {})
  })

  afterEach(async () => {
    await fs.remove(join(appDir, 'middleware.js')).catch(() => {})
    await fs.remove(join(appDir, 'instrumentation.js')).catch(() => {})
  })

  it('should throw error when middleware is outside src directory', async () => {
    await fs.writeFile(
      join(appDir, 'middleware.js'),
      `export function middleware() { return new Response('middleware') }`
    )

    const result = await nextBuild(appDir, [], { stderr: true, stdout: true })
    expect(result.stderr + result.stdout).toContain('Middleware file found outside src directory')
  })

  it('should throw error when instrumentation is outside src directory', async () => {
    await fs.writeFile(
      join(appDir, 'instrumentation.js'),
      `export function register() { console.log('instrumentation') }`
    )

    const result = await nextBuild(appDir, [], { stderr: true, stdout: true })
    expect(result.stderr + result.stdout).toContain('Instrumentation file found outside src directory')
  })

  it('should work correctly when middleware is inside src directory', async () => {
    await fs.writeFile(
      join(appDir, 'src/middleware.js'),
      `export function middleware() { return new Response('middleware') }`
    )

    const result = await nextBuild(appDir, [], { stderr: true, stdout: true })
    expect(result.code).toBe(0)
  })

  it('should work correctly when instrumentation is inside src directory', async () => {
    await fs.writeFile(
      join(appDir, 'src/instrumentation.js'),
      `export function register() { console.log('instrumentation') }`
    )

    const result = await nextBuild(appDir, [], { stderr: true, stdout: true })
    expect(result.code).toBe(0)
  })
})

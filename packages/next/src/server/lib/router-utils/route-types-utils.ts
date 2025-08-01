import path from 'path'
import {
  getRouteRegex,
  type Group,
} from '../../../shared/lib/router/utils/route-regex'
import type { NextConfigComplete } from '../../config-shared'
import { isParallelRouteSegment } from '../../../shared/lib/segment'
import { mkdir } from 'fs/promises'
import fs from 'fs'
import {
  generateRouteTypesFile,
  generateValidatorFile,
  generateServerTypesFile,
  generateCacheLifeTypesFile,
} from './typegen'
import { tryToParsePath } from '../../../lib/try-to-parse-path'
import type { CacheLife } from '../../../server/use-cache/cache-life'

interface RouteInfo {
  path: string
  groups: { [groupName: string]: Group }
}

export interface RouteTypesManifest {
  appRoutes: Record<string, RouteInfo>
  pageRoutes: Record<string, RouteInfo>
  layoutRoutes: Record<string, RouteInfo & { slots: string[] }>
  appRouteHandlerRoutes: Record<string, RouteInfo>
  /** Map of redirect source => RouteInfo */
  redirectRoutes: Record<string, RouteInfo>
  /** Map of rewrite source => RouteInfo */
  rewriteRoutes: Record<string, RouteInfo>
  /** File paths for validation */
  appPagePaths: Set<string>
  pagesRouterPagePaths: Set<string>
  layoutPaths: Set<string>
  appRouteHandlers: Set<string>
  pageApiRoutes: Set<string>
  /** Direct mapping from file paths to routes for validation (resolves intercepting routes) */
  filePathToRoute: Map<string, string>
  /** Layout parameters for root params extraction */
  collectedRootParams?: Record<string, string[]>
  /** Cache life configuration */
  cacheLifeConfig?: { [profile: string]: CacheLife }
}

// Convert a custom-route source string (`/blog/:slug`, `/docs/:path*`, ...)
// into the bracket-syntax used by other Next.js route helpers so that we can
// reuse `getRouteRegex()` to extract groups.
export function convertCustomRouteSource(source: string): string {
  const parseResult = tryToParsePath(source)

  if (parseResult.error || !parseResult.tokens) {
    // Fallback to original source if parsing fails
    return source.startsWith('/') ? source : '/' + source
  }

  let result = ''

  for (const token of parseResult.tokens) {
    if (typeof token === 'string') {
      // Literal path segment
      result += token
    } else {
      // Parameter token
      const { name, modifier, prefix } = token

      // Add the prefix (usually '/')
      result += prefix

      if (modifier === '*') {
        // Catch-all zero or more: :param* -> [[...param]]
        result += `[[...${name}]]`
      } else if (modifier === '+') {
        // Catch-all one or more: :param+ -> [...param]
        result += `[...${name}]`
      } else if (modifier === '?') {
        // Optional catch-all: :param? -> [[...param]]
        result += `[[...${name}]]`
      } else {
        // Standard dynamic segment: :param -> [param]
        result += `[${name}]`
      }
    }
  }

  // Ensure leading slash
  if (!result.startsWith('/')) result = '/' + result
  return result
}

/**
 * Extracts route parameters from a route pattern
 */
export function extractRouteParams(route: string) {
  const regex = getRouteRegex(route)
  return regex.groups
}

function isCanonicalRoute(route: string) {
  const segments = route.split('/')
  for (let i = segments.length - 1; i >= 0; i--) {
    const segment = segments[i]

    if (
      isParallelRouteSegment(segment) ||
      segment.startsWith('(.)') ||
      segment.startsWith('(..)') ||
      segment.startsWith('(...)')
    ) {
      return false
    }
  }

  return true
}

/**
 * Resolves an intercepting route to its canonical equivalent
 * Example: /gallery/test/(..)photo/[id] -> /gallery/photo/[id]
 */
function resolveInterceptingRoute(route: string): string {
  const segments = route.split('/').filter(Boolean)
  const resolved: string[] = []

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]

    if (segment.startsWith('(.)')) {
      // Same level intercept - replace with the intercepted route
      resolved.push(segment.slice(3))
    } else if (segment.startsWith('(..)')) {
      // Parent level intercept - go up one level and add intercepted route
      resolved.pop() // Remove the current level
      resolved.push(segment.slice(4))
    } else if (segment.startsWith('(...)')) {
      // Root level intercept - clear path and add intercepted route
      resolved.length = 0
      resolved.push(segment.slice(5))
    } else {
      resolved.push(segment)
    }
  }

  return '/' + resolved.join('/')
}

/**
 * Creates a route types manifest from processed route data
 * (used for both build and dev)
 */
export async function createRouteTypesManifest({
  dir,
  pageRoutes,
  appRoutes,
  appRouteHandlers,
  pageApiRoutes,
  layoutRoutes,
  slots,
  redirects,
  rewrites,
}: {
  dir: string
  pageRoutes: Array<{ route: string; filePath: string }>
  appRoutes: Array<{ route: string; filePath: string }>
  appRouteHandlers: Array<{ route: string; filePath: string }>
  pageApiRoutes: Array<{ route: string; filePath: string }>
  layoutRoutes: Array<{ route: string; filePath: string }>
  slots: Array<{ name: string; parent: string }>
  redirects?: NextConfigComplete['redirects']
  rewrites?: NextConfigComplete['rewrites']
}): Promise<RouteTypesManifest> {
  const manifest: RouteTypesManifest = {
    appRoutes: {},
    pageRoutes: {},
    layoutRoutes: {},
    appRouteHandlerRoutes: {},
    redirectRoutes: {},
    rewriteRoutes: {},
    appRouteHandlers: new Set(appRouteHandlers.map(({ filePath }) => filePath)),
    pageApiRoutes: new Set(pageApiRoutes.map(({ filePath }) => filePath)),
    appPagePaths: new Set(appRoutes.map(({ filePath }) => filePath)),
    pagesRouterPagePaths: new Set(pageRoutes.map(({ filePath }) => filePath)),
    layoutPaths: new Set(layoutRoutes.map(({ filePath }) => filePath)),
    filePathToRoute: new Map([
      ...appRoutes.map(
        ({ route, filePath }) =>
          [filePath, resolveInterceptingRoute(route)] as [string, string]
      ),
      ...layoutRoutes.map(
        ({ route, filePath }) =>
          [filePath, resolveInterceptingRoute(route)] as [string, string]
      ),
      ...appRouteHandlers.map(
        ({ route, filePath }) =>
          [filePath, resolveInterceptingRoute(route)] as [string, string]
      ),
      ...pageRoutes.map(
        ({ route, filePath }) => [filePath, route] as [string, string]
      ),
      ...pageApiRoutes.map(
        ({ route, filePath }) => [filePath, route] as [string, string]
      ),
    ]),
  }

  // Process page routes
  for (const { route, filePath } of pageRoutes) {
    manifest.pageRoutes[route] = {
      path: path.relative(dir, filePath),
      groups: extractRouteParams(route),
    }
  }

  // Process layout routes
  for (const { route, filePath } of layoutRoutes) {
    if (!isCanonicalRoute(route)) continue

    manifest.layoutRoutes[route] = {
      path: path.relative(dir, filePath),
      groups: extractRouteParams(route),
      slots: [],
    }
  }

  // Process slots
  for (const slot of slots) {
    if (manifest.layoutRoutes[slot.parent]) {
      manifest.layoutRoutes[slot.parent].slots.push(slot.name)
    }
  }

  // Process app routes
  for (const { route, filePath } of appRoutes) {
    if (!isCanonicalRoute(route)) continue

    manifest.appRoutes[route] = {
      path: path.relative(dir, filePath),
      groups: extractRouteParams(route),
    }
  }

  // Process app route handlers
  for (const { route, filePath } of appRouteHandlers) {
    if (!isCanonicalRoute(route)) continue

    manifest.appRouteHandlerRoutes[route] = {
      path: path.relative(dir, filePath),
      groups: extractRouteParams(route),
    }
  }

  // Process redirects
  if (typeof redirects === 'function') {
    const rd = await redirects()

    for (const item of rd) {
      const source = convertCustomRouteSource(item.source)

      manifest.redirectRoutes[source] = {
        path: source,
        groups: extractRouteParams(source),
      }
    }
  }

  // Process rewrites
  if (typeof rewrites === 'function') {
    const rw = await rewrites()

    const allSources = Array.isArray(rw)
      ? rw
      : [
          ...(rw?.beforeFiles || []),
          ...(rw?.afterFiles || []),
          ...(rw?.fallback || []),
        ]

    for (const item of allSources) {
      const source = convertCustomRouteSource(item.source)
      manifest.rewriteRoutes[source] = {
        path: source,
        groups: extractRouteParams(source),
      }
    }
  }

  return manifest
}

export async function writeRouteTypesManifest(
  manifest: RouteTypesManifest,
  filePath: string
) {
  const dirname = path.dirname(filePath)

  if (!fs.existsSync(dirname)) {
    await mkdir(dirname, { recursive: true })
  }

  await fs.promises.writeFile(filePath, generateRouteTypesFile(manifest))
}

export async function writeValidatorFile(
  manifest: RouteTypesManifest,
  filePath: string
) {
  const dirname = path.dirname(filePath)

  if (!fs.existsSync(dirname)) {
    await mkdir(dirname, { recursive: true })
  }

  await fs.promises.writeFile(filePath, generateValidatorFile(manifest))
}

export async function writeServerTypesFile(
  manifest: RouteTypesManifest,
  filePath: string
) {
  const dirname = path.dirname(filePath)

  if (!fs.existsSync(dirname)) {
    await mkdir(dirname, { recursive: true })
  }

  // Extract root params from collected layout params
  if (manifest.collectedRootParams) {
    // Since we now collect only the actual root layout, we can directly use its params
    const allRootParams: { param: string; optional: boolean }[] = []

    for (const [, params] of Object.entries(manifest.collectedRootParams)) {
      for (const param of params) {
        // All root layout params are required (not optional)
        // since they define the top-level structure of the app
        allRootParams.push({ param, optional: false })
      }
    }

    if (allRootParams.length > 0) {
      await fs.promises.writeFile(
        filePath,
        generateServerTypesFile(allRootParams)
      )
    }
  }
}

export async function writeCacheLifeTypesFile(
  manifest: RouteTypesManifest,
  filePath: string
) {
  const dirname = path.dirname(filePath)

  if (!fs.existsSync(dirname)) {
    await mkdir(dirname, { recursive: true })
  }

  if (manifest.cacheLifeConfig) {
    await fs.promises.writeFile(
      filePath,
      generateCacheLifeTypesFile(manifest.cacheLifeConfig)
    )
  }
}

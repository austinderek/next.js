import type { RouteTypesManifest } from './route-types-utils'
import { isDynamicRoute } from '../../../shared/lib/router/utils/is-dynamic'
import type { CacheLife } from '../../../server/use-cache/cache-life'

function generateRouteTypes(routesManifest: RouteTypesManifest): string {
  const appRoutes = Object.keys(routesManifest.appRoutes).sort()
  const pageRoutes = Object.keys(routesManifest.pageRoutes).sort()
  const layoutRoutes = Object.keys(routesManifest.layoutRoutes).sort()
  const redirectRoutes = Object.keys(routesManifest.redirectRoutes).sort()
  const rewriteRoutes = Object.keys(routesManifest.rewriteRoutes).sort()

  let result = ''

  // Generate AppRoutes union type (pages only)
  if (appRoutes.length > 0) {
    result += `type AppRoutes = ${appRoutes.map((route) => JSON.stringify(route)).join(' | ')}\n`
  } else {
    result += 'type AppRoutes = never\n'
  }

  // Generate AppRouteHandlerRoutes union type for route handlers
  const appRouteHandlerRoutes = Object.keys(
    routesManifest.appRouteHandlerRoutes
  ).sort()

  if (appRouteHandlerRoutes.length > 0) {
    result += `type AppRouteHandlerRoutes = ${appRouteHandlerRoutes.map((route) => JSON.stringify(route)).join(' | ')}\n`
  } else {
    result += 'type AppRouteHandlerRoutes = never\n'
  }

  // Generate PageRoutes union type
  if (pageRoutes.length > 0) {
    result += `type PageRoutes = ${pageRoutes.map((route) => JSON.stringify(route)).join(' | ')}\n`
  } else {
    result += 'type PageRoutes = never\n'
  }

  // Generate LayoutRoutes union type
  if (layoutRoutes.length > 0) {
    result += `type LayoutRoutes = ${layoutRoutes.map((route) => JSON.stringify(route)).join(' | ')}\n`
  } else {
    result += 'type LayoutRoutes = never\n'
  }

  // Generate RedirectRoutes union type
  if (redirectRoutes.length > 0) {
    result += `type RedirectRoutes = ${redirectRoutes
      .map((route) => JSON.stringify(route))
      .join(' | ')}\n`
  } else {
    result += 'type RedirectRoutes = never\n'
  }

  // Generate RewriteRoutes union type
  if (rewriteRoutes.length > 0) {
    result += `type RewriteRoutes = ${rewriteRoutes
      .map((route) => JSON.stringify(route))
      .join(' | ')}\n`
  } else {
    result += 'type RewriteRoutes = never\n'
  }

  result +=
    'type Routes = AppRoutes | AppRouteHandlerRoutes | PageRoutes | LayoutRoutes | RedirectRoutes | RewriteRoutes\n'

  return result
}

function generateParamTypes(routesManifest: RouteTypesManifest): string {
  const allRoutes = {
    ...routesManifest.appRoutes,
    ...routesManifest.appRouteHandlerRoutes,
    ...routesManifest.pageRoutes,
    ...routesManifest.layoutRoutes,
    ...routesManifest.redirectRoutes,
    ...routesManifest.rewriteRoutes,
  }

  let paramTypes = 'interface ParamMap {\n'

  // Sort routes deterministically for consistent output
  const sortedRoutes = Object.entries(allRoutes).sort(([a], [b]) =>
    a.localeCompare(b)
  )

  for (const [route, routeInfo] of sortedRoutes) {
    const { groups } = routeInfo

    // For static routes (no dynamic segments), we can produce an empty parameter map.
    if (!isDynamicRoute(route) || Object.keys(groups ?? {}).length === 0) {
      paramTypes += `  ${JSON.stringify(route)}: {}\n`
      continue
    }

    let paramType = '{'

    // Process each group based on its properties
    for (const [key, group] of Object.entries(groups)) {
      const escapedKey = JSON.stringify(key)
      if (group.repeat) {
        // Catch-all parameters
        if (group.optional) {
          paramType += ` ${escapedKey}?: string[];`
        } else {
          paramType += ` ${escapedKey}: string[];`
        }
      } else {
        // Regular parameters
        if (group.optional) {
          paramType += ` ${escapedKey}?: string;`
        } else {
          paramType += ` ${escapedKey}: string;`
        }
      }
    }

    paramType += ' }'

    paramTypes += `  ${JSON.stringify(route)}: ${paramType}\n`
  }

  paramTypes += '}\n'
  return paramTypes
}

function generateLayoutSlotMap(routesManifest: RouteTypesManifest): string {
  let slotMap = 'interface LayoutSlotMap {\n'

  // Sort routes deterministically for consistent output
  const sortedLayoutRoutes = Object.entries(routesManifest.layoutRoutes).sort(
    ([a], [b]) => a.localeCompare(b)
  )

  for (const [route, routeInfo] of sortedLayoutRoutes) {
    if ('slots' in routeInfo) {
      const slots = routeInfo.slots.sort()
      if (slots.length > 0) {
        slotMap += `  ${JSON.stringify(route)}: ${slots.map((slot) => JSON.stringify(slot)).join(' | ')}\n`
      } else {
        slotMap += `  ${JSON.stringify(route)}: never\n`
      }
    } else {
      slotMap += `  ${JSON.stringify(route)}: never\n`
    }
  }

  slotMap += '}\n'
  return slotMap
}

// Helper function to format routes to route types (matches the plugin logic exactly)
function formatRouteToRouteType(route: string) {
  const isDynamic = isDynamicRoute(route)
  if (isDynamic) {
    route = route
      .split('/')
      .map((part) => {
        if (part.startsWith('[') && part.endsWith(']')) {
          if (part.startsWith('[...')) {
            // /[...slug]
            return `\${CatchAllSlug<T>}`
          } else if (part.startsWith('[[...') && part.endsWith(']]')) {
            // /[[...slug]]
            return `\${OptionalCatchAllSlug<T>}`
          }
          // /[slug]
          return `\${SafeSlug<T>}`
        }
        return part
      })
      .join('/')
  }

  return {
    isDynamic,
    routeType: route,
  }
}

// Helper function to serialize route types (matches the plugin logic exactly)
function serializeRouteTypes(routeTypes: string[]) {
  // route collection is not deterministic, this makes the output of the file deterministic
  return routeTypes
    .sort()
    .map((route) => `\n    | \`${route}\``)
    .join('')
}

export function generateLinkTypesFile(
  routesManifest: RouteTypesManifest
): string {
  // Generate serialized static and dynamic routes for the internal namespace
  const allRoutes = {
    ...routesManifest.appRoutes,
    ...routesManifest.pageRoutes,
    ...routesManifest.redirectRoutes,
    ...routesManifest.rewriteRoutes,
  }

  const staticRouteTypes: string[] = []
  const dynamicRouteTypes: string[] = []

  // Process each route using the same logic as the plugin
  for (const route of Object.keys(allRoutes)) {
    const { isDynamic, routeType } = formatRouteToRouteType(route)
    if (isDynamic) {
      dynamicRouteTypes.push(routeType)
    } else {
      staticRouteTypes.push(routeType)
    }
  }

  const serializedStaticRouteTypes = serializeRouteTypes(staticRouteTypes)
  const serializedDynamicRouteTypes = serializeRouteTypes(dynamicRouteTypes)

  // If both StaticRoutes and DynamicRoutes are empty, fallback to type 'string & {}'.
  const routeTypesFallback =
    !serializedStaticRouteTypes && !serializedDynamicRouteTypes
      ? 'string & {}'
      : ''

  return `// This file is generated automatically by Next.js
// Do not edit this file manually

// Type definitions for Next.js routes

/**
 * Internal types used by the Next.js router and Link component.
 * These types are not meant to be used directly.
 * @internal
 */
declare namespace __next_route_internal_types__ {
  type SearchOrHash = \`?\${string}\` | \`#\${string}\`
  type WithProtocol = \`\${string}:\${string}\`

  type Suffix = '' | SearchOrHash

  type SafeSlug<S extends string> = S extends \`\${string}/\${string}\`
    ? never
    : S extends \`\${string}\${SearchOrHash}\`
    ? never
    : S extends ''
    ? never
    : S

  type CatchAllSlug<S extends string> = S extends \`\${string}\${SearchOrHash}\`
    ? never
    : S extends ''
    ? never
    : S

  type OptionalCatchAllSlug<S extends string> =
    S extends \`\${string}\${SearchOrHash}\` ? never : S

  type StaticRoutes = ${serializedStaticRouteTypes || 'never'}
  type DynamicRoutes<T extends string = string> = ${
    serializedDynamicRouteTypes || 'never'
  }

  type RouteImpl<T> = ${
    routeTypesFallback ||
    `
    ${
      // This keeps autocompletion working for static routes.
      '| StaticRoutes'
    }
    | SearchOrHash
    | WithProtocol
    | \`\${StaticRoutes}\${SearchOrHash}\`
    | (T extends \`\${DynamicRoutes<infer _>}\${Suffix}\` ? T : never)
    `
  }
}

declare module 'next' {
  export { default } from 'next/types.js'
  export * from 'next/types.js'

  export type Route<T extends string = string> =
    __next_route_internal_types__.RouteImpl<T>
}

declare module 'next/link' {
  import type { LinkProps as OriginalLinkProps } from 'next/dist/client/link.js'
  import type { AnchorHTMLAttributes, DetailedHTMLProps } from 'react'
  import type { UrlObject } from 'url'

  type LinkRestProps = Omit<
    Omit<
      DetailedHTMLProps<
        AnchorHTMLAttributes<HTMLAnchorElement>,
        HTMLAnchorElement
      >,
      keyof OriginalLinkProps
    > &
      OriginalLinkProps,
    'href'
  >

  export type LinkProps<RouteInferType> = LinkRestProps & {
    /**
     * The path or URL to navigate to. This is the only required prop. It can also be an object.
     * @see https://nextjs.org/docs/api-reference/next/link
     */
    href: __next_route_internal_types__.RouteImpl<RouteInferType> | UrlObject
  }

  export default function Link<RouteType>(props: LinkProps<RouteType>): JSX.Element
}

declare module 'next/navigation' {
  export * from 'next/dist/client/components/navigation.js'

  import type { NavigateOptions, AppRouterInstance as OriginalAppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime.js'
  interface AppRouterInstance extends OriginalAppRouterInstance {
    /**
     * Navigate to the provided href.
     * Pushes a new history entry.
     */
    push<RouteType>(href: __next_route_internal_types__.RouteImpl<RouteType>, options?: NavigateOptions): void
    /**
     * Navigate to the provided href.
     * Replaces the current history entry.
     */
    replace<RouteType>(href: __next_route_internal_types__.RouteImpl<RouteType>, options?: NavigateOptions): void
    /**
     * Prefetch the provided href.
     */
    prefetch<RouteType>(href: __next_route_internal_types__.RouteImpl<RouteType>): void
  }

  export function useRouter(): AppRouterInstance;
}

declare module 'next/form' {
  import type { FormProps as OriginalFormProps } from 'next/dist/client/form.js'

  type FormRestProps = Omit<OriginalFormProps, 'action'>

  export type FormProps<RouteInferType> = {
    /**
     * \`action\` can be either a \`string\` or a function.
     * - If \`action\` is a string, it will be interpreted as a path or URL to navigate to when the form is submitted.
     *   The path will be prefetched when the form becomes visible.
     * - If \`action\` is a function, it will be called when the form is submitted. See the [React docs](https://react.dev/reference/react-dom/components/form#props) for more.
     */
    action: __next_route_internal_types__.RouteImpl<RouteInferType> | ((formData: FormData) => void)
  } & FormRestProps

  export default function Form<RouteType>(props: FormProps<RouteType>): JSX.Element
}
`
}
function formatTimespan(seconds: number): string {
  if (seconds > 0) {
    if (seconds === 18748800) {
      return '1 month'
    }
    if (seconds === 18144000) {
      return '1 month'
    }
    if (seconds === 604800) {
      return '1 week'
    }
    if (seconds === 86400) {
      return '1 day'
    }
    if (seconds === 3600) {
      return '1 hour'
    }
    if (seconds === 60) {
      return '1 minute'
    }
    if (seconds % 18748800 === 0) {
      return seconds / 18748800 + ' months'
    }
    if (seconds % 18144000 === 0) {
      return seconds / 18144000 + ' months'
    }
    if (seconds % 604800 === 0) {
      return seconds / 604800 + ' weeks'
    }
    if (seconds % 86400 === 0) {
      return seconds / 86400 + ' days'
    }
    if (seconds % 3600 === 0) {
      return seconds / 3600 + ' hours'
    }
    if (seconds % 60 === 0) {
      return seconds / 60 + ' minutes'
    }
  }
  return seconds + ' seconds'
}

function formatTimespanWithSeconds(seconds: undefined | number): string {
  if (seconds === undefined) {
    return 'default'
  }
  if (seconds >= 0xfffffffe) {
    return 'never'
  }
  const text = seconds + ' seconds'
  const descriptive = formatTimespan(seconds)
  if (descriptive === text) {
    return text
  }
  return text + ' (' + descriptive + ')'
}

export function generateServerTypesFile(
  rootParams: { param: string; optional: boolean }[]
): string {
  return `// Type definitions for Next.js server types

declare module 'next/server' {

  import type { AsyncLocalStorage as NodeAsyncLocalStorage } from 'async_hooks'
  declare global {
    var AsyncLocalStorage: typeof NodeAsyncLocalStorage
  }
  export { NextFetchEvent } from 'next/dist/server/web/spec-extension/fetch-event'
  export { NextRequest } from 'next/dist/server/web/spec-extension/request'
  export { NextResponse } from 'next/dist/server/web/spec-extension/response'
  export { NextMiddleware, MiddlewareConfig } from 'next/dist/server/web/types'
  export { userAgentFromString } from 'next/dist/server/web/spec-extension/user-agent'
  export { userAgent } from 'next/dist/server/web/spec-extension/user-agent'
  export { URLPattern } from 'next/dist/compiled/@edge-runtime/primitives/url'
  export { ImageResponse } from 'next/dist/server/web/spec-extension/image-response'
  export type { ImageResponseOptions } from 'next/dist/compiled/@vercel/og/types'
  export { after } from 'next/dist/server/after'
  export { connection } from 'next/dist/server/request/connection'
  export type { UnsafeUnwrappedSearchParams } from 'next/dist/server/request/search-params'
  export type { UnsafeUnwrappedParams } from 'next/dist/server/request/params'
  export function unstable_rootParams(): Promise<{ ${rootParams
    .map(
      ({ param, optional }) =>
        // ensure params with dashes are valid keys
        `${param.includes('-') ? `'${param}'` : param}${optional ? '?' : ''}: string`
    )
    .join(', ')} }>
}
`
}

export function generateCacheLifeTypesFile(cacheLife: {
  [profile: string]: CacheLife
}): string {
  let overloads = ''

  const profileNames = Object.keys(cacheLife)
  for (let i = 0; i < profileNames.length; i++) {
    const profileName = profileNames[i]
    const profile = cacheLife[profileName]
    if (typeof profile !== 'object' || profile === null) {
      continue
    }

    let description = ''

    if (profile.stale === undefined) {
      description += `
     * This cache may be stale on clients for the default stale time of the scope before checking with the server.`
    } else if (profile.stale >= 0xfffffffe) {
      description += `
     * This cache may be stale on clients indefinitely before checking with the server.`
    } else {
      description += `
     * This cache may be stale on clients for ${formatTimespan(profile.stale)} before checking with the server.`
    }
    if (
      profile.revalidate !== undefined &&
      profile.expire !== undefined &&
      profile.revalidate >= profile.expire
    ) {
      description += `
     * This cache will expire after ${formatTimespan(profile.expire)}. The next request will recompute it.`
    } else {
      if (profile.revalidate === undefined) {
        description += `
     * It will inherit the default revalidate time of its scope since it does not define its own.`
      } else if (profile.revalidate >= 0xfffffffe) {
        // Nothing to mention.
      } else {
        description += `
     * If the server receives a new request after ${formatTimespan(profile.revalidate)}, start revalidating new values in the background.`
      }
      if (profile.expire === undefined) {
        description += `
     * It will inherit the default expiration time of its scope since it does not define its own.`
      } else if (profile.expire >= 0xfffffffe) {
        description += `
     * It lives for the maximum age of the server cache. If this entry has no traffic for a while, it may serve an old value the next request.`
      } else {
        description += `
     * If this entry has no traffic for ${formatTimespan(profile.expire)} it will expire. The next request will recompute it.`
      }
    }

    overloads += `
    /**
     * Cache this \`"use cache"\` for a timespan defined by the \`${JSON.stringify(profileName)}\` profile.
     * \`\`\`
     *   stale:      ${formatTimespanWithSeconds(profile.stale)}
     *   revalidate: ${formatTimespanWithSeconds(profile.revalidate)}
     *   expire:     ${formatTimespanWithSeconds(profile.expire)}
     * \`\`\`
     * ${description}
     */
    export function unstable_cacheLife(profile: ${JSON.stringify(profileName)}): void
    `
  }

  overloads += `
    /**
     * Cache this \`"use cache"\` using a custom timespan.
     * \`\`\`
     *   stale: ... // seconds
     *   revalidate: ... // seconds
     *   expire: ... // seconds
     * \`\`\`
     *
     * This is similar to Cache-Control: max-age=\`stale\`,s-max-age=\`revalidate\`,stale-while-revalidate=\`expire-revalidate\`
     *
     * If a value is left out, the lowest of other cacheLife() calls or the default, is used instead.
     */
    export function unstable_cacheLife(profile: {
      /**
       * This cache may be stale on clients for ... seconds before checking with the server.
       */
      stale?: number,
      /**
       * If the server receives a new request after ... seconds, start revalidating new values in the background.
       */
      revalidate?: number,
      /**
       * If this entry has no traffic for ... seconds it will expire. The next request will recompute it.
       */
      expire?: number
    }): void
  `

  // Redefine the cacheLife() accepted arguments.
  return `// Type definitions for Next.js cacheLife configs

declare module 'next/cache' {
  export { unstable_cache } from 'next/dist/server/web/spec-extension/unstable-cache'
  export {
    revalidateTag,
    revalidatePath,
    unstable_expireTag,
    unstable_expirePath,
  } from 'next/dist/server/web/spec-extension/revalidate'
  export { unstable_noStore } from 'next/dist/server/web/spec-extension/unstable-no-store'

  ${overloads}

  export { cacheTag as unstable_cacheTag } from 'next/dist/server/use-cache/cache-tag'
}
`
}

export function generateValidatorFile(
  routesManifest: RouteTypesManifest
): string {
  const generateValidations = (
    paths: string[],
    type:
      | 'AppPageConfig'
      | 'PagesPageConfig'
      | 'LayoutConfig'
      | 'RouteHandlerConfig'
      | 'ApiRouteConfig',
    pathToRouteMap?: Map<string, string>
  ) =>
    paths
      .sort()
      .map((filePath) => {
        const importPath = filePath.replace(/\.(tsx?|jsx?)$/, '')
        const route = pathToRouteMap?.get(filePath)
        const typeWithRoute =
          route &&
          (type === 'AppPageConfig' ||
            type === 'LayoutConfig' ||
            type === 'RouteHandlerConfig')
            ? `${type}<${JSON.stringify(route)}>`
            : type
        return `// Validate ${filePath}
{
  const handler = {} as typeof import(${JSON.stringify(importPath)})
  handler satisfies ${typeWithRoute}
}`
      })
      .join('\n\n')

  // Use direct mappings from the manifest

  // Generate validations for different route types
  const appPageValidations = generateValidations(
    Array.from(routesManifest.appPagePaths).sort(),
    'AppPageConfig',
    routesManifest.filePathToRoute
  )
  const appRouteHandlerValidations = generateValidations(
    Array.from(routesManifest.appRouteHandlers).sort(),
    'RouteHandlerConfig',
    routesManifest.filePathToRoute
  )
  const pagesRouterPageValidations = generateValidations(
    Array.from(routesManifest.pagesRouterPagePaths).sort(),
    'PagesPageConfig'
  )
  const pagesApiRouteValidations = generateValidations(
    Array.from(routesManifest.pageApiRoutes).sort(),
    'ApiRouteConfig'
  )
  const layoutValidations = generateValidations(
    Array.from(routesManifest.layoutPaths).sort(),
    'LayoutConfig',
    routesManifest.filePathToRoute
  )

  return `// This file is generated automatically by Next.js
// Do not edit this file manually
// This file validates that all pages and layouts export the correct types

import type { AppRoutes, AppRouteHandlerRoutes, LayoutRoutes, ParamMap } from "./routes"
import type { ResolvingMetadata, ResolvingViewport } from "next/dist/lib/metadata/types/metadata-interface.js"

type AppPageConfig<Route extends AppRoutes = AppRoutes> = {
  default: React.ComponentType<PageProps<Route>>
  generateStaticParams?: () => Promise<any[]> | any[]
  generateMetadata?: (
    props: PageProps<Route>,
    parent: ResolvingMetadata
  ) => Promise<any> | any
  generateViewport?: (
    props: PageProps<Route>,
    parent: ResolvingViewport
  ) => Promise<any> | any
  metadata?: any
  viewport?: any
}

type PagesPageConfig = {
  default: React.ComponentType<any>
  getStaticProps?: (context: any) => Promise<any> | any
  getStaticPaths?: (context: any) => Promise<any> | any
  getServerSideProps?: (context: any) => Promise<any> | any
  getInitialProps?: (context: any) => Promise<any> | any
  /**
   * Segment configuration for legacy Pages Router pages.
   * Validated at build-time by parsePagesSegmentConfig.
   */
  config?: {
    amp?: boolean | 'hybrid'
    maxDuration?: number
    runtime?: 'edge' | 'experimental-edge' | 'nodejs'
    regions?: string[]
  }
}

type LayoutConfig<Route extends LayoutRoutes = LayoutRoutes> = {
  default: React.ComponentType<LayoutProps<Route>>
  generateStaticParams?: () => Promise<any[]> | any[]
  generateMetadata?: (
    props: LayoutProps<Route>,
    parent: ResolvingMetadata
  ) => Promise<any> | any
  generateViewport?: (
    props: LayoutProps<Route>,
    parent: ResolvingViewport
  ) => Promise<any> | any
  metadata?: any
  viewport?: any
}

type RouteHandlerConfig<Route extends AppRouteHandlerRoutes = AppRouteHandlerRoutes> = {
  GET?: (request: Request, context: { params: Promise<ParamMap[Route]> }) => Promise<Response> | Response
  POST?: (request: Request, context: { params: Promise<ParamMap[Route]> }) => Promise<Response> | Response
  PUT?: (request: Request, context: { params: Promise<ParamMap[Route]> }) => Promise<Response> | Response
  PATCH?: (request: Request, context: { params: Promise<ParamMap[Route]> }) => Promise<Response> | Response
  DELETE?: (request: Request, context: { params: Promise<ParamMap[Route]> }) => Promise<Response> | Response
  HEAD?: (request: Request, context: { params: Promise<ParamMap[Route]> }) => Promise<Response> | Response
  OPTIONS?: (request: Request, context: { params: Promise<ParamMap[Route]> }) => Promise<Response> | Response
}

type ApiRouteConfig = {
  default: (req: any, res: any) => Promise<void> | void
  config?: {
    api?: {
      bodyParser?: boolean | { sizeLimit?: string }
      responseLimit?: string | number
      externalResolver?: boolean
    }
  }
}

${appPageValidations}

${appRouteHandlerValidations}

${pagesRouterPageValidations}

${pagesApiRouteValidations}

${layoutValidations}
`
}

export function generateRouteTypesFile(
  routesManifest: RouteTypesManifest
): string {
  const routeTypes = generateRouteTypes(routesManifest)
  const paramTypes = generateParamTypes(routesManifest)
  const layoutSlotMap = generateLayoutSlotMap(routesManifest)

  return `// This file is generated automatically by Next.js
// Do not edit this file manually

${routeTypes}

${paramTypes}

export type ParamsOf<Route extends Routes> = ParamMap[Route]

${layoutSlotMap}

export type { AppRoutes, AppRouteHandlerRoutes, PageRoutes, LayoutRoutes, RedirectRoutes, RewriteRoutes, ParamMap }

declare global {
  /**
   * Props for Next.js App Router page components
   * @example
   * \`\`\`tsx
   * export default function Page(props: PageProps<'/blog/[slug]'>) {
   *   const { slug } = await props.params
   *   return <div>Blog post: {slug}</div>
   * }
   * \`\`\`
   */
  interface PageProps<AppRoute extends AppRoutes> {
    params: Promise<ParamMap[AppRoute]>
    searchParams: Promise<Record<string, string | string[] | undefined>>
  }
  
  /**
   * Props for Next.js App Router layout components
   * @example
   * \`\`\`tsx
   * export default function Layout(props: LayoutProps<'/dashboard'>) {
   *   return <div>{props.children}</div>
   * }
   * \`\`\`
   */
  type LayoutProps<LayoutRoute extends LayoutRoutes> = {
    params: Promise<ParamMap[LayoutRoute]>
    children: React.ReactNode
  } & {
    [K in LayoutSlotMap[LayoutRoute]]: React.ReactNode
  }
}
`
}

import type { RouteTypesManifest } from './route-types-utils'
import { isDynamicRoute } from '../../../shared/lib/router/utils/is-dynamic'

function generateRouteTypes(routesManifest: RouteTypesManifest): string {
  const appRoutes = Object.keys(routesManifest.appRoutes).sort()
  const pageRoutes = Object.keys(routesManifest.pageRoutes).sort()
  const layoutRoutes = Object.keys(routesManifest.layoutRoutes).sort()
  const redirectRoutes = Object.keys(routesManifest.redirectRoutes).sort()
  const rewriteRoutes = Object.keys(routesManifest.rewriteRoutes).sort()

  let result = ''

  // Generate AppRoutes union type
  if (appRoutes.length > 0) {
    result += `type AppRoutes = ${appRoutes.map((route) => JSON.stringify(route)).join(' | ')}\n`
  } else {
    result += 'type AppRoutes = never\n'
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
    'type Routes = AppRoutes | PageRoutes | LayoutRoutes | RedirectRoutes | RewriteRoutes\n'

  return result
}

function generateParamTypes(routesManifest: RouteTypesManifest): string {
  const allRoutes = {
    ...routesManifest.appRoutes,
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
      | 'ApiRouteConfig'
  ) =>
    paths
      .sort()
      .map((filePath) => {
        const importPath = filePath.replace(/\.(tsx?|jsx?)$/, '')
        return `// Validate ${filePath}
{
  const handler = {} as typeof import(${JSON.stringify(importPath)})
  handler satisfies ${type}
}`
      })
      .join('\n\n')

  // Generate validations for different route types
  const appPageValidations = generateValidations(
    Array.from(routesManifest.appPagePaths).sort(),
    'AppPageConfig'
  )
  const appRouteHandlerValidations = generateValidations(
    Array.from(routesManifest.appRouteHandlers).sort(),
    'RouteHandlerConfig'
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
    'LayoutConfig'
  )

  return `// This file is generated automatically by Next.js
// Do not edit this file manually
// This file validates that all pages and layouts export the correct types

type AppPageConfig = {
  default: React.ComponentType<any>
  generateStaticParams?: () => Promise<any[]> | any[]
  generateMetadata?: (props: any, parent: any) => Promise<any> | any
  generateViewport?: (props: any, parent: any) => Promise<any> | any
  metadata?: any
  viewport?: any
}

type PagesPageConfig = {
  default: React.ComponentType<any>
  getStaticProps?: (context: any) => Promise<any> | any
  getStaticPaths?: (context: any) => Promise<any> | any
  getServerSideProps?: (context: any) => Promise<any> | any
}

type LayoutConfig = {
  default: React.ComponentType<{ children: React.ReactNode }>
  generateStaticParams?: () => Promise<any[]> | any[]
  generateMetadata?: (props: any, parent: any) => Promise<any> | any
  generateViewport?: (props: any, parent: any) => Promise<any> | any
  metadata?: any
  viewport?: any
}

type RouteHandlerConfig = {
  GET?: (request: Request, context: { params: Promise<any> }) => Promise<Response> | Response
  POST?: (request: Request, context: { params: Promise<any> }) => Promise<Response> | Response
  PUT?: (request: Request, context: { params: Promise<any> }) => Promise<Response> | Response
  PATCH?: (request: Request, context: { params: Promise<any> }) => Promise<Response> | Response
  DELETE?: (request: Request, context: { params: Promise<any> }) => Promise<Response> | Response
  HEAD?: (request: Request, context: { params: Promise<any> }) => Promise<Response> | Response
  OPTIONS?: (request: Request, context: { params: Promise<any> }) => Promise<Response> | Response
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

export type { AppRoutes, PageRoutes, LayoutRoutes, RedirectRoutes, RewriteRoutes }

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

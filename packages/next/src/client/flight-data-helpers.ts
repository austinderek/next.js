import type { DynamicParam } from '../server/app-render/app-render'
import type {
  CacheNodeSeedData,
  DynamicParamTypesShort,
  FlightData,
  FlightDataPath,
  FlightRouterState,
  FlightSegmentPath,
  Segment,
} from '../server/app-render/types'
import type { Params } from '../server/request/params'
import type { HeadData } from '../shared/lib/app-router-context.shared-runtime'
import { getDynamicParam } from '../shared/lib/router/utils/get-dynamic-param'
import { getRouteMatcher } from '../shared/lib/router/utils/route-matcher'
import type {
  RouteRegex,
  RouteRegexFlightSafe,
} from '../shared/lib/router/utils/route-regex'
import { PAGE_SEGMENT_KEY } from '../shared/lib/segment'
import {
  NEXT_REWRITTEN_PATH_HEADER,
  NEXT_REWRITTEN_QUERY_HEADER,
} from './components/app-router-headers'
import type { RSCResponse } from './components/router-reducer/fetch-server-response'
import type { NormalizedSearch } from './components/segment-cache'

export type NormalizedFlightData = {
  /**
   * The full `FlightSegmentPath` inclusive of the final `Segment`
   */
  segmentPath: FlightSegmentPath
  /**
   * The `FlightSegmentPath` exclusive of the final `Segment`
   */
  pathToSegment: FlightSegmentPath
  segment: Segment
  tree: FlightRouterState
  dynamicParams: Map<string, DynamicParam> | null
  seedData: CacheNodeSeedData | null
  head: HeadData
  isHeadPartial: boolean
  isRootRender: boolean
}

// TODO: We should only have to export `normalizeFlightData`, however because the initial flight data
// that gets passed to `createInitialRouterState` doesn't conform to the `FlightDataPath` type (it's missing the root segment)
// we're currently exporting it so we can use it directly. This should be fixed as part of the unification of
// the different ways we express `FlightSegmentPath`.
export function getFlightDataPartsFromPath(
  flightDataPath: FlightDataPath,
  params: Params,
  pagePath: string
): NormalizedFlightData {
  // Pick the last 4 items from the `FlightDataPath` to get the [tree, seedData, viewport, isHeadPartial].
  const flightDataPathLength = 4
  // tree, seedData, and head are *always* the last three items in the `FlightDataPath`.
  const [tree, seedData, head, isHeadPartial] =
    flightDataPath.slice(-flightDataPathLength)
  // The `FlightSegmentPath` is everything except the last three items. For a root render, it won't be present.
  const segmentPath = flightDataPath.slice(0, -flightDataPathLength)

  return {
    // TODO: Unify these two segment path helpers. We are inconsistently pushing an empty segment ("")
    // to the start of the segment path in some places which makes it hard to use solely the segment path.
    // Look for "// TODO-APP: remove ''" in the codebase.
    pathToSegment: segmentPath.slice(0, -1),
    segmentPath,
    // if the `FlightDataPath` corresponds with the root, there'll be no segment path,
    // in which case we default to ''.
    segment: segmentPath[segmentPath.length - 1] ?? '',
    tree,
    dynamicParams: getDynamicParamsFromTree(params, tree, pagePath),
    seedData,
    head,
    isHeadPartial,
    isRootRender: flightDataPath.length === flightDataPathLength,
  }
}

export function getNextFlightSegmentPath(
  flightSegmentPath: FlightSegmentPath
): FlightSegmentPath {
  // Since `FlightSegmentPath` is a repeated tuple of `Segment` and `ParallelRouteKey`, we slice off two items
  // to get the next segment path.
  return flightSegmentPath.slice(2)
}

export function normalizeFlightData(
  flightData: FlightData,
  renderedParams: Params,
  pagePath: string
): NormalizedFlightData[] | string {
  // FlightData can be a string when the server didn't respond with a proper flight response,
  // or when a redirect happens, to signal to the client that it needs to perform an MPA navigation.
  if (typeof flightData === 'string') {
    return flightData
  }

  return flightData.map((flightDataPath) =>
    getFlightDataPartsFromPath(flightDataPath, renderedParams, pagePath)
  )
}

/**
 * This function is used to prepare the flight router state for the request.
 * It removes markers that are not needed by the server, and are purely used
 * for stashing state on the client.
 * @param flightRouterState - The flight router state to prepare.
 * @param isHmrRefresh - Whether this is an HMR refresh request.
 * @returns The prepared flight router state.
 */
export function prepareFlightRouterStateForRequest(
  flightRouterState: FlightRouterState,
  isHmrRefresh?: boolean
): string {
  // HMR requests need the complete, unmodified state for proper functionality
  if (isHmrRefresh) {
    return encodeURIComponent(JSON.stringify(flightRouterState))
  }

  return encodeURIComponent(
    JSON.stringify(stripClientOnlyDataFromFlightRouterState(flightRouterState))
  )
}

/**
 * Recursively strips client-only data from FlightRouterState while preserving
 * server-needed information for proper rendering decisions.
 */
function stripClientOnlyDataFromFlightRouterState(
  flightRouterState: FlightRouterState
): FlightRouterState {
  const [
    segment,
    parallelRoutes,
    _url, // Intentionally unused - URLs are client-only
    refreshMarker,
    isRootLayout,
    hasLoadingBoundary,
  ] = flightRouterState

  // __PAGE__ segments are always fetched from the server, so there's
  // no need to send them up
  const cleanedSegment = stripSearchParamsFromPageSegment(segment)

  // Recursively process parallel routes
  const cleanedParallelRoutes: { [key: string]: FlightRouterState } = {}
  for (const [key, childState] of Object.entries(parallelRoutes)) {
    cleanedParallelRoutes[key] =
      stripClientOnlyDataFromFlightRouterState(childState)
  }

  const result: FlightRouterState = [
    cleanedSegment,
    cleanedParallelRoutes,
    null, // URLs omitted - server reconstructs paths from segments
    shouldPreserveRefreshMarker(refreshMarker) ? refreshMarker : null,
  ]

  // Append optional fields if present
  if (isRootLayout !== undefined) {
    result[4] = isRootLayout
  }
  if (hasLoadingBoundary !== undefined) {
    result[5] = hasLoadingBoundary
  }

  return result
}

/**
 * Strips search parameters from __PAGE__ segments to prevent sensitive
 * client-side data from being sent to the server.
 */
function stripSearchParamsFromPageSegment(segment: Segment): Segment {
  if (
    typeof segment === 'string' &&
    segment.startsWith(PAGE_SEGMENT_KEY + '?')
  ) {
    return PAGE_SEGMENT_KEY
  }
  return segment
}

/**
 * Determines whether the refresh marker should be sent to the server
 * Client-only markers like 'refresh' are stripped, while server-needed markers
 * like 'refetch' and 'inside-shared-layout' are preserved.
 */
function shouldPreserveRefreshMarker(
  refreshMarker: FlightRouterState[3]
): boolean {
  return Boolean(refreshMarker && refreshMarker !== 'refresh')
}

export function getRenderedSearch(response: RSCResponse): NormalizedSearch {
  // If the server performed a rewrite, the search params used to render the
  // page will be different from the params in the request URL. In this case,
  // the response will include a header that gives the rewritten search query.
  const rewrittenQuery = response.headers.get(NEXT_REWRITTEN_QUERY_HEADER)
  if (rewrittenQuery !== null) {
    return (
      rewrittenQuery === '' ? '' : '?' + rewrittenQuery
    ) as NormalizedSearch
  }
  // If the header is not present, there was no rewrite, so we use the search
  // query of the response URL.
  return new URL(response.url).search as NormalizedSearch
}

export function getRenderedPathname(response: RSCResponse): string {
  // If the server performed a rewrite, the pathname used to render the
  // page will be different from the pathname in the request URL. In this case,
  // the response will include a header that gives the rewritten pathname.
  const rewrittenPath = response.headers.get(NEXT_REWRITTEN_PATH_HEADER)
  return rewrittenPath ?? new URL(response.url).pathname
}

export function getRenderedParams(
  pathname: string,
  flightSafeRouteRegex: RouteRegexFlightSafe
): Params | null {
  // Parse the route params from the pathname, using the regex sent from
  // the server.
  //
  // This returns a "raw" params object, which is later turned into a "full"
  // dynamic params object that can be passed to page components
  // (getDynamicParamsFromTree). The only reason these separate steps is
  // because creating the full dynamic params object requires traversing the
  // router tree. Since we already do that elsewhere, we create the dynamic
  // params during that traversal instead of adding a new traversal here.
  const [source, flags] = flightSafeRouteRegex.reParts
  const routeRegex: RouteRegex = {
    groups: flightSafeRouteRegex.groups,
    re: new RegExp(source, flags),
  }
  const matcher = getRouteMatcher(routeRegex)
  const params = matcher(pathname)
  return params ? params : null
}

function getDynamicParamsFromTree(
  params: Params,
  flightRouterState: FlightRouterState,
  pagePath: string
): Map<string, DynamicParam> | null {
  // Traverse the FlightRouterState to build a map of dynamic params.
  // TODO: Eventually this function will accept a subset of the
  // FlightRouterState, and will be responsible for reconstructing the full
  // FlightRouterState using the dynamic params.
  const result = new Map()
  getDynamicParamsFromTreeImpl(params, flightRouterState, pagePath, result)
  return result.size > 0 ? result : null
}

function getDynamicParamsFromTreeImpl(
  params: Params,
  flightRouterState: FlightRouterState,
  pagePath: string,
  result: Map<string, DynamicParam>
): void {
  const segment = flightRouterState[0]
  if (Array.isArray(segment)) {
    const segmentKey = segment[0]
    if (!result.has(segmentKey)) {
      const dynamicParamType = segment[1] as DynamicParamTypesShort
      const dynamicParam = getDynamicParam(
        params,
        segmentKey,
        dynamicParamType,
        pagePath,
        null
      )
      result.set(segmentKey, dynamicParam)
    }
  }
  const parallelRoutes = flightRouterState[1]
  for (const parallelRouteKey in parallelRoutes) {
    getDynamicParamsFromTreeImpl(
      params,
      parallelRoutes[parallelRouteKey],
      pagePath,
      result
    )
  }
}

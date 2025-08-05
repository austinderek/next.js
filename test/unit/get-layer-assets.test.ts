import { getLayerAssets } from 'next/dist/server/app-render/get-layer-assets'
import type { AppRenderContext } from 'next/dist/server/app-render/app-render'
import type { PreloadCallbacks } from 'next/dist/server/app-render/types'

// Mock the dependencies
jest.mock('next/dist/server/app-render/get-css-inlined-link-tags', () => ({
  getLinkAndScriptTags: jest.fn(() => ({ styles: [], scripts: [] })),
}))

jest.mock('next/dist/server/app-render/get-preloadable-fonts', () => ({
  getPreloadableFonts: jest.fn(),
}))

jest.mock('next/dist/server/app-render/render-css-resource', () => ({
  renderCssResource: jest.fn(() => []),
}))

const {
  getPreloadableFonts,
} = require('next/dist/server/app-render/get-preloadable-fonts')

describe('getLayerAssets', () => {
  let mockCtx: AppRenderContext
  let preloadCallbacks: PreloadCallbacks
  let mockPreloadFont: jest.Mock
  let mockPreconnect: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()

    mockPreloadFont = jest.fn()
    mockPreconnect = jest.fn()

    mockCtx = {
      assetPrefix: '',
      renderOpts: {
        nextFontManifest: {},
        crossOrigin: undefined,
      },
      clientReferenceManifest: {},
      componentMod: {
        preloadFont: mockPreloadFont,
        preconnect: mockPreconnect,
      },
      nonce: undefined,
    } as any

    preloadCallbacks = []
  })

  afterEach(() => {
    delete mockCtx.renderOpts.deploymentId
  })

  describe('font dplId handling', () => {
    it('should add dplId query parameter to font URLs when NEXT_DEPLOYMENT_ID is set', () => {
      mockCtx.renderOpts.deploymentId = 'dpl_123'

      // Mock getPreloadableFonts to return some font files
      getPreloadableFonts.mockReturnValue([
        'static/media/font1.woff2',
        'static/media/font2.woff',
      ])

      getLayerAssets({
        ctx: mockCtx,
        layoutOrPagePath: '/app/page',
        injectedCSS: new Set(),
        injectedJS: new Set(),
        injectedFontPreloadTags: new Set(),
        preloadCallbacks,
      })

      // Execute the preload callbacks
      preloadCallbacks.forEach((callback) => callback())

      expect(mockPreloadFont).toHaveBeenCalledTimes(2)

      // Check first font call
      expect(mockPreloadFont).toHaveBeenNthCalledWith(
        1,
        '/_next/static/media/font1.woff2?dpl=dpl_123',
        'font/woff2',
        undefined,
        undefined
      )

      // Check second font call
      expect(mockPreloadFont).toHaveBeenNthCalledWith(
        2,
        '/_next/static/media/font2.woff?dpl=dpl_123',
        'font/woff',
        undefined,
        undefined
      )
    })

    it('should not add dplId query parameter when NEXT_DEPLOYMENT_ID is not set', () => {
      // Ensure NEXT_DEPLOYMENT_ID is not set
      delete mockCtx.renderOpts.deploymentId

      // Mock getPreloadableFonts to return some font files
      getPreloadableFonts.mockReturnValue([
        'static/media/font1.woff2',
        'static/media/font2.ttf',
      ])

      getLayerAssets({
        ctx: mockCtx,
        layoutOrPagePath: '/app/page',
        injectedCSS: new Set(),
        injectedJS: new Set(),
        injectedFontPreloadTags: new Set(),
        preloadCallbacks,
      })

      // Execute the preload callbacks
      preloadCallbacks.forEach((callback) => callback())

      expect(mockPreloadFont).toHaveBeenCalledTimes(2)

      // Check first font call - should not have dplId
      expect(mockPreloadFont).toHaveBeenNthCalledWith(
        1,
        '/_next/static/media/font1.woff2',
        'font/woff2',
        undefined,
        undefined
      )

      // Check second font call - should not have dplId
      expect(mockPreloadFont).toHaveBeenNthCalledWith(
        2,
        '/_next/static/media/font2.ttf',
        'font/ttf',
        undefined,
        undefined
      )
    })

    it('should handle empty NEXT_DEPLOYMENT_ID', () => {
      mockCtx.renderOpts.deploymentId = ''

      // Mock getPreloadableFonts to return some font files
      getPreloadableFonts.mockReturnValue(['static/media/font1.woff2'])

      getLayerAssets({
        ctx: mockCtx,
        layoutOrPagePath: '/app/page',
        injectedCSS: new Set(),
        injectedJS: new Set(),
        injectedFontPreloadTags: new Set(),
        preloadCallbacks,
      })

      // Execute the preload callbacks
      preloadCallbacks.forEach((callback) => callback())

      expect(mockPreloadFont).toHaveBeenCalledTimes(1)

      // Should not have dplId when deployment ID is empty
      expect(mockPreloadFont).toHaveBeenCalledWith(
        '/_next/static/media/font1.woff2',
        'font/woff2',
        undefined,
        undefined
      )
    })

    it('should handle different font file extensions correctly with dplId', () => {
      mockCtx.renderOpts.deploymentId = 'dpl_456'

      // Mock getPreloadableFonts to return various font extensions
      getPreloadableFonts.mockReturnValue([
        'static/media/font.woff',
        'static/media/font.woff2',
        'static/media/font.eot',
        'static/media/font.ttf',
        'static/media/font.otf',
      ])

      getLayerAssets({
        ctx: mockCtx,
        layoutOrPagePath: '/app/page',
        injectedCSS: new Set(),
        injectedJS: new Set(),
        injectedFontPreloadTags: new Set(),
        preloadCallbacks,
      })

      // Execute the preload callbacks
      preloadCallbacks.forEach((callback) => callback())

      expect(mockPreloadFont).toHaveBeenCalledTimes(5)

      const expectedCalls = [
        ['/_next/static/media/font.woff?dpl=dpl_456', 'font/woff'],
        ['/_next/static/media/font.woff2?dpl=dpl_456', 'font/woff2'],
        ['/_next/static/media/font.eot?dpl=dpl_456', 'font/eot'],
        ['/_next/static/media/font.ttf?dpl=dpl_456', 'font/ttf'],
        ['/_next/static/media/font.otf?dpl=dpl_456', 'font/otf'],
      ]

      expectedCalls.forEach((expectedCall, index) => {
        expect(mockPreloadFont).toHaveBeenNthCalledWith(
          index + 1,
          expectedCall[0],
          expectedCall[1],
          undefined,
          undefined
        )
      })
    })

    it('should include assetPrefix in font URLs with dplId', () => {
      mockCtx.renderOpts.deploymentId = 'dpl_789'
      mockCtx.assetPrefix = 'https://cdn.example.com'

      // Mock getPreloadableFonts to return some font files
      getPreloadableFonts.mockReturnValue(['static/media/font1.woff2'])

      getLayerAssets({
        ctx: mockCtx,
        layoutOrPagePath: '/app/page',
        injectedCSS: new Set(),
        injectedJS: new Set(),
        injectedFontPreloadTags: new Set(),
        preloadCallbacks,
      })

      // Execute the preload callbacks
      preloadCallbacks.forEach((callback) => callback())

      expect(mockPreloadFont).toHaveBeenCalledTimes(1)
      expect(mockPreloadFont).toHaveBeenCalledWith(
        'https://cdn.example.com/_next/static/media/font1.woff2?dpl=dpl_789',
        'font/woff2',
        undefined,
        undefined
      )
    })

    it('should pass crossOrigin and nonce to preloadFont with dplId', () => {
      mockCtx.renderOpts.deploymentId = 'dpl_cross'
      mockCtx.renderOpts.crossOrigin = 'anonymous'
      mockCtx.nonce = 'test-nonce-123'

      // Mock getPreloadableFonts to return some font files
      getPreloadableFonts.mockReturnValue(['static/media/font1.woff2'])

      getLayerAssets({
        ctx: mockCtx,
        layoutOrPagePath: '/app/page',
        injectedCSS: new Set(),
        injectedJS: new Set(),
        injectedFontPreloadTags: new Set(),
        preloadCallbacks,
      })

      // Execute the preload callbacks
      preloadCallbacks.forEach((callback) => callback())

      expect(mockPreloadFont).toHaveBeenCalledTimes(1)
      expect(mockPreloadFont).toHaveBeenCalledWith(
        '/_next/static/media/font1.woff2?dpl=dpl_cross',
        'font/woff2',
        'anonymous',
        'test-nonce-123'
      )
    })

    it('should handle preconnect when no fonts to preload but fonts exist', () => {
      mockCtx.renderOpts.deploymentId = 'dpl_preconnect'

      // Mock getPreloadableFonts to return empty array (fonts exist but none to preload)
      getPreloadableFonts.mockReturnValue([])

      getLayerAssets({
        ctx: mockCtx,
        layoutOrPagePath: '/app/page',
        injectedCSS: new Set(),
        injectedJS: new Set(),
        injectedFontPreloadTags: new Set(),
        preloadCallbacks,
      })

      // Execute the preload callbacks
      preloadCallbacks.forEach((callback) => callback())

      expect(mockPreloadFont).not.toHaveBeenCalled()
      expect(mockPreconnect).toHaveBeenCalledTimes(1)
      expect(mockPreconnect).toHaveBeenCalledWith('/', 'anonymous', undefined)
    })
  })
})

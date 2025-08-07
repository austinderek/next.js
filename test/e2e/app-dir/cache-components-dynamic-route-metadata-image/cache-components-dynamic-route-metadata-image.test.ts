import { nextTestSetup } from 'e2e-utils'

describe('cache-components-metadata-dynamic-image', () => {
  const { next } = nextTestSetup({
    files: __dirname,
  })

  it('should have icon link tag for dynamic route metadata image', async () => {
    const $ = await next.render$('/123')
    const iconLink = $('link[rel="icon"][href*="icon.png"]')
    expect(iconLink.attr('href')).toContain('/123/icon.png')

    const appleIconLink = $('link[rel="apple-touch-icon"][href*="apple-icon"]')
    expect(appleIconLink.attr('href')).toContain('/123/apple-icon')
  })

  it('should have correct headers for dynamic route metadata image', async () => {
    const res = await next.fetch('/123/icon.png')
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('cache-control')).toBe(
      'public, immutable, no-transform, max-age=31536000'
    )

    const appleIconRes = await next.fetch('/123/apple-icon')
    expect(appleIconRes.headers.get('content-type')).toBe('image/png')
    expect(appleIconRes.headers.get('cache-control')).toBe(
      'public, immutable, no-transform, max-age=31536000'
    )
  })
})

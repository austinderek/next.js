import cheerio from 'cheerio'
import { nextTestSetup } from 'e2e-utils'

describe('cache-components-metadata-dynamic-image', () => {
  const { next, isNextDev } = nextTestSetup({
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
    const iconRes = await next.fetch('/123/icon.png')
    expect(iconRes.headers.get('content-type')).toBe('image/png')
    expect(iconRes.headers.get('cache-control')).toBe(
      isNextDev
        ? 'no-cache, no-store'
        : 'public, immutable, no-transform, max-age=31536000'
    )

    const appleIconRes = await next.fetch('/123/apple-icon')
    expect(appleIconRes.headers.get('content-type')).toBe('image/png')
    expect(appleIconRes.headers.get('cache-control')).toBe(
      isNextDev
        ? 'no-cache, no-store'
        : 'public, immutable, no-transform, max-age=31536000'
    )
  })

  it('should work when bot is requesting', async () => {
    const res = await next.fetch('/123', {
      headers: {
        'User-Agent': 'applebot',
      },
    })

    const html = await res.text()
    const $ = cheerio.load(html)

    const iconLink = $('link[rel="icon"]')
    expect(iconLink.attr('href')).toContain('/123/icon.png')

    const appleIconLink = $('link[rel="apple-touch-icon"]')
    expect(appleIconLink.attr('href')).toContain('/123/apple-icon')
  })
})

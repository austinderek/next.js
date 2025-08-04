import { nextTestSetup } from 'e2e-utils'

describe('error-handler-not-found-req-url', () => {
  const { next } = nextTestSetup({
    files: __dirname,
  })

  it('should log the correct request url and asPath for not found _error page', async () => {
    await next.browser('/3')

    expect(await next.cliOutput).toContain(`{ reqUrl: '/3', asPath: '/3' }`)
  })
})

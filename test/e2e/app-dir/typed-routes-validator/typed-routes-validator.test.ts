import { nextTestSetup } from 'e2e-utils'

describe('typed-routes-validator', () => {
  const { next, isNextStart, skipped } = nextTestSetup({
    files: __dirname,
    skipDeployment: true,
  })

  if (skipped) {
    return
  }

  if (isNextStart) {
    it('should pass type checking with valid page exports', async () => {
      await next.stop()
      await next.patchFile(
        'app/test-page.tsx',
        `
export default function TestPage() {
  return <div>Test Page</div>
}

export const dynamic = 'force-static'
export const metadata = { title: 'Test' }
        `
      )

      const { exitCode } = await next.build()
      expect(exitCode).toBe(0)
    })

    it('should fail type checking with invalid page exports', async () => {
      await next.stop()
      await next.patchFile(
        'app/invalid-page.tsx',
        `
// Missing default export
export const metadata = { title: 'Invalid' }
        `
      )

      const { exitCode, cliOutput } = await next.build()
      expect(exitCode).toBe(1)
      expect(cliOutput).toMatch(
        /Type error.*does not satisfy the constraint.*PageConfig/
      )
    })

    it('should pass type checking with valid route handler exports', async () => {
      await next.stop()
      await next.patchFile(
        'app/api/valid/route.ts',
        `
export async function GET() {
  return new Response('OK')
}

export async function POST(request: Request) {
  return new Response('Created', { status: 201 })
}

export const dynamic = 'force-dynamic'
        `
      )

      const { exitCode } = await next.build()
      expect(exitCode).toBe(0)
    })

    it('should fail type checking with invalid route handler exports', async () => {
      await next.stop()
      await next.patchFile(
        'app/api/invalid/route.ts',
        `
// Invalid signature - missing Response return type
export function GET() {
  return 'not a response'
}
        `
      )

      const { exitCode, cliOutput } = await next.build()
      expect(exitCode).toBe(1)
      expect(cliOutput).toMatch(
        /Type error.*does not satisfy the constraint.*RouteHandlerConfig/
      )
    })

    it('should pass type checking with valid layout exports', async () => {
      await next.stop()
      await next.patchFile(
        'app/test/layout.tsx',
        `
export default function TestLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div>{children}</div>
}

export const metadata = { title: 'Test Layout' }
        `
      )

      const { exitCode } = await next.build()
      expect(exitCode).toBe(0)
    })

    it('should fail type checking with invalid layout exports', async () => {
      await next.stop()
      await next.patchFile(
        'app/invalid-layout.tsx',
        `
// Invalid - missing children prop
export default function InvalidLayout() {
  return <div>Invalid</div>
}
        `
      )

      const { exitCode, cliOutput } = await next.build()
      expect(exitCode).toBe(1)
      expect(cliOutput).toMatch(
        /Type error.*does not satisfy the constraint.*LayoutConfig/
      )
    })

    it('should pass type checking with valid API route exports', async () => {
      await next.stop()
      await next.patchFile(
        'pages/api/valid-api.ts',
        `
import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.status(200).json({ message: 'OK' })
}

export const config = {
  api: {
    bodyParser: true,
  },
}
        `
      )

      const { exitCode } = await next.build()
      expect(exitCode).toBe(0)
    })

    it('should fail type checking with invalid API route exports', async () => {
      await next.stop()
      await next.patchFile(
        'pages/api/invalid-api.ts',
        `
// Invalid - not a function
export default { message: 'not a function' }
        `
      )

      const { exitCode, cliOutput } = await next.build()
      expect(exitCode).toBe(1)
      expect(cliOutput).toMatch(
        /Type error.*does not satisfy the constraint.*ApiRouteConfig/
      )
    })
  }
})

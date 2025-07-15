export async function GET(request: Request, context: { params: Promise<any> }) {
  return Response.json({ message: 'Hello from API' })
}

export async function POST(
  request: Request,
  context: { params: Promise<any> }
) {
  const body = await request.json()
  return Response.json({ received: body })
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = false

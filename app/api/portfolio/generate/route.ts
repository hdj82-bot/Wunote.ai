import { requireAuth, AuthError } from '@/lib/auth'
import { assemblePortfolio } from '@/lib/portfolio'

export const runtime = 'nodejs'

export async function POST(): Promise<Response> {
  try {
    const auth = await requireAuth('student')
    const data = await assemblePortfolio(auth.userId)
    return Response.json(data)
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    console.error('[portfolio/generate] Error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

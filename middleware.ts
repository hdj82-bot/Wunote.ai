import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { Database } from '@/types/database'

type CookieToSet = { name: string; value: string; options: CookieOptions }

// Routes that require authentication.
const STUDENT_PREFIXES = [
  '/learn',
  '/errors',
  '/vocabulary',
  '/bookmarks',
  '/quiz',
  '/translate',
  '/analyze-url',
  '/progress',
  '/goals',
  '/badges',
  '/portfolio',
  '/cardnews',
]

const PROFESSOR_PREFIXES = [
  '/dashboard',
  '/classes',
  '/marketplace',
]

const AUTH_PAGES = ['/login', '/signup']

function hasPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export async function middleware(request: NextRequest) {
  // LMS API routes use API key auth — skip session middleware entirely.
  if (request.nextUrl.pathname.startsWith('/api/lms/')) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refreshes the session cookie if expired; must run before any auth checks.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isStudentRoute = hasPrefix(pathname, STUDENT_PREFIXES)
  const isProfessorRoute = hasPrefix(pathname, PROFESSOR_PREFIXES)
  const isAuthPage = AUTH_PAGES.includes(pathname)

  // Unauthenticated → protected route: redirect to login.
  if (!user && (isStudentRoute || isProfessorRoute)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // Authenticated → auth page: bounce to role-based home.
  if (user && isAuthPage) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .returns<Array<{ role: 'professor' | 'student' }>>()
      .single()
    const url = request.nextUrl.clone()
    url.pathname = profile?.role === 'professor' ? '/dashboard' : '/learn'
    url.search = ''
    return NextResponse.redirect(url)
  }

  // Role enforcement on protected routes.
  if (user && (isStudentRoute || isProfessorRoute)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .returns<Array<{ role: 'professor' | 'student' }>>()
      .single()
    const role = profile?.role

    if (isStudentRoute && role !== 'student') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
    if (isProfessorRoute && role !== 'professor') {
      const url = request.nextUrl.clone()
      url.pathname = '/learn'
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    // Skip static assets, Next internals, and API routes (routes do their own auth).
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon-.*\\.png|sounds/|api/).*)',
  ],
}

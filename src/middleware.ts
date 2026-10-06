import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/api/challenge/pregenerate')) {
    return NextResponse.next({ request })
  }

  if (pathname.startsWith('/auth/confirm')) {
    return NextResponse.next({ request })
  }

  const response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (!user && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/|api/usage$|favicon\\.ico$|robots\\.txt$|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|mp3|ogg|wav|mp4|webm|woff|woff2|ttf|otf|css|js|map|txt|xml|webmanifest)$).*)',
  ],
}

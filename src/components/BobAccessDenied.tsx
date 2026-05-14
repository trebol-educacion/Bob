'use client'

import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/browser-client'
import type { BobAccessDenialReason } from '@/contexts/OrganizationContext'

const REASON_COPY: Record<BobAccessDenialReason, { title: string; body: string }> = {
  not_authenticated: {
    title: 'Inicia sesión para continuar',
    body: 'Necesitas estar autenticado para acceder a Bob.',
  },
  no_profile: {
    title: 'Cuenta sin perfil asociado',
    body: 'Tu usuario no tiene un perfil configurado. Contacta con el administrador de tu colegio.',
  },
  not_student: {
    title: 'Bob es para estudiantes',
    body: 'Esta herramienta de práctica de pronunciación está disponible solo para alumnos. Si crees que es un error, contacta con el administrador de tu colegio.',
  },
  no_organization: {
    title: 'Sin colegio asignado',
    body: 'Tu cuenta no está vinculada a ningún colegio. Pide al administrador que te asocie a tu institución antes de usar Bob.',
  },
  bob_not_enabled: {
    title: 'Bob no está disponible en tu colegio',
    body: 'Tu colegio aún no ha activado Bob. Habla con el administrador de tu institución para solicitar el acceso.',
  },
}

export function BobAccessDenied({ reason }: { reason: BobAccessDenialReason }) {
  const { title, body } = REASON_COPY[reason]
  const router = useRouter()

  const handleBackToLogin = async () => {
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-trebol-bg">
      <div className="max-w-md text-center space-y-4">
        <div className="text-6xl">🔒</div>
        <h1 className="text-2xl font-bold text-trebol-text">{title}</h1>
        <p className="text-base text-trebol-text/70 leading-relaxed">{body}</p>
        <button
          type="button"
          onClick={handleBackToLogin}
          className="mt-2 inline-flex items-center justify-center rounded-full bg-trebol-primary text-white px-6 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Volver al inicio de sesión
        </button>
      </div>
    </div>
  )
}

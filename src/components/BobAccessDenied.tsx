'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createSupabaseBrowser } from '@/lib/supabase/browser-client'
import type { BobAccessDenialReason } from '@/contexts/OrganizationContext'

export function BobAccessDenied({ reason }: { reason: BobAccessDenialReason }) {
  const t = useTranslations('shell.accessDenied')
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
        <h1 className="text-2xl font-bold text-trebol-text">{t(`reasons.${reason}.title`)}</h1>
        <p className="text-base text-trebol-text/70 leading-relaxed">{t(`reasons.${reason}.body`)}</p>
        <button
          type="button"
          onClick={handleBackToLogin}
          className="mt-2 inline-flex items-center justify-center rounded-full bg-trebol-primary text-white px-6 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {t('backToLogin')}
        </button>
      </div>
    </div>
  )
}

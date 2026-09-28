import type { BobAccessDenialReason } from '@/contexts/OrganizationContext';

export interface AccessGateInput {
  profileErrored: boolean;
  hasProfile: boolean;
  role: string | null;
  orgFound: boolean;
  bobEnabled: boolean | null | undefined;
  /** Resultado del RPC has_product_access('bob'); null/undefined = desconocido (RPC ausente o fallido). */
  licenseResult: boolean | null | undefined;
}

/**
 * Decide la causa de denegación de acceso a Bob, en el mismo orden que el gate
 * histórico del OrganizationContext, más la licencia individual gestionada desde
 * noobe-hub. La licencia solo deniega con un false explícito (fail-open): un RPC
 * ausente o fallido nunca deja fuera a un alumno por un error de infraestructura.
 */
export function resolveBobAccessDenial(input: AccessGateInput): BobAccessDenialReason | null {
  if (input.profileErrored) return null;
  if (!input.hasProfile) return 'no_profile';
  if (input.role !== 'student') return 'not_student';
  if (!input.orgFound) return 'no_organization';
  if (!input.bobEnabled) return 'bob_not_enabled';
  if (input.licenseResult === false) return 'no_license';
  return null;
}

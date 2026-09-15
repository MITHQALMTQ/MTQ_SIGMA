// MTQΣ — Autonoma SDK endpoint (discover / up / down protocol)
//
// Mounted at /api/autonoma. The SDK handler:
//   • verifies the x-signature HMAC against AUTONOMA_SHARED_SECRET
//   • routes discover/up/down actions
//   • calls the factory for each entity the recipe creates
//   • tears down per-record on `down`
//
// The MTQΣ app has no auth system, so the auth callback returns an
// empty AuthResult — the dashboard is fully public.

import { createHandler } from '@autonoma-ai/server-web'
import { factories } from '@/lib/autonoma/factories'

export const dynamic = 'force-dynamic'

// signingSecret — internal-only secret for signing the refs JWT. We use
// a stable value derived from AUTONOMA_SHARED_SECRET so refs tokens
// survive a dev-server restart, but Autonoma never sees it.
const SIGNING_SECRET =
  process.env.AUTONOMA_SHARED_SECRET
  ? `${process.env.AUTONOMA_SHARED_SECRET}-internal-signing-v1`
  : 'mtqs-autonoma-signing-fallback-dev-only'

export const POST = createHandler({
  scopeField: 'testRunId',
  sharedSecret: process.env.AUTONOMA_SHARED_SECRET ?? '',
  signingSecret: SIGNING_SECRET,
  factories,
  auth: async () => ({}), // public dashboard, no credentials
})

// GET /api/autonoma — surface a discover stub for manual probing.
// The full protocol is POST-only (signed), but a GET makes it obvious
// from a browser that the endpoint is mounted.
export async function GET() {
  return Response.json({
    ok: true,
    endpoint: '/api/autonoma',
    protocol: 'discover/up/down',
    models: Object.keys(factories),
    hint: 'POST a signed request body with x-signature header to invoke the protocol.',
  })
}

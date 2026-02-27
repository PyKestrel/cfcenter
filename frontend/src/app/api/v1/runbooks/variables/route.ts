import { NextResponse } from 'next/server'

import { BUILTIN_VARIABLES } from '@/lib/runbooks'

export const runtime = 'nodejs'

/**
 * GET /api/v1/runbooks/variables
 * Returns the list of built-in variable definitions for autocomplete.
 */
export async function GET() {
  return NextResponse.json({ data: BUILTIN_VARIABLES })
}

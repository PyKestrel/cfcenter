// src/app/api/v1/auth/totp/verify/route.ts
// Verify TOTP code during login flow

import { NextRequest, NextResponse } from 'next/server'

import { verifyTotpCode, verifyRecoveryCode, isTotpEnabled } from '@/lib/auth/totp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/v1/auth/totp/verify — Verify a TOTP or recovery code
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, code, type } = body

    if (!user_id || !code) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, code' },
        { status: 400 }
      )
    }

    // Check if user has 2FA enabled
    if (!isTotpEnabled(user_id)) {
      return NextResponse.json({
        data: { verified: true, message: '2FA not enabled for this user' }
      })
    }

    let verified = false

    if (type === 'recovery') {
      verified = verifyRecoveryCode(user_id, code)
    } else {
      verified = verifyTotpCode(user_id, code)
    }

    if (!verified) {
      return NextResponse.json(
        { error: 'Invalid code. Please try again.' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      data: { verified: true, message: '2FA verification successful' }
    })
  } catch (e: any) {
    console.error('[auth/totp/verify] POST error:', e)

    return NextResponse.json({ error: e?.message || 'Verification failed' }, { status: 500 })
  }
}

// src/app/api/v1/auth/totp/setup/route.ts
// Begin or complete TOTP enrollment

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import QRCode from 'qrcode'

import { authOptions } from '@/lib/auth/config'
import { beginEnrollment, verifyEnrollment, getTotpStatus } from '@/lib/auth/totp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/v1/auth/totp/setup — Get current 2FA status
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const status = getTotpStatus(session.user.id)

    return NextResponse.json({ data: status })
  } catch (e: any) {
    console.error('[auth/totp/setup] GET error:', e)

    return NextResponse.json({ error: e?.message || 'Failed to get TOTP status' }, { status: 500 })
  }
}

// POST /api/v1/auth/totp/setup — Begin enrollment (returns QR code)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))

    // If code is provided, this is the verification step
    if (body.code) {
      const result = verifyEnrollment(session.user.id, body.code)

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }

      return NextResponse.json({
        data: {
          success: true,
          recovery_codes: result.recovery_codes,
          message: '2FA has been enabled successfully',
        }
      })
    }

    // Otherwise, begin enrollment
    const enrollment = beginEnrollment(session.user.id, session.user.email)

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(enrollment.uri, {
      width: 256,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })

    return NextResponse.json({
      data: {
        secret: enrollment.secret,
        qr_code: qrCodeDataUrl,
        uri: enrollment.uri,
      }
    })
  } catch (e: any) {
    console.error('[auth/totp/setup] POST error:', e)

    return NextResponse.json({ error: e?.message || 'Failed to setup TOTP' }, { status: 500 })
  }
}

// DELETE /api/v1/auth/totp/setup — Disable 2FA
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { disableTotp } = await import('@/lib/auth/totp')

    disableTotp(session.user.id)

    return NextResponse.json({ data: { success: true, message: '2FA has been disabled' } })
  } catch (e: any) {
    console.error('[auth/totp/setup] DELETE error:', e)

    return NextResponse.json({ error: e?.message || 'Failed to disable TOTP' }, { status: 500 })
  }
}

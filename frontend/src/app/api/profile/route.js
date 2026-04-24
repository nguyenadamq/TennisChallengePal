import { NextResponse } from 'next/server'
import { requireProfile } from '../../../lib/serverSupabase'

const JSON_HEADERS = {
  'Cache-Control': 'no-store',
}

export async function GET(request) {
  try {
    const { profile } = await requireProfile(request)
    return NextResponse.json({ profile }, { headers: JSON_HEADERS })
  } catch (error) {
    console.error('PROFILE API ERROR:', error)

    return NextResponse.json(
      { error: error.message || 'Unable to load profile.' },
      { status: 500, headers: JSON_HEADERS },
    )
  }
}

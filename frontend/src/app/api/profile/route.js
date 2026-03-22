import { NextResponse } from 'next/server'
import { requireProfile } from '../../../lib/serverSupabase'

export async function GET(request) {
  try {
    const { profile } = await requireProfile(request)
    return NextResponse.json({ profile })
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Unable to load profile.' },
      { status: 401 },
    )
  }
}

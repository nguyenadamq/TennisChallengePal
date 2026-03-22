import { NextResponse } from 'next/server'
import { requireProfile } from '../../../lib/serverSupabase'

const ALLOWED_RPCS = new Set([
  'claim_admin_role',
  'submit_ladder_request',
  'admin_add_user_to_ladder',
  'admin_move_ladder_entry',
  'admin_remove_ladder_entry',
  'admin_resolve_request',
  'respond_to_partner_ladder_invite',
  'search_users_by_username',
  'send_friend_request',
  'respond_to_friend_request',
  'mark_notification_read',
])

const ADMIN_ONLY_RPCS = new Set([
  'admin_add_user_to_ladder',
  'admin_move_ladder_entry',
  'admin_remove_ladder_entry',
  'admin_resolve_request',
])

export async function POST(request) {
  try {
    const { profile, supabaseUser } = await requireProfile(request)
    const body = await request.json()
    const functionName = body?.functionName
    const payload = body?.payload || {}

    if (!ALLOWED_RPCS.has(functionName)) {
      return NextResponse.json({ error: 'RPC not allowed.' }, { status: 400 })
    }

    if (ADMIN_ONLY_RPCS.has(functionName) && profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access is required.' }, { status: 403 })
    }

    const { data, error } = await supabaseUser.rpc(functionName, payload)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ data: data ?? null })
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Unable to complete the request.' },
      { status: 401 },
    )
  }
}

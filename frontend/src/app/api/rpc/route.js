import { NextResponse } from 'next/server'
import { requireProfile } from '../../../lib/serverSupabase'
import { consumeRateLimit } from '../../../lib/rateLimit'

const JSON_HEADERS = { 'Cache-Control': 'no-store' }
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/
const LADDER_CODES = new Set([
  'mens_singles',
  'mens_doubles',
  'mixed_doubles',
  'womens_singles',
  'womens_doubles',
])
const LADDER_REQUEST_TYPES = new Set(['join', 'challenge'])
const CLUB_ROLES = new Set(['member', 'officer', 'president'])
const NOTIFICATION_CATEGORIES = new Set(['social', 'club', 'court'])
const COURT_PLAY_TYPES = new Set(['singles', 'doubles', 'either'])
const COURT_LOCATION_TYPES = new Set(['osu', 'custom'])
const DECISIONS = new Set(['approved', 'rejected'])
const MAX_JSON_BODY_CHARS = 20_000

class RequestValidationError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'RequestValidationError'
    this.status = status
  }
}

function json(body, status = 200, extraHeaders = {}) {
  return NextResponse.json(body, {
    status,
    headers: {
      ...JSON_HEADERS,
      ...extraHeaders,
    },
  })
}

function getClientAddress(request) {
  const forwardedFor = request.headers.get('x-forwarded-for')
  return forwardedFor?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
}

async function parseJsonBody(request) {
  const contentType = request.headers.get('content-type') || ''

  if (!contentType.toLowerCase().includes('application/json')) {
    throw new RequestValidationError('JSON requests are required.', 415)
  }

  const rawBody = await request.text()

  if (!rawBody.trim()) {
    throw new RequestValidationError('Request body is required.')
  }

  if (rawBody.length > MAX_JSON_BODY_CHARS) {
    throw new RequestValidationError('Request body is too large.', 413)
  }

  try {
    return JSON.parse(rawBody)
  } catch {
    throw new RequestValidationError('Request body must be valid JSON.')
  }
}

function ensurePlainObject(value, message = 'Invalid request payload.') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RequestValidationError(message)
  }

  return value
}

function optionalText(value, fieldName, maxLength = 500) {
  if (value == null) {
    return null
  }

  if (typeof value !== 'string') {
    throw new RequestValidationError(`${fieldName} must be text.`)
  }

  const normalized = value.trim()

  if (!normalized) {
    return null
  }

  if (normalized.length > maxLength) {
    throw new RequestValidationError(`${fieldName} is too long.`)
  }

  return normalized
}

function requiredText(value, fieldName, maxLength = 120) {
  const normalized = optionalText(value, fieldName, maxLength)

  if (!normalized) {
    throw new RequestValidationError(`${fieldName} is required.`)
  }

  return normalized
}

function uuid(value, fieldName) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value.trim())) {
    throw new RequestValidationError(`${fieldName} must be a valid id.`)
  }

  return value.trim().toLowerCase()
}

function optionalUuid(value, fieldName) {
  if (value == null || value === '') {
    return null
  }

  return uuid(value, fieldName)
}

function uuidArray(value, fieldName) {
  if (value == null) {
    return []
  }

  if (!Array.isArray(value)) {
    throw new RequestValidationError(`${fieldName} must be a list.`)
  }

  return [...new Set(value.map((item) => uuid(item, fieldName)))]
}

function username(value, fieldName) {
  if (typeof value !== 'string') {
    throw new RequestValidationError(`${fieldName} must be a username.`)
  }

  const normalized = value.trim().toLowerCase()

  if (!USERNAME_PATTERN.test(normalized)) {
    throw new RequestValidationError(`${fieldName} must be an exact username.`)
  }

  return normalized
}

function optionalUsername(value, fieldName) {
  if (value == null || value === '') {
    return null
  }

  return username(value, fieldName)
}

function enumValue(value, allowed, fieldName) {
  if (typeof value !== 'string' || !allowed.has(value)) {
    throw new RequestValidationError(`${fieldName} is invalid.`)
  }

  return value
}

function optionalEnumValue(value, allowed, fieldName) {
  if (value == null || value === '') {
    return null
  }

  return enumValue(value, allowed, fieldName)
}

function optionalPositiveInteger(value, fieldName, max = 999) {
  if (value == null || value === '') {
    return null
  }

  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new RequestValidationError(`${fieldName} must be a positive whole number.`)
  }

  return value
}

function requiredPositiveInteger(value, fieldName, max = 999) {
  const normalized = optionalPositiveInteger(value, fieldName, max)

  if (normalized == null) {
    throw new RequestValidationError(`${fieldName} is required.`)
  }

  return normalized
}

function booleanValue(value, fieldName) {
  if (typeof value !== 'boolean') {
    throw new RequestValidationError(`${fieldName} must be true or false.`)
  }

  return value
}

function optionalBoolean(value, fieldName) {
  if (value == null) {
    return false
  }

  return booleanValue(value, fieldName)
}

function futureDate(value, fieldName) {
  if (typeof value !== 'string') {
    throw new RequestValidationError(`${fieldName} must be a date.`)
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new RequestValidationError(`${fieldName} must be a valid date.`)
  }

  return date.toISOString()
}

const RPC_CONFIG = {
  create_club: {
    rateLimit: { limit: 8, windowMs: 10 * 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      return {
        p_name: requiredText(payload.p_name, 'Club name', 80),
        p_password: requiredText(payload.p_password, 'Club password', 200),
      }
    },
  },
  join_club: {
    rateLimit: { limit: 20, windowMs: 10 * 60 * 1000, scope: 'user_ip' },
    sanitizePayload(payload) {
      return {
        p_name: requiredText(payload.p_name, 'Club name', 80),
        p_password: requiredText(payload.p_password, 'Club password', 200),
      }
    },
  },
  set_club_member_role: {
    rateLimit: { limit: 40, windowMs: 10 * 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      return {
        p_club_id: uuid(payload.p_club_id, 'Club'),
        p_member_id: uuid(payload.p_member_id, 'Member'),
        p_role: enumValue(payload.p_role, CLUB_ROLES, 'Club role'),
      }
    },
  },
  transfer_club_presidency: {
    rateLimit: { limit: 10, windowMs: 10 * 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      return {
        p_club_id: uuid(payload.p_club_id, 'Club'),
        p_new_president_id: uuid(payload.p_new_president_id, 'New president'),
      }
    },
  },
  search_users_by_username: {
    rateLimit: { limit: 30, windowMs: 60 * 1000, scope: 'user_ip' },
    sanitizePayload(payload) {
      return {
        p_query: username(payload.p_query, 'Username'),
      }
    },
  },
  send_friend_request: {
    rateLimit: { limit: 15, windowMs: 10 * 60 * 1000, scope: 'user_ip' },
    sanitizePayload(payload) {
      return {
        p_username: username(payload.p_username, 'Username'),
      }
    },
  },
  respond_to_friend_request: {
    rateLimit: { limit: 30, windowMs: 10 * 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      return {
        p_request_id: uuid(payload.p_request_id, 'Friend request'),
        p_accept: booleanValue(payload.p_accept, 'Accept'),
      }
    },
  },
  mark_notification_read: {
    rateLimit: { limit: 80, windowMs: 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      return {
        p_notification_id: uuid(payload.p_notification_id, 'Notification'),
      }
    },
  },
  mark_category_notifications_read: {
    rateLimit: { limit: 30, windowMs: 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      return {
        p_category: enumValue(payload.p_category, NOTIFICATION_CATEGORIES, 'Notification category'),
      }
    },
  },
  submit_ladder_request: {
    rateLimit: { limit: 20, windowMs: 10 * 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      return {
        p_club_id: uuid(payload.p_club_id, 'Club'),
        p_ladder_code: enumValue(payload.p_ladder_code, LADDER_CODES, 'Ladder'),
        p_request_type: enumValue(payload.p_request_type, LADDER_REQUEST_TYPES, 'Request type'),
        p_target_rank: optionalPositiveInteger(payload.p_target_rank, 'Target rank'),
        p_message: optionalText(payload.p_message, 'Message', 500),
        p_partner_username: optionalUsername(payload.p_partner_username, 'Partner username'),
        p_drop_ladder_code: optionalEnumValue(payload.p_drop_ladder_code, LADDER_CODES, 'Drop ladder'),
      }
    },
  },
  respond_to_partner_ladder_invite: {
    rateLimit: { limit: 20, windowMs: 10 * 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      return {
        p_request_id: uuid(payload.p_request_id, 'Ladder request'),
        p_accept: booleanValue(payload.p_accept, 'Accept'),
        p_drop_ladder_code: optionalEnumValue(payload.p_drop_ladder_code, LADDER_CODES, 'Drop ladder'),
      }
    },
  },
  officer_add_ladder_entry: {
    rateLimit: { limit: 35, windowMs: 10 * 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      return {
        p_club_id: uuid(payload.p_club_id, 'Club'),
        p_ladder_code: enumValue(payload.p_ladder_code, LADDER_CODES, 'Ladder'),
        p_user_id: uuid(payload.p_user_id, 'Player'),
        p_partner_user_id: optionalUuid(payload.p_partner_user_id, 'Partner'),
        p_rank: optionalPositiveInteger(payload.p_rank, 'Rank'),
      }
    },
  },
  officer_move_ladder_entry: {
    rateLimit: { limit: 60, windowMs: 10 * 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      return {
        p_entry_id: uuid(payload.p_entry_id, 'Ladder entry'),
        p_new_rank: requiredPositiveInteger(payload.p_new_rank, 'Rank'),
      }
    },
  },
  officer_remove_ladder_entry: {
    rateLimit: { limit: 35, windowMs: 10 * 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      return {
        p_entry_id: uuid(payload.p_entry_id, 'Ladder entry'),
      }
    },
  },
  officer_resolve_ladder_request: {
    rateLimit: { limit: 35, windowMs: 10 * 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      return {
        p_request_id: uuid(payload.p_request_id, 'Ladder request'),
        p_decision: enumValue(payload.p_decision, DECISIONS, 'Decision'),
        p_rank: optionalPositiveInteger(payload.p_rank, 'Rank'),
      }
    },
  },
  member_drop_own_ladder_entry: {
    rateLimit: { limit: 20, windowMs: 10 * 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      return {
        p_entry_id: uuid(payload.p_entry_id, 'Ladder entry'),
      }
    },
  },
  create_court: {
    rateLimit: { limit: 20, windowMs: 10 * 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      return {
        p_play_type: enumValue(payload.p_play_type, COURT_PLAY_TYPES, 'Play type'),
        p_description: optionalText(payload.p_description, 'Description', 280),
        p_scheduled_at: futureDate(payload.p_scheduled_at, 'Court time'),
        p_location_type: enumValue(payload.p_location_type, COURT_LOCATION_TYPES, 'Location type'),
        p_custom_location: optionalText(payload.p_custom_location, 'Custom location', 120),
        p_osu_court_number: optionalPositiveInteger(payload.p_osu_court_number, 'OSU court number', 10),
        p_broadcast_public: optionalBoolean(payload.p_broadcast_public, 'Public broadcast'),
        p_broadcast_friends: optionalBoolean(payload.p_broadcast_friends, 'Friends broadcast'),
        p_broadcast_club_ids: uuidArray(payload.p_broadcast_club_ids, 'Club broadcasts'),
        p_invited_friend_ids: uuidArray(payload.p_invited_friend_ids, 'Friend invites'),
      }
    },
  },
  request_join_court: {
    rateLimit: { limit: 30, windowMs: 10 * 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      return {
        p_court_id: uuid(payload.p_court_id, 'Court'),
      }
    },
  },
  respond_court_join_request: {
    rateLimit: { limit: 40, windowMs: 10 * 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      return {
        p_request_id: uuid(payload.p_request_id, 'Court join request'),
        p_accept: booleanValue(payload.p_accept, 'Accept'),
      }
    },
  },
  respond_court_invite: {
    rateLimit: { limit: 40, windowMs: 10 * 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      return {
        p_invite_id: uuid(payload.p_invite_id, 'Court invite'),
        p_accept: booleanValue(payload.p_accept, 'Accept'),
      }
    },
  },
  leave_court: {
    rateLimit: { limit: 30, windowMs: 10 * 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      return {
        p_court_id: uuid(payload.p_court_id, 'Court'),
      }
    },
  },
  remove_user_from_court: {
    rateLimit: { limit: 40, windowMs: 10 * 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      return {
        p_court_id: uuid(payload.p_court_id, 'Court'),
        p_user_id: uuid(payload.p_user_id, 'Player'),
      }
    },
  },
}

function applyRateLimit(request, profile, functionName, config) {
  if (!config.rateLimit) {
    return null
  }

  const scopeParts = [functionName]

  if (config.rateLimit.scope.includes('user')) {
    scopeParts.push(profile.id)
  }

  if (config.rateLimit.scope.includes('ip')) {
    scopeParts.push(getClientAddress(request))
  }

  const result = consumeRateLimit({
    key: scopeParts.join(':'),
    limit: config.rateLimit.limit,
    windowMs: config.rateLimit.windowMs,
  })

  if (!result.allowed) {
    return json(
      { error: 'Too many requests. Please wait and try again.' },
      429,
      { 'Retry-After': String(result.retryAfterSeconds) },
    )
  }

  return null
}

export async function POST(request) {
  try {
    const { profile, supabaseUser } = await requireProfile(request)
    const body = ensurePlainObject(await parseJsonBody(request), 'Invalid request body.')
    const functionName = body?.functionName
    const payload = ensurePlainObject(body?.payload || {}, 'Invalid request payload.')
    const config = RPC_CONFIG[functionName]

    if (!config) {
      return json({ error: 'RPC not allowed.' }, 400)
    }

    const rateLimitResponse = applyRateLimit(request, profile, functionName, config)

    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const sanitizedPayload = config.sanitizePayload(payload)
    const { data, error } = await supabaseUser.rpc(functionName, sanitizedPayload)

    if (error) {
      return json({ error: error.message }, 400)
    }

    return json({ data: data ?? null })
  } catch (error) {
    const status = error instanceof RequestValidationError ? error.status : 401
    return json({ error: error.message || 'Unable to complete the request.' }, status)
  }
}

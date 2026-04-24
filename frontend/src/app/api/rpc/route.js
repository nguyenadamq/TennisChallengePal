import { NextResponse } from 'next/server'
import { requireProfile } from '../../../lib/serverSupabase'
import { consumeRateLimit } from '../../../lib/rateLimit'

const JSON_HEADERS = {
  'Cache-Control': 'no-store',
}

const LADDER_CODES = new Set([
  'mens_singles',
  'mens_doubles',
  'mixed_doubles',
  'womens_singles',
  'womens_doubles',
])

const REQUEST_TYPES = new Set(['join', 'challenge'])
const REQUEST_DECISIONS = new Set(['approved', 'rejected'])
const COURT_VISIBILITIES = new Set(['open', 'invite_only'])
const DAYS_OF_WEEK = new Set([
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
])
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/
const CLUB_NAME_PATTERN = /^[a-z0-9][a-z0-9 '\-_]{1,38}[a-z0-9]$/i
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
const MAX_JSON_BODY_CHARS = 10_000
const MAX_MESSAGE_LENGTH = 500
const MAX_PASSWORD_LENGTH = 200
const MAX_RANK = 999
const MAX_INVITEES = 24

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

  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  return request.headers.get('x-real-ip') || 'unknown'
}

function ensureJsonRequest(request) {
  const contentType = request.headers.get('content-type') || ''

  if (!contentType.toLowerCase().includes('application/json')) {
    throw new RequestValidationError('JSON requests are required.', 415)
  }
}

async function parseJsonBody(request) {
  ensureJsonRequest(request)

  const rawBody = await request.text()

  if (!rawBody || !rawBody.trim()) {
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

function normalizeOptionalText(value, fieldName, maxLength = MAX_MESSAGE_LENGTH) {
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

function normalizeRequiredText(value, fieldName, maxLength) {
  const normalized = normalizeOptionalText(value, fieldName, maxLength)

  if (!normalized) {
    throw new RequestValidationError(`${fieldName} is required.`)
  }

  return normalized
}

function normalizeUuid(value, fieldName) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value.trim())) {
    throw new RequestValidationError(`${fieldName} must be a valid id.`)
  }

  return value.trim().toLowerCase()
}

function normalizeOptionalUuid(value, fieldName) {
  if (value == null) {
    return null
  }

  return normalizeUuid(value, fieldName)
}

function normalizeUsername(value, fieldName) {
  if (typeof value !== 'string') {
    throw new RequestValidationError(`${fieldName} must be a username.`)
  }

  const normalized = value.trim().toLowerCase()

  if (!USERNAME_PATTERN.test(normalized)) {
    throw new RequestValidationError(`${fieldName} must be an exact username.`)
  }

  return normalized
}

function normalizeClubName(value, fieldName) {
  if (typeof value !== 'string') {
    throw new RequestValidationError(`${fieldName} must be text.`)
  }

  const normalized = value.trim()

  if (!CLUB_NAME_PATTERN.test(normalized)) {
    throw new RequestValidationError(
      `${fieldName} must be 3-40 characters and use letters, numbers, spaces, apostrophes, hyphens, or underscores.`,
    )
  }

  return normalized
}

function normalizeOptionalUsername(value, fieldName) {
  if (value == null) {
    return null
  }

  return normalizeUsername(value, fieldName)
}

function normalizeLadderCode(value, fieldName) {
  if (typeof value !== 'string' || !LADDER_CODES.has(value)) {
    throw new RequestValidationError(`${fieldName} is invalid.`)
  }

  return value
}

function normalizeOptionalLadderCode(value, fieldName) {
  if (value == null) {
    return null
  }

  return normalizeLadderCode(value, fieldName)
}

function normalizePositiveInteger(value, fieldName) {
  if (!Number.isInteger(value) || value < 1 || value > MAX_RANK) {
    throw new RequestValidationError(`${fieldName} must be a positive whole number.`)
  }

  return value
}

function normalizeOptionalPositiveInteger(value, fieldName) {
  if (value == null) {
    return null
  }

  return normalizePositiveInteger(value, fieldName)
}

function normalizeBoolean(value, fieldName) {
  if (typeof value !== 'boolean') {
    throw new RequestValidationError(`${fieldName} must be true or false.`)
  }

  return value
}

function normalizeVisibility(value, fieldName) {
  if (typeof value !== 'string' || !COURT_VISIBILITIES.has(value)) {
    throw new RequestValidationError(`${fieldName} is invalid.`)
  }

  return value
}

function normalizeUuidArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw new RequestValidationError(`${fieldName} must be a list.`)
  }

  if (value.length > MAX_INVITEES) {
    throw new RequestValidationError(`${fieldName} has too many entries.`)
  }

  const normalized = value.map((entry) => normalizeUuid(entry, fieldName))
  const unique = Array.from(new Set(normalized))

  if (unique.length !== normalized.length) {
    throw new RequestValidationError(`${fieldName} cannot contain duplicates.`)
  }

  return unique
}

function normalizeDayOfWeek(value, fieldName) {
  if (typeof value !== 'string' || !DAYS_OF_WEEK.has(value)) {
    throw new RequestValidationError(`${fieldName} is invalid.`)
  }

  return value
}

function normalizeTime(value, fieldName) {
  if (typeof value !== 'string' || !TIME_PATTERN.test(value)) {
    throw new RequestValidationError(`${fieldName} must use HH:MM 24-hour time.`)
  }

  return value
}

const RPC_CONFIG = {
  create_club: {
    rateLimit: { limit: 5, windowMs: 15 * 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      return {
        p_club_name: normalizeClubName(payload.p_club_name, 'Club name'),
        p_password: normalizeRequiredText(payload.p_password, 'Club password', MAX_PASSWORD_LENGTH),
      }
    },
  },
  join_club: {
    rateLimit: { limit: 10, windowMs: 15 * 60 * 1000, scope: 'user_ip' },
    sanitizePayload(payload) {
      return {
        p_club_name: normalizeClubName(payload.p_club_name, 'Club name'),
        p_password: normalizeRequiredText(payload.p_password, 'Club password', MAX_PASSWORD_LENGTH),
      }
    },
  },
  claim_admin_role: {
    rateLimit: { limit: 5, windowMs: 15 * 60 * 1000, scope: 'user_ip' },
    sanitizePayload(payload) {
      return {
        p_password: normalizeRequiredText(payload.p_password, 'Officer password', MAX_PASSWORD_LENGTH),
      }
    },
  },
  submit_ladder_request: {
    rateLimit: { limit: 12, windowMs: 10 * 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      const requestType = typeof payload.p_request_type === 'string' ? payload.p_request_type : null

      if (!REQUEST_TYPES.has(requestType)) {
        throw new RequestValidationError('Request type is invalid.')
      }

      return {
        p_ladder_code: normalizeLadderCode(payload.p_ladder_code, 'Ladder'),
        p_request_type: requestType,
        p_target_rank: normalizeOptionalPositiveInteger(payload.p_target_rank, 'Target rank'),
        p_message: normalizeOptionalText(payload.p_message, 'Message'),
        p_partner_username: normalizeOptionalUsername(payload.p_partner_username, 'Partner username'),
        p_drop_ladder_code: normalizeOptionalLadderCode(payload.p_drop_ladder_code, 'Drop ladder'),
      }
    },
  },
  admin_add_user_to_ladder: {
    adminOnly: true,
    rateLimit: { limit: 25, windowMs: 10 * 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      const userId = normalizeUuid(payload.p_user_id, 'Primary player')
      const partnerUserId = normalizeOptionalUuid(payload.p_partner_user_id, 'Partner')

      if (partnerUserId && partnerUserId === userId) {
        throw new RequestValidationError('A doubles team needs two different users.')
      }

      return {
        p_ladder_code: normalizeLadderCode(payload.p_ladder_code, 'Ladder'),
        p_user_id: userId,
        p_partner_user_id: partnerUserId,
        p_rank: normalizeOptionalPositiveInteger(payload.p_rank, 'Starting rank'),
      }
    },
  },
  admin_move_ladder_entry: {
    adminOnly: true,
    rateLimit: { limit: 40, windowMs: 10 * 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      return {
        p_entry_id: normalizeUuid(payload.p_entry_id, 'Entry'),
        p_new_rank: normalizePositiveInteger(payload.p_new_rank, 'New rank'),
      }
    },
  },
  admin_remove_ladder_entry: {
    adminOnly: true,
    rateLimit: { limit: 25, windowMs: 10 * 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      return {
        p_entry_id: normalizeUuid(payload.p_entry_id, 'Entry'),
      }
    },
  },
  admin_resolve_request: {
    adminOnly: true,
    rateLimit: { limit: 30, windowMs: 10 * 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      if (typeof payload.p_decision !== 'string' || !REQUEST_DECISIONS.has(payload.p_decision)) {
        throw new RequestValidationError('Decision is invalid.')
      }

      return {
        p_request_id: normalizeUuid(payload.p_request_id, 'Request'),
        p_decision: payload.p_decision,
        p_rank: normalizeOptionalPositiveInteger(payload.p_rank, 'Rank override'),
      }
    },
  },
  member_drop_own_ladder_entry: {
    rateLimit: { limit: 15, windowMs: 10 * 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      return {
        p_entry_id: normalizeUuid(payload.p_entry_id, 'Entry'),
      }
    },
  },
  respond_to_partner_ladder_invite: {
    rateLimit: { limit: 20, windowMs: 10 * 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      return {
        p_request_id: normalizeUuid(payload.p_request_id, 'Request'),
        p_accept: normalizeBoolean(payload.p_accept, 'Accept'),
        p_drop_ladder_code: normalizeOptionalLadderCode(payload.p_drop_ladder_code, 'Drop ladder'),
      }
    },
  },
  search_users_by_username: {
    rateLimit: { limit: 20, windowMs: 60 * 1000, scope: 'user_ip' },
    sanitizePayload(payload) {
      return {
        p_query: normalizeUsername(payload.p_query, 'Username'),
      }
    },
  },
  send_friend_request: {
    rateLimit: { limit: 10, windowMs: 10 * 60 * 1000, scope: 'user_ip' },
    sanitizePayload(payload) {
      return {
        p_username: normalizeUsername(payload.p_username, 'Username'),
      }
    },
  },
  respond_to_friend_request: {
    rateLimit: { limit: 20, windowMs: 10 * 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      return {
        p_request_id: normalizeUuid(payload.p_request_id, 'Request'),
        p_accept: normalizeBoolean(payload.p_accept, 'Accept'),
      }
    },
  },
  mark_notification_read: {
    rateLimit: { limit: 60, windowMs: 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      return {
        p_notification_id: normalizeUuid(payload.p_notification_id, 'Notification'),
      }
    },
  },
  set_hit_partner_preference: {
    rateLimit: { limit: 40, windowMs: 10 * 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      return {
        p_friend_id: normalizeUuid(payload.p_friend_id, 'Friend'),
        p_enabled: normalizeBoolean(payload.p_enabled, 'Hit Partner'),
      }
    },
  },
  create_fill_court: {
    rateLimit: { limit: 20, windowMs: 10 * 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      const startTime = normalizeTime(payload.p_start_time, 'Start time')
      const endTime = normalizeTime(payload.p_end_time, 'End time')

      if (startTime >= endTime) {
        throw new RequestValidationError('End time must be later than start time.')
      }

      return {
        p_title: normalizeRequiredText(payload.p_title, 'Court title', 120),
        p_details: normalizeOptionalText(payload.p_details, 'Court details', 500),
        p_visibility: normalizeVisibility(payload.p_visibility, 'Court visibility'),
        p_invitee_ids: normalizeUuidArray(payload.p_invitee_ids ?? [], 'Invitees'),
        p_day_of_week: normalizeDayOfWeek(payload.p_day_of_week, 'Day of week'),
        p_start_time: startTime,
        p_end_time: endTime,
        p_max_players: normalizePositiveInteger(payload.p_max_players, 'Maximum players'),
      }
    },
  },
  join_fill_court: {
    rateLimit: { limit: 20, windowMs: 10 * 60 * 1000, scope: 'user' },
    sanitizePayload(payload) {
      return {
        p_court_id: normalizeUuid(payload.p_court_id, 'Court'),
      }
    },
  },
}

function applyRateLimit(request, profile, functionName, config) {
  if (!config.rateLimit) {
    return null
  }

  const clientAddress = getClientAddress(request)
  const scopeParts = [functionName]

  if (config.rateLimit.scope.includes('user')) {
    scopeParts.push(profile.id)
  }

  if (config.rateLimit.scope.includes('ip')) {
    scopeParts.push(clientAddress)
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

    if (config.adminOnly && profile.role !== 'officer') {
      return json({ error: 'Officer access is required.' }, 403)
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

import { fileURLToPath } from 'node:url'
import path from 'node:path'

const outputFileTracingRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

const nextConfig = {
  outputFileTracingRoot,
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
  },
}

export default nextConfig

import { createClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database'

/**
 * Create a Supabase admin client with service role key.
 * Use this for server-side operations that need to bypass RLS.
 */
export function useSupabaseAdmin() {
  const config = useRuntimeConfig()

  return createClient<Database>(
    process.env.SUPABASE_URL || '',
    config.supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}

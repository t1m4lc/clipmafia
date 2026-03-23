import { serverSupabaseUser } from '#supabase/server'

/**
 * GET /api/profile
 * Get the current user's profile with quota info.
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const supabase = useSupabaseAdmin()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    throw createError({ statusCode: 404, message: 'Profile not found' })
  }

  return profile
})

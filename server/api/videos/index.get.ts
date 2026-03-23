import { serverSupabaseUser } from '#supabase/server'

/**
 * GET /api/videos
 * List all videos for the authenticated user.
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const supabase = useSupabaseAdmin()

  const { data: videos, error } = await supabase
    .from('videos')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    throw createError({ statusCode: 500, message: 'Failed to fetch videos' })
  }

  return videos
})

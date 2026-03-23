import { serverSupabaseUser } from '#supabase/server'

/**
 * GET /api/shorts?videoId=xxx
 * List shorts for a specific video.
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const query = getQuery(event)
  const videoId = query.videoId as string

  const supabase = useSupabaseAdmin()

  let queryBuilder = supabase
    .from('shorts')
    .select('*')
    .eq('user_id', user.id)
    .order('score', { ascending: false })

  if (videoId) {
    queryBuilder = queryBuilder.eq('video_id', videoId)
  }

  const { data: shorts, error } = await queryBuilder

  if (error) {
    throw createError({ statusCode: 500, message: 'Failed to fetch shorts' })
  }

  return shorts
})

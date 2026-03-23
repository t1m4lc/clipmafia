import { serverSupabaseUser } from '#supabase/server'

/**
 * GET /api/jobs/[id]
 * Get job status by ID.
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const jobId = getRouterParam(event, 'id')
  if (!jobId) {
    throw createError({ statusCode: 400, message: 'Job ID is required' })
  }

  const supabase = useSupabaseAdmin()

  const { data: job, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .single()

  if (error || !job) {
    throw createError({ statusCode: 404, message: 'Job not found' })
  }

  return job
})

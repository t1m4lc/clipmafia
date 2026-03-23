import type { Database } from '~/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']

/**
 * Composable for user profile management.
 */
export function useProfile() {
  const supabase = useSupabaseClient<Database>()
  const user = useSupabaseUser()

  const profile = ref<Profile | null>(null)
  const loading = ref(false)

  /**
   * Fetch the current user's profile.
   */
  async function fetchProfile() {
    if (!user.value) return null

    loading.value = true
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.value.id)
        .single()

      if (error) throw error
      profile.value = data
      return data
    } catch (e) {
      console.error('Failed to fetch profile:', e)
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Check if user can process more videos this month.
   */
  function canProcessVideo(): boolean {
    if (!profile.value) return false
    return profile.value.videos_processed_this_month < profile.value.monthly_video_limit
  }

  /**
   * Get remaining video quota.
   */
  function remainingQuota(): number {
    if (!profile.value) return 0
    return Math.max(0, profile.value.monthly_video_limit - profile.value.videos_processed_this_month)
  }

  return {
    profile,
    loading,
    fetchProfile,
    canProcessVideo,
    remainingQuota,
  }
}

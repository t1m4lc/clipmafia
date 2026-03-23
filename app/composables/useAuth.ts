import type { Database } from '~/types/database'

/**
 * Composable for authentication state and actions.
 */
export function useAuth() {
  const supabase = useSupabaseClient<Database>()
  const user = useSupabaseUser()

  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Sign up with email and password.
   */
  async function signUp(email: string, password: string, fullName?: string) {
    loading.value = true
    error.value = null

    try {
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (authError) throw authError
      await navigateTo('/dashboard')
    } catch (e: any) {
      error.value = e.message || 'Failed to sign up'
    } finally {
      loading.value = false
    }
  }

  /**
   * Sign in with email and password.
   */
  async function signIn(email: string, password: string) {
    loading.value = true
    error.value = null

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) throw authError
      await navigateTo('/dashboard')
    } catch (e: any) {
      error.value = e.message || 'Failed to sign in'
    } finally {
      loading.value = false
    }
  }

  /**
   * Sign out.
   */
  async function signOut() {
    await supabase.auth.signOut()
    await navigateTo('/')
  }

  return {
    user,
    loading,
    error,
    signUp,
    signIn,
    signOut,
  }
}

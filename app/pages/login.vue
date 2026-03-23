<script setup lang="ts">
definePageMeta({
  layout: 'auth',
})

const { signIn, loading, error } = useAuth()

const email = ref('')
const password = ref('')

async function handleSubmit() {
  await signIn(email.value, password.value)
}
</script>

<template>
  <div class="space-y-6">
    <div class="text-center space-y-2">
      <NuxtLink to="/" class="inline-flex items-center gap-2 font-bold text-2xl">
        <span class="text-3xl">🎬</span>
        <span class="bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">ClipMafia</span>
      </NuxtLink>
      <h1 class="text-2xl font-bold">Welcome back</h1>
      <p class="text-muted-foreground">Sign in to your account</p>
    </div>

    <Card>
      <CardContent class="pt-6">
        <form class="space-y-4" @submit.prevent="handleSubmit">
          <div class="space-y-2">
            <Label for="email">Email</Label>
            <Input
              id="email"
              v-model="email"
              type="email"
              placeholder="you@example.com"
              required
            />
          </div>

          <div class="space-y-2">
            <Label for="password">Password</Label>
            <Input
              id="password"
              v-model="password"
              type="password"
              placeholder="••••••••"
              required
            />
          </div>

          <div v-if="error" class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {{ error }}
          </div>

          <Button type="submit" class="w-full" :disabled="loading">
            {{ loading ? 'Signing in...' : 'Sign in' }}
          </Button>
        </form>
      </CardContent>
      <CardFooter class="justify-center">
        <p class="text-sm text-muted-foreground">
          Don't have an account?
          <NuxtLink to="/register" class="text-primary hover:underline">Sign up</NuxtLink>
        </p>
      </CardFooter>
    </Card>
  </div>
</template>

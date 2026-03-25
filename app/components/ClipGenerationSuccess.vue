<script setup lang="ts">
import { PartyPopper, Share2, X } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  clipCount: number
  videoTitle: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { profile } = useProfile()

const hasShared = ref(false)
const claiming = ref(false)

const referralCode = computed(() => profile.value?.referral_code || '')

const shareText = computed(() => {
  return `I just generated ${props.clipCount} viral clips automatically using Clip Mafia 🚀\n\nPaste any YouTube link and get timestamped highlights in seconds — completely free!\n\nhttps://clipmafia.com?ref=${referralCode.value}`
})

const twitterShareUrl = computed(() => {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText.value)}`
})

async function handleShare() {
  // Open Twitter share intent
  window.open(twitterShareUrl.value, '_blank', 'width=550,height=420')
  hasShared.value = true

  // Claim the referral credit
  claiming.value = true
  try {
    await $fetch('/api/referrals/claim', {
      method: 'POST',
      body: { platform: 'twitter' },
    })
  } catch {
    // Best-effort — don't block the user
  } finally {
    claiming.value = false
  }
}

function close() {
  emit('update:open', false)
}

// Fire confetti when dialog opens
watch(() => props.open, async (isOpen) => {
  if (!isOpen || !import.meta.client) return

  const confetti = (await import('canvas-confetti')).default
  
  // Two bursts for a dramatic effect
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6, x: 0.3 },
    colors: ['#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e'],
  })
  setTimeout(() => {
    confetti({
      particleCount: 60,
      spread: 80,
      origin: { y: 0.6, x: 0.7 },
      colors: ['#6366f1', '#8b5cf6', '#a855f7', '#22c55e', '#eab308'],
    })
  }, 200)
})
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <div class="relative space-y-6 text-center p-2">
      <!-- Close button -->
      <button
        class="absolute -top-1 -right-1 p-1 rounded-full hover:bg-muted cursor-pointer"
        @click="close"
      >
        <X class="size-4 text-muted-foreground" />
      </button>

      <!-- Icon -->
      <div class="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
        <PartyPopper class="size-8 text-primary" />
      </div>

      <!-- Title -->
      <div class="space-y-2">
        <h2 class="text-2xl font-bold">Your clips are ready 🚀</h2>
        <p class="text-muted-foreground">
          We found <strong class="text-foreground">{{ clipCount }}</strong> viral moments
          in "{{ videoTitle }}"
        </p>
      </div>

      <!-- Share CTA -->
      <div class="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-5 space-y-3">
        <p class="text-sm font-semibold">
          🎁 Get 1 free upload credit
        </p>
        <p class="text-xs text-muted-foreground">
          Share Clip Mafia on Twitter and unlock a free file upload — no subscription needed.
        </p>
        <Button
          class="w-full gap-2"
          :disabled="claiming"
          @click="handleShare"
        >
          <Share2 class="size-4" />
          {{ hasShared ? '✓ Shared — Credit Granted!' : 'Share on Twitter' }}
        </Button>
      </div>

      <!-- Skip -->
      <button
        class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        @click="close"
      >
        Skip for now
      </button>
    </div>
  </Dialog>
</template>

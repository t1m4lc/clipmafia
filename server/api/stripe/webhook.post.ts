import Stripe from 'stripe'

/**
 * POST /api/stripe/webhook
 * Handles Stripe webhook events for subscription management.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const stripe = useStripe()
  const supabase = useSupabaseAdmin()

  // Get raw body for signature verification
  const body = await readRawBody(event)
  const signature = getHeader(event, 'stripe-signature')

  if (!body || !signature) {
    throw createError({ statusCode: 400, message: 'Missing body or signature' })
  }

  let stripeEvent: Stripe.Event

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      body,
      signature,
      config.stripeWebhookSecret,
    )
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    throw createError({ statusCode: 400, message: `Webhook Error: ${err.message}` })
  }

  // Handle events
  switch (stripeEvent.type) {
    case 'checkout.session.completed': {
      const session = stripeEvent.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.supabase_user_id
      const plan = session.metadata?.plan as 'basic' | 'pro'

      if (userId && plan) {
        const limits: Record<string, number> = {
          basic: 20,
          pro: 100,
        }

        await supabase
          .from('profiles')
          .update({
            subscription_id: session.subscription as string,
            subscription_status: 'active',
            subscription_plan: plan,
            monthly_video_limit: limits[plan] || 20,
            billing_cycle_start: new Date().toISOString(),
          })
          .eq('id', userId)
      }
      break
    }

    case 'customer.subscription.updated': {
      const subscription = stripeEvent.data.object as Stripe.Subscription

      // Find profile by stripe customer id
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', subscription.customer as string)
        .single()

      if (profile) {
        await supabase
          .from('profiles')
          .update({
            subscription_status: subscription.status === 'active' ? 'active' : subscription.status as any,
          })
          .eq('id', profile.id)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = stripeEvent.data.object as Stripe.Subscription

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', subscription.customer as string)
        .single()

      if (profile) {
        await supabase
          .from('profiles')
          .update({
            subscription_status: 'canceled',
            subscription_plan: 'free',
            monthly_video_limit: 3,
          })
          .eq('id', profile.id)
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = stripeEvent.data.object as Stripe.Invoice

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', invoice.customer as string)
        .single()

      if (profile) {
        await supabase
          .from('profiles')
          .update({
            subscription_status: 'past_due',
          })
          .eq('id', profile.id)
      }
      break
    }
  }

  return { received: true }
})

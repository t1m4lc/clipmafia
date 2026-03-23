import Stripe from 'stripe'

let stripeInstance: Stripe | null = null

/**
 * Get a singleton Stripe instance configured with the secret key.
 */
export function useStripe(): Stripe {
  if (!stripeInstance) {
    const config = useRuntimeConfig()
    stripeInstance = new Stripe(config.stripeSecretKey, {
      apiVersion: '2024-12-18.acacia',
    })
  }
  return stripeInstance
}

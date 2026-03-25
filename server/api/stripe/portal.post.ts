
/**
 * POST /api/stripe/portal
 * Creates a Stripe Customer Portal session for managing subscription.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);

  const config = useRuntimeConfig();
  const stripe = useStripe();
  const supabase = useSupabaseAdmin();

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    throw createError({ statusCode: 400, message: "No subscription found" });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${config.public.appUrl}/dashboard`,
  });

  return { url: session.url };
});

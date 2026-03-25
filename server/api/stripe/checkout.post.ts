
/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout session for subscription.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);

  const body = await readBody(event);
  const { plan } = body;

  if (!["pro", "business"].includes(plan)) {
    throw createError({ statusCode: 400, message: "Invalid plan" });
  }

  const config = useRuntimeConfig();
  const stripe = useStripe();
  const supabase = useSupabaseAdmin();

  // Get or create Stripe customer
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", user.id)
    .single();

  let customerId = profile?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email || user.email,
      metadata: {
        supabase_user_id: user.id,
      },
    });
    customerId = customer.id;

    await supabase
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  // Get price ID based on plan
  const priceId =
    plan === "pro"
      ? config.public.stripePriceIdPro
      : config.public.stripePriceIdBusiness;

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${config.public.appUrl}/dashboard?subscription=success`,
    cancel_url: `${config.public.appUrl}/pricing?subscription=canceled`,
    metadata: {
      supabase_user_id: user.id,
      plan,
    },
  });

  return { url: session.url };
});

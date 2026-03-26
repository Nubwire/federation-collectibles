import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export default async (request) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const items = JSON.parse(session.metadata.items);

    for (const item of items) {
      await supabase.rpc('reserve_product', {
        p_sku: item.sku,
        p_qty: item.quantity
      });
    }

    await supabase.from('orders').insert({
      stripe_session_id: session.id,
      customer_email: session.customer_details.email,
      amount_total: session.amount_total / 100,
      currency: session.currency,
      status: 'paid',
      items: items
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const config = { path: '/.netlify/functions/stripe-webhook' };

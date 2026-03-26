import Stripe from 'stripe';

export default async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const { items } = await request.json();

  const orderTotal = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const freeShipping = orderTotal >= 150;

  const line_items = items.map(item => ({
    price_data: {
      currency: 'usd',
      product_data: {
        name: item.name,
        metadata: { sku: item.sku }
      },
      unit_amount: Math.round(item.price * 100),
    },
    quantity: item.quantity,
  }));

  const shippingOptions = freeShipping
    ? [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 0, currency: 'usd' },
            display_name: 'Free Shipping',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 5 },
              maximum: { unit: 'business_day', value: 14 },
            },
          },
        },
      ]
    : [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 1100, currency: 'usd' },
            display_name: 'Australia — Insured Shipping',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 3 },
              maximum: { unit: 'business_day', value: 7 },
            },
          },
        },
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 1400, currency: 'usd' },
            display_name: 'New Zealand — Insured Shipping',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 5 },
              maximum: { unit: 'business_day', value: 10 },
            },
          },
        },
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 2300, currency: 'usd' },
            display_name: 'International — Insured Shipping',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 7 },
              maximum: { unit: 'business_day', value: 21 },
            },
          },
        },
      ];

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items,
    mode: 'payment',
    allow_promotion_codes: true,
    shipping_address_collection: {
      allowed_countries: ['AU', 'NZ', 'US', 'GB', 'CA', 'DE', 'FR', 'JP', 'SG', 'HK', 'NL', 'IT', 'ES', 'CH', 'SE', 'NO', 'DK', 'FI', 'BE', 'AT', 'IE', 'PT', 'NZ'],
    },
    shipping_options: shippingOptions,
    success_url: 'https://federationcollectibles.com/?order=success',
    cancel_url: 'https://federationcollectibles.com/?order=cancelled',
    metadata: {
      items: JSON.stringify(items.map(i => ({ sku: i.sku, quantity: i.quantity })))
    }
  });

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const config = { path: '/.netlify/functions/create-checkout' };

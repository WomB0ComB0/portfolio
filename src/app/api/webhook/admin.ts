import type Stripe from 'stripe';
import { stripe } from '@/utils/stripe';
const upsertProductRecord = async (product: Stripe.Product) => {
  // Here you would typically update your database with the product information
  console.log(`Product ${product.id} ${product.active ? 'activated' : 'deactivated'}: ${product.name}`);
};

const upsertPriceRecord = async (price: Stripe.Price) => {
  // Here you would typically update your database with the price information
  console.log(`Price ${price.id} for product ${price.product}: ${price.unit_amount} ${price.currency}`);
};

const deleteProductRecord = async (product: Stripe.Product) => {
  // Here you would typically delete the product from your database
  console.log(`Product deleted: ${product.id}`);
};

const deletePriceRecord = async (price: Stripe.Price) => {
  // Here you would typically delete the price from your database
  console.log(`Price deleted: ${price.id}`);
};

const createOrRetrieveCustomer = async ({ email, uuid }: { email: string; uuid: string }) => {
  // Here you would typically check if the customer exists in your database
  // If not, create a new customer in Stripe and save the info in your database
  const customerData = { metadata: { uuid }, email };
  const customer = await stripe.customers.create(customerData);
  console.log(`Customer created or retrieved: ${customer.id}`);
  return customer.id;
};

const manageSubscriptionStatusChange = async (
  subscriptionId: string,
  customerId: string,
  createAction = false
) => {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['default_payment_method'],
  });

  // Here you would typically update your database with the subscription information
  console.log(`Subscription ${subscription.id} for customer ${customerId} is ${subscription.status}`);

  if (createAction && subscription.default_payment_method) {
    await copyBillingDetailsToCustomer(customerId, subscription.default_payment_method as Stripe.PaymentMethod);
  }
};

const copyBillingDetailsToCustomer = async (customerId: string, paymentMethod: Stripe.PaymentMethod) => {
  const { name, phone, address } = paymentMethod.billing_details;
  if (!name || !phone || !address) return;

  await stripe.customers.update(customerId, {
    name,
    phone,
    address: {
      city: address.city || undefined,
      country: address.country || undefined,
      line1: address.line1 || undefined,
      line2: address.line2 || undefined,
      postal_code: address.postal_code || undefined,
      state: address.state || undefined,
    },
  });
  console.log(`Updated billing details for customer ${customerId}`);
};

export {
  upsertProductRecord,
  upsertPriceRecord,
  deleteProductRecord,
  deletePriceRecord,
  createOrRetrieveCustomer,
  manageSubscriptionStatusChange,
};

import { createPaymentLink } from "./stitchClient.js";

export async function startPayment(paymentIntent) {
  if (!paymentIntent?.amount) {
    throw new Error("paymentIntent.amount is required");
  }

  const amountCents = Math.round(Number(paymentIntent.amount) * 100);
  if (!Number.isFinite(amountCents) || amountCents < 500) {
    throw new Error("amount must be at least 500 cents (R5.00)");
  }

  // Create a Stitch payment link for this intent
  const response = await createPaymentLink({
    amount: amountCents,
    merchantReference: paymentIntent.id,
    payerName: paymentIntent?.description || "QR Checkout payer",
    payerEmailAddress: paymentIntent?.payerEmailAddress,
    payerPhoneNumber: paymentIntent?.payerPhoneNumber,
    description: paymentIntent?.description,
  });

  return response;
}


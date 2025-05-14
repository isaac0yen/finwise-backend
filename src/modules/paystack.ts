import axios from 'axios';

const PAYSTACK_API_KEY = process.env.PAYSTACK_API_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

if (!PAYSTACK_API_KEY) {
  throw new Error('PAYSTACK_API_KEY is not set in environment variables');
}

const paystackHeaders = {
  Authorization: `Bearer ${PAYSTACK_API_KEY}`,
  'Content-Type': 'application/json',
};

export async function initializeTransaction(email: string, amount: number, metadata: Record<string, any> = {}) {
  const response = await axios.post(
    `${PAYSTACK_BASE_URL}/transaction/initialize`,
    {
      email,
      amount: Math.round(amount * 100), // Paystack expects amount in kobo
      metadata,
    },
    { headers: paystackHeaders }
  );
  return response.data;
}

export async function verifyTransaction(reference: string) {
  const response = await axios.get(
    `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
    { headers: paystackHeaders }
  );
  return response.data;
}

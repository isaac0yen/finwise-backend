import axios from 'axios';

const PAYSTACK_API_KEY = process.env.PAYSTACK_API_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

if (!PAYSTACK_API_KEY && process.env.MOCK_PAYSTACK !== 'true') { // Only throw if not in mock mode and key is missing
  throw new Error('PAYSTACK_API_KEY is not set in environment variables and MOCK_PAYSTACK is not true');
}

const paystackHeaders = {
  Authorization: `Bearer ${PAYSTACK_API_KEY}`,
  'Content-Type': 'application/json',
};

export async function initializeTransaction(email: string, amount: number, metadata: Record<string, any> = {}) {
  if (process.env.MOCK_PAYSTACK === 'true') {
    const mockReference = `test_ref_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    console.log(`[MOCK PAYSTACK] Initializing transaction with mock reference: ${mockReference}`);
    return {
      status: true,
      message: "Transaction authorization successfully created (Mocked)",
      data: {
        authorization_url: "https://mock-paystack.url/pay/test-auth-code",
        access_code: "test-access-code_" + Date.now(),
        reference: mockReference
      }
    };
  }
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
  if (process.env.MOCK_PAYSTACK === 'true') {
    console.log(`[MOCK PAYSTACK] Verifying transaction with mock reference: ${reference}`);
    // In mock mode, assume any reference starting with 'test_ref_' is successful
    // The depositController uses deposit.amount, so the mocked amount here is illustrative
    const mockAmountInKobo = 10000; // Example, can be dynamic if needed based on reference pattern
    return {
      status: true, // Outer API call status
      message: "Verification successful (Mocked)",
      data: {
        status: "success", // Actual transaction status
        reference: reference, // Echo back the reference
        amount: mockAmountInKobo,
        currency: "NGN",
        transaction_date: new Date().toISOString(),
        // Add other fields your application might expect from a real Paystack verification
      }
    };
  }
  const response = await axios.get(
    `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
    { headers: paystackHeaders }
  );
  return response.data;
}

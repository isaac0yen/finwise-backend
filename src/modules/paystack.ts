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

/**
 * Resolves/verifies a bank account by account number and bank code
 * @param account_number The account number to verify
 * @param bank_code The bank code (from Paystack)
 * @returns Response with account details if valid
 */
export async function resolveAccount(account_number: string, bank_code: string) {
  if (process.env.MOCK_PAYSTACK === 'true') {
    console.log(`[MOCK PAYSTACK] Resolving account: ${account_number} with bank code: ${bank_code}`);
    const mockData = {
      account_number,
      account_name: 'John Doe ' + account_number.substring(0, 3),
      bank_id: bank_code
    };
    
    return {
      status: true,
      message: "Account resolved successfully (Mocked)",
      data: mockData
    };
  }
  
  try {
    const response = await axios.get(
      `${PAYSTACK_BASE_URL}/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`,
      { headers: paystackHeaders }
    );
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.data) {
      return error.response.data; // Return Paystack's error response
    }
    throw error; // Re-throw if it's a different kind of error
  }
}

/**
 * Fetches the list of banks supported by Paystack
 * @returns List of banks with their codes and names
 */
export async function getBanks() {
  if (process.env.MOCK_PAYSTACK === 'true') {
    console.log(`[MOCK PAYSTACK] Fetching bank list`);
    // Return some mock banks
    return {
      status: true,
      message: "Banks retrieved successfully (Mocked)",
      data: [
        { id: 1, name: 'Access Bank', code: '044', active: true },
        { id: 2, name: 'Guaranty Trust Bank', code: '058', active: true },
        { id: 3, name: 'First Bank of Nigeria', code: '011', active: true },
        { id: 4, name: 'United Bank for Africa', code: '033', active: true },
        { id: 5, name: 'Zenith Bank', code: '057', active: true },
        { id: 6, name: 'Fidelity Bank', code: '070', active: true },
        { id: 7, name: 'Ecobank Nigeria', code: '050', active: true },
        { id: 8, name: 'Stanbic IBTC Bank', code: '221', active: true },
        { id: 9, name: 'Sterling Bank', code: '232', active: true },
        { id: 10, name: 'Union Bank of Nigeria', code: '032', active: true },
      ]
    };
  }
  
  const response = await axios.get(
    `${PAYSTACK_BASE_URL}/bank`,
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

const axios = require('axios');
const fs = require('fs').promises;

// --- Configuration ---
const API_BASE_URL = 'http://localhost:3000/api'; // Adjust port if needed
const USER_SIGNUP_DATA = {
    nin: "96067494361",
    email: "isaacoyeniyi06@gmail.com" // Use a unique email for each test run or clean DB
};
const USER_PASSWORD = "TestPassword123!";
const DEPOSIT_AMOUNT = 1000; // Deposit 50,000 NGN
const WITHDRAWAL_DATA = {
    amount: "100.00", // Must be a string for validator, will be parsed to float
    currency: "NGN",
    bank_name: "Test Bank Plc",
    account_number: "0123456789",
    account_name: "Isaac Oyeniyi Test"
};

let authToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJpc2FhY295ZW5peWkwNkBnbWFpbC5jb20iLCJmaXJzdF9uYW1lIjoiSVNBQUMiLCJsYXN0X25hbWUiOiJPWUVOSVlJIiwiaWF0IjoxNzQ3MjM1MDQzLCJleHAiOjE3NDczMjE0NDN9.XgSXfFTBKmZXTSt7eWqsmajPw__8AFnFgHiuBU2dltg"; // Global variable for auth token
const results = {}; // To store results

// --- Helper Functions ---
const logStep = (stepName, data) => {
    console.log(`\n--- ${stepName} ---`);
    if (data) {
        console.log(JSON.stringify(data, null, 2));
    }
    results[stepName] = data || 'Completed';
};

const saveResults = async () => {
    try {
        await fs.writeFile('test_results.json', JSON.stringify(results, null, 2));
        console.log('\n--- Test results saved to test_results.json ---');
    } catch (error) {
        console.error('Error saving results:', error.message);
    }
};

// --- API Call Functions ---
async function signUpUser() {
    logStep('1. Signing Up User');
    try {
        const response = await axios.post(`${API_BASE_URL}/auth/sign-up`, USER_SIGNUP_DATA);
        logStep('1. Sign Up Response', response.data);
        if (response.data.status && response.data.token) {
            authToken = response.data.token;
            results.signup_token = authToken;
            console.log('Sign up successful, token received.');
        } else {
            console.error('Sign up failed or token not in response:', response.data.message);
            throw new Error('Sign up failed');
        }
    } catch (error) {
        console.error('Sign Up Error:', error.response ? error.response.data : error.message);
        results['1. Sign Up Error'] = error.response ? error.response.data : error.message;
        console.log(error)

        throw error; // Stop execution if sign up fails
    }
}

async function setPassword() {
    if (!authToken) {
        console.error('Cannot set password, no auth token from sign up.');
        results['2. Set Password Error'] = 'No auth token from sign up';
        throw new Error('No auth token for setPassword');
    }
    logStep('2. Setting Password');
    try {
        const response = await axios.post(`${API_BASE_URL}/auth/set-password`, 
            { password: USER_PASSWORD }, 
            { headers: { Authorization: `Bearer ${authToken}` } }
        );
        logStep('2. Set Password Response', response.data);
        if (!response.data.status) {
            console.error('Set password failed:', response.data.message);
            throw new Error('Set password failed');
        }
        console.log('Password set successfully.');
    } catch (error) {
        console.error('Set Password Error:', error.response ? error.response.data : error.message);
        results['2. Set Password Error'] = error.response ? error.response.data : error.message;
        throw error;
    }
}

async function loginUser() {
    logStep('3. Logging In User');
    try {
        const response = await axios.post(`${API_BASE_URL}/auth/login`, {
            email: USER_SIGNUP_DATA.email,
            password: USER_PASSWORD
        });
        logStep('3. Login Response', response.data);
        if (response.data.status && response.data.access_token) {
            authToken = response.data.access_token;
            results.login_token = authToken;
            console.log('Login successful, new token received.');
        } else {
            console.error('Login failed or token not in response:', response.data.message);
            throw new Error('Login failed');
        }
    } catch (error) {
        console.error('Login Error:', error.response ? error.response.data : error.message);
        results['3. Login Error'] = error.response ? error.response.data : error.message;
        throw error;
    }
}

async function initializeDeposit(currentAuthToken, amount) {
    if (!currentAuthToken) {
        console.error('Cannot initialize deposit, no auth token.');
        results['4. Initialize Deposit Error'] = 'No auth token';
        throw new Error('No auth token for initializeDeposit');
    }
    logStep('4. Initializing Deposit');
    try {
        const response = await axios.post(`${API_BASE_URL}/deposit/initialize`,
            { amount },
            { headers: { Authorization: `Bearer ${currentAuthToken}` } }
        );
        logStep('4. Initialize Deposit Response', response.data);
        if (!response.data.status || !response.data.reference) {
            console.error('Initialize deposit failed or reference not in response:', response.data.message);
            throw new Error('Initialize deposit failed');
        }
        console.log('Deposit initialized successfully, reference:', response.data.reference);
        return response.data.reference;
    } catch (error) {
        console.error('Initialize Deposit Error:', error.response ? error.response.data : error.message);
        results['4. Initialize Deposit Error'] = error.response ? error.response.data : error.message;
        throw error;
    }
}

async function verifyDeposit(currentAuthToken, reference) {
    if (!currentAuthToken) {
        console.error('Cannot verify deposit, no auth token.');
        results['5. Verify Deposit Error'] = 'No auth token';
        throw new Error('No auth token for verifyDeposit');
    }
    if (!reference) {
        console.error('Cannot verify deposit, no reference provided.');
        results['5. Verify Deposit Error'] = 'No reference provided';
        throw new Error('No reference for verifyDeposit');
    }
    logStep('5. Verifying Deposit');
    try {
        const response = await axios.get(`${API_BASE_URL}/deposit/verify/${reference}`,
            { headers: { Authorization: `Bearer ${currentAuthToken}` } }
        );
        logStep('5. Verify Deposit Response', response.data);
        if (!response.data.status) {
            console.error('Verify deposit failed:', response.data.message);
            throw new Error('Verify deposit failed');
        }
        console.log('Deposit verified successfully.');
    } catch (error) {
        console.error('Verify Deposit Error:', error.response ? error.response.data : error.message);
        results['5. Verify Deposit Error'] = error.response ? error.response.data : error.message;
        throw error;
    }
}

async function requestWithdrawal() {
    if (!authToken) {
        console.error('Cannot request withdrawal, no auth token.');
        results['6. Request Withdrawal Error'] = 'No auth token';
        throw new Error('No auth token for requestWithdrawal');
    }
    
    logStep('6. Requesting Withdrawal');
    try {
        const response = await axios.post(`${API_BASE_URL}/withdrawal/request`, 
            WITHDRAWAL_DATA, 
            { headers: { Authorization: `Bearer ${authToken}` } }
        );
        logStep('6. Request Withdrawal Response', response.data);
        if (!response.data.status) {
            console.error('Request withdrawal failed:', response.data.message);
            throw new Error('Request withdrawal failed');
        }
        console.log('Withdrawal requested successfully.');
    } catch (error) {
        console.error('Request Withdrawal Error:', error.response ? error.response.data : error.message);
        results['6. Request Withdrawal Error'] = error.response ? error.response.data : error.message;
        throw error;
    }
}

// --- Main Execution --- 
async function runTests() {
    console.log('Starting API Test Sequence...');
    try {
        const depositReference = await initializeDeposit(authToken, DEPOSIT_AMOUNT);
         //await verifyDeposit(authToken, "n5egkbt2au");
         //await requestWithdrawal();
        console.log('\n--- All tests completed successfully! ---');
    } catch (error) {
        console.error('\n--- Test sequence failed ---');
        // Error already logged in the respective function
    } finally {
        await saveResults();
    }
}

runTests();

import crypto from 'crypto';

// Your secret key
const secretKey = 'your-secret-key';

// Function to generate a signed key
function generateSignedKey(key: string) {
    return crypto.createHmac('sha256', secretKey).update(key).digest('hex');
}

// Example usage
const key = 'fakeKey123';
const signedKey = generateSignedKey(key);
console.log(`https://usesachi.com/start.js?key=${key}&signature=${signedKey}`);

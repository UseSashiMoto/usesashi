import crypto from "crypto"

// Your secret key

// Function to generate a signed key
export function generateSignedKey(key: string, secretKey: string) {
    console.log("generateSignedKey key", key, secretKey)
    return crypto.createHmac("sha256", secretKey).update(key).digest("hex")
}

export function validateSignedKey(
    key: string,
    signedKey: string,
    secretKey: string
) {
    console.log("validateSignedKey here key", key, signedKey, secretKey)
    console.log(
        "valid key?",
        generateSignedKey(key, secretKey),
        signedKey,
        generateSignedKey(key, secretKey) === signedKey
    )
    return generateSignedKey(key, secretKey) === signedKey
}

// Example usage
const key = "fakeKey123"
const secretKey = "your-secret"
const signedKey = generateSignedKey(key, secretKey)
console.log(`https://usesachi.com/start.js?key=${key}&signature=${signedKey}`)

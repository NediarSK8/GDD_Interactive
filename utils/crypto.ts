// A simple, non-cryptographically secure key.
// The purpose is obfuscation, as requested by the user.
const SECRET_KEY = 'Kael-is-the-key-to-stop-the-end-of-the-world-prophecy';

// Helper to convert string to Uint8Array
const textEncoder = new TextEncoder();
// Helper to convert Uint8Array to string
const textDecoder = new TextDecoder();

/**
 * Applies a simple XOR cipher to the data.
 * @param data The data to process.
 * @returns The processed data.
 */
const xorCipher = (data: Uint8Array): Uint8Array => {
    const keyBytes = textEncoder.encode(SECRET_KEY);
    const output = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
        output[i] = data[i] ^ keyBytes[i % keyBytes.length];
    }
    return output;
};

/**
 * Encrypts a JSON object into a Base64 string.
 * This function processes the data in chunks to avoid stack overflow errors
 * with large JSON objects (e.g., those containing base64 images).
 * @param data The object to encrypt.
 * @returns An encrypted Base64 string.
 */
export function encryptData(data: object): string {
    const jsonString = JSON.stringify(data);
    const dataBytes = textEncoder.encode(jsonString);
    const encryptedBytes = xorCipher(dataBytes);

    // Convert bytes to a binary string in chunks to avoid "Maximum call stack size exceeded"
    const CHUNK_SIZE = 8192; // A safe chunk size for String.fromCharCode.apply
    let binaryString = '';
    for (let i = 0; i < encryptedBytes.length; i += CHUNK_SIZE) {
        const chunk = encryptedBytes.subarray(i, i + CHUNK_SIZE);
        // Using `apply` is significantly faster than a loop of `fromCharCode` calls.
        // The `as any` is used because the type signature expects number[], but Uint8Array works.
        binaryString += String.fromCharCode.apply(null, chunk as any);
    }
    
    return btoa(binaryString);
}

/**
 * Decrypts a Base64 string back into a JSON object.
 * @param encryptedBase64 The encrypted Base64 string.
 * @returns The decrypted object.
 * @throws If decryption or parsing fails.
 */
export function decryptData(encryptedBase64: string): any {
    // Convert base64 to string of chars, then to bytes
    const encryptedString = atob(encryptedBase64);
    const encryptedBytes = new Uint8Array(encryptedString.length).map((_, i) => encryptedString.charCodeAt(i));
    const decryptedBytes = xorCipher(encryptedBytes);
    const jsonString = textDecoder.decode(decryptedBytes);
    return JSON.parse(jsonString);
}

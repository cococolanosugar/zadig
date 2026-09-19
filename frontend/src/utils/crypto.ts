import forge from 'node-forge';

/**
 * Generate a random alphanumeric string for AES key.
 * 32 characters corresponds to 32 bytes (256-bit AES key).
 */
export function generateAesKey(length = 32): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const randomValues = new Uint8Array(length);
    window.crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
      result += chars[randomValues[i] % chars.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return result;
}

/**
 * Encrypt a text (such as an AES key) using RSA public key with PKCS#1 v1.5 padding,
 * and return URL-encoded Base64 string matching Zadig backend's url.QueryUnescape and base64.StdEncoding.
 */
export function rsaEncrypt(plainText: string, publicKeyPem: string): string {
  if (!publicKeyPem) {
    throw new Error('RSA public key is required');
  }

  const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
  const buffer = forge.util.createBuffer(plainText, 'utf8');
  const encryptedBytes = publicKey.encrypt(buffer.getBytes(), 'RSAES-PKCS1-V1_5');
  const b64Encoded = forge.util.encode64(encryptedBytes);
  return encodeURIComponent(b64Encoded);
}

/**
 * Encrypt a plaintext string using AES-CFB with a 16-byte random IV.
 * The output matches Go's crypto.AesEncrypt:
 * [16 bytes IV] + [CFB ciphertext] encoded as a Hex string.
 */
export function aesEncrypt(plainText: string, aesKey: string): string {
  if (!aesKey) {
    throw new Error('AES key is required');
  }

  // Generate 16 bytes random IV
  const ivBytes = forge.random.getBytesSync(16);

  const cipher = forge.cipher.createCipher('AES-CFB', aesKey);
  cipher.start({ iv: ivBytes });
  cipher.update(forge.util.createBuffer(plainText, 'utf8'));
  cipher.finish();

  // Combine IV (16 bytes) + ciphertext bytes
  const combinedBuffer = forge.util.createBuffer();
  combinedBuffer.putBytes(ivBytes);
  combinedBuffer.putBytes(cipher.output.getBytes());

  return combinedBuffer.toHex();
}

/**
 * Decrypt a Hex string produced by Go's crypto.AesEncrypt or frontend aesEncrypt.
 * First 16 bytes is IV, followed by CFB ciphertext.
 */
export function aesDecrypt(encryptedHex: string, aesKey: string): string {
  if (!aesKey) {
    throw new Error('AES key is required');
  }

  const rawBytes = forge.util.hexToBytes(encryptedHex);
  if (rawBytes.length < 16) {
    throw new Error('Encrypted hex data too short (must contain at least 16-byte IV)');
  }

  const ivBytes = rawBytes.slice(0, 16);
  const cipherBytes = rawBytes.slice(16);

  const decipher = forge.cipher.createDecipher('AES-CFB', aesKey);
  decipher.start({ iv: ivBytes });
  decipher.update(forge.util.createBuffer(cipherBytes));
  decipher.finish();

  return decipher.output.toString();
}

export interface EncryptedLoginPayload {
  account: string;
  password: string; // Hex-encoded [IV + CFB ciphertext]
  encrypted_key: string; // URL-encoded Base64-encoded RSA-encrypted AES key
  captcha_id?: string;
  captcha_answer?: string;
}

/**
 * Build the encrypted envelope credentials for Zadig /api/v1/login.
 */
export function buildEncryptedLoginPayload(
  account: string,
  passwordPlain: string,
  publicKeyPem: string,
  captcha?: { id: string; answer: string }
): EncryptedLoginPayload {
  const aesKey = generateAesKey(32);
  const encrypted_key = rsaEncrypt(aesKey, publicKeyPem);
  const password = aesEncrypt(passwordPlain, aesKey);

  const payload: EncryptedLoginPayload = {
    account,
    password,
    encrypted_key,
  };

  if (captcha?.id && captcha?.answer) {
    payload.captcha_id = captcha.id;
    payload.captcha_answer = captcha.answer;
  }

  return payload;
}

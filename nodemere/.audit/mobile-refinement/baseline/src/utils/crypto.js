// src/utils/crypto.js

// Function to convert a Uint8Array to a hex string
export function uint8ArrayToHex(arrayBuffer) {
  return Array.from(new Uint8Array(arrayBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Function to convert a hex string to a Uint8Array
export function hexToUint8Array(hexString) {
  return new Uint8Array(hexString.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
}

// Function to derive a key from a PIN using PBKDF2
export async function deriveKeyFromPin(pin, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// Function to encrypt data using AES-GCM
export async function encrypt(data, key) {
  const encoder = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  // The salt for PBKDF2 is handled in deriveKeyFromPin, not needed here for AES-GCM itself
  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    encoder.encode(data)
  );
  return {
    ciphertext: new Uint8Array(ciphertext),
    iv,
  };
}

// Function to decrypt data using AES-GCM
export async function decrypt(encryptedData, key) {
  const decoder = new TextDecoder();
  // Ensure ciphertext and iv are Uint8Arrays
  const ciphertext = new Uint8Array(encryptedData.ciphertext);
  const iv = new Uint8Array(encryptedData.iv);

  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    ciphertext
  );
  return decoder.decode(decrypted);
}


// Function to get a SHA-256 hash of a PIN
export async function getPinHash(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hash = await window.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const hex = process.env.WALLET_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "WALLET_ENCRYPTION_KEY must be a 32-byte hex string (64 chars)"
    );
  }
  return Buffer.from(hex, "hex");
}

export function encryptMnemonic(mnemonic: string[]): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const plaintext = mnemonic.join(" ");
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // iv + tag + ciphertext, base64 encoded
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptMnemonic(encoded: string): string[] {
  const key = getEncryptionKey();
  const data = Buffer.from(encoded, "base64");

  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8").split(" ");
}

/**
 * Generate a custodial TON wallet.
 * Returns the wallet address and encrypted mnemonic for storage.
 */
export async function generateCustodialWallet(): Promise<{
  address: string;
  encryptedMnemonic: string;
}> {
  const { mnemonicNew, mnemonicToPrivateKey } = await import("@ton/crypto");
  const { WalletContractV4 } = await import("@ton/ton");

  const mnemonic = await mnemonicNew();
  const keyPair = await mnemonicToPrivateKey(mnemonic);

  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: keyPair.publicKey,
  });

  return {
    address: wallet.address.toString({ bounceable: false }),
    encryptedMnemonic: encryptMnemonic(mnemonic),
  };
}

const crypto = require("crypto");

function getEncryptionKey() {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("FIELD_ENCRYPTION_KEY is required");
  }

  let key;
  try {
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
      key = Buffer.from(raw, "hex");
    } else {
      key = Buffer.from(raw, "base64");
    }
  } catch (error) {
    throw new Error("FIELD_ENCRYPTION_KEY format is invalid");
  }

  if (!key || key.length !== 32) {
    throw new Error("FIELD_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }

  return key;
}

function encryptField(plaintext) {
  if (plaintext === undefined || plaintext === null || plaintext === "") {
    return null;
  }
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    keyId: "v1",
  };
}

function decryptField(encrypted) {
  if (!encrypted || !encrypted.iv || !encrypted.tag || !encrypted.ciphertext) {
    return null;
  }

  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(encrypted.iv, "base64"));
  decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

function maskPhone(phone) {
  if (!phone) {
    return null;
  }
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length <= 2) {
    return "**";
  }
  return `******${digits.slice(-2)}`;
}

function maskAddress(address) {
  if (!address) {
    return null;
  }
  const text = String(address);
  if (text.length <= 6) {
    return "******";
  }
  return `${text.slice(0, 6)}******`;
}

module.exports = {
  encryptField,
  decryptField,
  maskPhone,
  maskAddress,
};

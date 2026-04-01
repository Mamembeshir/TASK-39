const sharp = require("sharp");

function detectMimeFromMagicBytes(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    return null;
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png";
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return "image/gif";
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

function createMediaProcessingService({ mediaEnableProcessing }) {
  return {
    maybeCompressImage: async (buffer, mimeType) => {
      if (!mediaEnableProcessing) {
        return buffer;
      }

      if (mimeType === "image/jpeg") {
        return sharp(buffer).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
      }
      if (mimeType === "image/png") {
        return sharp(buffer).png({ compressionLevel: 9 }).toBuffer();
      }
      if (mimeType === "image/webp") {
        return sharp(buffer).webp({ quality: 75 }).toBuffer();
      }
      return buffer;
    },
  };
}

module.exports = {
  createMediaProcessingService,
  detectMimeFromMagicBytes,
};

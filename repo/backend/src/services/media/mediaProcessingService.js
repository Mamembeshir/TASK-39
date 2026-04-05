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
  function normalizeCrop(crop) {
    if (!crop || typeof crop !== "object") {
      return null;
    }

    const x = Number(crop.x);
    const y = Number(crop.y);
    const width = Number(crop.width);
    const height = Number(crop.height);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
      return null;
    }
    if (width <= 0 || height <= 0 || x < 0 || y < 0) {
      return null;
    }

    return {
      left: Math.trunc(x),
      top: Math.trunc(y),
      width: Math.trunc(width),
      height: Math.trunc(height),
    };
  }

  return {
    maybeCompressImage: async (buffer, mimeType, crop) => {
      if (!mediaEnableProcessing) {
        return buffer;
      }

      const normalizedCrop = normalizeCrop(crop);
      let pipeline = sharp(buffer);
      if (normalizedCrop) {
        pipeline = pipeline.extract(normalizedCrop);
      }

      if (mimeType === "image/jpeg") {
        return pipeline.jpeg({ quality: 80, mozjpeg: true }).toBuffer();
      }
      if (mimeType === "image/png") {
        return pipeline.png({ compressionLevel: 9 }).toBuffer();
      }
      if (mimeType === "image/webp") {
        return pipeline.webp({ quality: 75 }).toBuffer();
      }
      return buffer;
    },
  };
}

module.exports = {
  createMediaProcessingService,
  detectMimeFromMagicBytes,
};

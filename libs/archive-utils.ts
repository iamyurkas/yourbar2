const CRC_TABLE = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      if (c & 1) {
        c = 0xedb88320 ^ (c >>> 1);
      } else {
        c >>>= 1;
      }
    }
    table.push(c >>> 0);
  }
  return table;
})();

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, current) => sum + current.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  arrays.forEach((array) => {
    result.set(array, offset);
    offset += array.length;
  });
  return result;
}

function encodeUtf8(input: string): Uint8Array {
  const normalized = encodeURIComponent(input);
  const bytes: number[] = [];
  for (let i = 0; i < normalized.length; i += 1) {
    if (normalized[i] === '%') {
      bytes.push(parseInt(normalized.substring(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(normalized.charCodeAt(i));
    }
  }
  return new Uint8Array(bytes);
}

function encodeBytesToBase64(bytes: Uint8Array): string {
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const byte1 = bytes[i];
    const byte2 = bytes[i + 1];
    const byte3 = bytes[i + 2];

    const hasByte2 = i + 1 < bytes.length;
    const hasByte3 = i + 2 < bytes.length;

    const combined = (byte1 << 16) | ((hasByte2 ? byte2 : 0) << 8) | (hasByte3 ? byte3 : 0);

    const char1 = (combined >> 18) & 63;
    const char2 = (combined >> 12) & 63;
    const char3 = (combined >> 6) & 63;
    const char4 = combined & 63;

    output += BASE64_ALPHABET[char1];
    output += BASE64_ALPHABET[char2];
    output += hasByte2 ? BASE64_ALPHABET[char3] : '=';
    output += hasByte3 ? BASE64_ALPHABET[char4] : '=';
  }
  return output;
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  const sanitized = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const paddingLength = sanitized.endsWith('==') ? 2 : sanitized.endsWith('=') ? 1 : 0;
  const outputLength = Math.floor((sanitized.length * 3) / 4) - paddingLength;
  const bytes = new Uint8Array(outputLength);

  let byteIndex = 0;
  for (let i = 0; i < sanitized.length; i += 4) {
    const chunk =
      (BASE64_ALPHABET.indexOf(sanitized[i]) << 18) |
      (BASE64_ALPHABET.indexOf(sanitized[i + 1]) << 12) |
      (BASE64_ALPHABET.indexOf(sanitized[i + 2]) << 6) |
      BASE64_ALPHABET.indexOf(sanitized[i + 3]);

    const byte1 = (chunk >> 16) & 0xff;
    const byte2 = (chunk >> 8) & 0xff;
    const byte3 = chunk & 0xff;

    if (byteIndex < outputLength) {
      bytes[byteIndex] = byte1;
      byteIndex += 1;
    }
    if (byteIndex < outputLength) {
      bytes[byteIndex] = byte2;
      byteIndex += 1;
    }
    if (byteIndex < outputLength) {
      bytes[byteIndex] = byte3;
      byteIndex += 1;
    }
  }

  return bytes;
}

export function createStoredZip(entries: { path: string; data: Uint8Array }[]): Uint8Array {
  const localRecords: Uint8Array[] = [];
  const centralRecords: Uint8Array[] = [];
  let offset = 0;

  entries.forEach((entry) => {
    const nameBytes = encodeUtf8(entry.path);
    const crc = crc32(entry.data);
    const compressedSize = entry.data.length;
    const uncompressedSize = entry.data.length;

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, compressedSize, true);
    localView.setUint32(22, uncompressedSize, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    const localRecord = concatUint8Arrays([localHeader, entry.data]);
    localRecords.push(localRecord);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, compressedSize, true);
    centralView.setUint32(24, uncompressedSize, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralRecords.push(centralHeader);
    offset += localRecord.length;
  });

  const centralDirectory = concatUint8Arrays(centralRecords);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  return concatUint8Arrays([...localRecords, centralDirectory, endRecord]);
}

export function zipBase64Files(files: { path: string; base64: string }[]): string {
  const entries = files.map((file) => ({
    path: file.path,
    data: decodeBase64ToBytes(file.base64),
  }));
  const zipBytes = createStoredZip(entries);
  return encodeBytesToBase64(zipBytes);
}

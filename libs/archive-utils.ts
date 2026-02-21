const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export const base64ToBytes = (base64: string) => {
  const cleaned = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const padding = cleaned.endsWith('==') ? 2 : cleaned.endsWith('=') ? 1 : 0;
  const byteLength = (cleaned.length * 3) / 4 - padding;
  const bytes = new Uint8Array(byteLength);
  let byteIndex = 0;

  for (let i = 0; i < cleaned.length; i += 4) {
    const enc1 = base64Chars.indexOf(cleaned[i]);
    const enc2 = base64Chars.indexOf(cleaned[i + 1]);
    const enc3 = base64Chars.indexOf(cleaned[i + 2]);
    const enc4 = base64Chars.indexOf(cleaned[i + 3]);

    const byte1 = (enc1 << 2) | (enc2 >> 4);
    const byte2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const byte3 = ((enc3 & 3) << 6) | enc4;

    bytes[byteIndex++] = byte1;
    if (cleaned[i + 2] !== '=') {
      bytes[byteIndex++] = byte2;
    }
    if (cleaned[i + 3] !== '=') {
      bytes[byteIndex++] = byte3;
    }
  }

  return bytes;
};

export const bytesToBase64 = (bytes: Uint8Array) => {
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 3) {
    const byte1 = bytes[i];
    const byte2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const byte3 = i + 2 < bytes.length ? bytes[i + 2] : 0;

    const enc1 = byte1 >> 2;
    const enc2 = ((byte1 & 3) << 4) | (byte2 >> 4);
    const enc3 = ((byte2 & 15) << 2) | (byte3 >> 6);
    const enc4 = byte3 & 63;

    if (i + 1 >= bytes.length) {
      chunks.push(`${base64Chars[enc1]}${base64Chars[enc2]}==`);
    } else if (i + 2 >= bytes.length) {
      chunks.push(`${base64Chars[enc1]}${base64Chars[enc2]}${base64Chars[enc3]}=`);
    } else {
      chunks.push(`${base64Chars[enc1]}${base64Chars[enc2]}${base64Chars[enc3]}${base64Chars[enc4]}`);
    }
  }
  return chunks.join('');
};

export const createTarArchive = (files: Array<{ path: string; contents: Uint8Array }>) => {
  const encoder = new TextEncoder();
  const blocks: Uint8Array[] = [];
  let totalLength = 0;

  const writeString = (buffer: Uint8Array, offset: number, text: string, length: number) => {
    const encoded = encoder.encode(text);
    buffer.set(encoded.slice(0, length), offset);
  };

  const writeOctal = (buffer: Uint8Array, offset: number, length: number, value: number) => {
    const octal = value.toString(8).padStart(length - 1, '0');
    writeString(buffer, offset, `${octal}\0`, length);
  };

  const writeChecksum = (buffer: Uint8Array) => {
    let sum = 0;
    for (let i = 0; i < buffer.length; i += 1) {
      sum += buffer[i];
    }
    const checksum = sum.toString(8).padStart(6, '0');
    writeString(buffer, 148, `${checksum}\0 `, 8);
  };

  const addFile = (filePath: string, contents: Uint8Array) => {
    const header = new Uint8Array(512);
    writeString(header, 0, filePath, 100);
    writeString(header, 100, '0000777\0', 8);
    writeString(header, 108, '0000000\0', 8);
    writeString(header, 116, '0000000\0', 8);
    writeOctal(header, 124, 12, contents.length);
    writeOctal(header, 136, 12, Math.floor(Date.now() / 1000));
    writeString(header, 148, '        ', 8);
    writeString(header, 156, '0', 1);
    writeString(header, 257, 'ustar\0', 6);
    writeString(header, 263, '00', 2);
    writeChecksum(header);

    blocks.push(header);
    totalLength += header.length;

    blocks.push(contents);
    totalLength += contents.length;

    const paddingLength = (512 - (contents.length % 512)) % 512;
    if (paddingLength > 0) {
      blocks.push(new Uint8Array(paddingLength));
      totalLength += paddingLength;
    }
  };

  files.forEach((file) => addFile(file.path, file.contents));

  blocks.push(new Uint8Array(1024));
  totalLength += 1024;

  const archive = new Uint8Array(totalLength);
  let offset = 0;
  blocks.forEach((block) => {
    archive.set(block, offset);
    offset += block.length;
  });

  return bytesToBase64(archive);
};

const parseTarSize = (value: string) => {
  const normalized = value.replace(/\0/g, '').trim();
  if (!normalized) {
    return 0;
  }

  const parsed = Number.parseInt(normalized, 8);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const readTarString = (buffer: Uint8Array, offset: number, length: number) => {
  const raw = String.fromCharCode(...buffer.slice(offset, offset + length));
  return raw.replace(/\0.*$/, '').trim();
};

export const parseTarArchive = (contents: Uint8Array) => {
  const files: Array<{ path: string; contents: Uint8Array }> = [];
  let offset = 0;

  while (offset + 512 <= contents.length) {
    const header = contents.slice(offset, offset + 512);
    const isEmptyHeader = header.every((byte) => byte === 0);
    if (isEmptyHeader) {
      break;
    }

    const path = readTarString(header, 0, 100);
    const sizeRaw = readTarString(header, 124, 12);
    const size = parseTarSize(sizeRaw);
    offset += 512;

    const fileContents = contents.slice(offset, offset + size);
    if (path) {
      files.push({ path, contents: fileContents });
    }

    const dataBlockSize = Math.ceil(size / 512) * 512;
    offset += dataBlockSize;
  }

  return files;
};

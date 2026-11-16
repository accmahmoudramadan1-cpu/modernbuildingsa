/**
 * Pure TypeScript WebM-Opus (EBML) -> OGG-Opus (RFC 7845) remuxer.
 * Enables Chrome / Edge / Android MediaRecorder voice notes (audio/webm;codecs=opus)
 * to be uploaded cleanly to Meta WhatsApp Cloud API as audio/ogg voice messages.
 */

const OGG_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let j = 0; j < 8; j++) {
      r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1;
    }
    table[i] = r >>> 0;
  }
  return table;
})();

function oggCrc32(page: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < page.length; i++) {
    crc = ((crc << 8) ^ OGG_CRC_TABLE[((crc >>> 24) ^ page[i]) & 0xff]) >>> 0;
  }
  return crc >>> 0;
}

function readEbmlVint(
  buf: Uint8Array,
  pos: number,
  keepMarker = false
): { val: number; len: number; isAllOnes: boolean } {
  if (pos >= buf.length) return { val: 0, len: 0, isAllOnes: false };
  const first = buf[pos];
  if (first === 0) return { val: 0, len: 1, isAllOnes: false };
  let mask = 0x80;
  let len = 1;
  while (len <= 8 && (first & mask) === 0) {
    mask >>= 1;
    len++;
  }
  if (pos + len > buf.length) return { val: 0, len: buf.length - pos, isAllOnes: false };

  const firstPayload = first & ~mask;
  let isAllOnes = firstPayload === mask - 1;
  let val = keepMarker ? first : firstPayload;
  for (let i = 1; i < len; i++) {
    const b = buf[pos + i];
    if (b !== 0xff) isAllOnes = false;
    val = val * 256 + b;
  }
  return { val, len, isAllOnes };
}

function getOpusPacketSamples48k(packet: Uint8Array): number {
  if (packet.length < 1) return 960;
  const toc = packet[0];
  const config = toc >> 3;
  const frameCode = toc & 0x03;

  let framesPerPacket = 1;
  if (frameCode === 1 || frameCode === 2) framesPerPacket = 2;
  else if (frameCode === 3 && packet.length >= 2) framesPerPacket = packet[1] & 0x3f;

  // RFC 6716 Table 2 frame durations in ms * 48 samples/ms
  let samplesPerFrame = 960; // 20ms default
  if (config <= 11) {
    const idx = config & 0x03;
    samplesPerFrame = idx === 0 ? 480 : idx === 1 ? 960 : idx === 2 ? 1920 : 2880;
  } else if (config <= 15) {
    samplesPerFrame = (config & 0x01) === 0 ? 480 : 960;
  } else {
    const idx = config & 0x03;
    samplesPerFrame = idx === 0 ? 120 : idx === 1 ? 240 : idx === 2 ? 480 : 960;
  }
  return samplesPerFrame * framesPerPacket;
}

function splitSimpleBlockOpusFrames(
  buf: Uint8Array,
  start: number,
  end: number
): Uint8Array[] {
  if (end - start < 4) return [];
  const track = readEbmlVint(buf, start, false);
  const headerEnd = start + track.len + 3; // +2 bytes timecode + 1 byte flags
  if (headerEnd >= end) return [];

  const flags = buf[start + track.len + 2];
  const lacing = (flags >> 1) & 0x03;

  if (lacing === 0) {
    return [buf.subarray(headerEnd, end)];
  }

  const numFrames = buf[headerEnd] + 1;
  let pos = headerEnd + 1;
  const frames: Uint8Array[] = [];

  if (lacing === 2) {
    // Fixed-size lacing
    const remaining = end - pos;
    const frameSize = Math.floor(remaining / numFrames);
    if (frameSize <= 0) return [];
    for (let i = 0; i < numFrames; i++) {
      frames.push(buf.subarray(pos + i * frameSize, pos + (i + 1) * frameSize));
    }
    return frames;
  }

  if (lacing === 1) {
    // Xiph lacing
    const sizes: number[] = [];
    let sum = 0;
    for (let i = 0; i < numFrames - 1; i++) {
      let s = 0;
      while (pos < end) {
        const b = buf[pos++];
        s += b;
        if (b !== 255) break;
      }
      sizes.push(s);
      sum += s;
    }
    sizes.push(Math.max(0, end - pos - sum));
    for (const sz of sizes) {
      if (pos + sz <= end && sz > 0) frames.push(buf.subarray(pos, pos + sz));
      pos += sz;
    }
    return frames;
  }

  // EBML lacing (lacing === 3)
  if (pos >= end) return [];
  const firstSize = readEbmlVint(buf, pos, false);
  pos += firstSize.len;
  const sizes: number[] = [firstSize.val];
  let prev = firstSize.val;
  let totalKnown = firstSize.val;
  for (let i = 1; i < numFrames - 1; i++) {
    const delta = readEbmlVint(buf, pos, false);
    pos += delta.len;
    const signedOffset = (1 << (delta.len * 7 - 1)) - 1;
    prev = prev + (delta.val - signedOffset);
    sizes.push(prev);
    totalKnown += prev;
  }
  sizes.push(Math.max(0, end - pos - totalKnown));
  for (const sz of sizes) {
    if (pos + sz <= end && sz > 0) frames.push(buf.subarray(pos, pos + sz));
    pos += sz;
  }
  return frames;
}

function buildOggPage(
  serial: number,
  seqNo: number,
  headerType: number,
  granulePos: bigint,
  packets: Uint8Array[]
): Uint8Array {
  const lacing: number[] = [];
  let payloadLen = 0;
  for (const pkt of packets) {
    payloadLen += pkt.length;
    let rem = pkt.length;
    while (rem >= 255) {
      lacing.push(255);
      rem -= 255;
    }
    lacing.push(rem);
  }

  const headerSize = 27 + lacing.length;
  const page = new Uint8Array(headerSize + payloadLen);
  const view = new DataView(page.buffer);

  // "OggS"
  page[0] = 0x4f;
  page[1] = 0x67;
  page[2] = 0x67;
  page[3] = 0x53;
  page[4] = 0; // version
  page[5] = headerType;
  view.setBigInt64(6, granulePos, true);
  view.setUint32(14, serial >>> 0, true);
  view.setUint32(18, seqNo >>> 0, true);
  view.setUint32(22, 0, true); // CRC placeholder
  page[26] = lacing.length;
  for (let i = 0; i < lacing.length; i++) {
    page[27 + i] = lacing[i];
  }

  let offset = headerSize;
  for (const pkt of packets) {
    page.set(pkt, offset);
    offset += pkt.length;
  }

  view.setUint32(22, oggCrc32(page), true);
  return page;
}

/**
 * Extracts Opus frames + optional CodecPrivate from a WebM EBML recording
 * and wraps them in a valid OGG/Opus binary container.
 * Returns null if the input does not contain valid WebM Opus packets.
 */
export function remuxWebmOpusToOgg(webmBuffer: Buffer): Buffer | null {
  try {
    const buf = new Uint8Array(
      webmBuffer.buffer,
      webmBuffer.byteOffset,
      webmBuffer.byteLength
    );
    // Verify EBML header magic 0x1A45DFA3
    if (
      buf.length < 32 ||
      buf[0] !== 0x1a ||
      buf[1] !== 0x45 ||
      buf[2] !== 0xdf ||
      buf[3] !== 0xa3
    ) {
      return null;
    }

    let opusHead: Uint8Array | null = null;
    const packets: Uint8Array[] = [];

    const walk = (start: number, end: number) => {
      let pos = start;
      while (pos < end - 2) {
        const idInfo = readEbmlVint(buf, pos, true);
        if (idInfo.len === 0) break;
        pos += idInfo.len;
        const sizeInfo = readEbmlVint(buf, pos, false);
        pos += sizeInfo.len;

        const isUnknownSize = sizeInfo.len > 0 && sizeInfo.isAllOnes;
        const elemEnd = isUnknownSize ? end : Math.min(end, pos + sizeInfo.val);
        const id = idInfo.val;

        if (id === 0x63a2) {
          // CodecPrivate -> check for "OpusHead"
          const slice = buf.subarray(pos, elemEnd);
          if (
            slice.length >= 19 &&
            slice[0] === 0x4f &&
            slice[1] === 0x70 &&
            slice[2] === 0x75 &&
            slice[3] === 0x73
          ) {
            opusHead = slice;
          }
        } else if (id === 0xa3 || id === 0xa1) {
          // SimpleBlock (0xA3) or Block (0xA1)
          const frames = splitSimpleBlockOpusFrames(buf, pos, elemEnd);
          for (const f of frames) {
            if (f.length > 0) packets.push(f);
          }
        } else if (
          id === 0x18538067 || // Segment
          id === 0x1654ae6b || // Tracks
          id === 0xae || // TrackEntry
          id === 0x1f43b675 || // Cluster
          id === 0xa0 // BlockGroup
        ) {
          walk(pos, elemEnd);
        }

        pos = elemEnd;
      }
    };

    walk(0, buf.length);
    if (packets.length === 0) return null;

    if (!opusHead) {
      const head = new Uint8Array(19);
      head.set([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64], 0); // "OpusHead"
      head[8] = 1; // version
      head[9] = 1; // mono mic recording
      new DataView(head.buffer).setUint16(10, 312, true); // pre-skip
      new DataView(head.buffer).setUint32(12, 48000, true); // input sample rate
      opusHead = head;
    }

    const vendor = new TextEncoder().encode("ModernBuilding");
    const opusTags = new Uint8Array(8 + 4 + vendor.length + 4);
    opusTags.set([0x4f, 0x70, 0x75, 0x73, 0x54, 0x61, 0x67, 0x73], 0); // "OpusTags"
    new DataView(opusTags.buffer).setUint32(8, vendor.length, true);
    opusTags.set(vendor, 12);
    new DataView(opusTags.buffer).setUint32(12 + vendor.length, 0, true);

    const serial = 0x4d425741; // "MBWA"
    const pages: Uint8Array[] = [];
    let seq = 0;

    pages.push(buildOggPage(serial, seq++, 0x02, BigInt(0), [opusHead]));
    pages.push(buildOggPage(serial, seq++, 0x00, BigInt(0), [opusTags]));

    let granule = BigInt(0);
    const BATCH = 20;
    for (let i = 0; i < packets.length; i += BATCH) {
      const batch = packets.slice(i, i + BATCH);
      for (const pkt of batch) {
        granule += BigInt(getOpusPacketSamples48k(pkt));
      }
      const isLast = i + BATCH >= packets.length;
      pages.push(buildOggPage(serial, seq++, isLast ? 0x04 : 0x00, granule, batch));
    }

    const totalLen = pages.reduce((acc, p) => acc + p.length, 0);
    const out = Buffer.allocUnsafe(totalLen);
    let offset = 0;
    for (const p of pages) {
      out.set(p, offset);
      offset += p.length;
    }
    return out;
  } catch (err) {
    console.warn("[WebM->OGG Remux] Error:", err);
    return null;
  }
}

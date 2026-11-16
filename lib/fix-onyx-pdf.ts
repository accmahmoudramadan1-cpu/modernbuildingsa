import zlib from "zlib";

/**
 * Compact Times New Roman Bold (timesbd.ttf) Unicode -> GlyphID mapping for Arabic
 * Presentation Forms (U+FE70..U+FEFC) and core Arabic characters.
 * Ghostscript 9.21 / PDF24 Creator occasionally leaves cmap entries as gid=0 even
 * though the underlying composite component glyph outline exists in FontFile2.glyf.
 */
const TIMESBD_BASE_ARABIC_U2G: Record<number, number> = {
  0x0621: 751, 0x0622: 897, 0x0623: 899, 0x0624: 901, 0x0625: 903, 0x0626: 905,
  0x0627: 909, 0x0628: 911, 0x0629: 915, 0x062a: 917, 0x062b: 921, 0x062c: 925,
  0x062d: 929, 0x062e: 933, 0x062f: 937, 0x0630: 939, 0x0631: 941, 0x0632: 943,
  0x0633: 945, 0x0634: 949, 0x0635: 953, 0x0636: 957, 0x0637: 961, 0x0638: 965,
  0x0639: 969, 0x063a: 973, 0x0640: 752, 0x0641: 977, 0x0642: 981, 0x0643: 985,
  0x0644: 989, 0x0645: 993, 0x0646: 997, 0x0647: 1001, 0x0648: 1005, 0x0649: 1007,
  0x064a: 1009, 0x064b: 753, 0x064c: 754, 0x064d: 755, 0x064e: 756, 0x064f: 757,
  0x0650: 758, 0x0651: 759, 0x0652: 760,
  // Presentation Forms-B U+FE70..U+FE7F
  0xfe70: 3865, 0xfe71: 3866, 0xfe72: 3867, 0xfe73: 3868, 0xfe74: 3869,
  0xfe76: 3870, 0xfe77: 3871, 0xfe78: 3872, 0xfe79: 3873, 0xfe7a: 3874,
  0xfe7b: 3875, 0xfe7c: 3876, 0xfe7d: 3877, 0xfe7e: 3878, 0xfe7f: 3879,
};

function getTimesBoldArabicGid(codepoint: number): number | null {
  if (codepoint >= 0xfe80 && codepoint <= 0xfefc) {
    return 896 + (codepoint - 0xfe80);
  }
  if (codepoint >= 0x0660 && codepoint <= 0x0669) {
    return 761 + (codepoint - 0x0660);
  }
  return TIMESBD_BASE_ARABIC_U2G[codepoint] ?? null;
}

function calcTtfTableChecksum(buf: Buffer, offset: number, length: number): number {
  let sum = 0;
  const end = offset + length;
  for (let i = offset; i < end; i += 4) {
    let val = 0;
    for (let b = 0; b < 4; b++) {
      val = (val << 8) | (i + b < end ? buf[i + b] : 0);
    }
    sum = (sum + (val >>> 0)) >>> 0;
  }
  return sum;
}

function parseToUnicodeMap(cmapText: string): Map<number, number> {
  const map = new Map<number, number>();
  // Parse beginbfrange blocks: <srcStart><srcEnd><dstStart>
  const rangeBlockRe = /beginbfrange([\s\S]*?)endbfrange/g;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = rangeBlockRe.exec(cmapText)) !== null) {
    const lineRe = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
    let lineMatch: RegExpExecArray | null;
    while ((lineMatch = lineRe.exec(blockMatch[1])) !== null) {
      const start = parseInt(lineMatch[1], 16);
      const end = parseInt(lineMatch[2], 16);
      let dst = parseInt(lineMatch[3], 16);
      if (end - start <= 256) {
        for (let c = start; c <= end; c++, dst++) {
          map.set(c, dst);
        }
      }
    }
  }
  // Parse beginbfchar blocks: <src><dst>
  const charBlockRe = /beginbfchar([\s\S]*?)endbfchar/g;
  while ((blockMatch = charBlockRe.exec(cmapText)) !== null) {
    const pairRe = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
    let pairMatch: RegExpExecArray | null;
    while ((pairMatch = pairRe.exec(blockMatch[1])) !== null) {
      const src = parseInt(pairMatch[1], 16);
      const dst = parseInt(pairMatch[2], 16);
      map.set(src, dst);
    }
  }
  return map;
}

function extractObjectBody(pdfLatin1: string, objNum: number): { dict: string; streamStart: number; streamEnd: number } | null {
  const objHeaderRe = new RegExp(`(?:^|[\\r\\n])${objNum}\\s+0\\s+obj\\b`);
  const m = objHeaderRe.exec(pdfLatin1);
  if (!m) return null;
  const startPos = m.index + m[0].length;
  const endObjPos = pdfLatin1.indexOf("endobj", startPos);
  if (endObjPos < 0) return null;
  const slice = pdfLatin1.slice(startPos, endObjPos);
  const streamMatch = /<<([\s\S]*?)>>\s*stream\r?\n/.exec(slice);
  if (streamMatch) {
    const streamDataStart = startPos + streamMatch.index + streamMatch[0].length;
    const endStreamPos = pdfLatin1.indexOf("endstream", streamDataStart);
    if (endStreamPos > streamDataStart) {
      return {
        dict: streamMatch[1],
        streamStart: streamDataStart,
        streamEnd: endStreamPos,
      };
    }
  }
  const dictMatch = /<<([\s\S]*?)>>/.exec(slice);
  return {
    dict: dictMatch ? dictMatch[1] : slice,
    streamStart: -1,
    streamEnd: -1,
  };
}

function repairEmbeddedTtf(ttfInput: Buffer, toUnicode: Map<number, number>): Buffer | null {
  if (ttfInput.length < 12) return null;
  const numTables = ttfInput.readUInt16BE(4);
  if (ttfInput.length < 12 + numTables * 16) return null;

  const tables = new Map<string, { dirOffset: number; offset: number; length: number }>();
  for (let i = 0; i < numTables; i++) {
    const dirOffset = 12 + i * 16;
    const tag = ttfInput.subarray(dirOffset, dirOffset + 4).toString("ascii");
    const offset = ttfInput.readUInt32BE(dirOffset + 8);
    const length = ttfInput.readUInt32BE(dirOffset + 12);
    tables.set(tag, { dirOffset, offset, length });
  }

  const cmapInfo = tables.get("cmap");
  const locaInfo = tables.get("loca");
  const headInfo = tables.get("head");
  const maxpInfo = tables.get("maxp");
  if (!cmapInfo || !locaInfo || !headInfo || !maxpInfo) return null;

  const numGlyphs = ttfInput.readUInt16BE(maxpInfo.offset + 4);
  if (numGlyphs < 1000) return null;

  const indexToLocFormat = ttfInput.readInt16BE(headInfo.offset + 50);
  const hasNonEmptyGlyf = (gid: number): boolean => {
    if (gid <= 0 || gid >= numGlyphs) return false;
    if (indexToLocFormat === 0) {
      const pos = locaInfo.offset + gid * 2;
      if (pos + 4 > ttfInput.length) return false;
      return ttfInput.readUInt16BE(pos + 2) > ttfInput.readUInt16BE(pos);
    }
    const pos = locaInfo.offset + gid * 4;
    if (pos + 8 > ttfInput.length) return false;
    return ttfInput.readUInt32BE(pos + 4) > ttfInput.readUInt32BE(pos);
  };

  const ttf = Buffer.from(ttfInput);
  const cmapBase = cmapInfo.offset;
  const numSubtables = ttf.readUInt16BE(cmapBase + 2);
  let patchedCount = 0;

  for (let s = 0; s < numSubtables; s++) {
    const subHeader = cmapBase + 4 + s * 8;
    const pid = ttf.readUInt16BE(subHeader);
    const eid = ttf.readUInt16BE(subHeader + 2);
    const relOff = ttf.readUInt32BE(subHeader + 4);
    const soff = cmapBase + relOff;
    if (soff + 10 > ttf.length) continue;

    const fmt = ttf.readUInt16BE(soff);

    // Format 6 (single 1-byte/2-byte range array used by Ghostscript Mac/Platform 1 subtable)
    if (fmt === 6) {
      const firstCode = ttf.readUInt16BE(soff + 6);
      const entryCount = ttf.readUInt16BE(soff + 8);
      const garrOff = soff + 10;
      if (garrOff + entryCount * 2 > ttf.length) continue;

      for (const [charCode, unicodeVal] of toUnicode.entries()) {
        if (unicodeVal <= 0x20 || unicodeVal === 0xa0) continue;
        if (charCode < firstCode || charCode >= firstCode + entryCount) continue;
        const idxOff = garrOff + (charCode - firstCode) * 2;
        if (ttf.readUInt16BE(idxOff) === 0) {
          const candidateGid = getTimesBoldArabicGid(unicodeVal);
          if (candidateGid && hasNonEmptyGlyf(candidateGid)) {
            ttf.writeUInt16BE(candidateGid, idxOff);
            patchedCount++;
          }
        }
      }
    }
    // Format 4 Symbolic encoding (pid=3, eid=0, 0xF001..0xF0FF range mapped via idRangeOffset)
    else if (fmt === 4 && pid === 3 && eid === 0) {
      const subLen = ttf.readUInt16BE(soff + 2);
      const segCount = ttf.readUInt16BE(soff + 6) / 2;
      if (segCount < 1 || segCount > 32) continue;

      const endCountOff = soff + 14;
      const startCountOff = endCountOff + segCount * 2 + 2;
      const idDeltaOff = startCountOff + segCount * 2;
      const idRangeOff = idDeltaOff + segCount * 2;
      const garrStart = idRangeOff + segCount * 2;
      if (soff + subLen > ttf.length || garrStart > soff + subLen) continue;

      for (let seg = 0; seg < segCount; seg++) {
        const startChar = ttf.readUInt16BE(startCountOff + seg * 2);
        const endChar = ttf.readUInt16BE(endCountOff + seg * 2);
        const delta = ttf.readInt16BE(idDeltaOff + seg * 2);
        const roff = ttf.readUInt16BE(idRangeOff + seg * 2);
        if (startChar === 0xffff || roff === 0) continue;
        if (startChar < 0xf000 || endChar > 0xf0ff) continue;

        for (const [charCode, unicodeVal] of toUnicode.entries()) {
          if (unicodeVal <= 0x20 || unicodeVal === 0xa0) continue;
          const symCode = 0xf000 + charCode;
          if (symCode < startChar || symCode > endChar) continue;

          const glyphEntryPtr =
            idRangeOff + seg * 2 + roff + (symCode - startChar) * 2;
          if (glyphEntryPtr + 2 > soff + subLen) continue;
          if (ttf.readUInt16BE(glyphEntryPtr) === 0 && delta === 0) {
            const candidateGid = getTimesBoldArabicGid(unicodeVal);
            if (candidateGid && hasNonEmptyGlyf(candidateGid)) {
              ttf.writeUInt16BE(candidateGid, glyphEntryPtr);
              patchedCount++;
            }
          }
        }
      }
    }
  }

  if (patchedCount === 0) return null;

  // Update cmap table checksum and head.checkSumAdjustment per OpenType specification
  const newCmapSum = calcTtfTableChecksum(ttf, cmapInfo.offset, cmapInfo.length);
  ttf.writeUInt32BE(newCmapSum, cmapInfo.dirOffset + 4);
  ttf.writeUInt32BE(0, headInfo.offset + 8);
  const newHeadSum = calcTtfTableChecksum(ttf, headInfo.offset, headInfo.length);
  ttf.writeUInt32BE(newHeadSum, headInfo.dirOffset + 4);
  const wholeSum = calcTtfTableChecksum(ttf, 0, ttf.length);
  const adj = (0xb1b0afba - wholeSum) >>> 0;
  ttf.writeUInt32BE(adj, headInfo.offset + 8);

  return ttf;
}

/**
 * Repairs Ghostscript/PDF24-generated Onyx Pro PDFs where embedded
 * TimesNewRoman,Bold TrueType fonts omit cmap entries for isolated Arabic
 * glyphs (such as ر and ج) that already exist in FontFile2.glyf.
 *
 * Uses a standard ISO-32000 PDF incremental update so intact PDFs pass through
 * untouched bit-for-bit.
 */
export function repairOnyxPdfFonts(pdfBuffer: Buffer): Buffer {
  try {
    if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length < 256) return pdfBuffer;
    if (!pdfBuffer.subarray(0, 16).toString("latin1").includes("%PDF-")) {
      return pdfBuffer;
    }

    const tailText = pdfBuffer
      .subarray(Math.max(0, pdfBuffer.length - 4096))
      .toString("latin1");
    const trailerMatch = /trailer\s*<<([\s\S]*?)>>\s*startxref\s+(\d+)\s+%%EOF\s*$/i.exec(
      tailText
    );
    if (!trailerMatch) return pdfBuffer;

    const trailerDict = trailerMatch[1];
    const oldStartXref = parseInt(trailerMatch[2], 10);
    const sizeMatch = /\/Size\s+(\d+)/.exec(trailerDict);
    const rootMatch = /\/Root\s+(\d+\s+\d+\s+R)/.exec(trailerDict);
    if (!sizeMatch || !rootMatch) return pdfBuffer;

    const origSize = parseInt(sizeMatch[1], 10);
    const rootRef = rootMatch[1];
    const infoMatch = /\/Info\s+(\d+\s+\d+\s+R)/.exec(trailerDict);
    const idMatch = /\/ID\s*(\[[\s\S]*?\])/.exec(trailerDict);

    const pdfLatin1 = pdfBuffer.toString("latin1");

    // Locate TimesNewRoman TrueType font objects with both /ToUnicode and /FontDescriptor
    const fontCandidateRe =
      /(?:^|[\r\n])(\d+)\s+0\s+obj\s*<<([\s\S]*?\/Subtype\s*\/TrueType[\s\S]*?)>>/g;
    const updates: Array<{ objNum: number; dict: string; data: Buffer }> = [];
    const seenFontFileObjs = new Set<number>();

    let fontMatch: RegExpExecArray | null;
    while ((fontMatch = fontCandidateRe.exec(pdfLatin1)) !== null) {
      const fontDict = fontMatch[2];
      const baseFontMatch = /\/BaseFont\s*\/([^\s/<>\[\]]+)/.exec(fontDict);
      if (!baseFontMatch || !/TimesNewRoman/i.test(baseFontMatch[1])) continue;

      const toUniMatch = /\/ToUnicode\s+(\d+)\s+0\s+R/.exec(fontDict);
      const fdMatch = /\/FontDescriptor\s+(\d+)\s+0\s+R/.exec(fontDict);
      if (!toUniMatch || !fdMatch) continue;

      const fdObj = extractObjectBody(pdfLatin1, parseInt(fdMatch[1], 10));
      if (!fdObj) continue;
      const ffMatch = /\/FontFile2\s+(\d+)\s+0\s+R/.exec(fdObj.dict);
      if (!ffMatch) continue;

      const ffObjNum = parseInt(ffMatch[1], 10);
      if (seenFontFileObjs.has(ffObjNum)) continue;

      const tuObj = extractObjectBody(pdfLatin1, parseInt(toUniMatch[1], 10));
      const ffObj = extractObjectBody(pdfLatin1, ffObjNum);
      if (!tuObj || tuObj.streamStart < 0 || !ffObj || ffObj.streamStart < 0) continue;

      const tuCompressed = pdfBuffer.subarray(tuObj.streamStart, tuObj.streamEnd);
      const ffCompressed = pdfBuffer.subarray(ffObj.streamStart, ffObj.streamEnd);

      const tuText = zlib.inflateSync(tuCompressed).toString("utf8");
      const toUnicode = parseToUnicodeMap(tuText);
      if (toUnicode.size === 0) continue;

      const rawTtf = zlib.inflateSync(ffCompressed);
      const repairedTtf = repairEmbeddedTtf(rawTtf, toUnicode);
      if (!repairedTtf) continue;

      seenFontFileObjs.add(ffObjNum);
      const compressedRepaired = zlib.deflateSync(repairedTtf);
      updates.push({
        objNum: ffObjNum,
        dict: `<< /Filter /FlateDecode /Length ${compressedRepaired.length} /Length1 ${repairedTtf.length} >>`,
        data: compressedRepaired,
      });
    }

    if (updates.length === 0) return pdfBuffer;

    // Build standard PDF incremental update appended cleanly after %%EOF
    const chunks: Buffer[] = [pdfBuffer];
    if (pdfBuffer[pdfBuffer.length - 1] !== 0x0a) {
      chunks.push(Buffer.from("\n", "ascii"));
    }

    let currentOffset = chunks.reduce((acc, b) => acc + b.length, 0);
    const objOffsets: Array<{ objNum: number; offset: number }> = [];

    for (const upd of updates) {
      objOffsets.push({ objNum: upd.objNum, offset: currentOffset });
      const head = Buffer.from(`${upd.objNum} 0 obj\n${upd.dict}\nstream\n`, "ascii");
      const foot = Buffer.from("\nendstream\nendobj\n", "ascii");
      chunks.push(head, upd.data, foot);
      currentOffset += head.length + upd.data.length + foot.length;
    }

    objOffsets.sort((a, b) => a.objNum - b.objNum);
    const xrefOffset = currentOffset;
    const xrefLines: string[] = ["xref\n"];
    for (const entry of objOffsets) {
      xrefLines.push(`${entry.objNum} 1\n`);
      xrefLines.push(`${String(entry.offset).padStart(10, "0")} 00000 n \n`);
    }

    const extraInfo = infoMatch ? ` /Info ${infoMatch[1]}` : "";
    const extraId = idMatch ? ` /ID ${idMatch[1]}` : "";
    xrefLines.push(
      `trailer\n<< /Size ${origSize} /Root ${rootRef}${extraInfo}${extraId} /Prev ${oldStartXref} >>\nstartxref\n${xrefOffset}\n%%EOF\n`
    );

    chunks.push(Buffer.from(xrefLines.join(""), "ascii"));
    return Buffer.concat(chunks);
  } catch (err) {
    console.warn("[PDF Repair] Fallback to original PDF buffer:", err);
    return pdfBuffer;
  }
}

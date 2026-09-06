/** Bounded local XLSX reader. Only workbook/shared-string/worksheet XML is interpreted; no formulas or external links execute. */
const MAX_COMPRESSED = 8 * 1024 * 1024;
const MAX_EXPANDED = 32 * 1024 * 1024;
const decoder = new TextDecoder('utf-8', { fatal: true });
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n; for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0;
});
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff; for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0;
}

export async function unzipWorkbook(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  if (bytes.length > MAX_COMPRESSED || bytes.length < 22) throw new Error('XLSX must be a ZIP file smaller than 8 MiB.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ensure = (offset: number, length: number) => { if (offset < 0 || length < 0 || offset + length > bytes.length) throw new Error('Truncated XLSX archive.'); };
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0) throw new Error('Invalid XLSX central directory.');
  const entries = view.getUint16(end + 10, true);
  if (entries > 256 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || entries !== view.getUint16(end + 8, true)) throw new Error('Unsupported or oversized XLSX archive.');
  const directorySize = view.getUint32(end + 12, true); let offset = view.getUint32(end + 16, true);
  if (offset + directorySize !== end) throw new Error('Invalid XLSX directory bounds.');
  const files = new Map<string, Uint8Array>(); let expanded = 0;
  for (let i = 0; i < entries; i++) {
    ensure(offset, 46);
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('Invalid XLSX directory entry.');
    const flags = view.getUint16(offset + 8, true); const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true); const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true); const extraLength = view.getUint16(offset + 30, true); const commentLength = view.getUint16(offset + 32, true);
    const local = view.getUint32(offset + 42, true); ensure(offset + 46, nameLength + extraLength + commentLength);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    if (flags & 1 || ![0, 8].includes(method)) throw new Error('Encrypted or unsupported XLSX compression.');
    if (name.includes('..') || name.includes('\\') || name.startsWith('/') || files.has(name)) throw new Error('Invalid or duplicate XLSX member name.');
    expanded += size; if (expanded > MAX_EXPANDED) throw new Error('XLSX expands beyond 32 MiB.');
    ensure(local, 30);
    if (view.getUint32(local, true) !== 0x04034b50 || view.getUint16(local + 8, true) !== method) throw new Error('Invalid XLSX member header.');
    const localNameLength = view.getUint16(local + 26, true); const localExtraLength = view.getUint16(local + 28, true);
    ensure(local + 30, localNameLength + localExtraLength);
    if (decoder.decode(bytes.subarray(local + 30, local + 30 + localNameLength)) !== name) throw new Error('XLSX member names disagree.');
    const start = local + 30 + localNameLength + localExtraLength; ensure(start, compressedSize);
    if (start + compressedSize > view.getUint32(end + 16, true)) throw new Error('XLSX member overlaps its directory.');
    const compressed = bytes.slice(start, start + compressedSize);
    let value: Uint8Array;
    if (method === 0) value = compressed;
    else {
      const reader = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
      const chunks: Uint8Array[] = []; let received = 0;
      try {
        for (;;) {
          const next = await reader.read(); if (next.done) break;
          received += next.value.length;
          if (received > size || received > MAX_EXPANDED) throw new Error('XLSX inflated size exceeds declared bounds.');
          chunks.push(next.value);
        }
      } finally { await reader.cancel(); }
      value = new Uint8Array(received); let position = 0;
      for (const chunk of chunks) { value.set(chunk, position); position += chunk.length; }
    }
    if (value.length !== size) throw new Error('XLSX member size mismatch.');
    if (crc32(value) !== view.getUint32(offset + 16, true)) throw new Error('XLSX member checksum mismatch.');
    files.set(name, value); offset += 46 + nameLength + extraLength + commentLength;
  }
  if (offset !== end) throw new Error('XLSX directory size mismatch.');
  return files;
}

function xml(files: Map<string, Uint8Array>, path: string): Document {
  const bytes = files.get(path); if (!bytes) throw new Error(`XLSX is missing ${path}.`);
  const text = decoder.decode(bytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('XLSX XML declarations with entities are not supported.');
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error(`Invalid XML in ${path}.`);
  return doc;
}
function elements(parent: Document | Element, localName: string): Element[] { return Array.from(parent.getElementsByTagNameNS('*', localName)); }

export async function readXlsxRows(base64: string): Promise<string[][]> {
  if (typeof base64 !== 'string' || base64.length > Math.ceil(MAX_COMPRESSED / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new Error('Invalid or oversized XLSX content.');
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const files = await unzipWorkbook(bytes);
  const workbook = xml(files, 'xl/workbook.xml'); const rels = xml(files, 'xl/_rels/workbook.xml.rels');
  const sheets = elements(workbook, 'sheet'); const sheet = sheets.find(s => /control|soa|ism|cloud/i.test(s.getAttribute('name') || '')) || sheets[0];
  if (!sheet) throw new Error('XLSX has no worksheets.');
  const relId = sheet.getAttribute('r:id') || sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
  const relationship = elements(rels, 'Relationship').find(r => r.getAttribute('Id') === relId);
  const target = relationship?.getAttribute('Target');
  if (!target || relationship?.getAttribute('TargetMode') === 'External' || target.includes('..') || target.includes('\\') || target.includes(':')) throw new Error('Invalid XLSX worksheet relationship.');
  const path = target.startsWith('/') ? target.slice(1) : target.startsWith('xl/') ? target : `xl/${target.replace(/^\.\//, '')}`;
  const shared = files.has('xl/sharedStrings.xml') ? elements(xml(files, 'xl/sharedStrings.xml'), 'si').map(si => elements(si, 't').map(t => t.textContent || '').join('')) : [];
  const rows: string[][] = []; let cells = 0;
  for (const row of elements(xml(files, path), 'row')) {
    const values: string[] = [];
    for (const cell of elements(row, 'c')) {
      if (++cells > 250_000) throw new Error('XLSX contains too many cells.');
      const ref = cell.getAttribute('r')?.match(/^([A-Z]{1,3})[1-9][0-9]*$/);
      if (!ref) throw new Error('Invalid XLSX cell reference.');
      const column = [...ref[1]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
      if (column >= 256) throw new Error('XLSX exceeds 256 columns.');
      const value = elements(cell, 'v')[0]?.textContent || ''; const type = cell.getAttribute('t');
      let text = type === 'inlineStr' ? elements(cell, 't').map(t => t.textContent || '').join('') : value;
      if (type === 's') {
        const index = Number(value);
        if (!/^\d+$/.test(value) || !Number.isSafeInteger(index) || index >= shared.length) throw new Error('Invalid XLSX shared string reference.');
        text = shared[index];
      }
      if (text.length > 65_536) throw new Error('XLSX cell exceeds 64 KiB.');
      values[column] = text.trim();
    }
    if (values.some(Boolean)) rows.push(Array.from(values, v => v || ''));
    if (rows.length > 20_001) throw new Error('XLSX exceeds 20,000 data rows.');
  }
  return rows;
}

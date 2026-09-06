const mimeTypes: Record<string, string> = {
  json: 'application/json', txt: 'text/plain', md: 'text/markdown', csv: 'text/csv',
  html: 'text/html', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  pdf: 'application/pdf', ts: 'text/plain', js: 'text/javascript', xml: 'application/xml',
  zip: 'application/zip', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/** Open the destination before generating content: browser pickers require the original click. */
export async function saveFile(filename: string, content: Blob | (() => Promise<Blob>)): Promise<boolean> {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  const mime = mimeTypes[extension];
  if (typeof window.showSaveFilePicker === 'function') {
    let handle: FileSystemFileHandle;
    try {
      handle = await window.showSaveFilePicker({ suggestedName: filename,
        ...(mime ? { types: [{ description: `${extension.toUpperCase()} file`, accept: { [mime]: [`.${extension}`] } }] } : {}),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return false;
      throw error;
    }
    const blob = typeof content === 'function' ? await content() : content;
    const writable = await handle.createWritable();
    try { await writable.write(blob); await writable.close(); }
    catch (error) { try { await writable.abort(); } catch { /* Preserve the original write failure. */ } throw error; }
    return true;
  }

  // Some browsers expose downloads only; let the user choose that fallback explicitly.
  if (!window.confirm('This browser does not support a Save As picker. Download this file using your browser’s download settings instead?')) return false;
  const blob = typeof content === 'function' ? await content() : content;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename;
  document.body.appendChild(anchor);
  try { anchor.click(); }
  finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
  return true;
}

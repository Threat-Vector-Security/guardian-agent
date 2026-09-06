import { saveFile } from '../../../shared/file-dialogs';

const buildTimestamp = () => new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);

/** User-facing exports share native save/cancel semantics and display write failures. */
export const saveExport = async (filename: string, content: Blob | (() => Promise<Blob>)): Promise<boolean> => {
  try {
    return await saveFile(filename, content);
  } catch (error) {
    window.alert(`The file was not saved: ${error instanceof Error ? error.message : 'Unknown file error'}`);
    return false;
  }
};

export const downloadTextFile = (content: string, filenameBase: string): Promise<boolean> => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const timestamp = buildTimestamp();
  return saveExport(`${filenameBase}-${timestamp}.txt`, blob);
};

export const downloadHtmlFile = (content: string, filenameBase: string): Promise<boolean> => {
  const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
  const timestamp = buildTimestamp();
  return saveExport(`${filenameBase}-${timestamp}.html`, blob);
};

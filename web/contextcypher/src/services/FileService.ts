// Browser-based File Service using Web File System API
// Replaces Tauri file operations

export interface FileDialogOptions {
  title?: string;
  filters?: Array<{
    name: string;
    extensions: string[];
  }>;
  defaultPath?: string;
  multiple?: boolean;
}

export interface SaveFileOptions extends FileDialogOptions {
  suggestedName?: string;
}

class FileService {
  private static instance: FileService;
  private fileHandles: Map<string, FileSystemFileHandle> = new Map();
  
  private constructor() {
    console.log('[FileService] Browser-based file service initialized');
  }
  
  static getInstance(): FileService {
    if (!FileService.instance) {
      FileService.instance = new FileService();
    }
    return FileService.instance;
  }
  
  // Convert filters to accept string for file picker
  private getAcceptTypes(filters?: FileDialogOptions['filters']): Record<string, string[]> {
    if (!filters || filters.length === 0) {
      return {
        'application/json': ['.json']
      };
    }
    
    const accept: Record<string, string[]> = {};
    
    filters.forEach(filter => {
      const mimeType = this.getMimeType(filter.extensions[0]);
      accept[mimeType] = filter.extensions.map(ext => `.${ext}`);
    });
    
    return accept;
  }
  
  // Get MIME type from extension
  private getMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      'json': 'application/json',
      'txt': 'text/plain',
      'xml': 'application/xml',
      'csv': 'text/csv',
      'html': 'text/html',
      'js': 'text/javascript',
      'ts': 'text/typescript',
      'md': 'text/markdown'
    };
    
    return mimeTypes[extension] || 'application/octet-stream';
  }
  
  // Open file dialog and return selected file(s)
  async openFileDialog(options: FileDialogOptions = {}): Promise<string | string[] | null> {
    try {
      if (!('showOpenFilePicker' in window)) {
        // Fallback for browsers without File System Access API
        return this.openFileDialogFallback(options);
      }
      
      const pickerOptions: any = {
        types: Object.entries(this.getAcceptTypes(options.filters)).map(([mimeType, extensions]) => ({
          description: options.filters?.find(f => f.extensions.includes(extensions[0].slice(1)))?.name || 'Files',
          accept: { [mimeType]: extensions }
        })),
        multiple: options.multiple || false
      };
      
      const handles = await window.showOpenFilePicker(pickerOptions);
      
      if (options.multiple) {
        const files = await Promise.all(handles.map(async handle => {
          this.fileHandles.set(handle.name, handle);
          return handle.name;
        }));
        return files;
      } else {
        const handle = handles[0];
        this.fileHandles.set(handle.name, handle);
        return handle.name;
      }
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // User cancelled
        return null;
      }
      console.error('[FileService] Error opening file dialog:', error);
      throw error;
    }
  }
  
  // Fallback using input element
  private openFileDialogFallback(options: FileDialogOptions): Promise<string | string[] | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.style.display = 'none';
      
      if (options.multiple) {
        input.multiple = true;
      }
      
      if (options.filters) {
        const extensions = options.filters.flatMap(f => f.extensions.map(ext => `.${ext}`));
        input.accept = extensions.join(',');
      }
      
      input.addEventListener('change', async (event) => {
        const files = (event.target as HTMLInputElement).files;
        if (!files || files.length === 0) {
          resolve(null);
          return;
        }
        
        if (options.multiple) {
          const fileNames = Array.from(files).map(file => file.name);
          resolve(fileNames);
        } else {
          resolve(files[0].name);
        }
        
        document.body.removeChild(input);
      });
      
      input.addEventListener('cancel', () => {
        resolve(null);
        document.body.removeChild(input);
      });
      
      document.body.appendChild(input);
      input.click();
    });
  }
  
  // Save file dialog
  async saveFileDialog(options: SaveFileOptions = {}): Promise<string | null> {
    try {
      if (!('showSaveFilePicker' in window)) {
        // Fallback for browsers without File System Access API
        return this.saveFileDialogFallback(options);
      }
      
      const pickerOptions: any = {
        suggestedName: options.suggestedName || 'untitled.json',
        types: Object.entries(this.getAcceptTypes(options.filters)).map(([mimeType, extensions]) => ({
          description: options.filters?.find(f => f.extensions.includes(extensions[0].slice(1)))?.name || 'Files',
          accept: { [mimeType]: extensions }
        }))
      };
      
      const handle = await window.showSaveFilePicker(pickerOptions);
      this.fileHandles.set(handle.name, handle);
      return handle.name;
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // User cancelled
        return null;
      }
      console.error('[FileService] Error saving file:', error);
      throw error;
    }
  }
  
  // Fallback save using download
  private async saveFileDialogFallback(options: SaveFileOptions): Promise<string | null> {
    // This will trigger a download rather than a save dialog
    return options.suggestedName || 'download.json';
  }
  
  // Read file contents
  async readFile(path: string): Promise<string> {
    try {
      // Check if we have a file handle
      const handle = this.fileHandles.get(path);
      if (handle) {
        const file = await handle.getFile();
        return await file.text();
      }
      
      // Fallback: try to read from a File object if provided
      throw new Error('File not found. Please open the file first.');
      
    } catch (error) {
      console.error('[FileService] Error reading file:', error);
      throw error;
    }
  }
  
  // Write file contents
  async writeFile(path: string, contents: string): Promise<void> {
    try {
      // Check if we have a file handle
      const handle = this.fileHandles.get(path);
      if (handle && 'createWritable' in handle) {
        const fileHandle = handle as FileSystemFileHandle;
        const writable = await (fileHandle as any).createWritable();
        await writable.write(contents);
        await writable.close();
        return;
      }
      
      // Fallback: download the file
      this.downloadFile(path, contents);
      
    } catch (error) {
      console.error('[FileService] Error writing file:', error);
      throw error;
    }
  }
  
  // Download file (fallback method)
  private downloadFile(filename: string, content: string): void {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  
  // Check if File System Access API is available
  isFileSystemAccessSupported(): boolean {
    return 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
  }
  
  // Clear all file handles
  clearHandles(): void {
    this.fileHandles.clear();
  }
  
  // Get file handle by name (for advanced operations)
  getFileHandle(name: string): FileSystemFileHandle | undefined {
    return this.fileHandles.get(name);
  }
}

// Export singleton instance
export const fileService = FileService.getInstance();
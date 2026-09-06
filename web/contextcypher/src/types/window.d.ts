// Window property extensions for clipboard functionality

declare global {
  interface Window {
    __clipboardNodes?: any[];
    __clipboardEdges?: any[];
    __clipboardFromCut?: boolean;
    __APP_SECRET__?: string;
  }
}

export {};
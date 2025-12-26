export enum ProcessingStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export interface ConvertedDocument {
  htmlContent: string;
  fileName: string;
}

export interface FileData {
  file: File;
  previewUrl: string;
}

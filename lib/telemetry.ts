export type SystemTelemetry = {
  timestamp: string;
  ollamaOnline: boolean;
  ollamaHost: string;
  defaultModel: string;
  pythonBackendOnline: boolean;
  pythonBackendUrl: string;
  models: string[];
  nodeVersion: string;
  platform: string;
  freeMemoryMb: number;
  totalMemoryMb: number;
};

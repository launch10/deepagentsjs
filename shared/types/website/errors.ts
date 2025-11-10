export interface ConsoleError {
  type: 'error' | 'warning';
  message: string;
  location?: string;
  stack?: string;
  timestamp: Date;
}

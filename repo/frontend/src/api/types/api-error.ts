export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
  [key: string]: unknown;
};

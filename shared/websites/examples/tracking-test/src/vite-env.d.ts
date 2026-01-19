/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_SIGNUP_TOKEN: string;
  readonly VITE_GOOGLE_ADS_SEND_TO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

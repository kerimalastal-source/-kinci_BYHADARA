/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_META_PIXEL_ID?: string;
  readonly VITE_GA_ID?: string;
  readonly VITE_GOOGLE_ADS_ID?: string;
  readonly VITE_GOOGLE_ADS_LEAD_LABEL?: string;
  readonly VITE_GOOGLE_ADS_CONTACT_LABEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

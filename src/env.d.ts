/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly PUBLIC_CLOUDINARY_CLOUD_NAME: string;
  readonly PUBLIC_STRIPE_PUBLIC_KEY: string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
  readonly STRIPE_SECRET_KEY: string;
  readonly STRIPE_WEBHOOK_SECRET: string;
  readonly CLOUDINARY_API_KEY: string;
  readonly CLOUDINARY_API_SECRET: string;
  readonly GMAIL_USER: string;
  readonly GMAIL_PASSWORD: string;
  readonly ADMIN_EMAIL: string;
  readonly GROQ_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
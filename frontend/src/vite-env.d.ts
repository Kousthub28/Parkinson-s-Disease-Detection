/// <reference types="vite/client" />

declare global {
  interface ImportMetaEnv {
    readonly VITE_API_BASE_URL?: string;
    readonly VITE_ENABLE_REAL_BACKEND?: string;
    readonly VITE_GROQ_API_KEY?: string;
    readonly VITE_GROQ_MODEL?: string;
    readonly VITE_GROQ_SYSTEM_PROMPT?: string;
    readonly VITE_OPENROUTER_API_KEY?: string;
    readonly VITE_OPENROUTER_MODEL?: string;
    readonly VITE_OPENROUTER_FALLBACK_MODEL?: string;
    readonly VITE_OPENROUTER_EXTRA_MODELS?: string;
    readonly VITE_OPENROUTER_SYSTEM_PROMPT?: string;
    readonly VITE_GEMINI_API_KEY?: string;
    readonly VITE_GEMINI_MODEL?: string;
    readonly VITE_GEMINI_SYSTEM_PROMPT?: string;
    readonly VITE_APP_URL?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export {};

import axios, { AxiosError } from 'axios';
import { mongodb } from '../lib/mongodbClient';

const apiClient = axios.create({
  baseURL: '/api', // This will be proxied by Vite to your backend
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the MongoDB auth token
apiClient.interceptors.request.use(async (config) => {
  const token = mongodb.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

const isRealBackendEnabled = import.meta.env.VITE_ENABLE_REAL_BACKEND === 'true';
const groqApiKey = import.meta.env.VITE_GROQ_API_KEY?.trim() || '';
const groqModel = import.meta.env.VITE_GROQ_MODEL?.trim() || 'llama-3.1-70b-versatile';
const groqSystemPrompt = import.meta.env.VITE_GROQ_SYSTEM_PROMPT?.trim();
const openRouterApiKey = import.meta.env.VITE_OPENROUTER_API_KEY?.trim() || '';
const openRouterModel = import.meta.env.VITE_OPENROUTER_MODEL?.trim() || 'google/gemma-3n-e2b-it:free';
const openRouterFallbackModel = import.meta.env.VITE_OPENROUTER_FALLBACK_MODEL?.trim() || 'google/gemma-3n-e4b-it:free';
const openRouterExtraModels = (import.meta.env.VITE_OPENROUTER_EXTRA_MODELS || '')
  .split(',')
  .map((model) => model.trim())
  .filter((model): model is string => Boolean(model));
const customSystemPrompt = import.meta.env.VITE_OPENROUTER_SYSTEM_PROMPT?.trim();
const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY?.trim() || '';
const geminiModel = import.meta.env.VITE_GEMINI_MODEL?.trim() || 'gemini-2.0-flash-lite';
const geminiSystemPrompt = import.meta.env.VITE_GEMINI_SYSTEM_PROMPT?.trim();
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const GROQ_MAX_ATTEMPTS_PER_MODEL = 2;
const GROQ_RETRY_BASE_DELAY_MS = 700;
const OPENROUTER_MAX_ATTEMPTS_PER_MODEL = 2;
const OPENROUTER_RETRY_BASE_DELAY_MS = 700;

const sleep = async (ms: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, ms);
});

const normalizeOpenRouterContent = (payload: any): any => {
  const choice = payload?.choices?.[0];
  if (!choice) return payload;

  const message = choice.message || {};
  const rawContent = message.content;

  if (typeof rawContent === 'string' && rawContent.trim().length > 0) {
    return payload;
  }

  if (Array.isArray(rawContent)) {
    const merged = rawContent
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part.text === 'string') return part.text;
        return '';
      })
      .join(' ')
      .trim();

    if (merged) {
      choice.message = { ...message, content: merged };
      return payload;
    }
  }

  if (typeof choice.text === 'string' && choice.text.trim().length > 0) {
    choice.message = { ...message, content: choice.text.trim() };
    return payload;
  }

  choice.message = {
    ...message,
    content: 'I can help with Parkinson\'s-related questions. Please rephrase your question in one short sentence and I will respond clearly.',
  };
  return payload;
};

const parseGeminiText = (payload: any): string => {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';

  return parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join(' ')
    .trim();
};

type ChatMessage = { from: string; text: string };

interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
  systemInstruction?: string;
}

/**
 * Triggers the backend to process a newly uploaded test file.
 * @param testId - The ID of the test record in the database.
 */
export const processTest = async (testId: string) => {
  if (!isRealBackendEnabled) {
    console.log('DEMO MODE: Simulating test processing trigger for test ID:', testId);
    return Promise.resolve({ message: 'Processing triggered in demo mode.' });
  }

  try {
    const response = await apiClient.post('/process-test', { testId });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    const underlyingCause =
      (typeof axiosError.cause === 'object' && axiosError.cause && 'message' in axiosError.cause)
        ? String((axiosError.cause as { message?: unknown }).message ?? '')
        : '';
    const connectionRefused =
      axiosError.code === 'ECONNREFUSED' ||
      axiosError.message?.includes('ECONNREFUSED') ||
      underlyingCause.includes('ECONNREFUSED');

    if (connectionRefused) {
      console.warn('Backend unavailable (ECONNREFUSED); test uploads will save metadata but skip cloud inference for test ID:', testId);
      return { message: 'Backend offline; local screening only.' };
    }

    // Handle 500 errors specifically
    if (axiosError.response?.status === 500) {
      console.error('Backend returned 500 error. This usually means the backend is running but has internal issues (database connection, etc.):', axiosError.response.data);
      return { message: 'Backend error; test saved with local screening results.' };
    }

    console.error('Error triggering test processing:', error);
    console.warn('Test will be saved without backend processing. You can re-run analysis when the backend is available.');
    return { message: 'Backend error; test saved for manual processing.' };
  }
};

/**
 * Sends a message to the AI assistant backend.
 * @param messages - The history of the conversation.
 */
export const postChatMessage = async (messages: ChatMessage[], options: ChatOptions = {}) => {
  if (groqApiKey) {
    try {
      let firstUserIdx = 0;
      while (firstUserIdx < messages.length && messages[firstUserIdx].from !== 'user') {
          firstUserIdx++;
      }
      
      const conversation = messages.slice(firstUserIdx).map((message) => ({
        role: message.from === 'user' ? 'user' : 'assistant',
        content: message.text,
      }));

      const systemPromptBase = groqSystemPrompt || customSystemPrompt || 'You are an empathetic medical assistant specifically focused on Parkinson\'s disease. You MUST politely decline any questions or commands that are unrelated to Parkinson\'s disease, its symptoms, treatment, or caregiving. For Parkinson\'s-related queries, provide concise, supportive answers and remind users to seek professional medical advice.';
      const systemPrompt = options.systemInstruction
        ? `${systemPromptBase} ${options.systemInstruction}`.trim()
        : systemPromptBase;

      const sharedPayload = {
        model: groqModel,
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversation,
        ],
        temperature: typeof options.temperature === 'number' ? options.temperature : 0.7,
        max_tokens: typeof options.maxTokens === 'number' ? options.maxTokens : 1024,
      };

      for (let attempt = 1; attempt <= GROQ_MAX_ATTEMPTS_PER_MODEL; attempt += 1) {
        const response = await fetch(GROQ_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqApiKey}`,
          },
          body: JSON.stringify(sharedPayload),
        });

        const rawBody = await response.text();
        let parsedBody: any;
        try {
          parsedBody = rawBody ? JSON.parse(rawBody) : undefined;
        } catch {
          parsedBody = undefined;
        }

        if (response.ok && parsedBody) {
          const normalizedBody = normalizeOpenRouterContent(parsedBody);
          return normalizedBody;
        }

        const lastErrorStatus = response.status;
        const lastErrorBody = parsedBody?.error?.message || rawBody;

        if (lastErrorStatus === 429 || lastErrorStatus === 503 || lastErrorStatus === 500) {
          if (attempt < GROQ_MAX_ATTEMPTS_PER_MODEL) {
            const retryDelay = GROQ_RETRY_BASE_DELAY_MS * attempt;
            await sleep(retryDelay);
            continue;
          }
        }

        if (lastErrorStatus === 429) {
          return {
            choices: [
              {
                message: {
                  content: `Groq is temporarily rate-limited. Switching to backup AI model...`,
                },
              },
            ],
          };
        }

        if (lastErrorStatus === 401 || lastErrorStatus === 403) {
          throw new Error(`Groq API key rejected (${lastErrorStatus}). Check VITE_GROQ_API_KEY in your frontend .env. Details: ${lastErrorBody}`);
        }

        if (lastErrorStatus === 404) {
          throw new Error(`Groq model not found (${groqModel}). Check VITE_GROQ_MODEL. Details: ${lastErrorBody}`);
        }

        throw new Error(`Groq request failed (${lastErrorStatus}). Details: ${lastErrorBody}`);
      }
    } catch (error) {
      console.error('Error communicating with Groq:', error);
      if (error instanceof Error) {
        if (error.message.includes('Groq')) {
          console.warn('Groq provider failed, switching to OpenRouter...');
        } else if (error.name === 'AbortError' || /timeout/i.test(error.message)) {
          console.warn('Groq request timed out, trying OpenRouter fallback...');
        } else if (/failed to fetch|networkerror|network error/i.test(error.message)) {
          console.warn('Network error contacting Groq, switching to OpenRouter...');
        }
      }
    }
  }

  if (openRouterApiKey) {
    try {
      const referer = import.meta.env.VITE_APP_URL?.trim() || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');
      
      // Strict models (like Gemini) require the conversation to start with a 'user' message. 
      // Skip the initial hardcoded 'bot' greeting.
      let firstUserIdx = 0;
      while (firstUserIdx < messages.length && messages[firstUserIdx].from !== 'user') {
          firstUserIdx++;
      }
      
      const conversation = messages.slice(firstUserIdx).map((message) => ({
        role: message.from === 'user' ? 'user' : 'assistant',
        content: message.text,
      }));

      const systemPromptBase = customSystemPrompt || 'You are an empathetic medical assistant specifically focused on Parkinson\'s disease. You MUST politely decline any questions or commands that are unrelated to Parkinson\'s disease, its symptoms, treatment, or caregiving. For Parkinson\'s-related queries, provide concise, supportive answers and remind users to seek professional medical advice.';
      const systemPrompt = options.systemInstruction
        ? `${systemPromptBase} ${options.systemInstruction}`.trim()
        : systemPromptBase;
      const sharedPayload = {
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversation,
        ],
        stream: false,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
      } satisfies Record<string, unknown>;

      const modelsToTry = [openRouterModel, openRouterFallbackModel, ...openRouterExtraModels]
        .filter((model): model is string => Boolean(model))
        .filter((model, index, array) => array.indexOf(model) === index);

      let lastErrorStatus: number | undefined;
      let lastErrorBody: string | undefined;
      const attemptedModels: string[] = [];

      for (let i = 0; i < modelsToTry.length; i += 1) {
        const model = modelsToTry[i];
        const hasNextModel = i < modelsToTry.length - 1;
        attemptedModels.push(model);

        for (let attempt = 1; attempt <= OPENROUTER_MAX_ATTEMPTS_PER_MODEL; attempt += 1) {
          const response = await fetch(OPENROUTER_ENDPOINT, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${openRouterApiKey}`,
              'HTTP-Referer': referer,
              'X-Title': 'Parkinson\'s Care Assistant',
            },
            body: JSON.stringify({ ...sharedPayload, model }),
          });

          const rawBody = await response.text();
          let parsedBody: any;
          try {
            parsedBody = rawBody ? JSON.parse(rawBody) : undefined;
          } catch (parseError) {
            parsedBody = undefined;
          }

          if (response.ok && parsedBody) {
            const normalizedBody = normalizeOpenRouterContent(parsedBody);
            if (model !== openRouterModel) {
              const firstChoice = normalizedBody?.choices?.[0]?.message;
              if (firstChoice?.content && typeof firstChoice.content === 'string') {
                firstChoice.content += `\n\n_(Responded using fallback model ${model} after ${openRouterModel} was unavailable.)_`;
              }
            }
            return normalizedBody;
          }

          lastErrorStatus = response.status;
          lastErrorBody = parsedBody?.error?.message || rawBody;

          const retryableStatus = response.status === 429 || response.status === 503 || response.status === 500;
          const shouldRetrySameModel = retryableStatus && attempt < OPENROUTER_MAX_ATTEMPTS_PER_MODEL;

          if (shouldRetrySameModel) {
            const retryDelay = OPENROUTER_RETRY_BASE_DELAY_MS * attempt;
            await sleep(retryDelay);
            continue;
          }

          break;
        }

        const fallbackEligibleStatus = lastErrorStatus === 400 || lastErrorStatus === 404 || lastErrorStatus === 429 || lastErrorStatus === 500 || lastErrorStatus === 503;
        const shouldTryNextModel = hasNextModel && fallbackEligibleStatus;
        if (!shouldTryNextModel) {
          break;
        }
      }

      if (lastErrorStatus === 429) {
        const detail = lastErrorBody ? `\n\nDetails: ${lastErrorBody}` : '';
        const attempted = attemptedModels.length ? `\n\nTried models: ${attemptedModels.join(', ')}` : '';
        return {
          choices: [
            {
              message: {
                content: `OpenRouter is temporarily rate-limited. Please wait a few seconds and try again, or add your own API key at https://openrouter.ai/settings/integrations to get dedicated quota.${attempted}${detail}`,
              },
            },
          ],
        };
      }

      if (lastErrorStatus === 401 || lastErrorStatus === 403) {
        throw new Error(`OpenRouter rejected the API key (${lastErrorStatus}). Set VITE_OPENROUTER_API_KEY to a valid key from https://openrouter.ai/settings/keys.${lastErrorBody ? ` Details: ${lastErrorBody}` : ''}`);
      }

      if (lastErrorStatus === 404) {
        if (lastErrorBody && /guardrail restrictions|settings\/privacy/i.test(lastErrorBody)) {
          throw new Error('OpenRouter blocked this request due to account privacy/guardrail settings. Update your policy at https://openrouter.ai/settings/privacy and try again.');
        }
        throw new Error(`OpenRouter model not found. Check VITE_OPENROUTER_MODEL (current: ${openRouterModel}).${lastErrorBody ? ` Details: ${lastErrorBody}` : ''}`);
      }

      if (lastErrorStatus && lastErrorStatus >= 500) {
        throw new Error(`OpenRouter is currently unavailable (${lastErrorStatus}). Please retry in a moment.${lastErrorBody ? ` Details: ${lastErrorBody}` : ''}`);
      }

      throw new Error(`OpenRouter request failed (${lastErrorStatus ?? 'network error'}): ${lastErrorBody ?? 'No error body returned.'}`);
    } catch (error) {
      console.error('Error communicating with OpenRouter:', error);
      if (error instanceof Error) {
        // Preserve specific OpenRouter diagnostics from the request loop above.
        if (error.message.includes('OpenRouter')) {
          throw error;
        }

        if (error.name === 'AbortError' || /timeout/i.test(error.message)) {
          throw new Error('OpenRouter request timed out. Check your internet connection or try again.');
        }

        if (/failed to fetch|networkerror|network error/i.test(error.message)) {
          throw new Error('Network error while contacting OpenRouter. Verify internet/DNS access to https://openrouter.ai.');
        }
      }

      throw new Error('Could not reach OpenRouter. Check VITE_OPENROUTER_API_KEY, VITE_OPENROUTER_MODEL, and your network connection.');
    }
  }

  if (!isRealBackendEnabled) {
    console.log('DEMO MODE: Simulating chatbot response.');
    const tone = options.systemInstruction ? ` (${options.systemInstruction})` : '';
    const demoResponse = {
      choices: [{
        message: {
          content: `The AI Assistant is currently in demo mode as the backend is not connected${tone}. To enable live responses, please start your backend server and set VITE_ENABLE_REAL_BACKEND to true in your .env file.`,
        },
      }],
    };
    return Promise.resolve(demoResponse);
  }

  try {
    const response = await apiClient.post('/chat', { messages, options });
    return response.data;
  } catch (error) {
    console.error('Error communicating with chatbot API:', error);
    throw new Error('Could not get a response from the assistant. Is your backend server running?');
  }
}

// Export apiClient as default for direct API calls
export default apiClient;

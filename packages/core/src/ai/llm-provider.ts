import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { AIConfig, AIEndpoint } from "../types";
import { formatApiHost } from "../utils/api";

/**
 * Optional custom fetch for streaming support (e.g. expo/fetch in React Native).
 * Set via setStreamingFetch() before creating chat models.
 */
let _streamingFetch: typeof globalThis.fetch | undefined;

export function setStreamingFetch(fetchImpl: typeof globalThis.fetch) {
  _streamingFetch = fetchImpl;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
  deepThinking?: boolean;
}

export function resolveActiveEndpoint(config: AIConfig): {
  endpoint: AIEndpoint;
  model: string;
} {
  const endpoint = config.endpoints.find((ep) => ep.id === config.activeEndpointId);
  if (!endpoint) {
    throw new Error("No active AI endpoint configured. Go to Settings → AI to add one.");
  }
  if (!endpoint.apiKey) {
    throw new Error(`API key not set for endpoint "${endpoint.name}".`);
  }
  let model = config.activeModel;
  if (!model) {
    // Try to auto-select first available model from endpoint
    if (endpoint.models && endpoint.models.length > 0) {
      model = endpoint.models[0];
    } else if (!endpoint.apiKey) {
      throw new Error("API key not configured. Go to Settings → AI to set up your API key.");
    } else {
      throw new Error(
        "No models available. Go to Settings → AI and click 'Fetch Models' to get available models.",
      );
    }
  }
  return { endpoint, model };
}

export async function createChatModel(
  config: AIConfig,
  options: LLMOptions = {},
): Promise<BaseChatModel> {
  const { endpoint, model } = resolveActiveEndpoint(config);
  return createChatModelFromEndpoint(endpoint, model, {
    temperature: options.temperature ?? config.temperature,
    maxTokens: options.maxTokens ?? config.maxTokens,
    streaming: options.streaming,
    deepThinking: options.deepThinking,
  });
}

export async function createChatModelFromEndpoint(
  endpoint: AIEndpoint,
  model: string,
  options: LLMOptions = {},
): Promise<BaseChatModel> {
  if (!endpoint.apiKey) {
    throw new Error(`API key not set for endpoint "${endpoint.name}".`);
  }
  if (!model) {
    throw new Error("No model specified. Go to Settings → AI to choose a model.");
  }

  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens ?? 4096;
  const streaming = options.streaming ?? true;

  switch (endpoint.provider) {
    case "anthropic": {
      const { ChatAnthropic } = await import("@langchain/anthropic");

      const anthropicConfig: Record<string, unknown> = {
        model,
        apiKey: endpoint.apiKey,
        temperature: options.deepThinking ? 1 : temperature,
        maxTokens,
        streaming,
        clientOptions: {
          ...(endpoint.baseUrl ? { baseURL: endpoint.baseUrl } : {}),
          ...(_streamingFetch ? { fetch: _streamingFetch } : {}),
        },
      };

      // Enable extended thinking when deepThinking is requested
      if (options.deepThinking) {
        anthropicConfig.thinking = {
          type: "enabled",
          budget_tokens: Math.min(maxTokens, 10000),
        };
      }

      return new ChatAnthropic(anthropicConfig as ConstructorParameters<typeof ChatAnthropic>[0]);
    }

    case "google": {
      const { ChatGoogleGenerativeAI } = await import("@langchain/google-genai");

      return new ChatGoogleGenerativeAI({
        model,
        apiKey: endpoint.apiKey,
        temperature,
        maxOutputTokens: maxTokens,
        streaming,
      });
    }

    case "deepseek": {
      const { ChatDeepSeek } = await import("@langchain/deepseek");

      // Create a subclass that fixes the missing reasoning_content issue.
      // Bug: @langchain/deepseek stores reasoning_content in additional_kwargs
      // when receiving, but doesn't inject it back when sending requests.
      // DeepSeek API requires reasoning_content on every assistant message
      // during tool-calling loops, or it returns a 400 error.
      class ChatDeepSeekFixed extends ChatDeepSeek {
        private _reasoningMap = new Map<number, string>();

        // biome-ignore lint: override needs any
        async _generate(messages: any[], options: any, runManager?: any) {
          this._buildReasoningMap(messages);
          return super._generate(messages, options, runManager);
        }

        // biome-ignore lint: override needs any
        async *_streamResponseChunks(messages: any[], options: any, runManager?: any) {
          this._buildReasoningMap(messages);
          yield* super._streamResponseChunks(messages, options, runManager);
        }

        // biome-ignore lint: override needs any
        // @ts-expect-error -- overloaded signature; runtime type is correct
        async completionWithRetry(request: any, requestOptions?: any) {
          // Inject reasoning_content into assistant messages in the API request
          if (request.messages && this._reasoningMap.size > 0) {
            let assistantIdx = 0;
            for (const msg of request.messages) {
              if (msg.role === "assistant") {
                const reasoning = this._reasoningMap.get(assistantIdx);
                if (reasoning !== undefined) {
                  msg.reasoning_content = reasoning;
                }
                assistantIdx++;
              }
            }
          }
          return super.completionWithRetry(request, requestOptions);
        }

        // biome-ignore lint: messages is BaseMessage[]
        private _buildReasoningMap(messages: any[]) {
          this._reasoningMap.clear();
          let assistantIdx = 0;
          for (const msg of messages) {
            if (
              msg._getType?.() === "ai" ||
              msg.constructor?.name === "AIMessage" ||
              msg.constructor?.name === "AIMessageChunk"
            ) {
              const reasoning = msg.additional_kwargs?.reasoning_content;
              if (typeof reasoning === "string") {
                this._reasoningMap.set(assistantIdx, reasoning);
              }
              assistantIdx++;
            }
          }
        }
      }

      return new ChatDeepSeekFixed({
        model,
        apiKey: endpoint.apiKey,
        configuration: {
          ...(endpoint.baseUrl ? { baseURL: formatApiHost(endpoint.baseUrl) } : {}),
          ...(_streamingFetch ? { fetch: _streamingFetch } : {}),
        },
        temperature,
        maxTokens,
        streaming,
      } as ConstructorParameters<typeof ChatDeepSeek>[0]);
    }

    default: {
      const isDeepSeek =
        endpoint.baseUrl?.includes("deepseek") ||
        model?.toLowerCase().includes("deepseek") ||
        model?.toLowerCase().includes("reasoner");

      if (isDeepSeek) {
        const { ChatDeepSeek } = await import("@langchain/deepseek");

        class ChatDeepSeekFixed extends ChatDeepSeek {
          private _reasoningMap = new Map<number, string>();

          // biome-ignore lint: override needs any
          async _generate(messages: any[], options: any, runManager?: any) {
            this._buildReasoningMap(messages);
            return super._generate(messages, options, runManager);
          }

          // biome-ignore lint: override needs any
          async *_streamResponseChunks(messages: any[], options: any, runManager?: any) {
            this._buildReasoningMap(messages);
            yield* super._streamResponseChunks(messages, options, runManager);
          }

          // biome-ignore lint: override needs any
          // @ts-expect-error -- overloaded signature; runtime type is correct
          async completionWithRetry(request: any, requestOptions?: any) {
            if (request.messages && this._reasoningMap.size > 0) {
              let assistantIdx = 0;
              for (const msg of request.messages) {
                if (msg.role === "assistant") {
                  const reasoning = this._reasoningMap.get(assistantIdx);
                  if (reasoning !== undefined) {
                    msg.reasoning_content = reasoning;
                  }
                  assistantIdx++;
                }
              }
            }
            return super.completionWithRetry(request, requestOptions);
          }

          // biome-ignore lint: messages is BaseMessage[]
          private _buildReasoningMap(messages: any[]) {
            this._reasoningMap.clear();
            let assistantIdx = 0;
            for (const msg of messages) {
              if (
                msg._getType?.() === "ai" ||
                msg.constructor?.name === "AIMessage" ||
                msg.constructor?.name === "AIMessageChunk"
              ) {
                const reasoning = msg.additional_kwargs?.reasoning_content;
                if (typeof reasoning === "string") {
                  this._reasoningMap.set(assistantIdx, reasoning);
                }
                assistantIdx++;
              }
            }
          }
        }

        return new ChatDeepSeekFixed({
          model,
          apiKey: endpoint.apiKey,
          configuration: {
            ...(endpoint.baseUrl ? { baseURL: formatApiHost(endpoint.baseUrl) } : {}),
            ...(_streamingFetch ? { fetch: _streamingFetch } : {}),
          },
          temperature,
          maxTokens,
          streaming,
        } as ConstructorParameters<typeof ChatDeepSeek>[0]);
      }

      const { ChatOpenAI } = await import("@langchain/openai");

      return new ChatOpenAI({
        model,
        apiKey: endpoint.apiKey,
        configuration: {
          baseURL: endpoint.baseUrl ? formatApiHost(endpoint.baseUrl) : undefined,
          ...(_streamingFetch ? { fetch: _streamingFetch } : {}),
        },
        temperature,
        maxTokens,
        streaming,
      });
    }
  }
}

---
draft: false
title: AI Providers
description: Configure OpenAI-compatible and native AI providers, test endpoints, and understand request URLs.
---

## What You Can Configure

ReadAny lets you configure one or more AI endpoints and then choose which one is active.

Common use cases:

- cloud chat providers like OpenAI, Anthropic, Google, DeepSeek, SiliconFlow, Moonshot, or Zhipu
- local providers like Ollama and LM Studio
- OpenAI-compatible custom endpoints

[Image path: ai-settings-overview]

## Supported Providers

| Provider | Models | Notes |
|---|---|---|
| **OpenAI** | GPT-4o, GPT-4o-mini, etc. | Requires API key |
| **Anthropic** | Claude models | Requires API key |
| **Google Gemini** | Gemini models | Requires API key |
| **DeepSeek** | Chat and reasoning models | Requires API key |
| **Ollama** | Local models | Usually no API key needed |
| **LM Studio** | OpenAI-compatible local models | Usually no API key needed |
| **Custom** | Any OpenAI-compatible endpoint | For third-party or self-hosted APIs |

## Endpoint Fields

Most providers expose the same core fields:

- **Name**: your label for the endpoint
- **Provider**: OpenAI, Anthropic, Ollama, etc.
- **API key**: required for most cloud providers
- **Base URL / endpoint URL**: optional for custom routing or self-hosted APIs
- **Models**: fetched automatically or entered manually

## Testing an Endpoint

Each endpoint card includes:

- **Fetch Models** to retrieve model names when supported
- **Test Connection** to make a real minimal model call
- **Final Request URL** preview so you can see the exact path ReadAny will hit

[Image path: ai-endpoint-test-connection-card]

If model fetching is not available for your endpoint shape, enter the model name manually and use **Test Connection**.

## OpenAI-Compatible URLs

For OpenAI-compatible endpoints, ReadAny uses two URL modes.

### Prefix Mode

This is the default:

- if you enter `https://api.openai.com`, ReadAny will usually append `/v1`
- if you enter a custom path ending with `/`, ReadAny keeps that custom path and appends only the request route

Examples:

- `https://api.openai.com` → `https://api.openai.com/v1/chat/completions`
- `https://example.com/api/` → `https://example.com/api/chat/completions`

### Exact Request URL Mode

Use this when the provider expects a non-standard full request path.

- enable **Exact Request URL**
- enter the full request URL exactly as the server expects
- ReadAny will not append `/v1`, `/chat/completions`, or `/models`
- model fetching is typically disabled in this mode, so enter the model manually

[Image path: ai-exact-request-url]

## Using Ollama

For a private local setup:

1. install [Ollama](https://ollama.com)
2. pull a model such as `ollama pull llama3.2`
3. select **Ollama** in ReadAny
4. fetch or enter the model name
5. test the endpoint

## Troubleshooting

### “No active AI endpoint configured”

- make sure one endpoint is marked as active
- confirm the endpoint and API key were actually saved

### Fetch models works but chat fails

Check:

- selected model name
- final request URL
- whether the endpoint should use Exact Request URL mode

### Local provider asks for an API key

Ollama and LM Studio usually do not require one unless you added your own gateway or auth layer.

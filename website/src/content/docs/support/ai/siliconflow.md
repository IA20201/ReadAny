---
draft: false
title: SiliconFlow Configuration Guide
description: Configure AI chat and remote embedding models with SiliconFlow.
---

[SiliconFlow](https://siliconflow.cn/) is a leading AI model service platform in China, providing rich open-source model APIs, including chat models and Embedding models.

## Why Choose SiliconFlow?

- **Affordable Pricing**: Pay-as-you-go, with free credits for new users
- **Rich Model Selection**: Supports DeepSeek, Qwen, Llama and other mainstream open-source models
- **Fast Access in China**: Servers located in China for fast access
- **Embedding Models**: Provides various Embedding models for semantic search

## Register Account

1. Visit [SiliconFlow Official Website](https://cloud.siliconflow.cn/)
2. Click "Register" to create an account
3. Complete identity verification (required for some models)

![SiliconFlow Register Page](./images/siliconflow-register.png)
*Register SiliconFlow Account*

![Identity Verification Page](./images/siliconflow-verify.png)
*Complete Identity Verification*

## Get API Key

1. After logging in, go to [API Key Management](https://cloud.siliconflow.cn/account/ak)
2. Click "Create API Key"
3. Copy the generated API Key (starts with `sk-`)

![API Key Management Page](./images/siliconflow-api-keys.png)
*API Key Management Page*

![Create New Key](./images/siliconflow-create-key.png)
*Click Create API Key*

![Copy API Key](./images/siliconflow-copy-key.png)
*Copy Generated API Key*

:::warning
Please keep your API Key safe and do not share it with others.
:::

## Configure AI Chat

### Steps

1. Go to **Settings → AI**
2. Click "Add Endpoint"
3. Select **SiliconFlow** as provider
4. Enter your API Key
5. Click "Fetch Models" to get available models
6. Select the model you want to use

![ReadAny AI Settings Page](./images/readany-ai-settings.png)
*ReadAny AI Settings Page*

![Add SiliconFlow Endpoint](./images/readany-add-siliconflow.png)
*Add SiliconFlow Endpoint*

![Enter API Key](./images/readany-enter-apikey.png)
*Enter API Key and Fetch Models*

![Select Model](./images/readany-select-model.png)
*Select Model to Use*

### Recommended Models

| Model | Description |
|---|---|
| **DeepSeek-V3** | Strong overall capability, suitable for daily chat |
| **DeepSeek-R1** | Strong reasoning ability, suitable for complex analysis |
| **Qwen2.5-72B-Instruct** | Alibaba open-source, strong Chinese capability |
| **Llama-3.3-70B-Instruct** | Meta open-source, strong English capability |

## Configure Embedding Model (Semantic Search)

SiliconFlow provides various Embedding models for book semantic search functionality.

### Steps

1. Go to **Settings → Embedding Model**
2. Select "Remote API"
3. Select **SiliconFlow** as provider
4. Enter your API Key
5. Select an Embedding model

![Embedding Model Settings Page](./images/readany-embedding-settings.png)
*Embedding Model Settings Page*

![Select SiliconFlow Embedding Model](./images/readany-embedding-siliconflow.png)
*Select SiliconFlow as Embedding Model Provider*

### Recommended Embedding Models

| Model | Max Length | Description |
|---|---|---|
| **BAAI/bge-m3** | 8192 | Multilingual support, recommended for Chinese users |
| **BAAI/bge-large-zh-v1.5** | 512 | Chinese-specific, fast |
| **BAAI/bge-large-en-v1.5** | 512 | English-specific |
| **Qwen/Qwen3-Embedding** | 32768 | Alibaba open-source, ultra-long text support |

### Using Embedding Model

After configuration:

1. Open a book
2. Click the "Vectorize" button in the sidebar
3. Select "Use Remote API"
4. Wait for processing to complete

![Book Vectorize Button](./images/readany-vectorize-button.png)
*Click Vectorize Button*

![Select Remote API](./images/readany-vectorize-remote.png)
*Select Use Remote API for Vectorization*

![Vectorization Progress](./images/readany-vectorize-progress.png)
*Vectorization Processing Progress*

Embedding data will be sent to SiliconFlow servers for processing, and the index will be saved locally after completion.

:::info
Mobile only supports remote embedding API, not local embedding models (to reduce app size).
:::

## Pricing

SiliconFlow uses pay-as-you-go pricing:

- **Chat Models**: Charged by input/output token count
- **Embedding Models**: Charged by processed token count

New users get free credits after registration. Check the official website for details.

![SiliconFlow Billing Page](./images/siliconflow-billing.png)
*Billing and Usage Statistics Page*

## Troubleshooting

### API Key Invalid

**Symptoms**: "API Key invalid" or "Authentication failed" error

**Solutions**:
- Confirm the API Key is correctly copied without extra spaces
- Check if identity verification is completed
- Confirm account balance is sufficient
- Try creating a new API Key

### Model List Empty

**Symptoms**: Model list is empty or errors after clicking "Fetch Models"

**Solutions**:
- Check network connection
- Confirm API Key is valid
- Some models need to be enabled in SiliconFlow console first
- Try manually entering the model name

### Vectorization Failed

**Symptoms**: Vectorization process interrupted or errors

**Solutions**:
- Check if embedding model is correctly configured
- Confirm account balance is sufficient
- Large files may take longer to process, please wait patiently
- Check network connection stability
- Try switching to another Embedding model

### Connection Timeout

**Symptoms**: Request timeout or no response

**Solutions**:
- Check network connection
- If overseas, may need to use a proxy
- Check if SiliconFlow service is normal (check official announcements)
- Try changing network environment

### Model Not Responding

**Symptoms**: No reply for a long time after sending message

**Solutions**:
- Check if model is available in current region
- Confirm model name is correct
- Try switching to another model
- Check if account has sufficient balance

### Insufficient Balance

**Symptoms**: "Insufficient balance" or "Quota exhausted" error

**Solutions**:
- Login to SiliconFlow console to check balance
- Top up account
- Check if there are unclaimed free credits

### Rate Limit

**Symptoms**: "Too many requests" or "Rate Limit" error

**Solutions**:
- Reduce request frequency
- Wait for a while and retry
- Upgrade account level for higher limits

## Screenshot Checklist

Please prepare the following screenshots and place them in `website/src/content/docs/support/ai/images/` directory:

| Filename | Description |
|---|---|
| `siliconflow-register.png` | SiliconFlow register page |
| `siliconflow-verify.png` | Identity verification page |
| `siliconflow-api-keys.png` | API key management page |
| `siliconflow-create-key.png` | Create new key popup |
| `siliconflow-copy-key.png` | Copy API key |
| `readany-ai-settings.png` | ReadAny AI settings page |
| `readany-add-siliconflow.png` | Add SiliconFlow endpoint |
| `readany-enter-apikey.png` | Enter API key |
| `readany-select-model.png` | Select model |
| `readany-embedding-settings.png` | Embedding model settings page |
| `readany-embedding-siliconflow.png` | Select SiliconFlow embedding model |
| `readany-vectorize-button.png` | Book vectorize button |
| `readany-vectorize-remote.png` | Select remote API |
| `readany-vectorize-progress.png` | Vectorization progress |
| `siliconflow-billing.png` | Billing statistics page |

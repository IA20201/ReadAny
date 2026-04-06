---
draft: false
title: AI 服务商
description: 配置 OpenAI 兼容和原生 AI 服务商，测试端点，并理解最终请求地址。
---

## 可以配置什么

ReadAny 支持同时配置多个 AI 端点，并从中选择一个当前激活端点。

常见场景包括：

- OpenAI、Anthropic、Google、DeepSeek、硅基流动、Moonshot、智谱等云端服务
- Ollama、LM Studio 这样的本地模型服务
- 任意 OpenAI 兼容的第三方或自建接口

[图片路径：AI 设置总览]

## 支持的服务商

| Provider | Models | Notes |
|---|---|---|
| **OpenAI** | GPT-4o 等 | 需要 API key |
| **Anthropic** | Claude 系列 | 需要 API key |
| **Google Gemini** | Gemini 系列 | 需要 API key |
| **DeepSeek** | 对话和推理模型 | 需要 API key |
| **Ollama** | 本地模型 | 通常不需要 API key |
| **LM Studio** | OpenAI 兼容本地模型 | 通常不需要 API key |
| **Custom** | 任意 OpenAI 兼容接口 | 适合第三方或自建服务 |

## 端点字段说明

大多数端点都会包含这些字段：

- **名称**：你给这个端点起的名字
- **Provider**：OpenAI、Anthropic、Ollama 等
- **API 密钥**：多数云端服务需要
- **接口地址 / Base URL**：用于自定义路由或自建接口
- **模型列表**：可自动拉取或手动填写

## 端点测试

每个端点卡片里通常都有：

- **拉取模型**：用于读取模型列表
- **测试连接**：会真正发起一次最小模型调用
- **最终请求地址**：展示 ReadAny 最终实际请求的 URL

[图片路径：AI 端点测试连接卡片]

如果你的端点无法拉模型，可以手动填模型名，再用 **测试连接** 验证。

## OpenAI 兼容接口地址规则

对于 OpenAI 兼容端点，ReadAny 提供两种 URL 模式。

### 前缀模式

这是默认模式：

- 如果你填 `https://api.openai.com`，ReadAny 通常会自动补 `/v1`
- 如果你填了一个以 `/` 结尾的自定义路径，ReadAny 会保留这个路径，只再拼接请求路由

例如：

- `https://api.openai.com` → `https://api.openai.com/v1/chat/completions`
- `https://example.com/api/` → `https://example.com/api/chat/completions`

### 完全自定义请求地址

当服务端的最终请求地址不是标准 OpenAI 路径时，用这个模式。

- 打开 **完全自定义请求地址**
- 把完整请求 URL 原样填进去
- ReadAny 不会再自动补 `/v1`、`/chat/completions`、`/models`
- 这种模式下一般也无法可靠拉取模型，需要手动填写模型名

[图片路径：AI 完全自定义请求地址]

## 使用 Ollama

如果你想本地私有运行 AI：

1. 安装 [Ollama](https://ollama.com)
2. 先拉一个模型，例如 `ollama pull llama3.2`
3. 在 ReadAny 中选择 **Ollama**
4. 拉取或手动填写模型名
5. 使用 **测试连接** 验证

## 排障

### “No active AI endpoint configured”

- 确认至少有一个端点被设为当前激活端点
- 确认端点和 API key 已经真正保存

### 能拉到模型，但实际聊天失败

优先检查：

- 选中的模型名
- **最终请求地址**
- 这个端点是否应该开启 **完全自定义请求地址**

### 本地模型却提示缺少 API key

Ollama 和 LM Studio 通常不需要 API key。只有当你的本地服务自己加了鉴权，才需要在端点里填写。

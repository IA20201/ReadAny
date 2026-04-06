---
draft: false
title: FAQ
description: Frequently asked questions about ReadAny.
---

[Image path: support-center-faq-navigation]

## General

### Is ReadAny free?

Yes. ReadAny is open source and free to use.

### Does ReadAny upload my books by default?

No. ReadAny is local-first. Books stay on your device unless you explicitly configure cloud AI, sync, export, or LAN transfer features.

### Is ReadAny available on desktop and mobile?

Yes. Desktop and mobile builds exist, but some workflows and settings differ by platform.

## Books and Reading

### Does ReadAny support DRM-protected books?

No. DRM-free books only.

### Why does a synced book show up before it can open?

Because metadata and covers can arrive before the full file is downloaded locally. Open the book again and let it download first.

### Can I keep notes without keeping the highlight?

Notes are attached to highlights. Clearing note text should keep the highlight, while deleting the highlight removes both.

## AI

### Do I need an API key?

For most cloud providers, yes. For Ollama and LM Studio, usually no.

### What does “Test Connection” actually test?

It performs a real minimal model call, not just a shallow health check.

### Why does model fetching work but chat still fail?

Usually because the selected model name, request path, or custom endpoint mode is wrong.

## Semantic Search

### What is vectorization?

Vectorization builds a local semantic index for a book so you can search by meaning.

### Are vectors synced?

No. Vector indexes stay local to each device.

## Sync

### Which sync mode should I choose?

- WebDAV or S3 for long-term multi-device sync
- LAN quick transfer for one-off device migration

### What is the difference between full upload and full download?

- **Full Upload** replaces the remote side with this device
- **Full Download** replaces this device with the remote side

### Why is LAN not treated like normal cloud sync?

Because LAN quick transfer is designed as one-way migration, not long-term two-way background sync.

## Desktop Storage

### Can I move the desktop library off my system drive?

Yes. Use **Settings → General → Desktop Library Storage Location**.

### What gets moved when I change the desktop storage location?

Books, covers, and desktop database files, including vector-related databases.

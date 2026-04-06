---
draft: false
title: Sync Overview
description: Understand WebDAV, S3, LAN quick transfer, and full sync options.
---

ReadAny supports three different ways to move data between devices. They are not identical, and choosing the right one matters.

## The Three Sync Modes

| Mode | Best for | Direction | Notes |
|---|---|---|---|
| **WebDAV** | Long-term multi-device sync | Two-way | Good default for personal cloud storage |
| **S3** | Long-term multi-device sync | Two-way | Good for S3-compatible object storage |
| **LAN Quick Transfer** | One-off migration | One-way import | Best when moving data from one device to another on the same network |

[Image path: sync-settings-overview]

## What Syncs

Depending on the backend and sync mode, ReadAny can sync:

- book metadata
- reading progress
- highlights and notes
- reading sessions and reading stats
- covers
- book files

## What Does Not Sync

Vector indexes are local-only.

That means:

- if one device has already vectorized a book, another device does **not** automatically receive those vectors
- the local vectorized state should follow the actual local index on that device
- sync should not overwrite a device's existing local vectors

## Normal Sync vs Full Sync

### Normal Sync

Used for daily sync.

- merges recent metadata changes
- syncs reading progress, notes, and stats
- uploads missing files and covers when needed
- may download books on demand instead of pre-downloading every file

### Full Upload

Use this when one device has the complete or correct library and you want to replace remote data with it.

- uploads the current device's database snapshot
- uploads books and covers
- overwrites the remote side used for future sync

### Full Download

Use this when you want to replace the current device with the remote copy.

- downloads the remote database snapshot
- downloads books and covers
- overwrites the current device's corresponding data

[Image path: full-upload-and-full-download-actions]

## Automatic Sync

Automatic sync is meant for **WebDAV** and **S3**.

- it can run on an interval
- it can be limited to Wi-Fi
- you can still trigger manual sync at any time

LAN quick transfer is not long-term auto-sync. It is a one-off import flow.

## Recommended Setup

- **Single user, multiple devices**: WebDAV or S3
- **Moving from old device to new device**: LAN quick transfer
- **Resetting a broken device from a good one**: Full upload on the good device, then full download on the other device

## Related Guides

- [WebDAV Sync](/ReadAny/support/sync/webdav/)
- [S3 Sync](/ReadAny/support/sync/s3/)
- [LAN Quick Transfer](/ReadAny/support/sync/lan/)

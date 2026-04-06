---
draft: false
title: WebDAV Sync
description: Configure WebDAV sync for books, notes, covers, and reading data.
---

WebDAV is a good default choice if you want long-term sync across multiple devices without using S3.

## What WebDAV Sync Can Do

WebDAV sync can be used for:

- reading progress
- highlights and notes
- reading stats
- book metadata
- covers
- book files

## Basic Setup

1. Go to **Settings → Sync → WebDAV**
2. Enter the server URL
3. Enter username and password
4. Test the connection
5. Save the config
6. Run a manual sync

[Image path: webdav-sync-settings]
[Image path: webdav-server-url-example]

## URL Tips

Use the exact WebDAV root your service expects. For example, some services require a full DAV path instead of a generic account homepage.

## Daily Sync vs Full Sync

### Daily Sync

Use this for normal use.

- merges recent changes
- syncs notes, progress, and stats
- uploads or downloads files when needed

### Full Upload / Full Download

Use these when one side should replace the other more completely.

- **Full Upload**: overwrite the remote side with this device
- **Full Download**: overwrite this device with the remote side

[Image path: webdav-full-sync-actions]

## Automatic Sync

WebDAV supports automatic sync:

- interval-based sync
- optional Wi-Fi-only mode
- manual sync at any time

## Common Issues

### Connection test keeps failing

Check:

- URL
- username
- password or app password
- whether the server is reachable from the current network

### Sync stays on checking

This usually means the connection test never completed or failed before the sync phase began. Re-run **Test Connection** first.

### A synced book exists but still needs download

That can happen when metadata arrived before the file was downloaded locally. Open the book again and let ReadAny download it.

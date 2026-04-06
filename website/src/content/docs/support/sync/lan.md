---
draft: false
title: LAN Quick Transfer
description: Move your library from one device to another on the same local network.
---

LAN quick transfer is for **one-off migration**, not long-term automatic sync.

Use it when:

- you are moving from an old device to a new device
- both devices are on the same local network
- you want a fast import without configuring WebDAV or S3 first

## How It Works

One device acts as the **sender**.

The other device acts as the **import target**.

The import target connects to the sender over the same LAN and downloads:

- database snapshot
- books
- covers

This import can overwrite the target device's corresponding data.

[Image path: lan-transfer-overview]

## Recommended Flow

### On the source device

1. Open **Settings → Sync → LAN**
2. Choose **Send This Device**
3. Start the LAN server
4. Keep the app open

### On the target device

1. Open **Settings → Sync → LAN**
2. Choose **Import From Device**
3. Scan the QR code or enter IP, port, and pair code manually
4. Confirm the overwrite warning
5. Start the import

[Image path: lan-manual-import-form]

## Important Notes

- LAN quick transfer is a **one-way import**
- it is best used for migration, not merge workflows
- it does **not** replace WebDAV or S3 for daily multi-device sync
- auto-sync and sync interval do not apply to this mode

## Desktop and Mobile Differences

- mobile can scan a QR code when supported by the device
- desktop typically uses manual entry for the import target
- both sides still need to be on the same local network

## Troubleshooting

### Cannot connect to the sender

Check:

- both devices are on the same LAN
- the sender app is still open
- the pair code matches
- the IP and port are correct

### Import completed but some books are missing

Try again with the source device kept awake and the app left open until the transfer finishes.

### Can I keep LAN sync running all the time?

You can, but that is not what this mode is designed for. For ongoing sync, use WebDAV or S3.

---
draft: false
title: Desktop Library Storage Location
description: Change where the desktop app stores books, covers, and databases.
---

Desktop ReadAny can move its managed library data to another folder. This is useful if your system drive is small or you want to keep a large library on another disk.

## Desktop Only

This feature is for the desktop app. Mobile apps use their own sandboxed storage model.

## What Gets Moved

When you change the desktop library location, ReadAny can migrate:

- imported book files
- covers
- `readany.db`
- `readany_local.db`
- `vectors.db`
- SQLite sidecar files such as `-wal`, `-shm`, and `-journal`

[Image path: desktop-storage-location-settings]

## How To Change It

1. Open **Settings → General**
2. Find **Desktop Library Storage Location**
3. Choose a target folder
4. Start migration
5. Wait for migration to complete
6. The desktop app will restart so it can reopen the databases from the new path

[Image path: desktop-storage-migration-confirmation]

## Restore the Default Location

You can also return to the default app data directory by using **Restore Default Location**.

ReadAny will migrate the managed data back and then restart the app.

## Good Use Cases

- moving a large library off the system disk
- placing the library on a larger SSD
- keeping books and vector data together in a custom location

## Important Notes

- choose a folder on a stable local disk when possible
- avoid removing the external drive while ReadAny is running
- let migration finish before force-quitting the app
- keep a backup if you are moving a very large library for the first time

## Troubleshooting

### The app restarted after migration

This is expected. The desktop app restarts so the main database and vector database reopen from the new location.

### The form still shows the old path

The path field should update after a successful migration or reset. If it does not, reopen Settings once after the restart.

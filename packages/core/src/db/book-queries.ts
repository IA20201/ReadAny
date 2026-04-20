import type { Book, ReadingStatus } from "../types";
import { getDB, getLocalDB, getDeviceId, nextSyncVersion, nextUpdatedAt, insertTombstone, parseJSON } from "./db-core";

interface BookRow {
  id: string;
  file_path: string;
  format: string;
  title: string;
  author: string;
  publisher: string | null;
  language: string | null;
  isbn: string | null;
  description: string | null;
  cover_url: string | null;
  publish_date: string | null;
  subjects: string | null;
  total_pages: number;
  total_chapters: number;
  added_at: number;
  last_opened_at: number | null;
  updated_at: number;
  progress: number;
  current_cfi: string | null;
  is_vectorized: number;
  vectorize_progress: number;
  tags: string;
  file_hash: string | null;
  sync_status: string;
  reading_status: string | null;
  rating: number | null;
  short_review: string | null;
}

function rowToBook(row: BookRow): Book {
  return {
    id: row.id,
    filePath: row.file_path,
    format: (row.format as Book["format"]) || "epub",
    meta: {
      title: row.title,
      author: row.author,
      publisher: row.publisher || undefined,
      language: row.language || undefined,
      isbn: row.isbn || undefined,
      description: row.description || undefined,
      coverUrl: row.cover_url || undefined,
      publishDate: row.publish_date || undefined,
      subjects: parseJSON(row.subjects, undefined),
      totalPages: row.total_pages || undefined,
      totalChapters: row.total_chapters || undefined,
    },
    addedAt: row.added_at,
    lastOpenedAt: row.last_opened_at || undefined,
    updatedAt: row.updated_at || row.added_at,
    progress: row.progress,
    currentCfi: row.current_cfi || undefined,
    isVectorized: row.is_vectorized === 1,
    vectorizeProgress: row.vectorize_progress,
    tags: parseJSON(row.tags, []),
    fileHash: row.file_hash || undefined,
    syncStatus: (row.sync_status as Book["syncStatus"]) || "local",
    readingStatus: (row.reading_status as ReadingStatus) || "unread",
    rating: row.rating || undefined,
    shortReview: row.short_review || undefined,
  };
}

export async function getBooks(): Promise<Book[]> {
  const database = await getDB();
  const rows = await database.select<BookRow>(
    "SELECT * FROM books ORDER BY last_opened_at DESC, added_at DESC",
  );
  return rows.map(rowToBook);
}

export async function getBook(id: string): Promise<Book | null> {
  const database = await getDB();
  const rows = await database.select<BookRow>("SELECT * FROM books WHERE id = ?", [id]);
  return rows.length > 0 ? rowToBook(rows[0]) : null;
}

export async function insertBook(book: Book): Promise<void> {
  const database = await getDB();
  const deviceId = await getDeviceId();
  const syncVersion = await nextSyncVersion(database, "books");
  const now = Date.now();
  await database.execute(
    `INSERT INTO books (id, file_path, format, title, author, publisher, language, isbn, description, cover_url, publish_date, subjects, total_pages, total_chapters, added_at, last_opened_at, updated_at, progress, current_cfi, is_vectorized, vectorize_progress, tags, file_hash, sync_status, reading_status, rating, short_review, sync_version, last_modified_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      book.id,
      book.filePath,
      book.format || "epub",
      book.meta.title,
      book.meta.author,
      book.meta.publisher || null,
      book.meta.language || null,
      book.meta.isbn || null,
      book.meta.description || null,
      book.meta.coverUrl || null,
      book.meta.publishDate || null,
      book.meta.subjects ? JSON.stringify(book.meta.subjects) : null,
      book.meta.totalPages || 0,
      book.meta.totalChapters || 0,
      book.addedAt,
      book.lastOpenedAt || null,
      now,
      book.progress,
      book.currentCfi || null,
      book.isVectorized ? 1 : 0,
      book.vectorizeProgress,
      JSON.stringify(book.tags),
      book.fileHash || null,
      book.syncStatus || "local",
      book.readingStatus || "unread",
      book.rating || null,
      book.shortReview || null,
      syncVersion,
      deviceId,
    ],
  );
}

export async function updateBook(id: string, updates: Partial<Book>): Promise<void> {
  const database = await getDB();
  const sets: string[] = [];
  const values: unknown[] = [];

  if (updates.filePath !== undefined) {
    sets.push("file_path = ?");
    values.push(updates.filePath);
  }
  if (updates.meta?.title !== undefined) {
    sets.push("title = ?");
    values.push(updates.meta.title);
  }
  if (updates.meta?.author !== undefined) {
    sets.push("author = ?");
    values.push(updates.meta.author);
  }
  if (updates.meta?.coverUrl !== undefined) {
    sets.push("cover_url = ?");
    values.push(updates.meta.coverUrl || null);
  }
  if (updates.meta?.publisher !== undefined) {
    sets.push("publisher = ?");
    values.push(updates.meta.publisher || null);
  }
  if (updates.meta?.description !== undefined) {
    sets.push("description = ?");
    values.push(updates.meta.description || null);
  }
  if (updates.meta?.language !== undefined) {
    sets.push("language = ?");
    values.push(updates.meta.language || null);
  }
  if (updates.meta?.totalPages !== undefined) {
    sets.push("total_pages = ?");
    values.push(updates.meta.totalPages);
  }
  if (updates.format !== undefined) {
    sets.push("format = ?");
    values.push(updates.format);
  }
  if (updates.progress !== undefined) {
    sets.push("progress = ?");
    values.push(updates.progress);
  }
  if (updates.currentCfi !== undefined) {
    sets.push("current_cfi = ?");
    values.push(updates.currentCfi);
  }
  if (updates.lastOpenedAt !== undefined) {
    sets.push("last_opened_at = ?");
    values.push(updates.lastOpenedAt);
  }
  if (updates.isVectorized !== undefined) {
    sets.push("is_vectorized = ?");
    values.push(updates.isVectorized ? 1 : 0);
  }
  if (updates.vectorizeProgress !== undefined) {
    sets.push("vectorize_progress = ?");
    values.push(updates.vectorizeProgress);
  }
  if (updates.tags !== undefined) {
    sets.push("tags = ?");
    values.push(JSON.stringify(updates.tags));
  }
  if (updates.fileHash !== undefined) {
    sets.push("file_hash = ?");
    values.push(updates.fileHash);
  }
  if (updates.syncStatus !== undefined) {
    sets.push("sync_status = ?");
    values.push(updates.syncStatus);
  }
  if (updates.readingStatus !== undefined) {
    sets.push("reading_status = ?");
    values.push(updates.readingStatus);
  }
  if (updates.rating !== undefined) {
    sets.push("rating = ?");
    values.push(updates.rating || null);
  }
  if (updates.shortReview !== undefined) {
    sets.push("short_review = ?");
    values.push(updates.shortReview || null);
  }

  if (sets.length === 0) return;

  // Add sync tracking fields
  const deviceId = await getDeviceId();
  const syncVersion = await nextSyncVersion(database, "books");
  const updatedAt = await nextUpdatedAt(database, "books", id);
  sets.push("updated_at = ?");
  values.push(updatedAt);
  sets.push("sync_version = ?");
  values.push(syncVersion);
  sets.push("last_modified_by = ?");
  values.push(deviceId);

  values.push(id);
  await database.execute(`UPDATE books SET ${sets.join(", ")} WHERE id = ?`, values);
}

export async function setBookSyncStatus(id: string, syncStatus: Book["syncStatus"]): Promise<void> {
  const database = await getDB();
  await database.execute("UPDATE books SET sync_status = ? WHERE id = ?", [syncStatus, id]);
}

export async function deleteBook(id: string): Promise<void> {
  const database = await getDB();

  // Delete all related data first to maintain referential integrity
  // Delete highlights
  await database.execute("DELETE FROM highlights WHERE book_id = ?", [id]);

  // Delete bookmarks
  await database.execute("DELETE FROM bookmarks WHERE book_id = ?", [id]);

  // Delete reading sessions
  await database.execute("DELETE FROM reading_sessions WHERE book_id = ?", [id]);

  // Delete chunks from local DB
  const localDatabase = await getLocalDB();
  await localDatabase.execute("DELETE FROM chunks WHERE book_id = ?", [id]);

  // Finally, delete the book itself
  await insertTombstone(database, id, "books");
  await database.execute("DELETE FROM books WHERE id = ?", [id]);
}

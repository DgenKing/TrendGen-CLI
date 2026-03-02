import { Database } from "bun:sqlite";
import path from "path";

const DB_PATH = path.join(process.cwd(), "x_post_data.db");

let db: Database | null = null;

export function getDb(): Database {
  if (!db) {
    db = new Database(DB_PATH);
    initDb();
  }
  return db;
}

function initDb(): void {
  if (!db) return;

  // posts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY,
      tweet_id TEXT,
      text TEXT,
      image_path TEXT,
      posted_at TEXT,
      status TEXT
    )
  `);

  // comments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY,
      tweet_id TEXT,
      reply_to_tweet_id TEXT,
      reply_to_user TEXT,
      text TEXT,
      search_query TEXT,
      posted_at TEXT,
      status TEXT
    )
  `);

  // daily_counts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_counts (
      date TEXT PRIMARY KEY,
      posts_count INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0
    )
  `);

  // Track replied tweets to avoid duplicate replies
  db.exec(`
    CREATE TABLE IF NOT EXISTS replied_tweets (
      id INTEGER PRIMARY KEY,
      original_tweet_id TEXT UNIQUE,
      replied_at TEXT
    )
  `);
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

export function getTodayPostCount(): number {
  const db = getDb();
  const today = getToday();
  const row = db.prepare("SELECT posts_count FROM daily_counts WHERE date = ?").get(today) as { posts_count: number } | undefined;
  return row?.posts_count ?? 0;
}

export function getTodayCommentCount(): number {
  const db = getDb();
  const today = getToday();
  const row = db.prepare("SELECT comments_count FROM daily_counts WHERE date = ?").get(today) as { comments_count: number } | undefined;
  return row?.comments_count ?? 0;
}

export function incrementPostCount(): void {
  const db = getDb();
  const today = getToday();
  db.prepare(`
    INSERT INTO daily_counts (date, posts_count, comments_count)
    VALUES (?, 1, 0)
    ON CONFLICT(date) DO UPDATE SET posts_count = posts_count + 1
  `).run(today);
}

export function incrementCommentCount(): void {
  const db = getDb();
  const today = getToday();
  db.prepare(`
    INSERT INTO daily_counts (date, posts_count, comments_count)
    VALUES (?, 0, 1)
    ON CONFLICT(date) DO UPDATE SET comments_count = comments_count + 1
  `).run(today);
}

export interface PostRecord {
  tweet_id: string;
  text: string;
  image_path: string | null;
  posted_at: string;
  status: string;
}

export function logPost(post: PostRecord): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO posts (tweet_id, text, image_path, posted_at, status)
    VALUES (?, ?, ?, ?, ?)
  `).run(post.tweet_id, post.text, post.image_path, post.posted_at, post.status);
}

export interface CommentRecord {
  tweet_id: string;
  reply_to_tweet_id: string;
  reply_to_user: string;
  text: string;
  search_query: string;
  posted_at: string;
  status: string;
}

export function logComment(comment: CommentRecord): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO comments (tweet_id, reply_to_tweet_id, reply_to_user, text, search_query, posted_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    comment.tweet_id,
    comment.reply_to_tweet_id,
    comment.reply_to_user,
    comment.text,
    comment.search_query,
    comment.posted_at,
    comment.status
  );
}

export function hasRepliedToTweet(originalTweetId: string): boolean {
  const db = getDb();
  const row = db.prepare("SELECT 1 FROM replied_tweets WHERE original_tweet_id = ?").get(originalTweetId);
  return !!row;
}

export function markTweetReplied(originalTweetId: string): void {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO replied_tweets (original_tweet_id, replied_at)
    VALUES (?, ?)
  `).run(originalTweetId, new Date().toISOString());
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

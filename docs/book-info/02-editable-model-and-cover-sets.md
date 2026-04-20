# Editable Model, Ratings And Reviews

## 为什么很多东西都应该可编辑

"书籍信息"如果完全相信导入元数据，体验一定会很僵。

因为用户实际遇到的问题很多：

- 标题错了
- 作者信息不完整
- 简介缺失
- 封面不好看
- 文件来自不同来源，元数据质量不同
- 用户想为一本书补自己的评价和理解

所以这块必须明确区分两种信息：

1. `原始元数据`（文件提取 + 导入时的数据）
2. `用户附加数据`（评分、状态、短评、封面替换、元数据修正）

## 两层模型

### 1. 原始元数据（已有）

来源：

- EPUB/PDF/MOBI 等文件内嵌元数据（通过 `DocumentLoader` / `pdfjs` / `OPF` 解析）
- 导入时自动提取

当前已有字段（`BookMeta` 类型）：

- `title` / `author` / `publisher` / `language`
- `isbn` / `description` / `coverUrl`
- `publishDate` / `subjects` / `totalPages` / `totalChapters`

这些字段存在 `books` 表中，保持原值不变。

### 2. 用户附加数据（需新增）

这是用户对这本书的修正、评价和个性化标记。

包括：

- 元数据修正（标题、作者等覆写）
- 阅读状态（未读 / 在读 / 读完 / 搁置 / 弃读）
- 星级评分
- 一句话短评
- 主封面替换

## 建议可编辑字段矩阵

| 字段 | 是否可编辑 | 优先级 | 备注 |
|---|---|---|---|
| 封面 | 是 | P0 | 替换主封面，单张 |
| 阅读状态 | 是 | P0 | 新增字段，带自动流转 |
| 评分 | 是 | P0 | 新增字段，1-5 星整星 |
| 一句话短评 | 是 | P0 | 新增字段 |
| 标题 | 是 | P1 | 覆写原始值 |
| 作者 | 是 | P1 | 覆写原始值 |
| 标签 | 是 | P1 | 已有 tags 字段 |
| 简介 | 是 | P2 | 覆写原始值 |
| 出版社 | 是 | P2 | 覆写原始值 |
| ISBN | 是 | P2 | 覆写原始值 |
| 语言 | 是 | P2 | 覆写原始值 |

> P0 = Phase 1 必做，P1 = Phase 2 做，P2 = 后续按需。

## 关于封面

MVP 阶段只做 **主封面替换**，不做封面集。

理由：

- 绝大多数用户就一个封面，少数用户会换一次
- "封面集"（多封面管理、分组、排序、不同场景设不同封面）复杂度极高，收益极低
- 后续如果确实有需求，再扩展为封面列表

MVP 封面能力：

- 点击封面 → 从相册/文件选择新封面
- 新封面保存到 `covers/{bookId}.{ext}`，覆盖原封面路径
- 更新 `books` 表的 `cover_url` 字段

## 评分

评分至少应该支持：

- 1-5 星整星（不做半星，降低交互复杂度）
- 可改
- 可清空（恢复为未评分）

评分展示位置：

- 移动端：标题区下方，轻量星级条
- 桌面端：左栏，紧挨标题

## 书评

MVP 只做 **一句话短评**。

理由：

- 长评需要富文本编辑器，投入产出比低
- 标签化评价（"节奏快/慢"、"易读/难读"）需要有足够多的书被标记后才有聚合价值，单机应用不成立
- 一句话短评门槛低，大多数用户愿意写

实现：

- 一个 `TEXT` 字段，限制 200 字
- 可编辑、可清空
- 展示在评分下方

## 建议的新数据结构

### 方案：扩展现有 books 表

考虑到 MVP 新增字段不多，不另建表，直接在 `books` 表上加字段：

```sql
ALTER TABLE books ADD COLUMN reading_status TEXT DEFAULT 'unread';
-- 'unread' | 'reading' | 'finished' | 'shelved' | 'dropped'

ALTER TABLE books ADD COLUMN rating INTEGER;
-- 1-5, NULL = 未评分

ALTER TABLE books ADD COLUMN short_review TEXT;
-- 一句话短评, 限 200 字
```

理由：

- 阅读状态、评分、短评是每本书一条记录，和 Book 是 1:1 关系
- 不需要额外的 `book_review` 表
- 减少 JOIN 查询开销
- 与现有 `book-queries.ts` 的 `rowToBook` 映射天然兼容

### 对应 TypeScript 类型变更

```typescript
// packages/core/src/types/book.ts

// 新增到 Book 接口:
readingStatus: ReadingStatus;
rating?: number;        // 1-5, undefined = 未评分
shortReview?: string;   // 一句话短评

// 新增类型:
type ReadingStatus = 'unread' | 'reading' | 'finished' | 'shelved' | 'dropped';
```

### 元数据修正方案（Phase 2）

当实现元数据编辑时，采用 `meta_override` JSON 字段：

```sql
ALTER TABLE books ADD COLUMN meta_override TEXT;
-- JSON: { "title": "用户修正的标题", "author": "用户修正的作者" }
```

UI 层读取时优先取 `meta_override` 中的值，fallback 到原始 `meta` 字段。这样原始元数据不被破坏，用户修正可随时回退。

## 数据迁移策略

现有 `books` 表已有数据，加字段时需要注意：

1. **`reading_status`**：默认值 `'unread'`，但对于 `progress > 0` 的书应该迁移为 `'reading'`，`progress >= 1.0` 的书迁移为 `'finished'`
2. **`rating`** 和 **`short_review`**：默认 `NULL`，无需迁移
3. **迁移脚本**：在 `packages/core/src/db/migrations.ts` 中新增迁移版本

```sql
-- Migration: add book info fields
ALTER TABLE books ADD COLUMN reading_status TEXT DEFAULT 'unread';
ALTER TABLE books ADD COLUMN rating INTEGER;
ALTER TABLE books ADD COLUMN short_review TEXT;

-- Backfill reading status from progress
UPDATE books SET reading_status = 'reading' WHERE progress > 0 AND progress < 1.0;
UPDATE books SET reading_status = 'finished' WHERE progress >= 1.0;
```

## 当前代码可复用的基础

| 已有能力 | 位置 | 复用方式 |
|---|---|---|
| Book 类型定义 | `packages/core/src/types/book.ts` | 扩展接口 |
| BookMeta 元数据 | 同上 | 保持不变 |
| 封面提取 & 落盘 | `library-store.ts` importBooks | 复用路径逻辑 |
| 封面显示 | `BookCard.tsx` | 复用 fallback 封面组件 |
| 标签管理 | `library-store.ts` tag 相关方法 | 直接复用 |
| 阅读会话 | `session-queries.ts` | 聚合本书数据 |
| 数据库迁移 | `migrations.ts` | 新增迁移版本 |

## 最值得优先落地的能力

按优先级排序：

1. 阅读状态切换（带自动流转）
2. 星级评分
3. 一句话短评
4. 主封面替换
5. 元数据查看（只读展示）
6. 元数据修正（Phase 2）

前四项一旦做完，书籍信息页就会明显从"展示信息"升级成"拥有这本书"。

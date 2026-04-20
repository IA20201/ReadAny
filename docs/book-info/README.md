# Book Info Design

这组文档用于定义 ReadAny 的"书籍信息"系统。

目标不是做一个静态详情页，而是把它做成一本书的总控中心：

1. 回答"这是什么书"。
2. 回答"我和这本书现在是什么关系"。
3. 回答"我还能对这本书做什么"。

这套方案会覆盖：

- 移动端与桌面端的信息架构
- 可编辑字段与权限边界
- 封面替换、评分、书评等用户资产模型
- 与阅读器、笔记、统计、AI、听书的联动方式
- 数据迁移与兼容策略
- 分阶段实现路线

文档目录：

- [01-product-vision-and-ia.md](./01-product-vision-and-ia.md) — 产品愿景与信息架构
- [02-editable-model-and-cover-sets.md](./02-editable-model-and-cover-sets.md) — 可编辑模型与评分书评
- [03-interaction-and-implementation-roadmap.md](./03-interaction-and-implementation-roadmap.md) — 交互与实施路线图

当前约束：

- 先冻结产品边界与数据模型，不直接开工 UI。
- 先复用现有 `Book / BookMeta / ReadingSession / stats / notes / TTS` 能力，再往上加扩展字段。
- 优先保证"对阅读当下有用"，再逐步做"收藏感"和"沉淀感"。
- 不做社区功能，所有数据都是本地/用户私有的。

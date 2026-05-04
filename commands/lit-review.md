---
description: 文献综述。搜索、整理、保存文献到本地 papers/ 目录。
---

# Lit Review — 文献综述

搜索、整理、保存文献到本地 `papers/` 目录。

## 流程

1. 确认搜索关键词（人类提供或建议）
2. 确认搜索范围（年份、期刊、领域）
3. 执行搜索，返回结果列表
4. 人类确认哪些需要下载
5. 下载文献 PDF，保存到 `papers/`
6. 更新 `papers/references.json`

## Arguments

`$ARGUMENTS` — 搜索关键词（可选，也可交互式确认）

## 输出

- `papers/` — 下载的文献 PDF
- `papers/references.json` — 文献元数据索引
- 搜索结果摘要（待人类确认相关性）

## 注意

- 搜索前需要人类确认关键词
- 下载后需要人类确认相关性
- 所有文献必须保存到本地，方便复查
- 记录来源 URL/DOI

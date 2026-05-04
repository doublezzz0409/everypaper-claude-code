---
description: 开始新论文项目。创建项目结构，确认研究主题。
---

# Paper Start — 开始新论文

初始化一个新的论文写作项目。

## 流程

1. 确认研究主题（人类提供）
2. 创建 `output/` 下的项目目录
3. 初始化 `papers/references.json`
4. 调用 `paper-planner` 代理规划结构
5. 输出规划结果，等待人类确认

## Arguments

`$ARGUMENTS` — 研究主题描述（可选，也可交互式确认）

## 输出

- `output/paper-{topic}/` — 项目目录
- `output/paper-{topic}/outline.md` — 论文大纲（待人类确认）
- `papers/references.json` — 文献索引（空）

## 注意

- 研究方向由人类决定
- 大纲需要人类审查确认后才能继续
- 不会自动开始写作

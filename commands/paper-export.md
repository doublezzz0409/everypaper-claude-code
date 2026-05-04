---
description: 导出论文为 LaTeX 或 Word 格式。
---

# Paper Export — 导出论文

将论文导出为 LaTeX 或 Word 格式。

## 流程

1. 读取所有章节内容
2. 整合引用列表
3. 生成 LaTeX 或 Word 文件
4. 输出到 `output/final/`

## Arguments

`$ARGUMENTS` — 导出格式（latex 或 word，默认 latex）

## 输出

- `output/final/paper.tex` — LaTeX 文件
- `output/final/paper.docx` — Word 文件（如果选择）
- `output/final/references.bib` — 参考文献

## 注意

- 导出前需要人类确认所有章节已审查通过
- 引用格式需要人类确认
- 不会自动修改内容

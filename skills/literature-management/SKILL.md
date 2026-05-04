---
name: literature-management
description: 文献管理技能。管理文献的搜索、下载、整理和引用。
---

# Literature Management — 文献管理

## When to Use

- 需要搜索文献时
- 需要整理文献时
- 需要引用文献时
- `/lit-review` 命令

## How It Works

### 文献存储

所有文献保存到 `papers/` 目录：

```
papers/
├── references.json          # 元数据索引
├── zhang2023_finance.pdf    # 下载的文献
├── li2022_market.pdf
└── ...
```

### references.json 格式

```json
{
  "papers": [
    {
      "id": "zhang2023",
      "title": "论文标题",
      "authors": ["作者1", "作者2"],
      "year": 2023,
      "journal": "期刊名",
      "doi": "10.xxxx/xxxxx",
      "url": "https://...",
      "file": "papers/zhang2023_finance.pdf",
      "source": "Web of Science / Google Scholar / 人类提供",
      "added_date": "2026-05-03"
    }
  ]
}
```

### 引用规则

1. 引用必须在 `papers/` 有原文
2. 引用格式必须一致
3. 每个引用必须有来源标注
4. 不确定的引用标注 `[来源待确认]`

### 搜索流程

1. 确认关键词（人类提供或建议）
2. 确认范围（年份、期刊、领域）
3. 执行搜索
4. 人类确认相关性
5. 下载并保存
6. 更新 references.json

## Examples

```
用户: 搜索关于股票市场波动性的文献

我: 确认搜索关键词：
    - "stock market volatility"
    - "financial market volatility"
    
    确认搜索范围：
    - 年份：2015-2025
    - 期刊：Journal of Finance, Review of Financial Studies
    
    请确认是否需要调整？
```

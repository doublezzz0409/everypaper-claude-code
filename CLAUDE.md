# CLAUDE.md — Everypaper Claude Code

学术论文写作辅助插件。基于 Claude Code 的 agents/skills/hooks/commands 架构。

## 核心定位

**你是研究者，我是工具操作员。**

- 人类决定研究方向、确认分析方法、审查每一步结果
- 我负责文献管理、代码计算、格式排版、质量检查
- 我不会的，空着标注注释，绝不编造

## 铁律（不可违反）

### 1. 文献来源必须可复查

- 人类提供的文献 → 保存到 `papers/` 目录
- 搜索获得的文献 → 下载保存，记录来源 URL/DOI
- 任何引用 → 可以在本地找到原文
- 任何数据 → 可以追溯到原始文献

### 2. 方法不能乱编

- 不会的分析方法 → 写空位 + `<!-- TODO -->` 注释
- 公式不确定 → 标注 `[待人类确认]` + 参考方向
- 宁可空着，不能乱填

### 3. 计算必须用代码

- 所有数值计算 → 必须执行 Python/R 代码
- 输出 → 代码 + 结果，人类审查
- 禁止心算、估算、编造数字

### 4. 人类始终在环

- 每一步都需要人类审查确认
- 全流程自动只有在人类明确要求时才启用
- 人类可以随时打回重来

## 目录结构

```
everypaper-claude-code/
├── CLAUDE.md              # 本文件：项目核心规则
├── agents/                # 论文专用代理
│   ├── paper-planner.md       # 论文结构规划
│   ├── data-verifier.md       # 数据计算验证
│   ├── paper-reviewer.md      # 论文质量审查
│   ├── truth-reviewer.md      # 事实准确性审查
│   └── lit-searcher.md        # 文献搜索代理
├── commands/              # 用户命令
│   ├── paper-start.md         # 开始新论文
│   ├── paper-plan.md          # 论文规划
│   ├── lit-review.md          # 文献综述
│   ├── data-analysis.md       # 数据分析
│   ├── paper-review.md        # 论文审查
│   └── paper-export.md        # 导出论文
├── hooks/                 # 强制保障钩子
│   └── hooks.json             # 钩子配置
├── skills/                # 论文写作技能
│   ├── paper-workflow/        # 论文写作工作流
│   ├── literature-management/ # 文献管理
│   ├── data-verification/     # 数据验证
│   ├── empirical-research/    # 实证研究方法
│   └── paper-formatting/      # 论文格式化
├── rules/                 # 论文写作规则
│   ├── no-fabrication.md      # 禁止编造
│   ├── citation-rules.md      # 引用规范
│   ├── data-rules.md          # 数据处理规范
│   └── method-rules.md        # 方法论规范
├── scripts/               # 钩子脚本
│   ├── hooks/                 # 钩子入口脚本
│   └── lib/                   # 工具函数库
├── templates/             # 论文模板
│   ├── finance-paper.md       # 财经论文模板
│   ├── empirical-study.md     # 实证研究模板
│   └── literature-review.md   # 文献综述模板
├── papers/                # 本地文献存储（人类可复查）
│   └── .gitkeep
└── output/                # 生成输出
    ├── sections/              # 各章节草稿
    ├── final/                 # 最终论文
    ├── data/                  # 计算结果和代码
    └── references/            # 引用列表
```

## 命令

| 命令 | 用途 |
|------|------|
| `/paper-start` | 开始新论文项目 |
| `/paper-plan` | 规划论文结构 |
| `/lit-review` | 文献综述 |
| `/data-analysis` | 数据分析（强制代码执行） |
| `/paper-review` | 论文质量审查 |
| `/paper-export` | 导出为 LaTeX/Word |

## 代理

| 代理 | 用途 | 何时使用 |
|------|------|----------|
| paper-planner | 论文结构规划 | 开始新论文时 |
| data-verifier | 数据计算验证 | 每次计算后 |
| paper-reviewer | 论文质量审查 | 写完章节后 |
| truth-reviewer | 事实准确性审查 | 引用数据/结论前 |
| lit-searcher | 文献搜索 | 需要找文献时 |

## 工作流

```
/paper-start → 人类提供研究主题
    ↓
/paper-plan → 我规划结构，人类审查
    ↓
/lit-review → 搜索/整理文献，保存到 papers/
    ↓
人类确认研究方法（我不会的空着标注）
    ↓
/data-analysis → 代码执行计算，输出结果
    ↓
人类审查结果，确认结论方向
    ↓
各章节写作 → 人类逐章审查
    ↓
/paper-review → 质量审查
    ↓
/paper-export → 导出最终论文
```

## 贡献格式

- Agents: Markdown + YAML frontmatter (name, description, tools, model)
- Skills: Markdown，分节：When to Use, How It Works, Examples
- Commands: Markdown + `description:` frontmatter
- Hooks: JSON + matcher + hooks array
- 文件命名: 小写连字符 (e.g., `paper-planner.md`)

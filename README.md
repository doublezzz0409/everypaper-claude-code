# Everypaper Claude Code

学术论文写作辅助插件 — 基于 Claude Code 的 agents / skills / hooks / commands 架构。

> **你是研究者，我是工具操作员。**

## 它是什么

Everypaper 是一个 Claude Code 插件，帮助研究者写学术论文。它不会替你做研究决策，而是负责文献管理、代码计算、格式排版和质量检查这些繁琐但必须严谨的工作。

核心设计原则：**绝不编造**。所有引用必须有原文可查，所有数字必须用代码算，所有方法不确定的就空着标注，等你来确认。

项目建立了两条对称的管线守护论文质量：**数据管线**（8 个阻断式 hook，确保计算正确性）和**格式管线**（5 个 hook，确保格式规范性），共计 27 个钩子形成完整的安全网。

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/doublezzz0409/everypaper-claude-code.git
cd everypaper-claude-code

# 设置环境变量（可选，控制钩子严格程度）
export EVERYPAPER_HOOK_PROFILE=standard  # minimal / standard / strict

# 在 Claude Code 中使用命令
/paper-start    # 开始新论文
/paper-plan     # 规划论文结构
/lit-review     # 文献综述
/data-analysis  # 数据分析（强制代码执行）
/paper-review   # 论文质量审查
/paper-export   # 导出论文
```

## 架构

```
everypaper-claude-code/
├── CLAUDE.md              # 项目核心规则（"宪法"）
├── agents/                # 5 个专用代理
│   ├── paper-planner.md       # 论文结构规划
│   ├── data-verifier.md       # 数据计算验证
│   ├── paper-reviewer.md      # 论文质量审查
│   ├── truth-reviewer.md      # 事实准确性审查
│   └── lit-searcher.md        # 文献搜索代理
├── commands/              # 6 个用户命令
├── hooks/                 # 钩子配置（27 个钩子）
├── skills/                # 6 个写作技能
├── rules/                 # 4 条不可违反的规则
├── templates/             # 3 个论文模板
├── defaults/              # 格式管线默认配置
│   ├── format-defaults.json   # 学术论文格式参数
│   └── figure-defaults.json   # 图表质量参数
├── scripts/               # 钩子脚本和工具库
│   ├── hooks/                 # 钩子入口脚本
│   └── lib/                   # 共享工具库
├── tests/                 # 测试套件（891 个测试点）
├── docs/                  # 文档
├── papers/                # 本地文献存储（人类可复查）
└── output/                # 生成输出
```

### 代理

| 代理 | 用途 |
|------|------|
| `paper-planner` | 规划论文结构，不会替你决定研究方向 |
| `data-verifier` | 验证所有计算都用代码执行，拒绝心算 |
| `paper-reviewer` | 从逻辑、引用、数据、格式四个维度审查 |
| `truth-reviewer` | 事实准确性审查，每个事实必须有来源 |
| `lit-searcher` | 文献搜索、下载、整理 |

### 钩子系统

27 个钩子覆盖论文写作全流程，分三个严格等级：

| 等级 | 钩子数 | 适用场景 |
|------|--------|----------|
| `minimal` | 5 | 仅核心防编造 |
| `standard` | 25 | 全部验证钩子（默认） |
| `strict` | 28 | 包含观察模式的全部钩子 |

钩子分为两条对称管线：

#### 数据管线（8 个钩子）

守护计算正确性，确保"每个数字都有代码来源"：

| 钩子 | 类型 | 作用 |
|------|------|------|
| `pre:calc:verify` | 阻断 | 检查数据文件 checksum 是否变化 |
| `pre:pipeline:check` | 阻断 | 检查上游步骤是否过期 |
| `pre:calc:quality` | 阻断 | 数据质量门禁（空值率、编码、列名） |
| `pre:write:data-guard` | 阻断 | CSV 格式校验（列数一致性、空列名） |
| `post:calc:stderr` | 阻断 | Python/R 错误分析（ImportError、SettingWithCopyWarning） |
| `post:calc:output-verify` | 阻断 | 输出文件存在性 + 行数变化幅度 |
| `cross:step:consistency` | 阻断 | 上下游列名/行数一致性 |
| `post:calc:save` | 记录 | 归档计算代码 + 更新 checksum |

#### 格式管线（5 个钩子）

守护格式规范性，确保"引用统一、图表连续、章节完整"：

| 钩子 | 类型 | 作用 |
|------|------|------|
| `pre:write:structure-check` | 阻断 | 必需章节完整性（引言/文献/方法/结果/结论） |
| `pre:write:citation-format` | 警告 | 引用风格一致性（APA/MLA/Chicago/GB） |
| `post:write:xref-check` | 阻断 | 交叉引用完整性（引用的 Table/Figure 必须存在） |
| `post:write:numbering-check` | 警告 | 编号连续性（Table/Figure 不能跳号） |
| `post:figure:verify` | 阻断 | 图表质量（DPI≥300、字体≥8pt、标签完整） |

#### 格式管线库函数

| 库 | 等价于数据管线的 | 用途 |
|------|-----------------|------|
| `paper-schema.js` | `pipeline.js` | 论文结构化中间表示 |
| `format-rules.js` | `business-rules.js` | 格式规则引擎 |
| `citation-checker.js` | `data-verify.js` | 引用格式检查 |
| `xref-resolver.js` | — | 交叉引用解析 |
| `numbering-validator.js` | — | 编号连续性检查 |
| `figure-qa.js` | — | 图表质量验证 |

#### 其他防护钩子

| 钩子 | 作用 |
|------|------|
| `pre:write:no-fabrication` | 检测写入中的虚构文献和数据 |
| `pre:write:citation-check` | 确保每个引用在 `papers/` 中有原文 |
| `pre:write:method-placeholder` | 方法描述必须有权威来源或 `[待人类确认]` |
| `post:write:quality-check` | 写入后二次扫描格式和引用 |
| `pre:config-protection` | 防止意外修改关键学术配置文件 |
| `pre:bash:code-execution` | 数值计算必须用代码，禁止心算 |
| `post:tool-failure` | 工具失败时提供环境诊断建议 |
| `pre:compact` | 上下文压缩前保存论文状态 |
| `session:start` | 会话启动时加载论文上下文 |
| `stop:session-summary` | 会话结束时生成摘要 |

### 论文模板

| 模板 | 适用场景 |
|------|----------|
| `finance-paper` | 财经类论文 |
| `empirical-study` | 实证研究 |
| `literature-review` | 文献综述 |

### 格式默认配置

`defaults/format-defaults.json` 定义学术论文的默认格式参数：

```json
{
  "citation_style": "apa",
  "required_sections": ["introduction", "literature_review", "methodology", "results", "conclusion"],
  "abstract": { "word_min": 150, "word_max": 300 },
  "keywords": { "min_count": 3, "max_count": 5 },
  "typography": { "font_family": "Times New Roman", "font_size_pt": 12 }
}
```

用户可以在 `output/format-overrides.json` 中覆盖任意参数。

`defaults/figure-defaults.json` 定义图表质量默认参数：

```json
{
  "dpi": 300,
  "font_size": 11,
  "palette": "colorblind-safe"
}
```

当 AI 生成图表时，`figure-qa.js` 自动应用这些默认值并校验 spec。

## 四条铁律

1. **文献来源必须可复查** — 每个引用都能在本地找到原文
2. **方法不能乱编** — 不会的写空位 + `<!-- TODO -->` 注释
3. **计算必须用代码** — 所有数值计算必须执行 Python/R 代码
4. **人类始终在环** — 每一步都需要人类审查确认

## 工作流

```
/paper-start → 人类提供研究主题
    ↓
/paper-plan → 规划结构，人类审查
    ↓
/lit-review → 搜索/整理文献，保存到 papers/
    ↓
人类确认研究方法（不会的空着标注）
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

写作过程中，格式管线自动守护：
- 写入章节时 → 检查引用格式、交叉引用、编号连续性
- 跳过必需章节时 → 阻断，要求先完成前置章节
- 引用不存在的图表时 → 阻断，要求先创建图表
- 生成图表时 → 检查 DPI、字体、标签，自动应用默认参数

## 运行测试

```bash
node tests/run-all.js
```

测试覆盖：17 个库测试 + 15 个钩子测试，891 个测试点，零外部依赖。

## 命令说明

详见 [docs/commands-guide.md](docs/commands-guide.md)。

| 命令 | 用途 |
|------|------|
| `/paper-start` | 开始新论文，创建项目目录和大纲 |
| `/paper-plan` | 规划论文结构，输出待确认事项 |
| `/lit-review` | 文献综述，搜索/下载/整理文献 |
| `/data-analysis` | 数据分析，强制代码执行 |
| `/paper-review` | 论文质量审查（逻辑/引用/数据/格式） |
| `/paper-export` | 导出论文（LaTeX/Word） |

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `EVERYPAPER_HOOK_PROFILE` | 钩子严格等级 | `standard` |
| `EVERYPAPER_DISABLED_HOOKS` | 禁用的钩子列表（逗号分隔） | 空 |

## 致谢

这个项目的诞生，离不开 [everything-claude-code](https://github.com/affaan-m/everything-claude-code) 项目的启发和架构参考。

everything-claude-code 用 agents / skills / hooks / commands 的架构模式，展示了 Claude Code 作为开发工具的真正潜力 — 它不只是一个聊天机器人，而是一个可以被精确编排、严格约束、持续进化的开发平台。正是这套架构理念，让我意识到学术写作同样需要这种"工具操作员"式的严谨编排：把人类的专业判断和工具的自动化执行清晰地分离，用钩子系统强制执行规则，让每一行代码、每一个数字、每一条引用都有据可查。

感谢 affaan-m 和 everything-claude-code 的贡献者们，你们的工作让这个项目成为可能。

## 许可

MIT License

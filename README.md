# Everypaper Claude Code

学术论文写作辅助插件 — 基于 Claude Code 的 agents / skills / hooks / commands 架构。

> **你是研究者，我是工具操作员。**

## 它是什么

Everypaper 是一个 Claude Code 插件，帮助研究者写学术论文。它不会替你做研究决策，而是负责文献管理、代码计算、格式排版和质量检查这些繁琐但必须严谨的工作。

核心设计原则：**绝不编造**。所有引用必须有原文可查，所有数字必须用代码算，所有方法不确定的就空着标注，等你来确认。

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
├── hooks/                 # 钩子配置（22 个钩子）
├── skills/                # 6 个写作技能
├── rules/                 # 4 条不可违反的规则
├── templates/             # 3 个论文模板
├── scripts/               # 钩子脚本和工具库
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

22 个钩子覆盖论文写作全流程，分三个严格等级：

| 等级 | 钩子数 | 适用场景 |
|------|--------|----------|
| `minimal` | 5 | 仅核心防编造 |
| `standard` | 14 | 全部验证钩子（默认） |
| `strict` | 17 | 包含观察模式的全部钩子 |

关键防护：
- **防编造** — 检测写入中的虚构文献和数据
- **引用检查** — 确保每个引用在 `papers/` 中有原文
- **计算审计** — 记录所有代码执行，验证输出
- **数据管道** — 追踪数据源版本，检测过期步骤
- **配置保护** — 防止意外修改关键学术配置文件

### 论文模板

| 模板 | 适用场景 |
|------|----------|
| `finance-paper` | 财经类论文 |
| `empirical-study` | 实证研究 |
| `literature-review` | 文献综述 |

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

## 运行测试

```bash
node tests/run-all.js
```

测试覆盖：12 个库测试 + 10 个钩子测试，零外部依赖。

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `EVERYPAPER_HOOK_PROFILE` | 钩子严格等级 | `standard` |
| `EVERYPAPER_DISABLED_HOOKS` | 禁用的钩子列表（逗号分隔） | 空 |

## 致谢

这个项目的诞生，离不开 [everything-claude-code](https://github.com/nicekate/everything-claude-code) 项目的启发和架构参考。

everything-claude-code 用 agents / skills / hooks / commands 的架构模式，展示了 Claude Code 作为开发工具的真正潜力 — 它不只是一个聊天机器人，而是一个可以被精确编排、严格约束、持续进化的开发平台。正是这套架构理念，让我意识到学术写作同样需要这种"工具操作员"式的严谨编排：把人类的专业判断和工具的自动化执行清晰地分离，用钩子系统强制执行规则，让每一行代码、每一个数字、每一条引用都有据可查。

感谢 nicekate 和 everything-claude-code 的贡献者们，你们的工作让这个项目成为可能。

## 许可

MIT License

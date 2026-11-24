# 决策记录与交接文档模板

本模板提供项目指令、交接文档、任务清单、三份虚构的决策记录和两个 Node.js 校验脚本。脚本可直接运行，无需安装额外依赖。

模板内的 `AGENTS.md` 和 `.agents/` 供接入项目使用。适合经常跨会话推进、多人接手或需要恢复工作现场的项目。已有记录方式能满足需要时，可以沿用现有做法。决策记录说明为什么选用某个方案，交接文档说明当前状态和下一步。起步时先记录会影响后续工作的决定和接手所需的信息，再按实际需要增加校验或归档。

## 接入

1. 把本目录下的 `AGENTS.md`、`.agents/`、`scripts/verify-agent-notes.mjs`、`scripts/verify-doc-links.mjs` 复制到项目根目录。目标位置已有 `AGENTS.md` 时，把本模板的章节并入现有文件，不要覆盖原内容。
2. 按项目实际情况更新 `AGENTS.md` 中的仓库布局与命令。需要调整记录类别时，同步更新 `.agents/notes/README.md` 和 `scripts/verify-agent-notes.mjs` 中的 `CLASSES`。
3. 用实际记录替换示例。项目需要自动校验时，将脚本接入现有检查流程。例如，可在 `package.json` 中加入 `"check:docs": "node scripts/verify-agent-notes.mjs . && node scripts/verify-doc-links.mjs ."`。结构校验要求至少有一份记录，可在第一份实际记录就绪后启用。

## 目录内容

| 路径 | 作用 |
|---|---|
| `AGENTS.md` | 项目总览，包含仓库布局、常用命令、提交约定和阅读入口 |
| `.agents/notes/README.md` | 三态记录的位置、命名、格式契约与迁移规则 |
| `.agents/notes/{state}/{class}/` | `proposed`、`implemented`、`rejected` 三个状态各放一份示例，演示章节差异 |
| `.agents/HANDOFF.md` | 当前交付、开发进度、恢复步骤和工作约束 |
| `.agents/TODO.md` | 当前任务清单，按状态分组 |
| `scripts/verify-agent-notes.mjs` | 校验路径形态、状态与目录、必备与禁用章节 |
| `scripts/verify-doc-links.mjs` | 校验 Markdown 相对链接与锚点 |

## 脚本行为

两个脚本都可在项目根目录运行，接受一个可选的位置参数（默认当前目录）。校验失败时以英文报告原因，文件相关问题按 `path: message` 格式输出。失败时退出码为 1，可直接接入 CI 或 pre-commit。

```sh
node scripts/verify-agent-notes.mjs .
node scripts/verify-doc-links.mjs .
```

`verify-agent-notes.mjs` 检查记录结构，内容由评审判断。`verify-doc-links.mjs` 跳过页内锚点。跨文件锚点与目标标题不匹配时会告警，目标不存在时校验失败。代码行锚点（如 `#L24`）等非标题锚点也可能产生告警。

决策记录的结构校验只检查 `proposed/`、`implemented/` 和 `rejected/`。链接校验也会扫描归档文档。

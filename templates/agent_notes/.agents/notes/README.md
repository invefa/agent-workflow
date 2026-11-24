# 决策记录（Agent Notes）

一份记录说明一个影响后续工作的决定。记录要交代问题、考虑过的做法、选择依据和已知影响，便于后续维护者理解当时的取舍。

## 位置与命名

路径采用 `{lifecycle}/{class}/yyyyMMdd-topic.md`，例如 `proposed/feature/20261120-chunked_upload.md`。

- **状态目录**，文件随状态迁移：
  - `proposed/` 保存尚未实施的提案。
  - `implemented/` 保存已实施的决定。路径、包名或默认值等实际行为发生变化时，同步更新受影响的记录。
  - `rejected/` 保存仍有参考价值的否决提案。否决理由写在 `Status:` 行，正文保留评审时的内容。
- **类别目录**从 `CLASSES` 固定集合里选，新增类别要同时改校验脚本和本文件。
- 文件名使用**首次提出**的日期，年月日连写为八位数字。用 `-` 分隔日期和主题。主题作为一个语义片段，使用小写英文，词间用 `_` 连接。主题可含数字，省略版本号和状态后缀。

模板通过目录和全文搜索查找记录。需要在项目总览中提示重要决定时，链接到对应记录。

## 文件格式

前三行固定：

```markdown
# Agent Note: <title>

Status: <status>
```

`Status:` 取值只有三种，且必须与所在目录一致，校验脚本会交叉检查：

- `Status: proposed`
- `Status: implemented`
- `Status: rejected — <一句话原因>`

状态行不带日期、不带括号补充；提案被"有条件通过"这类情况属于正文内容，写在决定所在的位置。

正文以 `## Problem` 开头，先讲问题本身，不依赖方案也能读懂。之后按状态使用固定章节：

```markdown
## proposed/
## Problem
## Proposal
…项目自有章节…
## Alternatives considered
## Acceptance criteria
## Risks

## implemented/
## Problem
## Decision
…项目自有章节…
## Alternatives considered
## Consequences
```

`## Proposal` 记录计划、迁移步骤和未决问题。`## Decision` 描述当前生效的做法。结构校验会检查已实施记录中是否仍有 `## Proposal`、`## Plan`、`## Migration plan` 或 `## Acceptance criteria` 章节。

各状态均保留 `## Alternatives considered`。写明实际考虑过的做法及取舍。没有其他方案进入讨论时，简要说明即可。

## 状态迁移

提案实施后，同步调整路径和 `Status:`，把 `## Proposal` 改写为 `## Decision`。将已发生的影响与仍存在的风险写入 `## Consequences`，需要时在 `## Verification` 保留实际验证结果。提案被否决时，移入 `rejected/` 并在 `Status:` 写明原因，保留原正文。迁移后检查相关链接。

一个决定被新决定取代时，不把旧记录改成相反的意思：新建一份并互相链接。旧记录被完全取代、并入新记录后才能删除——合并前要保留原有的理由、被否方案、后果和已知缺口，并修复所有入站链接。部分取代不算合并，两份都留、互相链接。

## 何时写

决定会影响后续实现的判断标准时才写：结构选择、对外契约、安全边界、被放弃的能力、需要后人知道为什么没选某条路。纯机械改动、局部界面调整不写。更新已有记录能覆盖同一决定时，改它，不要新建。

## 归档

旧记录仍有历史价值、但已不再指导当前工作时，可移入 `archived/{class}/`。在 `Status:` 下一行加 `Archived: YYYY-MM-DD`，并更新指向该记录的链接。归档正文供查阅历史，当前做法由现行记录说明。

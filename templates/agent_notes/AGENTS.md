# AGENTS.md

本文件说明仓库布局、常用命令、提交约定和按需阅读入口。子目录的 `AGENTS.md` 补充该目录的具体规则，按适用范围读取。

## 仓库布局

```
src/            源码
tests/          测试，与 src 下目录结构对应
docs/           面向使用者的文档
.agents/        Agent 工作记录：决策记录、交接文档、任务清单
scripts/        校验与构建脚本
```

## 常用命令

```sh
<install>       # Install dependencies
<build>         # Build
<test>          # Run unit tests
node scripts/verify-agent-notes.mjs .
node scripts/verify-doc-links.mjs .
```

提交前至少运行与改动相关的那条测试命令。项目规定的必需检查不能用局部测试替代。

## 约定

- 每个影响后续实现的决定写一份[决策记录](.agents/notes/README.md)，与实现同一提交。
- 暂停工作或交接时更新 [.agents/HANDOFF.md](.agents/HANDOFF.md)，保留仍然有效的信息。
- 任务状态写在 [.agents/TODO.md](.agents/TODO.md)，按"进行中 / 待办 / 已完成"分组。
- 提交标题用英文约定式前缀；正文说明改动、原因和验证方式。小改动不必凑固定段数。
- 修改行为时同步更新受影响的文档与记录；纯机械改动不需要新记录。

## 按需阅读

| 当前任务 | 先读 |
|---|---|
| 需要决定架构、接口或放弃某个能力 | [.agents/notes/README.md](.agents/notes/README.md) |
| 接手开发、恢复中断的工作 | [.agents/HANDOFF.md](.agents/HANDOFF.md) |
| 选择下一步做什么 | [.agents/TODO.md](.agents/TODO.md) |

# Quiz App

一个支持 Markdown、Latex 渲染、AI 评分、解析的无后端答题网页项目。

使用到的主要框架为：

- Vue3
- marked
- highlight.js
- katex

> 当前代码渲染仅支持 sql，可按需引入配置

数据均本地存储，后续考虑支持坚果云 webdav 多端同步数据。

目前预设仅支持 deepseekv3 模型，需要自行在官网重置后填入 key。

正在测试答题反馈（连对/错音效）。

当前预览（编辑）功能不完善且不稳定，建议直接修改 json。

基础结构可参照 [demo.json](./assets/demo.json)

当前已配置 husky pre-commit 自动在提交时获取 json 题库列表生成静态索引一并提交，如需修改生成策略可修改[geneart_bank_list.js](./utils/geneart_bank_list.js)。

## 基本功能

- 标签筛选
- 跨卷组题
- AI 评分/生成解析
- 快捷键操作

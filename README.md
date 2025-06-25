# Quiz App

一个支持多种题型、Markdown 渲染和 LaTeX 公式的练习系统。



## 题库格式说明

题库文件为 JSON 格式，包含 `questions` 和 `sets` 两个主要字段：

### 题库结构

```json
{
    "questions": [ /* 题目数组 */ ],
    "sets": [ /* 题库集合 */ ]
}
```

### 题库集合 (sets)

每个题库集合包含以下字段：

```json
{
    "id": "unique-set-id",      // 题库唯一标识
    "name": "题库名称",         // 显示的题库名称
    "description": "题库描述"   // 支持 Markdown 格式的题库说明
}
```

### 题目格式 (questions)

系统支持以下题型：

1. 单选题 (single-choice)
2. 多选题 (multiple-choice)
3. 填空题 (fill-in-blank)
4. 简答题 (short-answer)

所有题型都支持以下特性：
- Markdown 渲染
- LaTeX 公式（单行 `$...$` 和多行 `$$...$$`）
- 外链图片
- 超链接

#### 1. 单选题示例

```json
{
    "type": "single-choice",
    "content": "# 题目内容\n\n支持 Markdown 和 LaTeX：$E = mc^2$",
    "options": [
        "选项A - 普通文本",
        "选项B - 包含公式：$\\sqrt{x^2 + y^2}$",
        "选项C - **Markdown加粗**",
        "选项D - 包含[链接](https://example.com)"
    ],
    "correct_answer": ["选项A - 普通文本"],
    "analysis": "解析说明，支持所有渲染特性"
}
```

#### 2. 多选题示例

```json
{
    "type": "multiple-choice",
    "content": "# 多选题\n\n支持多行公式：\n$$\\begin{aligned}f(x) &= x^2 + 2x + 1 \\\\&= (x + 1)^2\\end{aligned}$$",
    "options": [
        "选项A",
        "选项B",
        "选项C",
        "选项D"
    ],
    "correct_answer": [
        "选项A",
        "选项B",
        "选项D"
    ],
    "analysis": "解析说明"
}
```

#### 3. 填空题示例

```json
{
    "type": "fill-in-blank",
    "content": "请完成填空：\n1. 第一空 _____\n2. 第二空 _____",
    "blanks": ["空1", "空2"],
    "correct_answer": ["答案1", "答案2"],
    "analysis": "填空题解析"
}
```

#### 4. 简答题示例

```json
{
    "type": "short-answer",
    "content": "简答题问题描述",
    "correct_answer": ["参考答案"],
    "analysis": "解析说明"
}
```

### 注意事项

1. 使用单选题可以适配判断题，不需要加题目序号和选项的字母序号
2. 所有文本内容都支持 Markdown 格式
3. LaTeX 公式使用 `$` 和 `$$` 包裹
4. 填空题的空使用 5 个下划线 `_____` 表示
5. 简答题的答案通常需要人工评判
6. 每个题目都应该有解析说明
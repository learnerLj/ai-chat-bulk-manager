# AI Chat Bulk Manager

AI Chat Bulk Manager is a Tampermonkey userscript that helps you select and manage multiple ChatGPT or Gemini conversations from the sidebar.

It is built for people who have too many AI chat histories and do not want to archive or delete them one by one.

## What It Does

### ChatGPT

- Adds checkboxes to conversations in the sidebar.
- Adds a control bar above the conversation list.
- Lets you bulk archive selected conversations.
- Lets you bulk delete selected conversations from the visible sidebar list.

### Gemini

- Adds checkboxes to conversations in the history list.
- Adds a control bar above the history list.
- Lets you bulk delete selected conversations.
- Runs the same visible delete flow you would do manually: open menu, click delete, confirm.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Open the Tampermonkey dashboard.
3. Create a new script.
4. Copy everything from [`src/index.user.js`](src/index.user.js).
5. Paste it into Tampermonkey.
6. Save the script.
7. Refresh ChatGPT or Gemini.

Supported pages:

- `https://chatgpt.com/`
- `https://gemini.google.com/app`

## How To Use

### ChatGPT

1. Open ChatGPT.
2. Wait for the left sidebar conversation list to load.
3. Tick the conversations you want to manage.
4. Click:
   - `归档选中` to archive them.
   - `删除选中` to remove them from the visible conversation list.

The ChatGPT delete action removes conversations from the normal visible list. For most users, this behaves like deletion because the conversations are no longer available from the sidebar.

### Gemini

1. Open Gemini.
2. Wait for the history list to load.
3. Tick the conversations you want to delete.
4. Click `删除选中`.
5. Confirm the browser prompt.

The script will delete the selected Gemini conversations one by one.

## Buttons

- `归档选中`: Archive selected ChatGPT conversations.
- `删除选中`: Delete selected conversations.
- `停止`: Stop a running batch.
- Top checkbox: Select or unselect all currently visible conversations.

## Safety Notes

- Bulk delete asks for confirmation before it starts.
- Try it on one or two test conversations first.
- The script only runs on ChatGPT and Gemini.
- The script does not send your data to any third-party server.
- Browser screenshots and test logs are not included in this repository.

## If It Feels Too Fast Or Too Slow

Gemini deletion speed can be adjusted inside `src/index.user.js`:

```js
const BULK_DELETE_INTERVAL_MS = 100;
const GEMINI_DELETE_POLL_MS = 150;
```

If Gemini misses a delete dialog or leaves a popup open, increase `BULK_DELETE_INTERVAL_MS` to `300` or `500`.

## 中文说明

AI Chat Bulk Manager 是一个用于 ChatGPT 和 Gemini 的油猴脚本。它会在左侧历史会话列表里加入多选框，让你一次选择多条会话，然后批量归档或删除。

### 安装方法

1. 安装 Tampermonkey。
2. 打开 Tampermonkey 管理后台。
3. 新建脚本。
4. 复制 `src/index.user.js` 的完整内容。
5. 粘贴到 Tampermonkey 并保存。
6. 刷新 ChatGPT 或 Gemini。

### ChatGPT 怎么用

1. 打开 ChatGPT。
2. 勾选左侧要处理的会话。
3. 点击：
   - `归档选中`：批量归档。
   - `删除选中`：从可见会话列表中移除。

ChatGPT 的删除是用户层面的删除：会话会从正常侧边栏里消失。

### Gemini 怎么用

1. 打开 Gemini。
2. 勾选左侧历史记录。
3. 点击 `删除选中`。
4. 确认弹窗后，脚本会逐条执行删除。

### 注意事项

- 批量删除前会弹确认框。
- 第一次建议先选 1 到 2 条不重要的会话测试。
- 如果 Gemini 删除太快导致漏删，可以把 `BULK_DELETE_INTERVAL_MS` 调大。

## Technical Details

Implementation notes are in [`spec.md`](spec.md). Maintenance steps are in [`plan.md`](plan.md).

## License

MIT

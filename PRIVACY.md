# 隐私政策 / Privacy Policy

GPTNav 不收集、不上传任何个人数据。

- **设置**：语言和 GitHub 仓库地址保存在 `chrome.storage.sync`，用于在浏览器配置间同步扩展设置。
- **对话缓存**：为了适配 ChatGPT 的懒加载，插件会在 `chatgpt.com` 站点的 `localStorage` 中保存已经加载过的提问摘要、标题文本、滚动位置，以及引用关系所需的被引用消息 ID 和选中文字片段（键名以 `gptnav:` 开头）。这些数据仅保存在本机，不会发送到任何服务器。
- **书签**：选中的文字摘录、所在提问和消息位置保存在同一站点的 `localStorage` 中，仅用于跳回原文；可以在「书签」标签里单条删除或清空全部。
- **网络请求**：插件本身不发起任何网络请求，不包含分析、广告或第三方脚本。
- **清除数据**：面板右下角的刷新按钮可清除当前会话缓存，`Shift + 点击` 可清除全部会话缓存；卸载扩展会清除扩展设置。
- **非官方产品**：GPTNav 不是 OpenAI 官方产品，与 OpenAI 无隶属关系。

如有问题，请在本仓库的 Issues 中反馈。

---

GPTNav does not collect or upload any personal data.

- **Settings** (language, GitHub repository URL) are stored in `chrome.storage.sync`.
- **Chat cache** (question summaries, heading text, scroll positions, quoted-message IDs and selected-text excerpts) is stored in `chatgpt.com`'s `localStorage` under the `gptnav:` prefix and never leaves your device.
- **Bookmarks** (selected-text excerpts, prompt and message positions) are stored in the same local `localStorage`; delete them individually or clear all in the Bookmarks tab.
- The extension makes no network requests and contains no analytics, ads, or third-party scripts.
- Use the refresh button in the panel to clear the current chat cache; `Shift + click` clears all chat caches. Uninstalling the extension clears its settings.
- GPTNav is not affiliated with OpenAI.

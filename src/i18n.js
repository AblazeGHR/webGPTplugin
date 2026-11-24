/* 极简 i18n：内容脚本和设置页共用。语言优先级：用户设置 > 浏览器 UI 语言 > en */
var GPTNAV_I18N = {
  zh: {
    'app.name': 'GPTNav · ChatGPT 导航轨',
    'app.short': 'GPTNav',
    'tabs.list': '提问',
    'tabs.outline': '大纲',
    'tabs.tree': '树形',
    'tabs.bookmarks': '笔记',
    'panel.aria': 'GPTNav 导航',
    'fab.open': '打开导航',
    'collapse': '收起导航',
    'refresh': '重新同步并清空本会话缓存',
    'refresh.title': '重新同步：点击清空本会话缓存，Shift+点击清空全部会话缓存',
    'repo': 'GitHub 仓库',
    'settings': '设置',
    'pos': '位置',
    'answer.current': '当前回答',
    'outline.empty': '这条回答没有 Markdown 标题，暂时无法生成大纲。',
    'outline.waiting': '正在等待回答…',
    'empty.title': '还没有可导航的内容',
    'empty.hint': '打开一个已有对话，这里会列出每条提问与回答大纲。',
    'noText': '（无文本）',
    'stat.questions': '{n} 问',
    'stat.cached': ' · {n} 缓存',
    'stat.headings': '{n} 节',
    'stat.bookmarks': '{n} 条笔记',
    'stat.tree': '{n} 个节点 · {q} 处引用',
    'fold': '折叠',
    'unfold': '展开',
    'bookmark.add': '笔记',
    'bookmark.addTitle': '为选中文字添加笔记',
    'bookmark.saved': '已保存',
    'bookmark.empty': '还没有笔记',
    'bookmark.emptyHint': '选中正文文字，点击浮出的「笔记」按钮，写一句备注。',
    'bookmark.clear': '清空',
    'bookmark.confirm': '确认清空？',
    'bookmark.delete': '删除笔记',
    'bookmark.notFound': '未找到笔记位置',
    'bookmark.deleted': '已删除笔记',
    'note.title': '笔记',
    'note.editTitle': '编辑笔记',
    'note.placeholder': '写一句简短的备注…（可留空）',
    'note.save': '保存',
    'note.cancel': '取消',
    'note.edit': '编辑笔记',
    'note.saved': '笔记已保存',
    'note.updated': '笔记已更新',
    'note.excerpt': '摘录',
    'note.hasNote': '这条提问有笔记',
    'tree.empty': '还没有引用提问',
    'tree.emptyHint': '在 ChatGPT 中引用一段回答再提问，这里会生成父子节点。',
    'tree.missing': '引用的提问尚未加载',

    'options.subtitle': '在 ChatGPT 聊天页右侧提供提问导航与回答大纲。',
    'options.language': '语言',
    'options.languageAuto': '自动（跟随浏览器）',
    'options.languageZh': '简体中文',
    'options.languageEn': 'English',
    'options.autoDetected': '自动（{name}）',
    'options.repo': 'GitHub 仓库地址',
    'options.repoPlaceholder': 'https://github.com/AblazeGHR/webGPTplugin',
    'options.repoHint': '用于面板里的 GitHub 图标和 Star 提示；留空则使用插件内置的仓库地址。',
    'options.repoInvalid': '请填写以 https://github.com/ 开头的地址',
    'options.saved': '已保存',
    'options.about': '关于',
    'options.aboutText': 'GPTNav 完全在本地运行，不收集、不上传任何聊天内容。',
    'options.star': '在 GitHub 上点个 Star',
    'options.repoLink': '打开仓库',
    'options.version': '版本',
    'options.modalTitle': '喜欢 GPTNav 吗？',
    'options.modalText': '如果它对你有帮助，欢迎去 GitHub 点个 Star ⭐，这是对作者最大的鼓励。',
    'options.modalGo': '去点 Star',
    'options.modalGoRepo': '去填写仓库地址',
    'options.modalLater': '以后再说',
    'options.hideStar': '进入设置时不再显示 GitHub 提示弹窗',
    'options.notes': '笔记汇总',
    'options.notesHint': '这里汇总所有会话里的笔记，点击标题可以回到对应会话。',
    'options.notesEmpty': '还没有任何笔记。在聊天里选中文字，点击「笔记」就能添加。',
    'options.notesCount': '{n} 条',
    'options.notesUntitled': '未命名会话',
    'options.notesOpen': '打开会话',
    'options.notesLoadFail': '读取笔记失败。',
    'options.privacy': '插件只在本机读写设置与对话缓存，不会向任何服务器发送数据。'
  },
  en: {
    'app.name': 'GPTNav · ChatGPT Navigator',
    'app.short': 'GPTNav',
    'tabs.list': 'Prompts',
    'tabs.outline': 'Outline',
    'tabs.tree': 'Tree',
    'tabs.bookmarks': 'Notes',
    'panel.aria': 'GPTNav navigation',
    'fab.open': 'Open navigation',
    'collapse': 'Collapse panel',
    'refresh': 'Resync and clear this chat cache',
    'refresh.title': 'Resync: click to clear this chat cache; Shift+click to clear all chat caches',
    'repo': 'GitHub repository',
    'settings': 'Settings',
    'pos': 'Position',
    'answer.current': 'Current answer',
    'outline.empty': 'This answer has no Markdown headings.',
    'outline.waiting': 'Waiting for the answer…',
    'empty.title': 'Nothing to navigate yet',
    'empty.hint': 'Open an existing chat to list its prompts and outline.',
    'noText': '(no text)',
    'stat.questions': '{n} prompts',
    'stat.cached': ' · {n} cached',
    'stat.headings': '{n} headings',
    'stat.bookmarks': '{n} notes',
    'stat.tree': '{n} nodes · {q} quotes',
    'fold': 'Collapse',
    'unfold': 'Expand',
    'bookmark.add': 'Note',
    'bookmark.addTitle': 'Add a note for the selected text',
    'bookmark.saved': 'Saved',
    'bookmark.empty': 'No notes yet',
    'bookmark.emptyHint': 'Select text in the chat, then click the note button and write a short note.',
    'bookmark.clear': 'Clear',
    'bookmark.confirm': 'Clear all?',
    'bookmark.delete': 'Delete note',
    'bookmark.notFound': 'Note location not found',
    'bookmark.deleted': 'Note deleted',
    'note.title': 'Note',
    'note.editTitle': 'Edit note',
    'note.placeholder': 'Write a short note… (optional)',
    'note.save': 'Save',
    'note.cancel': 'Cancel',
    'note.edit': 'Edit note',
    'note.saved': 'Note saved',
    'note.updated': 'Note updated',
    'note.excerpt': 'Excerpt',
    'note.hasNote': 'This prompt has a note',
    'tree.empty': 'No quoted prompts yet',
    'tree.emptyHint': 'Quote an answer when asking a question; parent and child nodes will appear here.',
    'tree.missing': 'Quoted prompt is not loaded yet',

    'options.subtitle': 'A prompt navigator and answer outline for ChatGPT chats.',
    'options.language': 'Language',
    'options.languageAuto': 'Auto (follow browser)',
    'options.languageZh': '简体中文',
    'options.languageEn': 'English',
    'options.autoDetected': 'Auto ({name})',
    'options.repo': 'GitHub repository URL',
    'options.repoPlaceholder': 'https://github.com/AblazeGHR/webGPTplugin',
    'options.repoHint': 'Used by the GitHub icon and the star prompt. If empty, the built-in repository URL is used.',
    'options.repoInvalid': 'Enter a URL starting with https://github.com/',
    'options.saved': 'Saved',
    'options.about': 'About',
    'options.aboutText': 'GPTNav runs entirely in your browser. It never collects or uploads chat content.',
    'options.star': 'Star on GitHub',
    'options.repoLink': 'Open repository',
    'options.version': 'Version',
    'options.modalTitle': 'Enjoying GPTNav?',
    'options.modalText': 'If it helps you, please consider starring the repository on GitHub ⭐.',
    'options.modalGo': 'Star on GitHub',
    'options.modalGoRepo': 'Set repository URL',
    'options.modalLater': 'Maybe later',
    'options.hideStar': 'Do not show the GitHub prompt when opening settings',
    'options.notes': 'All notes',
    'options.notesHint': 'All notes from every chat. Click a chat title to open it.',
    'options.notesEmpty': 'No notes yet. Select text in a chat and click “Note” to add one.',
    'options.notesCount': '{n} notes',
    'options.notesUntitled': 'Untitled chat',
    'options.notesOpen': 'Open chat',
    'options.notesLoadFail': 'Failed to load notes.',
    'options.privacy': 'The extension only reads and writes settings and chat cache locally. Nothing is sent to any server.'
  }
};

function gptnavDefaultLang() {
  var ui = '';
  try {
    if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getUILanguage) {
      ui = chrome.i18n.getUILanguage() || '';
    }
  } catch (e) { /* ignore */ }
  if (!ui) {
    try { ui = (typeof navigator !== 'undefined' && navigator.language) || ''; } catch (e) { ui = ''; }
  }
  return /^zh/i.test(ui) ? 'zh' : 'en';
}

function gptnavNormLang(lang) {
  if (lang === 'zh' || lang === 'en') return lang;
  return gptnavDefaultLang();
}

function gptnavT(lang, key, vars) {
  var l = gptnavNormLang(lang);
  var dict = GPTNAV_I18N[l] || GPTNAV_I18N.en;
  var s = dict[key];
  if (s == null) s = (GPTNAV_I18N.en[key] != null ? GPTNAV_I18N.en[key] : key);
  if (vars) {
    Object.keys(vars).forEach(function (k) {
      s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]));
    });
  }
  return s;
}

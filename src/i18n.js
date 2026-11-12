/* 极简 i18n：内容脚本和设置页共用。语言优先级：用户设置 > 浏览器 UI 语言 > en */
var GPTNAV_I18N = {
  zh: {
    'app.name': 'GPTNav · ChatGPT 导航轨',
    'app.short': 'GPTNav',
    'tabs.list': '提问',
    'tabs.outline': '大纲',
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
    'fold': '折叠',
    'unfold': '展开',

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
    'options.privacy': '插件只在本机读写设置与对话缓存，不会向任何服务器发送数据。'
  },
  en: {
    'app.name': 'GPTNav · ChatGPT Navigator',
    'app.short': 'GPTNav',
    'tabs.list': 'Prompts',
    'tabs.outline': 'Outline',
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
    'fold': 'Collapse',
    'unfold': 'Expand',

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

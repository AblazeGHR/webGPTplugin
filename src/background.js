chrome.action.onClicked.addListener(function () {
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || !msg.type) return;

  if (msg.type === 'gptnav:open-options') {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return;
  }

  if (msg.type === 'gptnav:inject-quote-main') {
    var tabId = sender.tab && sender.tab.id;
    if (!tabId) { sendResponse({ ok: false }); return; }
    try {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['src/quote-main.js'],
        world: 'MAIN'
      }, function () {
        var err = chrome.runtime.lastError;
        sendResponse({ ok: !err, error: err ? err.message : '' });
      });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
    return true;
  }

  if (msg.type === 'gptnav:open-url') {
    var url = String(msg.url || '');
    if (/^https:\/\//i.test(url)) {
      chrome.tabs.create({ url: url });
      sendResponse({ ok: true });
    } else {
      sendResponse({ ok: false });
    }
  }
});

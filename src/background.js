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

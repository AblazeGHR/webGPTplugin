/**
 * 运行在 MAIN world 的辅助脚本。
 * 内容脚本处于 isolated world，读不到页面 React 节点上的 __reactFiber$ 属性，
 * 所以这里把“引用来源消息 ID / 被引用文字”写到 turn 元素的 data-* 上，供内容脚本读取。
 */
(function () {
  'use strict';

  if (window.__gptnavQuoteMain) return;
  window.__gptnavQuoteMain = true;

  var ATTR_SRC = 'data-gptnav-quote-src';
  var ATTR_TEXT = 'data-gptnav-quote-text';
  var ATTR_REQ = 'data-gptnav-quote-req';
  var EVT = 'gptnav:quote';

  function setAttr(el, name, value) {
    if (value) {
      if (el.getAttribute(name) !== value) {
        el.setAttribute(name, value);
        return true;
      }
    } else if (el.hasAttribute(name)) {
      el.removeAttribute(name);
      return true;
    }
    return false;
  }

  function itemsOf(el) {
    try {
      var keys = Object.keys(el);
      var fk = null;
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].indexOf('__reactFiber$') === 0) { fk = keys[i]; break; }
      }
      if (!fk) return null;

      var f = el[fk];
      for (var d = 0; d < 6 && f; d++) {
        var p = f.memoizedProps;
        var entry = p && ((p.children && p.children.props && p.children.props.entry) || p.entry);
        var items = entry && entry.turn && entry.turn.items;
        if (Array.isArray(items)) return items;
        f = f.return;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  var scanned = new WeakSet();

  function scan() {
    var turns = document.querySelectorAll('[data-turn-key]');
    var changed = false;

    for (var i = 0; i < turns.length; i++) {
      var el = turns[i];
      if (scanned.has(el)) continue;

      var items = itemsOf(el);
      if (!items) continue;

      var ui = null;
      for (var j = 0; j < items.length; j++) {
        if (items[j] && items[j].type === 'user-message') { ui = items[j]; break; }
      }
      if (!ui) continue;

      var src = ui.selectedTextSourceMessageId || '';
      if (!src && Array.isArray(ui.selectedTextSourceMessageIds) && ui.selectedTextSourceMessageIds.length) {
        src = ui.selectedTextSourceMessageIds[0] || '';
      }

      var atts = Array.isArray(ui.selectedTextAttachments) ? ui.selectedTextAttachments : [];
      var msg = ui.message || '';
      var mk = '# My request:';
      var mi = msg.lastIndexOf(mk);
      var req = mi >= 0 ? msg.slice(mi + mk.length).trim() : '';

      changed = setAttr(el, ATTR_SRC, src) || changed;
      changed = setAttr(el, ATTR_TEXT, atts.length ? atts.join('\n\n').slice(0, 600) : '') || changed;
      changed = setAttr(el, ATTR_REQ, req ? req.slice(0, 300) : '') || changed;

      // 有“已选文本片段”胶囊但 React 数据还没就绪时，先不要标记为已扫描
      var chip = el.querySelector('[data-composer-attachment-pill]');
      var chipLabel = chip ? (chip.textContent || '') : '';
      if (!src && !atts.length && /已选文本片段|selected text/i.test(chipLabel)) continue;

      scanned.add(el);
    }

    if (changed) {
      try {
        document.dispatchEvent(new CustomEvent(EVT));
      } catch (e) { /* ignore */ }
    }
  }

  var timer = 0;
  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(scan, 160);
  }

  var mo = new MutationObserver(schedule);
  if (document.body) mo.observe(document.body, { childList: true, subtree: true });

  schedule();
  setTimeout(scan, 700);
  setTimeout(scan, 1800);
  setTimeout(scan, 4000);
})();

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
  var ATTR_ROWS = 'data-gptnav-rows';
  var EVT = 'gptnav:quote';
  var EVT_ROWS = 'gptnav:rows';

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

  // ---------------------------------------------------------------- 全量轮次
  // 页面虚拟列表的 fiber 上有一份 rows：当前分支的完整轮次（含尚未渲染的），
  // 每项带 turnKey、用户文本、全局序号，是唯一可靠的排序依据。

  function visibleTurn() {
    var list = document.querySelectorAll('.thread-scroll-container');
    var best = null;
    var bestArea = 0;
    for (var i = 0; i < list.length; i++) {
      var r = list[i].getBoundingClientRect();
      if (!(r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < window.innerHeight)) continue;
      var area = r.width * r.height;
      if (area > bestArea) { bestArea = area; best = list[i]; }
    }
    var root = best || document;
    var t = root.querySelector('[data-turn-key]');
    if (!t && !best) t = document.querySelector('[data-turn-key]');
    return t;
  }

  function rowsOf(el) {
    try {
      var keys = Object.keys(el);
      var fk = null;
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].indexOf('__reactFiber$') === 0) { fk = keys[i]; break; }
      }
      if (!fk) return null;

      var f = el[fk];
      for (var d = 0; d < 14 && f; d++) {
        var p = f.memoizedProps;
        var rows = p && p.rows;
        if (Array.isArray(rows) && rows.length) {
          var first = rows[0];
          if (first && first.turn && (first.turnKey || first.id)) return rows;
        }
        f = f.return;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function rowPayload(rows) {
    var list = [];
    var conv = '';
    var usedIdx = {};

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r || !r.turn) continue;
      if (!conv && r.conversationId) conv = r.conversationId;

      var items = Array.isArray(r.turn.items) ? r.turn.items : [];
      var ui = null;
      for (var j = 0; j < items.length; j++) {
        if (items[j] && items[j].type === 'user-message') { ui = items[j]; break; }
      }
      var key = r.turnKey || (ui && (ui.messageId || ui.serverMessageId)) || '';
      if (!key) continue;

      var text = (ui && (typeof ui.message === 'string' ? ui.message : ui.authoredPrompt)) || '';
      if (typeof text !== 'string') text = '';
      var mk = '# My request:';
      var mi = text.lastIndexOf(mk);
      if (mi >= 0) text = text.slice(mi + mk.length).trim();

      var asst = '';
      for (var k = items.length - 1; k >= 0; k--) {
        var it = items[k];
        if (it && it.type === 'assistant-message') {
          asst = it.messageId || it.serverMessageId || it.id || '';
          if (asst) break;
        }
      }
      if (!asst && Array.isArray(r.turn.messageIds) && r.turn.messageIds.length) {
        asst = r.turn.messageIds[r.turn.messageIds.length - 1] || '';
      }

      // 只有 fallback-turn-N / turn-N 才是页面序号；
      // 共享会话等场景 id 是 UUID，末尾数字没有意义，必须用数组下标。
      var idx = i;
      var m = String(r.id || '').trim().match(/^(?:fallback-)?turn-(\d+)$/);
      if (m) {
        var cand = parseInt(m[1], 10);
        if (!usedIdx[cand]) idx = cand;
      }
      usedIdx[idx] = 1;

      var src = '';
      var quote = '';
      if (ui) {
        src = ui.selectedTextSourceMessageId || '';
        if (!src && Array.isArray(ui.selectedTextSourceMessageIds) && ui.selectedTextSourceMessageIds.length) {
          src = ui.selectedTextSourceMessageIds[0] || '';
        }
        if (Array.isArray(ui.selectedTextAttachments) && ui.selectedTextAttachments.length) {
          quote = ui.selectedTextAttachments.join('\n\n').slice(0, 400);
        }
      }

      list.push({
        k: key,
        i: idx,
        t: text.slice(0, 300),
        a: asst,
        q: src,
        x: quote
      });
    }

    if (!list.length) return null;

    var pathId = (location.pathname.match(/\/c\/([^/?#]+)/) || [])[1] || '';
    return {
      v: 1,
      conv: conv || pathId,
      last: !!(rows[rows.length - 1] && rows[rows.length - 1].isMostRecentTurn),
      list: list
    };
  }

  var lastRowsSig = '';

  function scanRows() {
    var el = visibleTurn();
    if (!el) return;

    var rows = rowsOf(el);
    if (!rows) return;

    var payload = rowPayload(rows);
    if (!payload) return;

    var sig = JSON.stringify(payload);
    if (sig === lastRowsSig) return;
    lastRowsSig = sig;

    payload.at = Date.now();
    try {
      document.documentElement.setAttribute(ATTR_ROWS, JSON.stringify(payload));
      document.dispatchEvent(new CustomEvent(EVT_ROWS));
    } catch (e) { /* ignore */ }
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

    scanRows();
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

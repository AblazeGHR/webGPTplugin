/**
 * GPTNav —— ChatGPT 右侧导航（提问轨 + 回答大纲）
 *
 * 依赖的页面锚点（已在实际页面上验证）：
 *   [data-turn-key]                                  一问一答的轮次容器
 *   [data-user-message-bubble]                        用户消息气泡
 *   [data-markdown-text-style="assistant-message"]    AI 回答的 Markdown 容器
 *   .thread-scroll-container                          实际滚动容器
 *
 * 旧版 chatgpt.com 的 article[data-testid^="conversation-turn"] /
 * [data-message-author-role] 已不存在，这里只保留极简兜底。
 */
(function () {
  'use strict';

  var HOST_ID = 'gptnav-host';
  var KEY_UI = 'gptnav:ui';
  var KEY_CONV = 'gptnav:conv:';
  var KEY_BOOK = 'gptnav:book:';
  var CACHE_VERSION = 1;
  var MODES = { list: 1, outline: 1, tree: 1, bookmarks: 1 };
  var MAX_HEADINGS = 400;
  var MAX_CONVS = 24;
  var STALE_MS = 1000 * 60 * 60 * 24 * 14;

  if (window.__gptnav && typeof window.__gptnav.destroy === 'function') {
    try { window.__gptnav.destroy(); } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------- 工具

  function $one(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function now() { return Date.now(); }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* quota */ }
  }

  function getConvId() {
    var m = location.pathname.match(/\/c\/([^/?#]+)/);
    return m ? m[1] : 'new';
  }

  function textOf(el) {
    if (!el) return '';
    return (el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function getSelectionConvId() {
    var el = document.querySelector('[data-chatgpt-selection-conversation-id]');
    return el ? (el.getAttribute('data-chatgpt-selection-conversation-id') || '') : '';
  }

  // ---------------------------------------------------------------- 滚动容器

  function findScroller() {
    var list = $all('.thread-scroll-container');
    var best = null;
    var bestArea = 0;

    // SPA 切换会话时，旧会话的容器可能仍留在 DOM 里（高度为 0），必须只取可见的那个
    for (var i = 0; i < list.length; i++) {
      var r = list[i].getBoundingClientRect();
      var visible = r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < window.innerHeight;
      if (!visible) continue;
      var area = r.width * r.height;
      if (area > bestArea) {
        best = list[i];
        bestArea = area;
      }
    }
    if (best) return best;

    for (var j = 0; j < list.length; j++) {
      if (list[j].scrollHeight > 40) return list[j];
    }

    var anchor = $one('[data-turn-key]') || $one('[data-message-author-role]');
    var n = anchor ? anchor.parentElement : null;
    while (n && n !== document.body && n !== document.documentElement) {
      var cs = getComputedStyle(n);
      if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 40) return n;
      n = n.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  }
  function isDocScroller(sc) {
    return sc === document.scrollingElement || sc === document.documentElement;
  }
  function viewTop(sc) {
    return isDocScroller(sc) ? (window.scrollY || 0) : sc.scrollTop;
  }
  function viewHeight(sc) {
    return isDocScroller(sc) ? window.innerHeight : sc.clientHeight;
  }
  function absTop(el, sc) {
    var r = el.getBoundingClientRect();
    if (isDocScroller(sc)) return r.top + (window.scrollY || 0);
    return r.top - sc.getBoundingClientRect().top + sc.scrollTop;
  }
  function setScrollTop(sc, y) {
    var top = Math.max(0, y);
    if (isDocScroller(sc)) window.scrollTo(0, top);
    else sc.scrollTop = top;
  }

  function scrollToY(sc, y) {
    var top = Math.max(0, y);
    var before = viewTop(sc);
    if (isDocScroller(sc)) window.scrollTo({ top: top, behavior: 'smooth' });
    else sc.scrollTo({ top: top, behavior: 'smooth' });

    // 某些情况下页面会吞掉 smooth 滚动（隐藏标签页/自定义滚动容器），兜底直接跳
    setTimeout(function () {
      if (Math.abs(viewTop(sc) - top) > 4 && Math.abs(viewTop(sc) - before) < 4) {
        setScrollTop(sc, top);
      }
    }, 420);
  }

  // 虚拟列表在加载前给的坐标是临时的，跳转后需要几次校正
  function jumpToElement(el, sc) {
    if (!el || !sc) return;
    var tries = 0;
    var first = true;

    function step() {
      if (!el.isConnected || !sc.contains(el)) return;
      var scTop = isDocScroller(sc) ? 0 : sc.getBoundingClientRect().top;
      var delta = el.getBoundingClientRect().top - scTop - 84;
      if (Math.abs(delta) <= 10 || tries >= 4) return;

      var target = viewTop(sc) + delta;
      if (first) {
        scrollToY(sc, target);
        first = false;
      } else {
        setScrollTop(sc, target);
      }
      tries++;
      setTimeout(step, 200);
    }

    step();
  }

  // 面板展开时给正文让出空间，避免遮挡
  var RESERVE_ATTR = 'data-gptnav-reserve';

  function panelWidth() {
    var w = window.innerWidth;
    if (w <= 1024) return 200;
    if (w <= 1200) return 216;
    return 232;
  }

  function findViewportEl() {
    var sc = findScroller();
    var n = sc;
    while (n && n !== document.body) {
      var cls = typeof n.className === 'string' ? n.className : '';
      if (cls.indexOf('MainContentViewport') >= 0) return n;
      n = n.parentElement;
    }
    return sc && sc.parentElement ? sc.parentElement : null;
  }

  function applyReserve(on) {
    var vp = findViewportEl();
    if (!vp) return;
    var want = (on && window.innerWidth >= 900) ? Math.round(panelWidth() + 22) : 0;
    var saved = vp.getAttribute(RESERVE_ATTR);

    if (want) {
      if (saved === null) {
        vp.setAttribute(RESERVE_ATTR, vp.style.paddingRight || '');
        vp.style.paddingRight = want + 'px';
      } else if (vp.style.paddingRight !== want + 'px') {
        vp.style.paddingRight = want + 'px';
      }
    } else if (saved !== null) {
      vp.style.paddingRight = saved;
      vp.removeAttribute(RESERVE_ATTR);
    }
  }

  // ---------------------------------------------------------------- 页面数据

  function turnOrder(t, fallback) {
    var el = t.querySelector('[data-content-search-turn-key]');
    var raw = el ? (el.getAttribute('data-content-search-turn-key') || '') : '';
    var m = raw.match(/(\d+)\s*$/);
    if (m) return parseInt(m[1], 10);

    var unit = t.querySelector('[data-chatgpt-search-unit-key]');
    var uv = unit ? (unit.getAttribute('data-chatgpt-search-unit-key') || '') : '';
    var um = uv.match(/(\d+)/);
    return um ? parseInt(um[1], 10) : fallback;
  }

  // ChatGPT 的引用信息只在 React 数据里（DOM 只显示“N 个已选文本片段”）。
  // 从 turn 元素的 fiber 里取 selectedTextSourceMessageId，失败时退回 chip 检测。
  function quoteMetaOf(turnEl, key, userText, asstId) {
    var chip = turnEl.querySelector ? turnEl.querySelector('[data-composer-attachment-pill]') : null;
    var chipLabel = chip ? textOf(chip).slice(0, 40) : '';
    var ck = (state.convId || '') + '|' + key + '|' + (userText || '').length + '|' + (asstId || '') + '|' + chipLabel;

    // MAIN world 辅助脚本写入的引用信息（isolated world 读不到 React fiber）
    var attrSrc = turnEl.getAttribute ? (turnEl.getAttribute('data-gptnav-quote-src') || '') : '';
    var attrText = turnEl.getAttribute ? (turnEl.getAttribute('data-gptnav-quote-text') || '') : '';
    var attrReq = turnEl.getAttribute ? (turnEl.getAttribute('data-gptnav-quote-req') || '') : '';
    if (attrSrc || attrText) {
      var attrResult = {
        quoted: true,
        sourceId: attrSrc,
        text: attrText.slice(0, 400),
        request: attrReq
      };
      state.quoteCache.set(ck, { v: attrResult, at: now() });
      return attrResult;
    }

    var cached = state.quoteCache.get(ck);
    if (cached && (cached.v || now() - cached.at < 3000)) return cached.v;

    var result = null;
    try {
      var fk = null;
      var keys = Object.keys(turnEl);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].indexOf('__reactFiber$') === 0) { fk = keys[i]; break; }
      }
      if (fk) {
        var f = turnEl[fk];
        for (var d = 0; d < 5 && f; d++) {
          var p = f.memoizedProps;
          var entry = p && ((p.children && p.children.props && p.children.props.entry) || p.entry);
          var items = entry && entry.turn && entry.turn.items;
          if (Array.isArray(items)) {
            var ui = null;
            for (var j = 0; j < items.length; j++) {
              if (items[j] && items[j].type === 'user-message') { ui = items[j]; break; }
            }
            if (ui) {
              var src = ui.selectedTextSourceMessageId || '';
              if (!src && Array.isArray(ui.selectedTextSourceMessageIds) && ui.selectedTextSourceMessageIds.length) {
                src = ui.selectedTextSourceMessageIds[0] || '';
              }
              var atts = Array.isArray(ui.selectedTextAttachments) ? ui.selectedTextAttachments : [];
              if (src || atts.length) {
                var msg = ui.message || '';
                var req = '';
                var mk = '# My request:';
                var mi = msg.lastIndexOf(mk);
                if (mi >= 0) req = msg.slice(mi + mk.length).trim();
                result = {
                  quoted: true,
                  sourceId: src,
                  text: atts.join('\n\n').slice(0, 400),
                  request: req
                };
              }
            }
            break;
          }
          f = f.return;
        }
      }
    } catch (e) { /* React internals may change */ }

    if (!result && chip && /已选文本片段|selected text/i.test(chipLabel)) {
      result = { quoted: true, sourceId: '', text: '', request: '' };
    }

    state.quoteCache.set(ck, { v: result, at: now() });
    return result;
  }

  function collectTurns(sc) {
    var list = [];
    var root = (sc && !isDocScroller(sc)) ? sc : document;
    var turnEls = $all('[data-turn-key]', root);

    for (var i = 0; i < turnEls.length; i++) {
      var t = turnEls[i];
      var userEl = $one('[data-user-message-bubble]', t);
      if (!userEl) continue;

      var assts = $all('[data-markdown-text-style="assistant-message"]', t);
      var asstEl = assts.length ? assts[assts.length - 1] : null;
      var key = t.getAttribute('data-turn-key') || ('turn-' + i);
      var asstId = '';
      var userText = textOf(userEl).slice(0, 300);

      if (asstEl) {
        var holder = asstEl.closest('[data-chatgpt-selection-message-id]');
        if (holder) asstId = holder.getAttribute('data-chatgpt-selection-message-id') || '';
        if (!asstId) {
          var dil = t.querySelector('[data-dil-message-id]');
          if (dil) asstId = dil.getAttribute('data-dil-message-id') || '';
        }
      }

      var quote = quoteMetaOf(t, key, userText, asstId || key);

      list.push({
        key: key,
        el: t,
        userEl: userEl,
        asstEl: asstEl,
        asstId: asstId || key,
        userText: userText,
        quoteSourceId: quote ? quote.sourceId : '',
        quoteText: quote ? quote.text : '',
        quoted: !!(quote && quote.quoted),
        order: turnOrder(t, i),
        ghost: false
      });
    }

    if (list.length) return list;

    // 旧版结构兜底
    var pending = null;
    var articles = $all('article[data-testid^="conversation-turn"]', root);
    for (var j = 0; j < articles.length; j++) {
      var a = articles[j];
      var roleEl = $one('[data-message-author-role]', a) ||
        (a.hasAttribute('data-message-author-role') ? a : null);
      if (!roleEl) continue;
      var role = roleEl.getAttribute('data-message-author-role');
      if (role === 'user') {
        pending = {
          key: a.getAttribute('data-testid') || ('legacy-' + j),
          el: a,
          userEl: roleEl,
          asstEl: null,
          asstId: '',
          userText: textOf(roleEl).slice(0, 300),
          quoteSourceId: '',
          quoteText: '',
          quoted: false,
          order: list.length,
          ghost: false
        };
      } else if (role === 'assistant' && pending) {
        pending.asstEl = roleEl;
        pending.asstId = a.getAttribute('data-testid') || pending.key;
        list.push(pending);
        pending = null;
      }
    }
    return list;
  }

  // 注意：整个回答都渲染在 DilRenderer 里，不能按 DilRenderer 过滤；
  // 交互式 widget 里的假标题位于 data-d-component="box" 内，需要排除。
  var BAD_HEADING_ANCESTORS = 'pre, code, [role="widget"], [contenteditable="true"], ' +
    '[data-d-component="box"]';

  function headingText(h) {
    var clone = h.cloneNode(true);
    // KaTeX 会同时输出 MathML 与 HTML 两份文本，去掉隐藏的 MathML 副本避免重复
    var dup = clone.querySelectorAll('.katex-mathml');
    for (var i = 0; i < dup.length; i++) dup[i].remove();
    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function extractHeadings(asstEl) {
    if (!asstEl) return { flat: [], roots: [] };

    var nodes = $all('h1, h2, h3, h4, h5, h6', asstEl);
    var flat = [];

    for (var i = 0; i < nodes.length; i++) {
      var h = nodes[i];
      if (h.closest(BAD_HEADING_ANCESTORS)) continue;
      var text = headingText(h);
      if (!text || text.length > 180) continue;
      var level = parseInt(h.tagName.charAt(1), 10) || 1;
      flat.push({ el: h, level: level, text: text, children: [], parent: null });
      if (flat.length >= MAX_HEADINGS) break;
    }

    var roots = [];
    var stack = [];
    for (var k = 0; k < flat.length; k++) {
      var node = flat[k];
      while (stack.length && stack[stack.length - 1].level >= node.level) stack.pop();
      if (stack.length) {
        var p = stack[stack.length - 1];
        node.parent = p;
        p.children.push(node);
      } else {
        roots.push(node);
      }
      stack.push(node);
    }

    (function walk(arr, ancestors) {
      for (var m = 0; m < arr.length; m++) {
        var n = arr[m];
        n.ancestors = ancestors;
        n.pk = ancestors.concat(n.text).join('\u0001');
        walk(n.children, ancestors.concat(n.text));
      }
    })(roots, []);

    return { flat: flat, roots: roots };
  }

  function activeTurnIndex(turns, sc) {
    var vTop = viewTop(sc);
    var vBottom = vTop + viewHeight(sc);

    // 优先：视口里出现的第一条提问（哪怕顶部还残留着上一条回答）
    for (var i = 0; i < turns.length; i++) {
      var el = turns[i].userEl;
      var top = absTop(el, sc);
      var h = el.getBoundingClientRect().height || 0;
      // 至少要露出 20px，避免提问只在底部露出一条边就提前切换
      if (top + h > vTop + 4 && top < vBottom - 20) return i;
    }

    // 视口里没有任何提问（例如长回答中段）：退回视口上方的最后一条
    var threshold = vTop + 96;
    var idx = 0;
    for (var j = 0; j < turns.length; j++) {
      if (absTop(turns[j].userEl, sc) <= threshold) idx = j;
      else break;
    }
    return idx;
  }

  // ---------------------------------------------------------------- 缓存

  function emptyCache() {
    return { v: CACHE_VERSION, updated: now(), order: [], turns: {}, folded: {}, treeFolded: [] };
  }

  function loadCache(convId) {
    if (!convId || convId === 'new') return null;
    var c = readJSON(KEY_CONV + convId, null);
    if (!c || c.v !== CACHE_VERSION) return emptyCache();
    if (!Array.isArray(c.order)) c.order = [];
    if (!c.turns || typeof c.turns !== 'object') c.turns = {};
    if (!c.folded || typeof c.folded !== 'object') c.folded = {};
    if (!Array.isArray(c.treeFolded)) c.treeFolded = [];

    var seen = {};
    var order = [];
    for (var i = 0; i < c.order.length; i++) {
      var k = c.order[i];
      if (seen[k]) continue;
      seen[k] = 1;
      order.push(k);
    }
    c.order = order;
    return c;
  }

  function rememberTurnMeta(turn, cache) {
    if (!cache || !turn) return;
    if (!cache.turns) cache.turns = {};
    var rec = cache.turns[turn.key] || {};
    rec.t = (turn.userText || '').slice(0, 300);
    rec.a = turn.asstId || turn.key;
    if (turn.quoteSourceId) rec.q = turn.quoteSourceId;
    else if (!turn.quoted) delete rec.q;
    if (turn.quoteText) rec.qt = turn.quoteText.slice(0, 200);
    else if (!turn.quoted) delete rec.qt;
    if (typeof turn.order === 'number' && !state.rowsActive) rec.i = turn.order;
    rec.seen = now();
    cache.turns[turn.key] = rec;
    cache.updated = now();
  }

  // 维护一个跨窗口稳定的全局顺序：只按 turn key 增删，不依赖会随虚拟窗口变化的 fallback-turn-N。
  // 注意：GPT 上下两个方向都会懒加载，所以绝不能因为“当前滚动到底”就删掉后面的缓存。
  function updateOrder(turns, cache) {
    if (!cache || !turns.length) return;
    if (!Array.isArray(cache.order)) cache.order = [];
    if (!cache.order.length) {
      cache.order = turns.map(function (t) { return t.key; });
      return;
    }

    var pos = {};
    for (var i = 0; i < cache.order.length; i++) pos[cache.order[i]] = i;

    var overlap = false;
    for (var j = 0; j < turns.length; j++) {
      if (pos[turns[j].key] !== undefined) { overlap = true; break; }
    }

    var domKeys = turns.map(function (t) { return t.key; });

    if (!overlap) {
      // 当前窗口和缓存完全没有交集：按跳转/滚动方向拼到一端，保留另一端已有条目
      var hint = state.orderHint;
      if (Date.now() - (state.orderHintAt || 0) > 4000) hint = '';
      var side = hint || state.scrollDir || 'after';
      if (side === 'before') cache.order = domKeys.concat(cache.order);
      else cache.order = cache.order.concat(domKeys);
      state.orderHint = '';
      state.orderHintAt = 0;
      return;
    }

    var insertAfter = -1;
    var batch = [];

    function rebuildPos() {
      pos = {};
      for (var k = 0; k < cache.order.length; k++) pos[cache.order[k]] = k;
    }
    function applyBatch(at) {
      if (!batch.length) return -1;
      cache.order.splice.apply(cache.order, [at, 0].concat(batch));
      rebuildPos();
      var last = at + batch.length - 1;
      batch = [];
      return last;
    }

    for (var m = 0; m < turns.length; m++) {
      var key = turns[m].key;
      if (pos[key] !== undefined) {
        if (batch.length) {
          // 有前一个已知 turn 时插在它后面；向上补加载时插在第一个已知 turn 前面，
          // 但位于更早的缓存条目之后，避免把更上方的缓存挤走
          var at = insertAfter >= 0 ? insertAfter + 1 : pos[key];
          var lastAt = applyBatch(at);
          if (lastAt >= 0) insertAfter = lastAt;
        }
        insertAfter = pos[key];
      } else {
        batch.push(key);
      }
    }
    if (batch.length) {
      var at2 = insertAfter >= 0 ? insertAfter + 1 : cache.order.length;
      applyBatch(at2);
    }

    var seen = {};
    var out = [];
    for (var n = 0; n < cache.order.length; n++) {
      var k2 = cache.order[n];
      if (seen[k2]) continue;
      seen[k2] = 1;
      out.push(k2);
    }
    cache.order = out;
  }

  function buildList(turns, cache) {
    if (!cache || !Array.isArray(cache.order) || !cache.order.length) return turns.slice();

    var domMap = {};
    for (var i = 0; i < turns.length; i++) domMap[turns[i].key] = turns[i];

    var items = [];
    var used = {};

    for (var j = 0; j < cache.order.length; j++) {
      var key = cache.order[j];
      var t = domMap[key];
      if (t) {
        items.push(t);
        used[key] = 1;
        continue;
      }
      var rec = cache.turns[key];
      if (!rec || !rec.t) continue;
      if (now() - (rec.seen || 0) > STALE_MS) continue;
      items.push({
        key: key,
        userText: rec.t,
        asstId: rec.a || key,
        quoteSourceId: rec.q || '',
        quoteText: rec.qt || '',
        quoted: !!(rec.q || rec.qt),
        ghost: true,
        userEl: null,
        asstEl: null,
        el: null,
        ratio: typeof rec.r === 'number' ? rec.r : 0,
        order: typeof rec.i === 'number' ? rec.i : 0
      });
      used[key] = 1;
    }

    for (var k = 0; k < turns.length; k++) {
      if (!used[turns[k].key]) items.push(turns[k]);
    }
    return items;
  }

  // ---------------------------------------------------------------- 权威顺序
  // MAIN world 的 quote-main.js 会把页面虚拟列表的 rows 写到 <html data-gptnav-rows>。
  // 它包含当前分支的完整轮次和页面自己的全局序号，比“按滚动方向猜”可靠。

  function sameConv(a, b) {
    if (!a || !b) return true;
    if (a === b) return true;
    return a.indexOf(b) >= 0 || b.indexOf(a) >= 0;
  }

  function readRows() {
    var raw = '';
    try { raw = document.documentElement.getAttribute('data-gptnav-rows') || ''; } catch (e) { return null; }
    if (!raw) return null;

    try {
      var p = JSON.parse(raw);
      if (!p || !Array.isArray(p.list) || !p.list.length) return null;
      var cid = getConvId();
      if (cid !== 'new' && p.conv && !sameConv(p.conv, cid)) {
        // 项目/本地会话的 id 可能和 URL 不同：只要当前 DOM 里的 turn 在这份 rows 里，就认它
        var t = document.querySelector('.thread-scroll-container [data-turn-key]') ||
          document.querySelector('[data-turn-key]');
        var k = t ? (t.getAttribute('data-turn-key') || '') : '';
        var hit = false;
        if (k) {
          for (var i = 0; i < p.list.length; i++) {
            if (p.list[i] && p.list[i].k === k) { hit = true; break; }
          }
        }
        if (!hit) return null;
      }
      return p;
    } catch (e) {
      return null;
    }
  }

  function syncOrder(rows, turns, cache) {
    if (!rows || !cache || !Array.isArray(rows.list) || !rows.list.length) return false;
    if (!cache.turns) cache.turns = {};

    var list = rows.list;
    var byIndex = {};
    var rowKeys = {};
    var min = 1e9;
    var max = -1;
    var i;

    for (i = 0; i < list.length; i++) {
      var r = list[i];
      if (!r || !r.k) continue;

      var idx = typeof r.i === 'number' ? r.i : i;
      var rec = cache.turns[r.k] || (cache.turns[r.k] = {});
      if (r.t) rec.t = String(r.t).slice(0, 300);
      if (r.a) rec.a = r.a;
      if (r.q) rec.q = r.q;
      if (r.x) rec.qt = String(r.x).slice(0, 200);
      rec.i = idx;
      rec.seen = now();

      if (byIndex[idx] === undefined) byIndex[idx] = r.k;
      rowKeys[r.k] = 1;
      if (idx < min) min = idx;
      if (idx > max) max = idx;
    }

    if (max < 0) return false;

    // 0..最后一条都在 rows 里，说明这份 rows 就是当前分支的全量
    var full = !!(rows.last && min <= 0);

    var old = Array.isArray(cache.order) ? cache.order : [];
    var noIndex = [];

    for (i = 0; i < old.length; i++) {
      var key = old[i];
      if (!key || rowKeys[key]) continue;

      var cr = cache.turns[key];
      if (!cr || !cr.t) continue;

      // rows 之外：全量模式下必然是别的分支/旧状态，不再展示
      if (full) continue;

      if (typeof cr.i !== 'number') { noIndex.push(key); continue; }

      // rows 覆盖的区间里已有权威 key，缓存里不同的 key 属于旧分支
      if (cr.i >= min && cr.i <= max) continue;

      // 区间外的缓存条目保留，按全局序号归位；同一序号只留较新的
      if (byIndex[cr.i] !== undefined) {
        var prev = cache.turns[byIndex[cr.i]];
        if (prev && (prev.seen || 0) > (cr.seen || 0)) continue;
      }
      byIndex[cr.i] = key;
    }

    // 刚发出、rows 还没来得及收录的轮次：先接在末尾
    var tail = [];
    var tailSeen = {};
    for (i = 0; i < turns.length; i++) {
      var tk = turns[i].key;
      if (!tk || rowKeys[tk] || tailSeen[tk]) continue;

      var dup = false;
      for (var bi in byIndex) {
        if (byIndex[bi] === tk) { dup = true; break; }
      }
      if (dup) continue;

      tailSeen[tk] = 1;
      tail.push(tk);
    }

    var indexes = Object.keys(byIndex).map(Number).sort(function (a, b) { return a - b; });
    var out = [];
    for (i = 0; i < indexes.length; i++) out.push(byIndex[indexes[i]]);

    out = out.concat(noIndex, tail);
    cache.order = out;
    cache.updated = now();
    state.rowsActive = true;
    return true;
  }

  function rowOrdOf(key) {
    if (!key || !state.rows) return -1;
    var list = state.rows.list;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].k === key && typeof list[i].i === 'number') return list[i].i;
    }
    return -1;
  }

  function clearCurrentCache() {
    if (state.convId && state.convId !== 'new') {
      try { localStorage.removeItem(KEY_CONV + state.convId); } catch (e) { /* ignore */ }
    }
    state.cache = emptyCache();
    state.folded = new Map();
    state.treeFolded = new Set();
    state.quoteCache = new Map();
    state.activePk = '';
    state.activeTreeKey = '';
    state.pendingBookmark = null;
    state.sig = '';
  }

  function clearAllCaches() {
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(KEY_CONV) === 0) keys.push(k);
      }
      for (var j = 0; j < keys.length; j++) localStorage.removeItem(keys[j]);
    } catch (e) { /* ignore */ }
    state.cache = emptyCache();
    state.folded = new Map();
    state.treeFolded = new Set();
    state.quoteCache = new Map();
    state.activePk = '';
    state.activeTreeKey = '';
    state.pendingBookmark = null;
    state.sig = '';
  }

  var pruneDone = false;
  function pruneKeyList(keys) {
    if (keys.length <= MAX_CONVS) return;
    var rows = [];
    for (var j = 0; j < keys.length; j++) {
      var t = 0;
      try { t = JSON.parse(localStorage.getItem(keys[j]) || '{}').updated || 0; } catch (e) { t = 0; }
      rows.push({ k: keys[j], t: t });
    }
    rows.sort(function (a, b) { return a.t - b.t; });
    for (var m = 0; m < rows.length - MAX_CONVS; m++) {
      try { localStorage.removeItem(rows[m].k); } catch (e) { /* ignore */ }
    }
  }

  function pruneCaches() {
    if (pruneDone) return;
    pruneDone = true;
    try {
      var convKeys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(KEY_CONV) === 0) convKeys.push(k);
      }
      // 书签是用户手动创建的数据，不做自动清理
      pruneKeyList(convKeys);
    } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------- 状态

  var ui = readJSON(KEY_UI, null) || { open: true, mode: 'list' };

  var state = {
    convId: '',
    cache: null,
    rows: null,
    rowsActive: false,
    folded: new Map(),
    turns: [],
    all: [],
    idx: 0,
    outline: null,
    flat: [],
    mode: MODES[ui.mode] === 1 ? ui.mode : 'list',
    open: ui.open !== false,
    sig: '',
    activePk: '',
    activeTurnKey: '',
    activeTreeKey: '',
    itemByKey: new Map(),
    rowByPk: new Map(),
    treeByKey: new Map(),
    crumbEl: null,
    crumbK: null,
    lastPanelTouch: 0,
    orderHint: '',
    orderHintAt: 0,
    scrollDir: '',
    searchToken: 0,
    saveTimer: 0,
    quoteCache: new Map(),
    treeFolded: new Set(),
    treeNodeCount: 0,
    treeLinks: 0,
    bookmarks: [],
    bmConfirmUntil: 0,
    pendingBookmark: null,
    selInfo: null,
    selTimer: 0
  };

  var settings = { lang: 'auto', repo: '' };
  var lang = gptnavDefaultLang();

  function t(key, vars) { return gptnavT(lang, key, vars); }

  // ---------------------------------------------------------------- Shadow UI

  var TEMPLATE = [
    '<div class="gn-root" data-open="true" data-mode="list" data-gn-theme="dark">',
    '  <button class="gn-fab" type="button" aria-label="打开 GPTNav 导航" title="打开导航">',
    '    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">',
    '      <path d="M5 4h9M5 8h9M5 12h9"/>',
    '      <circle cx="2" cy="4" r="0.85" fill="currentColor" stroke="none"/>',
    '      <circle cx="2" cy="8" r="0.85" fill="currentColor" stroke="none"/>',
    '      <circle cx="2" cy="12" r="0.85" fill="currentColor" stroke="none"/>',
    '    </svg>',
    '  </button>',
    '  <section class="gn-panel" role="complementary" aria-label="GPTNav 导航">',
    '    <header class="gn-head">',
    '      <div class="gn-tabs" role="tablist">',
    '        <button class="gn-tab" data-mode="list" role="tab" aria-selected="true" type="button">提问</button>',
    '        <button class="gn-tab" data-mode="outline" role="tab" aria-selected="false" type="button">大纲</button>',
    '        <button class="gn-tab" data-mode="tree" role="tab" aria-selected="false" type="button">树形</button>',
    '        <button class="gn-tab" data-mode="bookmarks" role="tab" aria-selected="false" type="button">书签</button>',
    '      </div>',
    '      <span class="gn-head-spacer"></span>',
    '      <button class="gn-iconbtn gn-collapse" type="button" aria-label="收起导航" title="收起">',
    '        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l4 4-4 4"/></svg>',
    '      </button>',
    '    </header>',
    '    <div class="gn-context"></div>',
    '    <div class="gn-scroll"><div class="gn-body"></div></div>',
    '    <footer class="gn-foot">',
    '      <span class="gn-stat"></span>',
    '      <div class="gn-foot-actions">',
    '        <button class="gn-iconbtn gn-github" type="button" aria-label="GitHub 仓库" title="GitHub 仓库">',
    '          <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>',
    '        </button>',
    '        <button class="gn-iconbtn gn-settings" type="button" aria-label="设置" title="设置">',
    '          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="8" cy="8" r="2.2"/><path d="M8 1.3v1.6M8 13.1v1.6M1.3 8h1.6M13.1 8h1.6M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M12.8 3.2l-1.1 1.1M4.3 11.7l-1.1 1.1"/></svg>',
    '        </button>',
    '        <button class="gn-iconbtn gn-refresh" type="button" aria-label="重新同步并清空本会话缓存" title="重新同步：点击清空本会话缓存，Shift+点击清空全部会话缓存">',
    '          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 8a5 5 0 1 1-1.5-3.5"/><path d="M13 2v3h-3"/></svg>',
    '        </button>',
    '      </div>',
    '    </footer>',
    '  </section>',
    '  <button class="gn-sel-add" type="button" hidden>',
    '    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M4 2.5h8v11l-4-2.6-4 2.6z"/></svg>',
    '    <span>书签</span>',
    '  </button>',
    '</div>'
  ].join('\n');

  var host = document.createElement('div');
  host.id = HOST_ID;
  host.setAttribute('data-gptnav', 'host');
  var shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = TEMPLATE;

  // 用 constructable stylesheet，避免受页面 CSP 对 inline style 的限制
  try {
    var sheet = new CSSStyleSheet();
    sheet.replaceSync(typeof GPTNAV_CSS === 'string' ? GPTNAV_CSS : '');
    shadow.adoptedStyleSheets = [sheet];
  } catch (e) {
    var styleEl = document.createElement('style');
    styleEl.textContent = typeof GPTNAV_CSS === 'string' ? GPTNAV_CSS : '';
    shadow.insertBefore(styleEl, shadow.firstChild);
  }
  (document.body || document.documentElement).appendChild(host);

  var els = {
    root: shadow.querySelector('.gn-root'),
    fab: shadow.querySelector('.gn-fab'),
    panel: shadow.querySelector('.gn-panel'),
    scroll: shadow.querySelector('.gn-scroll'),
    context: shadow.querySelector('.gn-context'),
    body: shadow.querySelector('.gn-body'),
    stat: shadow.querySelector('.gn-stat'),
    tabList: shadow.querySelector('.gn-tab[data-mode="list"]'),
    tabOutline: shadow.querySelector('.gn-tab[data-mode="outline"]'),
    tabTree: shadow.querySelector('.gn-tab[data-mode="tree"]'),
    tabBookmarks: shadow.querySelector('.gn-tab[data-mode="bookmarks"]'),
    selAdd: shadow.querySelector('.gn-sel-add'),
    collapse: shadow.querySelector('.gn-collapse'),
    github: shadow.querySelector('.gn-github'),
    settings: shadow.querySelector('.gn-settings'),
    refresh: shadow.querySelector('.gn-refresh')
  };

  // ---------------------------------------------------------------- 设置 / 语言

  function applyStaticLabels() {
    els.tabList.textContent = t('tabs.list');
    els.tabOutline.textContent = t('tabs.outline');
    els.tabTree.textContent = t('tabs.tree');
    els.tabBookmarks.textContent = t('tabs.bookmarks');
    els.selAdd.querySelector('span').textContent = t('bookmark.add');
    els.selAdd.title = t('bookmark.addTitle');
    els.selAdd.setAttribute('aria-label', t('bookmark.addTitle'));
    els.panel.setAttribute('aria-label', t('panel.aria'));
    els.fab.setAttribute('aria-label', t('fab.open'));
    els.fab.title = t('fab.open');
    els.collapse.setAttribute('aria-label', t('collapse'));
    els.collapse.title = t('collapse');
    els.refresh.setAttribute('aria-label', t('refresh'));
    els.refresh.title = t('refresh.title');
    els.github.setAttribute('aria-label', t('repo'));
    els.github.title = t('repo');
    els.settings.setAttribute('aria-label', t('settings'));
    els.settings.title = t('settings');
  }

  function applySettings(next) {
    var prev = lang;
    settings.lang = (next && next.lang) || 'auto';
    settings.repo = (next && typeof next.repo === 'string') ? next.repo : '';
    lang = settings.lang === 'auto' ? gptnavDefaultLang() : gptnavNormLang(settings.lang);

    applyStaticLabels();
    if (lang !== prev) {
      state.sig = '';
      render(true);
    }
  }

  function loadSettings() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get({ lang: 'auto', repo: '' }, function (s) {
          applySettings(s);
        });
        chrome.storage.onChanged.addListener(function (changes, area) {
          if (area !== 'sync') return;
          var next = { lang: settings.lang, repo: settings.repo };
          if (changes.lang) next.lang = changes.lang.newValue;
          if (changes.repo) next.repo = changes.repo.newValue;
          applySettings(next);
        });
        return;
      }
    } catch (e) { /* ignore */ }
    applySettings({ lang: 'auto', repo: '' });
  }

  function openOptions() {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'gptnav:open-options' });
        return;
      }
    } catch (e) { /* ignore */ }
    try {
      window.open(chrome.runtime.getURL('options.html'), '_blank');
    } catch (e) { /* ignore */ }
  }

  function effectiveRepo() {
    var u = (settings.repo || '').trim();
    if (!u && typeof GPTNAV_DEFAULT_REPO === 'string') u = GPTNAV_DEFAULT_REPO.trim();
    return u;
  }

  function openRepo() {
    var url = effectiveRepo();
    if (!url || !/^https:\/\//i.test(url)) { openOptions(); return; }
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'gptnav:open-url', url: url });
        return;
      }
    } catch (e) { /* ignore */ }
    try { window.open(url, '_blank', 'noopener'); } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------- 持久化

  function persistUI() {
    writeJSON(KEY_UI, { open: state.open, mode: state.mode });
  }

  function foldKey(asstId) { return asstId || 'unknown'; }

  function getFoldSet(asstId) {
    var k = foldKey(asstId);
    var set = state.folded.get(k);
    if (!set) { set = new Set(); state.folded.set(k, set); }
    return set;
  }

  function isFolded(asstId, pk) {
    return getFoldSet(asstId).has(pk);
  }

  function persistFolded() {
    if (!state.cache) return;
    var obj = {};
    state.folded.forEach(function (set, key) {
      if (set.size) obj[key] = Array.from(set).slice(-500);
    });
    state.cache.folded = obj;
    scheduleCacheSave();
  }

  function loadFolded(cache) {
    var map = new Map();
    if (cache && cache.folded) {
      Object.keys(cache.folded).forEach(function (key) {
        var arr = cache.folded[key];
        if (Array.isArray(arr)) map.set(key, new Set(arr));
      });
    }
    return map;
  }

  function loadTreeFolded(cache) {
    return new Set(cache && Array.isArray(cache.treeFolded) ? cache.treeFolded : []);
  }

  function persistTreeFolded() {
    if (!state.cache) return;
    state.cache.treeFolded = Array.from(state.treeFolded).slice(-500);
    scheduleCacheSave();
  }

  function toggleTreeFold(key) {
    if (!key) return;
    var row = state.treeByKey.get(key);
    if (!row) return;
    var folded = state.treeFolded.has(key);
    if (folded) state.treeFolded.delete(key);
    else state.treeFolded.add(key);

    var node = row.parentElement;
    if (node) node.classList.toggle('is-collapsed', !folded);
    var chev = row.querySelector('.gn-tree-chev');
    if (chev) {
      chev.setAttribute('aria-expanded', String(folded));
      chev.setAttribute('aria-label', folded ? t('unfold') : t('fold'));
    }
    persistTreeFolded();
  }

  function rememberTurn(turn, sc, headings, withHeads) {
    var cache = state.cache;
    if (!cache || !turn) return;
    if (!cache.turns) cache.turns = {};

    var rec = cache.turns[turn.key] || {};
    rec.t = (turn.userText || '').slice(0, 300);
    rec.a = turn.asstId || turn.key;
    if (typeof turn.order === 'number' && !state.rowsActive) rec.i = turn.order;
    try {
      var top = absTop(turn.userEl, sc);
      var total = Math.max(1, sc.scrollHeight);
      rec.r = Math.max(0, Math.min(1, top / total));
    } catch (e) { /* ignore */ }
    rec.seen = now();
    if (withHeads && headings) {
      rec.h = headings.flat.map(function (h) { return [h.level, h.text]; });
    }
    cache.turns[turn.key] = rec;
    cache.updated = now();
  }

  function scheduleCacheSave() {
    if (state.saveTimer) return;
    state.saveTimer = setTimeout(function () {
      state.saveTimer = 0;
      flushCache();
    }, 1400);
  }

  function flushCache() {
    if (!state.cache || !state.convId || state.convId === 'new') return;
    try {
      if (state.cache.order.length > 400) {
        state.cache.order = state.cache.order.slice(-400);
      }
      writeJSON(KEY_CONV + state.convId, state.cache);
    } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------- 交互

  function setOpen(open) {
    state.open = !!open;
    persistUI();
    state.sig = '';
    render(true);
  }

  function setMode(mode) {
    if (MODES[mode] !== 1) return;
    if (state.mode === mode) return;
    state.mode = mode;
    state.activePk = '';
    state.activeTreeKey = '';
    state.bmConfirmUntil = 0;
    persistUI();
    state.sig = '';
    els.scroll.scrollTop = 0;
    render(true);
  }

  function toggleFold(pk) {
    if (!state.outline) return;
    var asstId = state.outline.asstId;
    var set = getFoldSet(asstId);
    var folded = set.has(pk);
    if (folded) set.delete(pk);
    else set.add(pk);

    var row = state.rowByPk.get(pk);
    if (row) {
      var node = row.parentElement;
      if (node) node.classList.toggle('is-collapsed', !folded);
      var chev = row.querySelector('.gn-chev');
      if (chev) {
        chev.setAttribute('aria-expanded', String(folded));
        chev.setAttribute('aria-label', folded ? t('unfold') : t('fold'));
      }
    }
    persistFolded();
  }

  function findNode(nodes, pk) {
    if (!nodes) return null;
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].pk === pk) return nodes[i];
      var hit = findNode(nodes[i].children, pk);
      if (hit) return hit;
    }
    return null;
  }

  function jumpHeading(pk) {
    if (!state.outline) return;
    state.searchToken++;
    var sc = findScroller();
    var node = findNode(state.outline.roots, pk);
    if (!node || !node.el || !node.el.isConnected || !sc.contains(node.el)) {
      render(true);
      sc = findScroller();
      node = state.outline ? findNode(state.outline.roots, pk) : null;
    }
    if (!node || !node.el || !sc.contains(node.el)) return;
    jumpToElement(node.el, sc);
    setActiveHeading(node, true);
  }

  function cssEscape(s) {
    return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&');
  }

  function findBubbleByKey(sc, key) {
    var el = sc.querySelector('[data-turn-key="' + cssEscape(key) + '"] [data-user-message-bubble]');
    return (el && sc.contains(el)) ? el : null;
  }

  function findBubbleByText(sc, text) {
    if (!text) return null;
    var want = text.replace(/\s+/g, ' ').trim();
    if (want.length < 4) return null;
    var bubbles = sc.querySelectorAll('[data-user-message-bubble]');
    for (var i = 0; i < bubbles.length; i++) {
      var t = textOf(bubbles[i]);
      if (!t) continue;
      var n = Math.min(60, want.length, t.length);
      if (n >= 4 && t.slice(0, n) === want.slice(0, n)) return bubbles[i];
    }
    return null;
  }

  // 目标还没加载时：跳到已加载窗口里最接近目标的位置（上边界/下边界），
  // 等虚拟列表补齐下一批；内容一出现就继续，不做固定长等待。
  function jumpToTurnProgressive(key, sc, rec, direction) {
    var token = ++state.searchToken;
    var tries = 0;
    var stuck = 0;

    function check() {
      var el = findBubbleByKey(sc, key) || findBubbleByText(sc, rec && rec.t);
      if (el) {
        jumpToElement(el, sc);
        setActiveListItem(key);
        return true;
      }
      return false;
    }

    function waitForContent(beforeHeight, beforeCount) {
      var started = now();
      var poll = setInterval(function () {
        if (token !== state.searchToken) { clearInterval(poll); return; }
        if (check()) { clearInterval(poll); return; }

        var h = sc.scrollHeight;
        var count = sc.querySelectorAll('[data-turn-key]').length;
        if (h !== beforeHeight || count !== beforeCount) {
          clearInterval(poll);
          step();
          return;
        }
        if (now() - started > 800) {
          clearInterval(poll);
          stuck++;
          if (stuck >= 2) return;
          step();
        }
      }, 60);
    }

    function step() {
      if (token !== state.searchToken) return;
      if (check()) return;

      tries++;
      if (tries > 14) return;

      var beforeHeight = sc.scrollHeight;
      var beforeCount = sc.querySelectorAll('[data-turn-key]').length;
      var nearTurns = sc.querySelectorAll('[data-turn-key]');
      var targetY;

      if (nearTurns.length) {
        // 跳到“最接近目标的已加载条目”的边缘：向上取第一条的顶部，向下取最后一条的底部
        var near = direction === 'before' ? nearTurns[0] : nearTurns[nearTurns.length - 1];
        targetY = direction === 'before'
          ? 0
          : absTop(near, sc) + near.offsetHeight - viewHeight(sc) + 8;
      } else {
        targetY = direction === 'before' ? 0 : Math.max(0, sc.scrollHeight - viewHeight(sc));
      }

      // 只能朝目标方向移动，避免“最接近的已加载条目”在反方向时把页面拉回去
      if (direction === 'before') targetY = Math.min(targetY, viewTop(sc));
      else targetY = Math.max(targetY, viewTop(sc));

      if (Math.abs(viewTop(sc) - targetY) < 1) {
        // 已经贴边：轻推一下，促使虚拟列表继续加载
        setScrollTop(sc, targetY + (direction === 'before' ? 4 : -4));
        setTimeout(function () { setScrollTop(sc, targetY); }, 30);
      } else {
        setScrollTop(sc, targetY);
      }

      waitForContent(beforeHeight, beforeCount);
    }

    step();
  }

  function findTurnByKey(key) {
    for (var i = 0; i < state.turns.length; i++) {
      if (state.turns[i].key === key) return state.turns[i];
    }
    return null;
  }

  function cssEscape(v) {
    if (window.CSS && CSS.escape) return CSS.escape(String(v));
    return String(v).replace(/["\\]/g, '\\$&');
  }

  var toastTimer = 0;
  function flashToast(text) {
    if (!text) return;
    var old = document.querySelector('[data-gptnav-toast]');
    if (old) old.remove();
    if (toastTimer) clearTimeout(toastTimer);

    var d = document.createElement('div');
    d.setAttribute('data-gptnav-toast', '');
    d.textContent = text;
    d.style.cssText = 'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);padding:7px 12px;border-radius:9px;background:rgba(32,32,36,.94);color:#e6e6ec;border:1px solid rgba(255,255,255,.12);font:12px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;z-index:2147483647;pointer-events:none;box-shadow:0 8px 24px rgba(0,0,0,.3);opacity:1;transition:opacity .3s ease;';
    (document.body || document.documentElement).appendChild(d);
    toastTimer = setTimeout(function () {
      d.style.opacity = '0';
      setTimeout(function () { try { d.remove(); } catch (e) { /* ignore */ } }, 320);
    }, 1600);
  }

  // ---------------------------------------------------------------- 书签

  function loadBookmarks(convId) {
    var c = readJSON(KEY_BOOK + convId, null);
    return c && Array.isArray(c.items) ? c.items : [];
  }

  function saveBookmarks() {
    if (!state.convId) return;
    writeJSON(KEY_BOOK + state.convId, {
      v: 1,
      updated: now(),
      items: state.bookmarks.slice(-500)
    });
  }

  function bookmarkIndex(bm) {
    for (var i = 0; i < state.all.length; i++) {
      if (state.all[i].key === bm.turnKey) return i;
    }
    return -1;
  }

  function buildTextIndex(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var chars = [];
    var map = [];
    var node;
    while ((node = walker.nextNode())) {
      var p = node.parentElement;
      if (!p) continue;
      var tag = p.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') continue;
      if (p.closest('.katex-mathml, [hidden], [aria-hidden="true"], svg')) continue;
      var value = node.nodeValue || '';
      for (var i = 0; i < value.length; i++) {
        var ch = value.charAt(i);
        if (/\s/.test(ch)) {
          if (!chars.length || chars[chars.length - 1] === ' ') continue;
          ch = ' ';
        }
        chars.push(ch);
        map.push({ node: node, offset: i });
      }
    }
    while (chars.length && chars[chars.length - 1] === ' ') {
      chars.pop();
      map.pop();
    }
    return { text: chars.join(''), map: map };
  }

  function locateInRoot(root, want) {
    if (!root || !want) return null;
    var norm = want.replace(/\s+/g, ' ').trim();
    if (norm.length < 2) return null;
    var idx = buildTextIndex(root);
    if (!idx.text) return null;

    var needles = [norm];
    if (norm.length > 60) needles.push(norm.slice(0, 60));
    else if (norm.length > 30) needles.push(norm.slice(0, 30));

    var firstRange = null;

    for (var n = 0; n < needles.length; n++) {
      var needle = needles[n];
      var from = 0;
      var guard = 0;

      while (guard++ < 200) {
        var at = idx.text.indexOf(needle, from);
        if (at < 0) break;

        var len = Math.min(needle.length, idx.text.length - at);
        var start = idx.map[at];
        var end = idx.map[at + len - 1];
        if (start && end) {
          try {
            var range = document.createRange();
            range.setStart(start.node, start.offset);
            range.setEnd(end.node, end.offset + 1);
            var rect = range.getBoundingClientRect();
            if (rect && (rect.width || rect.height)) return range;
            if (!firstRange) firstRange = range;
          } catch (e) { /* try next */ }
        }
        from = at + 1;
      }
    }

    return firstRange;
  }

  function findBookmarkRange(bm, sc) {
    var turn = findTurnByKey(bm.turnKey);
    var roots = [];

    if (turn) {
      if (bm.role === 'user' && turn.userEl) {
        roots.push(turn.userEl);
      } else {
        if (bm.msgId) {
          var holder = turn.el.querySelector('[data-chatgpt-selection-message-id="' + cssEscape(bm.msgId) + '"]');
          if (!holder) holder = turn.el.querySelector('[data-dil-message-id="' + cssEscape(bm.msgId) + '"]');
          if (holder) roots.push(holder);
        }
        if (turn.asstEl) roots.push(turn.asstEl);
        if (!roots.length) roots.push(turn.el);
      }
    }

    for (var i = 0; i < roots.length; i++) {
      var hit = locateInRoot(roots[i], bm.text);
      if (hit) return hit;
    }
    if (sc) return locateInRoot(sc, bm.text);
    return null;
  }

  function flashRange(range) {
    setTimeout(function () {
      try {
        var rects = range.getClientRects();
        var count = 0;
        for (var i = 0; i < rects.length && count < 8; i++) {
          var r = rects[i];
          if (r.width < 2 || r.height < 2) continue;
          count++;
          var d = document.createElement('div');
          d.setAttribute('data-gptnav-flash', '');
          d.style.cssText = 'position:fixed;left:' + (r.left - 2) + 'px;top:' + (r.top - 1) + 'px;width:' + (r.width + 4) + 'px;height:' + (r.height + 2) + 'px;background:rgba(167,139,250,.26);border:1px solid rgba(167,139,250,.55);border-radius:3px;pointer-events:none;z-index:2147483647;transition:opacity .5s ease;';
          (document.body || document.documentElement).appendChild(d);
          (function (el) {
            setTimeout(function () { el.style.opacity = '0'; }, 1200);
            setTimeout(function () { try { el.remove(); } catch (e) { /* ignore */ } }, 1800);
          })(d);
        }
      } catch (e) { /* ignore */ }
    }, 260);
  }

  function jumpToRange(range, sc, fallbackRatio) {
    if (!range || !sc) return;
    var tries = 0;
    var fallbackUsed = false;

    function step() {
      try {
        if (!range.startContainer || !range.startContainer.isConnected) return;
        var rect = range.getBoundingClientRect();
        if (!rect || (!rect.width && !rect.height)) {
          if (!fallbackUsed && typeof fallbackRatio === 'number' && fallbackRatio > 0) {
            fallbackUsed = true;
            var max = Math.max(0, sc.scrollHeight - viewHeight(sc));
            scrollToY(sc, Math.min(max, fallbackRatio * sc.scrollHeight));
            setTimeout(step, 480);
          }
          return;
        }
        var scTop = isDocScroller(sc) ? 0 : sc.getBoundingClientRect().top;
        var delta = rect.top - scTop - 100;
        if (Math.abs(delta) <= 8 || tries >= 4) {
          flashRange(range);
          return;
        }
        scrollToY(sc, viewTop(sc) + delta);
        tries++;
        setTimeout(step, 240);
      } catch (e) { /* ignore */ }
    }

    step();
  }

  function jumpToBookmark(bm) {
    var sc = findScroller();
    if (!sc) return;

    var turn = findTurnByKey(bm.turnKey);
    if (!turn) {
      state.pendingBookmark = { bm: bm, at: now() };
      jumpTurn(bm.turnKey);
      return;
    }

    var range = findBookmarkRange(bm, sc);
    if (range) {
      state.pendingBookmark = null;
      jumpToRange(range, sc, bm.ratio);
      return;
    }

    setTimeout(function () {
      var retry = findBookmarkRange(bm, sc);
      if (retry) jumpToRange(retry, sc, bm.ratio);
      else flashToast(t('bookmark.notFound'));
    }, 350);
  }

  function maybeJumpPendingBookmark() {
    var p = state.pendingBookmark;
    if (!p) return;
    if (now() - p.at > 15000) {
      state.pendingBookmark = null;
      flashToast(t('bookmark.notFound'));
      return;
    }
    var turn = findTurnByKey(p.bm.turnKey);
    if (!turn) return;
    var sc = findScroller();
    if (!sc) return;
    var range = findBookmarkRange(p.bm, sc);
    if (!range) return;
    state.pendingBookmark = null;
    state.searchToken++;
    jumpToRange(range, sc, p.bm.ratio);
  }

  function readSelection() {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return null;
    var range = sel.getRangeAt(0);
    var text = (sel.toString() || '').replace(/\s+/g, ' ').trim();
    if (text.length < 2) return null;

    var node = range.commonAncestorContainer;
    if (node.nodeType === 3) node = node.parentElement;
    if (!node || !node.closest) return null;
    if (node.getRootNode() === shadow || shadow.contains(node)) return null;

    var sc = findScroller();
    if (!sc || !sc.contains(node)) return null;
    var turnEl = node.closest('[data-turn-key]');
    if (!turnEl) return null;

    var bubble = node.closest('[data-user-message-bubble]');
    var asst = node.closest('[data-markdown-text-style="assistant-message"]');
    if (!bubble && !asst) return null;

    var msgId = '';
    var holder = node.closest('[data-chatgpt-selection-message-id]');
    if (holder) msgId = holder.getAttribute('data-chatgpt-selection-message-id') || '';
    if (!msgId) {
      var dil = node.closest('[data-dil-message-id]');
      if (dil) msgId = dil.getAttribute('data-dil-message-id') || '';
    }

    var rect = range.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) return null;

    return {
      range: range,
      text: text,
      turnKey: turnEl.getAttribute('data-turn-key') || '',
      msgId: msgId,
      role: bubble ? 'user' : 'assistant',
      rect: rect
    };
  }

  function hideSelButton() {
    if (!els.selAdd) return;
    els.selAdd.hidden = true;
    els.selAdd.classList.remove('is-done');
    state.selInfo = null;
  }

  function updateSelButton() {
    if (!els.selAdd) return;
    if (state.selInfo && state.selInfo.keep) return;

    var info = readSelection();
    if (!info) {
      hideSelButton();
      return;
    }

    var r = info.rect;
    if (r.bottom < 0 || r.top > window.innerHeight) {
      hideSelButton();
      return;
    }

    var left = Math.min(Math.max(8, r.left + r.width / 2 - 30), window.innerWidth - 96);
    var top = r.bottom + 8;
    if (top > window.innerHeight - 40) top = r.top - 34;
    top = Math.max(8, Math.min(top, window.innerHeight - 38));

    els.selAdd.style.left = Math.round(left) + 'px';
    els.selAdd.style.top = Math.round(top) + 'px';
    els.selAdd.hidden = false;
    state.selInfo = info;
  }

  function addBookmarkFromSelection(info) {
    if (!info) return;
    var sc = findScroller();
    var bm = {
      id: 'b' + now().toString(36) + Math.random().toString(36).slice(2, 6),
      text: info.text.slice(0, 800),
      summary: info.text.slice(0, 80),
      turnKey: info.turnKey,
      msgId: info.msgId,
      role: info.role,
      created: now(),
      ratio: 0
    };

    try {
      var scTop = isDocScroller(sc) ? 0 : sc.getBoundingClientRect().top;
      var top = info.rect.top - scTop + viewTop(sc);
      bm.ratio = Math.max(0, Math.min(1, top / Math.max(1, sc.scrollHeight)));
    } catch (e) { /* ignore */ }

    state.bookmarks.push(bm);
    saveBookmarks();
    if (state.mode === 'bookmarks') render(true);

    els.selAdd.querySelector('span').textContent = t('bookmark.saved');
    els.selAdd.classList.add('is-done');
    try { window.getSelection().removeAllRanges(); } catch (e) { /* ignore */ }

    setTimeout(function () {
      hideSelButton();
      els.selAdd.querySelector('span').textContent = t('bookmark.add');
    }, 900);
  }

  function deleteBookmark(id) {
    var out = [];
    for (var i = 0; i < state.bookmarks.length; i++) {
      if (state.bookmarks[i].id !== id) out.push(state.bookmarks[i]);
    }
    if (out.length === state.bookmarks.length) return;
    state.bookmarks = out;
    saveBookmarks();
    render(true);
  }

  function clearBookmarks() {
    state.bookmarks = [];
    state.bmConfirmUntil = 0;
    saveBookmarks();
    render(true);
  }

  function jumpTurn(key) {
    var sc = findScroller();
    if (!sc) return;
    state.searchToken++;

    // 记录跳转方向：如果整段窗口被替换且与缓存没有交集，用它决定拼到哪一端
    var activeKey = state.activeTurnKey || (state.turns[state.idx] && state.turns[state.idx].key) || '';
    var targetIdx = -1;
    var activeIdx = -1;
    for (var ai = 0; ai < state.all.length; ai++) {
      if (state.all[ai].key === key) targetIdx = ai;
      if (state.all[ai].key === activeKey) activeIdx = ai;
    }

    // 优先用页面权威序号（rows / 缓存记录里的全局下标）判断方向；
    // 面板下标本身可能就是错乱的，不能再拿它当依据。
    var cacheTurns = state.cache && state.cache.turns ? state.cache.turns : null;
    var targetOrd = rowOrdOf(key);
    var activeOrd = rowOrdOf(activeKey);
    if (targetOrd < 0 && cacheTurns && cacheTurns[key] && typeof cacheTurns[key].i === 'number') {
      targetOrd = cacheTurns[key].i;
    }
    if (activeOrd < 0 && cacheTurns && cacheTurns[activeKey] && typeof cacheTurns[activeKey].i === 'number') {
      activeOrd = cacheTurns[activeKey].i;
    }

    if (targetOrd >= 0 && activeOrd >= 0 && targetOrd !== activeOrd) {
      state.orderHint = targetOrd < activeOrd ? 'before' : 'after';
      state.orderHintAt = now();
    } else if (targetIdx >= 0 && activeIdx >= 0 && targetIdx !== activeIdx) {
      state.orderHint = targetIdx < activeIdx ? 'before' : 'after';
      state.orderHintAt = now();
    }

    var target = null;
    for (var i = 0; i < state.turns.length; i++) {
      if (state.turns[i].key === key) { target = state.turns[i]; break; }
    }
    if (target && target.userEl && target.userEl.isConnected && sc.contains(target.userEl)) {
      jumpToElement(target.userEl, sc);
      setActiveListItem(target.key);
      return;
    }

    var rec = state.cache && state.cache.turns ? state.cache.turns[key] : null;
    if (!rec) return;

    var dir = '';
    if (targetOrd >= 0 && activeOrd >= 0 && targetOrd !== activeOrd) {
      dir = targetOrd < activeOrd ? 'before' : 'after';
    } else if (targetIdx >= 0 && activeIdx >= 0 && targetIdx !== activeIdx) {
      dir = targetIdx < activeIdx ? 'before' : 'after';
    } else if (typeof rec.r === 'number') {
      dir = rec.r * sc.scrollHeight > viewTop(sc) ? 'after' : 'before';
    } else {
      dir = 'after';
    }
    jumpToTurnProgressive(key, sc, rec, dir);
  }

  function onPanelClick(e) {
    e.stopPropagation();
    state.lastPanelTouch = now();

    var t = e.target;
    var tab = t.closest ? t.closest('.gn-tab') : null;
    if (tab) { setMode(tab.getAttribute('data-mode')); return; }

    if (t.closest && t.closest('.gn-collapse')) { setOpen(false); return; }
    if (t.closest && t.closest('.gn-settings')) { openOptions(); return; }
    if (t.closest && t.closest('.gn-github')) { openRepo(); return; }
    if (t.closest && t.closest('.gn-refresh')) {
      if (e.shiftKey) clearAllCaches();
      else clearCurrentCache();
      render(true);
      return;
    }

    var treeChev = t.closest ? t.closest('.gn-tree-chev') : null;
    if (treeChev) {
      toggleTreeFold(treeChev.getAttribute('data-key'));
      return;
    }

    var treeRow = t.closest ? t.closest('.gn-tree-row') : null;
    if (treeRow) {
      var treeKey = treeRow.getAttribute('data-key');
      jumpTurn(treeKey);
      setActiveTreeItem(treeKey);
      return;
    }

    var bmDel = t.closest ? t.closest('.gn-bm-del') : null;
    if (bmDel) {
      deleteBookmark(bmDel.getAttribute('data-id'));
      return;
    }

    var bmClear = t.closest ? t.closest('.gn-bm-clear') : null;
    if (bmClear) {
      if (state.bmConfirmUntil > now()) {
        clearBookmarks();
      } else {
        state.bmConfirmUntil = now() + 3000;
        render(true);
        setTimeout(function () {
          if (state.mode === 'bookmarks' && state.bmConfirmUntil && now() >= state.bmConfirmUntil) {
            state.bmConfirmUntil = 0;
            render(true);
          }
        }, 3200);
      }
      return;
    }

    var bmRow = t.closest ? t.closest('.gn-bm') : null;
    if (bmRow) {
      var bid = bmRow.getAttribute('data-id');
      for (var bi = 0; bi < state.bookmarks.length; bi++) {
        if (state.bookmarks[bi].id === bid) {
          jumpToBookmark(state.bookmarks[bi]);
          break;
        }
      }
      return;
    }

    var chev = t.closest ? t.closest('.gn-chev') : null;
    if (chev) { toggleFold(chev.getAttribute('data-pk')); return; }

    var row = t.closest ? t.closest('.gn-row') : null;
    if (row) { jumpHeading(row.getAttribute('data-pk')); return; }

    var item = t.closest ? t.closest('.gn-item') : null;
    if (item) { jumpTurn(item.getAttribute('data-key')); return; }
  }

  function stopProp(e) { e.stopPropagation(); }

  els.panel.addEventListener('click', onPanelClick);
  els.panel.addEventListener('pointerdown', stopProp);
  els.panel.addEventListener('keydown', stopProp);
  els.panel.addEventListener('wheel', function (e) {
    state.lastPanelTouch = now();
    e.stopPropagation();
  }, { passive: true });

  els.fab.addEventListener('click', function (e) {
    e.stopPropagation();
    setOpen(true);
  });

  // 选中正文后浮出“书签”按钮
  els.selAdd.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (state.selInfo) state.selInfo.keep = true;
  });
  els.selAdd.addEventListener('click', function (e) {
    e.stopPropagation();
    addBookmarkFromSelection(state.selInfo);
  });

  function scheduleSelCheck() {
    if (state.selTimer) clearTimeout(state.selTimer);
    state.selTimer = setTimeout(function () {
      state.selTimer = 0;
      updateSelButton();
    }, 130);
  }

  function onDocMouseUp(e) {
    if (e.composedPath && e.composedPath().indexOf(host) >= 0) return;
    scheduleSelCheck();
  }

  function onDocKeyUp(e) {
    if (e.composedPath && e.composedPath().indexOf(host) >= 0) return;
    scheduleSelCheck();
  }

  function onDocSelectionChange() {
    scheduleSelCheck();
  }

  function onDocScrollHide() {
    hideSelButton();
  }

  function onDocPointerDown(e) {
    if (e.composedPath && e.composedPath().indexOf(host) >= 0) return;
    if (state.selInfo) state.selInfo.keep = false;
    hideSelButton();
  }

  document.addEventListener('mouseup', onDocMouseUp, true);
  document.addEventListener('keyup', onDocKeyUp, true);
  document.addEventListener('selectionchange', onDocSelectionChange);
  document.addEventListener('scroll', onDocScrollHide, true);
  document.addEventListener('pointerdown', onDocPointerDown, true);

  function onQuoteMeta() {
    state.quoteCache = new Map();
    scheduleRender(40);
  }
  document.addEventListener('gptnav:quote', onQuoteMeta);

  function onRowsMeta() {
    state.sig = '';
    scheduleRender(80);
  }
  document.addEventListener('gptnav:rows', onRowsMeta);

  // ---------------------------------------------------------------- 渲染

  function renderEmpty() {
    var d = document.createElement('div');
    d.className = 'gn-empty';
    var a = document.createElement('div');
    a.textContent = t('empty.title');
    var b = document.createElement('div');
    b.textContent = t('empty.hint');
    d.appendChild(a);
    d.appendChild(b);
    els.body.appendChild(d);
  }

  // ---------------------------------------------------------------- 引用树

  function buildQuoteTree(items) {
    var nodes = {};
    var byAsst = {};
    var pos = {};

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      pos[it.key] = i;
      nodes[it.key] = { key: it.key, item: it, children: [], parentKey: '' };
      if (it.asstId) byAsst[it.asstId] = it.key;
      // 引用用户消息时，source id 就是这条提问的 turn key
      if (it.key) byAsst[it.key] = it.key;
    }

    var inTree = {};
    var links = 0;

    for (var j = 0; j < items.length; j++) {
      var item = items[j];
      if (!item.quoted) continue;

      var parentKey = '';
      if (item.quoteSourceId) parentKey = byAsst[item.quoteSourceId] || '';
      if (parentKey === item.key) parentKey = '';

      // 只在拿不到精确 source id 时，退回“前一条提问”
      if (!parentKey && !item.quoteSourceId) {
        for (var k = j - 1; k >= 0; k--) {
          if (items[k].key) { parentKey = items[k].key; break; }
        }
      }

      // 父节点必须存在且在当前节点之前，避免环和反向引用
      if (parentKey && (!nodes[parentKey] || pos[parentKey] >= j)) parentKey = '';

      nodes[item.key].parentKey = parentKey;
      inTree[item.key] = 1;

      if (parentKey) {
        nodes[parentKey].children.push(nodes[item.key]);
        inTree[parentKey] = 1;
        links++;
      }
    }

    var roots = [];
    for (var m = 0; m < items.length; m++) {
      var key = items[m].key;
      if (!inTree[key]) continue;
      if (!nodes[key].parentKey) roots.push(nodes[key]);
    }

    return { roots: roots, nodes: nodes, links: links, total: Object.keys(inTree).length };
  }

  function renderTreeNodes(nodes, depth, container) {
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var item = node.item;
      var hasKids = node.children.length > 0;
      var canFold = node.children.length > 1;
      var folded = canFold && state.treeFolded.has(item.key);

      var li = document.createElement('div');
      li.className = 'gn-tree-node';
      li.setAttribute('data-key', item.key);
      if (item.ghost) li.classList.add('is-ghost');
      if (folded) li.classList.add('is-collapsed');

      var row = document.createElement('div');
      row.className = 'gn-tree-row';
      row.setAttribute('data-key', item.key);
      row.setAttribute('data-depth', String(depth));
      row.setAttribute('role', 'button');
      row.tabIndex = 0;

      if (canFold) {
        var chev = document.createElement('button');
        chev.type = 'button';
        chev.className = 'gn-tree-chev';
        chev.setAttribute('data-key', item.key);
        chev.setAttribute('aria-expanded', String(!folded));
        chev.setAttribute('aria-label', folded ? t('unfold') : t('fold'));
        chev.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l4 4-4 4"/></svg>';
        row.appendChild(chev);
      } else {
        var sp = document.createElement('span');
        sp.className = 'gn-tree-spacer';
        row.appendChild(sp);
      }

      var badge = document.createElement('span');
      badge.className = 'gn-tree-badge';
      var ix = bookmarkIndex({ turnKey: item.key });
      badge.textContent = ix >= 0 ? 'Q' + (ix + 1) : 'Q?';
      row.appendChild(badge);

      var label = document.createElement('span');
      label.className = 'gn-tree-label';
      label.textContent = item.userText || t('noText');
      var title = item.userText || '';
      if (item.quoteText) title += (title ? '\n\n' : '') + item.quoteText;
      row.title = title;
      row.appendChild(label);

      if (node.children.length > 1) {
        var cnt = document.createElement('span');
        cnt.className = 'gn-tree-count';
        cnt.textContent = String(node.children.length);
        row.appendChild(cnt);
      }

      li.appendChild(row);
      state.treeByKey.set(item.key, row);

      if (hasKids) {
        var kids = document.createElement('div');
        kids.className = 'gn-tree-children';
        renderTreeNodes(node.children, depth + 1, kids);
        li.appendChild(kids);
      }

      container.appendChild(li);
    }
  }

  function renderTreeEmpty() {
    var d = document.createElement('div');
    d.className = 'gn-empty';
    var a = document.createElement('div');
    a.textContent = t('tree.empty');
    var b = document.createElement('div');
    b.textContent = t('tree.emptyHint');
    d.appendChild(a);
    d.appendChild(b);
    els.body.appendChild(d);
  }

  function renderTree() {
    var tree = buildQuoteTree(state.all);
    state.treeNodeCount = tree.total;
    state.treeLinks = tree.links;

    if (!tree.roots.length) {
      renderTreeEmpty();
      return;
    }

    var wrap = document.createElement('div');
    wrap.className = 'gn-tree gn-tree-quote';
    renderTreeNodes(tree.roots, 0, wrap);
    els.body.appendChild(wrap);
  }

  function setActiveTreeItem(key) {
    if (key === state.activeTreeKey) return;
    var prev = state.activeTreeKey ? state.treeByKey.get(state.activeTreeKey) : null;
    if (prev) prev.classList.remove('is-active');
    state.activeTreeKey = key || '';
    var row = key ? state.treeByKey.get(key) : null;
    if (row) {
      row.classList.add('is-active');
      ensureVisible(row);
    }
  }

  // ---------------------------------------------------------------- 书签列表

  function renderBookmarksEmpty() {
    var d = document.createElement('div');
    d.className = 'gn-empty';
    var a = document.createElement('div');
    a.textContent = t('bookmark.empty');
    var b = document.createElement('div');
    b.textContent = t('bookmark.emptyHint');
    d.appendChild(a);
    d.appendChild(b);
    els.body.appendChild(d);
  }

  function renderBookmarks() {
    if (!state.bookmarks.length) {
      renderBookmarksEmpty();
      return;
    }

    var list = state.bookmarks.slice();
    list.sort(function (a, b) {
      var ia = bookmarkIndex(a);
      var ib = bookmarkIndex(b);
      if (ia < 0) ia = 1e9;
      if (ib < 0) ib = 1e9;
      return ia - ib || a.created - b.created;
    });

    var head = document.createElement('div');
    head.className = 'gn-bm-head';

    var title = document.createElement('span');
    title.className = 'gn-bm-title';
    title.textContent = t('tabs.bookmarks');

    var clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'gn-bm-clear';
    var confirming = state.bmConfirmUntil > now();
    clear.textContent = confirming ? t('bookmark.confirm') : t('bookmark.clear');
    if (confirming) clear.classList.add('is-confirm');
    clear.setAttribute('data-act', 'clear');

    head.appendChild(title);
    head.appendChild(clear);
    els.body.appendChild(head);

    for (var i = 0; i < list.length; i++) {
      var bm = list[i];
      var row = document.createElement('div');
      row.className = 'gn-bm';
      row.setAttribute('data-id', bm.id);
      row.setAttribute('role', 'button');
      row.tabIndex = 0;

      var ix = bookmarkIndex(bm);
      if (ix < 0) row.classList.add('is-ghost');

      var q = document.createElement('span');
      q.className = 'gn-bm-q';
      q.textContent = ix >= 0 ? 'Q' + (ix + 1) : '—';

      var txt = document.createElement('span');
      txt.className = 'gn-bm-text';
      txt.textContent = bm.summary || bm.text;
      txt.title = bm.text;

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'gn-bm-del';
      del.setAttribute('data-id', bm.id);
      del.title = t('bookmark.delete');
      del.setAttribute('aria-label', t('bookmark.delete'));
      del.textContent = '×';

      row.appendChild(q);
      row.appendChild(txt);
      row.appendChild(del);
      els.body.appendChild(row);
    }
  }

  function renderList() {
    var rail = document.createElement('div');
    rail.className = 'gn-rail';

    for (var i = 0; i < state.all.length; i++) {
      var t = state.all[i];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'gn-item' + (t.ghost ? ' is-ghost' : '');
      b.setAttribute('data-key', t.key);
      b.title = t.userText || '';

      var head = document.createElement('div');
      head.className = 'gn-item-head';

      var idx = document.createElement('span');
      idx.className = 'gn-idx';
      idx.textContent = pad2(i + 1);

      var q = document.createElement('span');
      q.className = 'gn-q';
      q.textContent = t.userText || t('noText');

      head.appendChild(idx);
      head.appendChild(q);
      b.appendChild(head);
      rail.appendChild(b);

      state.itemByKey.set(t.key, b);
    }

    els.body.appendChild(rail);
  }

  function renderNodes(nodes, depth, container, asstId) {
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var folded = isFolded(asstId, n.pk);

      var li = document.createElement('div');
      li.className = 'gn-node';
      li.setAttribute('data-depth', String(depth));

      var row = document.createElement('div');
      row.className = 'gn-row';
      row.setAttribute('data-pk', n.pk);
      row.setAttribute('data-depth', String(depth));

      if (n.children.length) {
        if (folded) li.classList.add('is-collapsed');

        var chev = document.createElement('button');
        chev.type = 'button';
        chev.className = 'gn-chev';
        chev.setAttribute('data-pk', n.pk);
        chev.setAttribute('aria-expanded', String(!folded));
        chev.setAttribute('aria-label', folded ? t('fold') : t('unfold'));
        chev.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l4 4-4 4"/></svg>';
        row.appendChild(chev);
      } else {
        var sp = document.createElement('span');
        sp.className = 'gn-spacer';
        row.appendChild(sp);
      }

      var label = document.createElement('span');
      label.className = 'gn-label';
      label.textContent = n.text;
      label.title = n.text;
      if (depth === 0) label.style.fontWeight = '500';
      row.appendChild(label);
      li.appendChild(row);

      state.rowByPk.set(n.pk, row);

      if (n.children.length) {
        var kids = document.createElement('div');
        kids.className = 'gn-children';
        renderNodes(n.children, depth + 1, kids, asstId);
        li.appendChild(kids);
      }

      container.appendChild(li);
    }
  }

  function renderOutline(turn) {
    if (!turn) { renderEmpty(); return; }

    var meta = document.createElement('div');
    meta.className = 'gn-meta';

    var qrow = document.createElement('div');
    qrow.className = 'gn-meta-q';

    var badge = document.createElement('span');
    badge.className = 'gn-badge';
    var dispIdx = findListItemIndex(turn);
    badge.textContent = 'Q' + ((dispIdx >= 0 ? dispIdx : state.idx) + 1);

    var txt = document.createElement('span');
    txt.className = 'gn-meta-text';
    txt.textContent = turn.userText || t('answer.current');
    txt.title = turn.userText || '';

    qrow.appendChild(badge);
    qrow.appendChild(txt);
    meta.appendChild(qrow);

    var crumb = document.createElement('div');
    crumb.className = 'gn-crumb';
    crumb.style.display = 'none';
    var crumbK = document.createElement('span');
    crumbK.className = 'gn-crumb-k';
    crumbK.textContent = t('pos');
    var crumbT = document.createElement('span');
    crumbT.className = 'gn-crumb-t';
    crumb.appendChild(crumbK);
    crumb.appendChild(crumbT);
    meta.appendChild(crumb);
    els.context.appendChild(meta);
    state.crumbEl = crumbT;
    state.crumbK = crumbK;

    if (!state.outline || !state.flat.length) {
      var d = document.createElement('div');
      d.className = 'gn-empty';
      d.textContent = turn.asstEl
        ? t('outline.empty')
        : t('outline.waiting');
      els.body.appendChild(d);
      return;
    }

    var tree = document.createElement('div');
    tree.className = 'gn-tree';
    renderNodes(state.outline.roots, 0, tree, state.outline.asstId);
    els.body.appendChild(tree);
  }

  function updateStat() {
    if (state.mode === 'list') {
      var ghosts = 0;
      for (var i = 0; i < state.all.length; i++) if (state.all[i].ghost) ghosts++;
      var text = t('stat.questions', { n: state.all.length });
      if (ghosts) text += t('stat.cached', { n: ghosts });
      els.stat.textContent = text;
    } else if (state.mode === 'tree') {
      els.stat.textContent = state.treeNodeCount
        ? t('stat.tree', { n: state.treeNodeCount, q: state.treeLinks })
        : '';
    } else if (state.mode === 'bookmarks') {
      els.stat.textContent = t('stat.bookmarks', { n: state.bookmarks.length });
    } else {
      els.stat.textContent = state.flat.length ? t('stat.headings', { n: state.flat.length }) : '';
    }
  }

  function makeSig(turns, idx, outline) {
    var a = turns.map(function (t) {
      return t.key + ':' + t.asstId + ':' + t.userText.length + ':' + (t.quoteSourceId || '');
    }).join(',');

    var b = outline ? outline.flat.map(function (h) {
      return h.level + h.text;
    }).join(',') : '';

    var ghosts = 0;
    for (var gi = 0; gi < state.all.length; gi++) {
      if (state.all[gi].ghost) ghosts++;
    }

    return [state.convId, state.mode, state.open ? 1 : 0, idx, a, b,
      state.all.length, ghosts, state.bookmarks.length, state.treeNodeCount, state.treeLinks].join('~');
  }

  var lastRenderAt = 0;

  function render(force) {
    var sc = findScroller();
    if (!sc) return;

    var theme = document.documentElement.getAttribute('data-theme');
    els.root.setAttribute('data-gn-theme', theme === 'light' ? 'light' : 'dark');

    var convId = getConvId();
    if (convId !== state.convId) {
      var prevConv = state.convId;
      state.convId = convId;
      state.cache = loadCache(convId);
      state.folded = loadFolded(state.cache);
      state.treeFolded = loadTreeFolded(state.cache);
      state.quoteCache = new Map();
      state.pendingBookmark = null;
      state.activePk = '';
      state.activeTurnKey = '';
      state.activeTreeKey = '';
      state.bmConfirmUntil = 0;
      state.sig = '';

      var books = loadBookmarks(convId);
      // 新对话变成真实会话时，把临时书签迁过去
      if (prevConv === 'new' && convId !== 'new') {
        var temp = loadBookmarks('new');
        if (temp.length) {
          var seenIds = {};
          for (var bi = 0; bi < books.length; bi++) seenIds[books[bi].id] = 1;
          for (var bj = 0; bj < temp.length; bj++) {
            if (!seenIds[temp[bj].id]) books.push(temp[bj]);
          }
          try { localStorage.removeItem(KEY_BOOK + 'new'); } catch (e) { /* ignore */ }
          state.bookmarks = books;
          saveBookmarks();
        } else {
          state.bookmarks = books;
        }
      } else {
        state.bookmarks = books;
      }
    }

    // 同一 URL 下可能切换分支：用页面里的 selection conversation id 校验缓存
    var sid = getSelectionConvId();
    if (sid && state.cache) {
      if (state.cache.sid && state.cache.sid !== sid) {
        state.cache = emptyCache();
        state.folded = new Map();
        state.treeFolded = new Set();
        state.activePk = '';
        state.activeTreeKey = '';
        state.pendingBookmark = null;
        state.sig = '';
      }
      state.cache.sid = sid;
    }

    state.rows = readRows();
    state.rowsActive = false;

    var turns = collectTurns(sc);
    var hasContent = turns.length > 0;
    els.root.style.display = hasContent ? '' : 'none';
    applyReserve(state.open && hasContent);

    state.turns = turns;
    if (state.cache) {
      var rowsSynced = state.rows && syncOrder(state.rows, turns, state.cache);
      if (!rowsSynced) updateOrder(turns, state.cache);
      for (var ti = 0; ti < turns.length; ti++) rememberTurnMeta(turns[ti], state.cache);
    }
    state.all = buildList(turns, state.cache);
    maybeJumpPendingBookmark();

    var idx = turns.length ? activeTurnIndex(turns, sc) : 0;
    var activeTurn = turns[idx] || null;

    var outlineData = null;
    if (activeTurn && activeTurn.asstEl) {
      outlineData = extractHeadings(activeTurn.asstEl);
      rememberTurn(activeTurn, sc, outlineData, true);
    } else if (activeTurn) {
      rememberTurn(activeTurn, sc, null, false);
    }

    state.idx = idx;
    state.outline = outlineData ? { asstId: activeTurn.asstId, flat: outlineData.flat, roots: outlineData.roots } : null;
    state.flat = outlineData ? outlineData.flat : [];

    var sig = makeSig(turns, idx, state.outline);
    if (!force && sig === state.sig) {
      updateActive();
      return;
    }
    state.sig = sig;

    els.root.setAttribute('data-open', state.open ? 'true' : 'false');
    els.root.setAttribute('data-mode', state.mode);
    els.tabList.setAttribute('aria-selected', String(state.mode === 'list'));
    els.tabOutline.setAttribute('aria-selected', String(state.mode === 'outline'));
    els.tabTree.setAttribute('aria-selected', String(state.mode === 'tree'));
    els.tabBookmarks.setAttribute('aria-selected', String(state.mode === 'bookmarks'));
    try {
      var activeTab = state.mode === 'list' ? els.tabList
        : state.mode === 'outline' ? els.tabOutline
        : state.mode === 'tree' ? els.tabTree : els.tabBookmarks;
      if (activeTab && activeTab.scrollIntoView) {
        activeTab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    } catch (e) { /* ignore */ }

    var keepScroll = els.scroll.scrollTop;

    state.itemByKey = new Map();
    state.rowByPk = new Map();
    state.treeByKey = new Map();
    state.crumbEl = null;
    state.crumbK = null;
    state.activePk = '';
    state.activeTurnKey = '';
    state.activeTreeKey = '';
    state.treeNodeCount = 0;
    state.treeLinks = 0;
    els.body.textContent = '';
    els.context.textContent = '';

    if (!turns.length) renderEmpty();
    else if (state.mode === 'list') renderList();
    else if (state.mode === 'outline') renderOutline(activeTurn);
    else if (state.mode === 'tree') renderTree();
    else renderBookmarks();

    els.scroll.scrollTop = keepScroll;
    updateStat();
    updateActive(true);
    scheduleCacheSave();
    lastRenderAt = now();
  }

  function ensureVisible(el) {
    if (!el) return;
    if (now() - state.lastPanelTouch < 2200) return;
    var sc = els.scroll;
    var r = el.getBoundingClientRect();
    var sr = sc.getBoundingClientRect();
    if (r.top < sr.top + 6) sc.scrollTop -= (sr.top + 6 - r.top);
    else if (r.bottom > sr.bottom - 6) sc.scrollTop += (r.bottom - (sr.bottom - 6));
  }

  function setActiveHeading(node, force) {
    var pk = node ? node.pk : '';
    if (!force && pk === state.activePk) return;

    var prev = state.activePk ? state.rowByPk.get(state.activePk) : null;
    if (prev) prev.classList.remove('is-active');
    state.activePk = pk;

    if (node) {
      var row = state.rowByPk.get(node.pk);
      if (row) {
        row.classList.add('is-active');
        ensureVisible(row);
      }
    }
    updateCrumb(node);
  }

  function updateCrumb(node) {
    if (!state.crumbEl) return;
    var text = node ? node.ancestors.concat(node.text).join(' › ') : '';
    state.crumbEl.textContent = text;
    state.crumbEl.title = text;
    var box = state.crumbEl.parentElement;
    if (box) box.style.display = text ? '' : 'none';
    if (state.crumbK) state.crumbK.style.display = text ? '' : 'none';
  }

  function findListItemIndex(turn) {
    if (!turn) return -1;

    for (var i = 0; i < state.all.length; i++) {
      if (state.all[i].key === turn.key) return i;
    }

    var want = (turn.userText || '').replace(/\s+/g, ' ').trim();
    if (!want) return -1;

    // key 变了但文本相同的缓存条目：把高亮落到对应显示项上
    for (var j = 0; j < state.all.length; j++) {
      var it = state.all[j];
      if (!it.ghost) continue;
      var t = (it.userText || '').replace(/\s+/g, ' ').trim();
      var n = Math.min(60, want.length, t.length);
      if (n >= 4 && t.slice(0, n) === want.slice(0, n)) return j;
    }
    return -1;
  }

  function findListItemKey(turn) {
    var idx = findListItemIndex(turn);
    return idx >= 0 ? state.all[idx].key : (turn ? turn.key : '');
  }

  function updateActive() {
    if (!state.open) return;
    var sc = findScroller();
    if (!sc || !state.turns.length) return;

    var idx = activeTurnIndex(state.turns, sc);
    var turn = state.turns[idx] || null;

    if (state.mode === 'list') {
      setActiveListItem(findListItemKey(turn));
      return;
    }

    if (state.mode === 'tree') {
      setActiveTreeItem(findListItemKey(turn));
      return;
    }

    if (state.mode === 'bookmarks') return;

    if (idx !== state.idx) {
      scheduleRender(120);
      return;
    }

    var threshold = viewTop(sc) + 96;
    var act = null;
    for (var i = 0; i < state.flat.length; i++) {
      var h = state.flat[i];
      if (!h.el || !h.el.isConnected) break;
      if (absTop(h.el, sc) <= threshold) act = h;
      else break;
    }

    // 刚进入回答、还没有标题越过顶部线时，把第一条可见标题作为当前位置
    if (!act && state.flat.length) {
      var first = state.flat[0];
      if (first.el && first.el.isConnected) {
        var ft = absTop(first.el, sc);
        if (ft >= threshold && ft < viewTop(sc) + viewHeight(sc)) act = first;
      }
    }

    setActiveHeading(act);
  }

  function setActiveListItem(key) {
    if (key === state.activeTurnKey) return;
    var prevEl = state.activeTurnKey ? state.itemByKey.get(state.activeTurnKey) : null;
    if (prevEl) prevEl.classList.remove('is-active');
    state.activeTurnKey = key || '';
    var el = key ? state.itemByKey.get(key) : null;
    if (el) {
      el.classList.add('is-active');
      ensureVisible(el);
    }
  }

  // ---------------------------------------------------------------- 调度

  var renderTimer = 0;
  function scheduleRender(delay) {
    if (renderTimer) clearTimeout(renderTimer);
    renderTimer = setTimeout(function () {
      renderTimer = 0;
      render(false);
    }, typeof delay === 'number' ? delay : 220);
  }

  var mo = new MutationObserver(function () {
    if (now() - lastRenderAt > 1400) scheduleRender(60);
    else scheduleRender(240);
  });
  if (document.body) {
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  var themeMo = new MutationObserver(function () {
    var theme = document.documentElement.getAttribute('data-theme');
    if (els.root) els.root.setAttribute('data-gn-theme', theme === 'light' ? 'light' : 'dark');
  });
  themeMo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

  var rafPending = false;
  function onScroll() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () {
      rafPending = false;
      updateActive();
    });
  }
  document.addEventListener('scroll', onScroll, { capture: true, passive: true });

  // 用户自己滚动或点击时，取消自动逐级定位
  function cancelSearch() { state.searchToken++; }
  document.addEventListener('wheel', cancelSearch, { capture: true, passive: true });
  document.addEventListener('pointerdown', cancelSearch, { capture: true, passive: true });
  window.addEventListener('resize', function () { scheduleRender(250); });

  // 页面会吞掉 scroll 事件，且 SPA 切会话时可能清掉预留空间：用低频轮询兜底
  var lastTickTop = -1;
  var lastReserveTick = 0;
  var tickTimer = setInterval(function () {
    if (document.hidden) return;
    var sc = findScroller();
    if (!sc) return;

    if (state.open && now() - lastReserveTick > 800) {
      lastReserveTick = now();
      applyReserve(state.turns.length > 0);
    }

    var top = viewTop(sc);
    if (top !== lastTickTop) {
      if (lastTickTop >= 0) state.scrollDir = top < lastTickTop ? 'up' : 'down';
      lastTickTop = top;
      updateActive();
    }
  }, 120);

  var lastHref = location.href;
  var urlTimer = setInterval(function () {
    if (location.href !== lastHref) {
      lastHref = location.href;
      state.turns = [];
      state.all = [];
      state.flat = [];
      state.outline = null;
      state.idx = 0;
      state.activeTurnKey = '';
      state.activePk = '';
      state.sig = '';
      lastTickTop = -1;
      scheduleRender(60);
    }
  }, 800);

  window.addEventListener('pagehide', flushCache);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flushCache();
    else scheduleRender(60);
  });

  // ---------------------------------------------------------------- 启动

  pruneCaches();
  applyStaticLabels();
  loadSettings();

  // 让 background 把 quote-main.js 注入页面 MAIN world（isolated world 读不到 React fiber）
  function injectQuoteMain() {
    try {
      chrome.runtime.sendMessage({ type: 'gptnav:inject-quote-main' }, function () {
        void chrome.runtime.lastError;
      });
    } catch (e) { /* ignore */ }
  }
  injectQuoteMain();
  setTimeout(injectQuoteMain, 1600);

  [200, 900, 2200].forEach(function (d) {
    setTimeout(function () { render(true); }, d);
  });

  window.__gptnav = {
    render: function () { render(true); },
    destroy: function () {
      try { mo.disconnect(); } catch (e) { /* ignore */ }
      try { themeMo.disconnect(); } catch (e) { /* ignore */ }
      try { clearInterval(urlTimer); } catch (e) { /* ignore */ }
      try { clearInterval(tickTimer); } catch (e) { /* ignore */ }
      try { clearTimeout(renderTimer); } catch (e) { /* ignore */ }
      try { clearTimeout(state.saveTimer); } catch (e) { /* ignore */ }
      document.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('wheel', cancelSearch, true);
      document.removeEventListener('pointerdown', cancelSearch, true);
      document.removeEventListener('mouseup', onDocMouseUp, true);
      document.removeEventListener('keyup', onDocKeyUp, true);
      document.removeEventListener('selectionchange', onDocSelectionChange);
      document.removeEventListener('scroll', onDocScrollHide, true);
      document.removeEventListener('pointerdown', onDocPointerDown, true);
      document.removeEventListener('gptnav:quote', onQuoteMeta);
      document.removeEventListener('gptnav:rows', onRowsMeta);
      try { clearTimeout(state.selTimer); } catch (e) { /* ignore */ }
      try { applyReserve(false); } catch (e) { /* ignore */ }
      try { host.remove(); } catch (e) { /* ignore */ }
    }
  };
})();

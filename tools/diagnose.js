/**
 * GPTNav 诊断脚本（只读：不改页面、不改缓存、不发网络请求）
 *
 * 用法：在出问题的 ChatGPT 页面打开 DevTools → Console，整段粘贴 → 回车。
 * 结果：1) 自动复制 JSON 到剪贴板；2) 挂在 window.__gptnavDiag；3) console 里分组打印。
 *
 * 建议采样两次：
 *   A. 顺序错乱出现时；
 *   B. 点击某条、跳错位置之后。
 */
(function () {
  'use strict';

  var txt = function (el, n) {
    return el ? (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, n || 90) : '';
  };
  var one = function (s, r) { return (r || document).querySelector(s); };
  var all = function (s, r) {
    return Array.prototype.slice.call((r || document).querySelectorAll(s));
  };
  var numEnd = function (v) {
    var m = String(v || '').match(/(\d+)\s*$/);
    return m ? +m[1] : null;
  };
  var cid = (location.pathname.match(/\/c\/([^/?#]+)/) || [])[1] || 'new';

  // ---------------------------------------------------------- 滚动容器
  var containers = all('.thread-scroll-container');
  var scrollers = containers.map(function (el, i) {
    var r = el.getBoundingClientRect();
    return {
      i: i,
      visible: r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight,
      w: Math.round(r.width),
      h: Math.round(r.height),
      top: Math.round(r.top),
      scrollTop: Math.round(el.scrollTop),
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      turns: all('[data-turn-key]', el).length
    };
  });

  // 与插件一致：可见且面积最大的 thread-scroll-container
  var sc = null;
  var area = 0;
  containers.forEach(function (el) {
    var r = el.getBoundingClientRect();
    if (!(r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight)) return;
    var a = r.width * r.height;
    if (a > area) { area = a; sc = el; }
  });

  function topOf(el) {
    var r = el.getBoundingClientRect();
    if (!sc) return Math.round(r.top + scrollY);
    return Math.round(r.top - sc.getBoundingClientRect().top + sc.scrollTop);
  }

  // ---------------------------------------------------------- DOM 里的轮次
  var turnEls = all('[data-turn-key]');
  var dup = {};
  turnEls.forEach(function (el) {
    var k = el.getAttribute('data-turn-key') || '';
    dup[k] = (dup[k] || 0) + 1;
  });

  var dom = turnEls.map(function (el, i) {
    var key = el.getAttribute('data-turn-key') || '';
    var user = one('[data-user-message-bubble]', el);
    var cs = one('[data-content-search-turn-key]', el);
    var um = one('[data-chatgpt-search-unit-key]', el);
    var asst = all('[data-markdown-text-style="assistant-message"]', el).pop();
    var asstId = '';
    if (asst) {
      var holder = asst.closest('[data-chatgpt-selection-message-id]');
      if (holder) asstId = holder.getAttribute('data-chatgpt-selection-message-id') || '';
      if (!asstId) {
        var dil = one('[data-dil-message-id]', el);
        if (dil) asstId = dil.getAttribute('data-dil-message-id') || '';
      }
    }
    return {
      dom: i,
      key: key,
      dup: dup[key] > 1 ? dup[key] : 0,
      inScroller: sc ? sc.contains(el) : true,
      rawOrder: (cs && cs.getAttribute('data-content-search-turn-key')) || '',
      ord: numEnd(cs && cs.getAttribute('data-content-search-turn-key')),
      unit: (um && um.getAttribute('data-chatgpt-search-unit-key')) || '',
      asstId: asstId,
      top: topOf(el),
      h: Math.round(el.getBoundingClientRect().height),
      quoteSrc: el.getAttribute('data-gptnav-quote-src') || '',
      quoteText: (el.getAttribute('data-gptnav-quote-text') || '').slice(0, 60),
      text: txt(user, 90)
    };
  });

  // ---------------------------------------------------------- 插件面板
  var host = document.getElementById('gptnav-host');
  var sr = host && host.shadowRoot;
  var rootEl = sr ? one('.gn-root', sr) : null;
  var panel = sr ? all('.gn-item[data-key]', sr).map(function (el, i) {
    return {
      i: i,
      key: el.getAttribute('data-key'),
      ghost: el.classList.contains('is-ghost'),
      active: el.classList.contains('is-active'),
      no: txt(one('.gn-idx', el), 8),
      text: txt(one('.gn-q', el), 90)
    };
  }) : null;

  // ---------------------------------------------------------- 缓存
  var cacheKey = 'gptnav:conv:' + cid;
  var cache = null;
  try {
    cache = JSON.parse(localStorage.getItem(cacheKey) || 'null');
  } catch (e) {
    cache = { parseError: String(e) };
  }
  var cacheOrder = cache && Array.isArray(cache.order) ? cache.order : [];
  var cacheTurns = (cache && cache.turns) || {};

  var sidEl = one('[data-chatgpt-selection-conversation-id]');
  var sid = sidEl ? (sidEl.getAttribute('data-chatgpt-selection-conversation-id') || '') : '';

  var domIndex = {};
  dom.forEach(function (r) { if (domIndex[r.key] === undefined) domIndex[r.key] = r.dom; });
  var panelIndex = {};
  (panel || []).forEach(function (r) { if (panelIndex[r.key] === undefined) panelIndex[r.key] = r.i; });

  // 插件从页面 React rows 读到的权威顺序
  var rowsPayload = null;
  try {
    rowsPayload = JSON.parse(document.documentElement.getAttribute('data-gptnav-rows') || 'null');
  } catch (e) {
    rowsPayload = { parseError: String(e) };
  }
  var rowsList = rowsPayload && Array.isArray(rowsPayload.list) ? rowsPayload.list : [];
  var rowsKeys = rowsList.map(function (r) { return r.k; });
  var rowsKeySet = {};
  rowsKeys.forEach(function (k) { rowsKeySet[k] = 1; });

  var orderRows = cacheOrder.map(function (k, i) {
    var rec = cacheTurns[k] || {};
    return {
      i: i,
      key: k,
      text: (rec.t || '').slice(0, 60),
      ord: rec.i,
      r: typeof rec.r === 'number' ? +rec.r.toFixed(4) : null,
      seenAgoH: rec.seen ? +((Date.now() - rec.seen) / 36e5).toFixed(2) : null,
      inDom: domIndex[k] !== undefined,
      inPanel: panelIndex[k] !== undefined
    };
  });

  // ---------------------------------------------------------- 一致性检查
  // 1. 缓存顺序 与 DOM 顺序 的交错次数
  var seq = cacheOrder
    .filter(function (k) { return domIndex[k] !== undefined; })
    .map(function (k) { return { k: k, dom: domIndex[k] }; });
  var inversions = 0;
  var invSamples = [];
  for (var i = 1; i < seq.length; i++) {
    if (seq[i].dom < seq[i - 1].dom) {
      inversions++;
      if (invSamples.length < 8) {
        invSamples.push(seq[i - 1].k + '@dom' + seq[i - 1].dom + ' -> ' + seq[i].k + '@dom' + seq[i].dom);
      }
    }
  }

  // 2. DOM 内 turnOrder 是否单调
  var ordSeq = dom.filter(function (r) { return r.inScroller && r.ord !== null; });
  var ordBreaks = [];
  for (i = 1; i < ordSeq.length; i++) {
    if (ordSeq[i].ord < ordSeq[i - 1].ord) {
      ordBreaks.push(ordSeq[i - 1].ord + ' -> ' + ordSeq[i].ord + ' (' + ordSeq[i].key + ')');
    }
  }

  // 3. 面板顺序 与 缓存顺序 是否一致
  var panelKeys = (panel || []).map(function (r) { return r.key; });
  var panelKeySet = {};
  panelKeys.forEach(function (k) { panelKeySet[k] = 1; });
  var orderInPanel = cacheOrder.filter(function (k) { return panelKeySet[k]; });
  var panelInCache = panelKeys.filter(function (k) { return cacheOrder.indexOf(k) >= 0; });
  var panelOrderMismatch = orderInPanel.join('|') !== panelInCache.join('|');

  // 4. 视口：按插件的规则，第一条可见提问是谁
  var vTop = sc ? sc.scrollTop : scrollY;
  var vh = sc ? sc.clientHeight : innerHeight;
  var visible = dom.filter(function (r) {
    return r.inScroller && r.top + r.h > vTop + 4 && r.top < vTop + vh - 20;
  });

  var checks = {
    url: location.href,
    pathConvId: cid,
    selectionConvId: sid,
    selectionConvIdMissing: !sid,
    cacheSid: (cache && cache.sid) || '',
    cacheSidMismatch: !!(sid && cache && cache.sid && cache.sid !== sid),
    domTurnCount: dom.length,
    domTurnsOutsideScroller: dom.filter(function (r) { return !r.inScroller; })
      .map(function (r) { return r.key + ' :: ' + r.text.slice(0, 40); }),
    duplicateDomKeys: Object.keys(dup).filter(function (k) { return dup[k] > 1; })
      .map(function (k) { return k + ' x' + dup[k]; }),
    fallbackKeys: dom.filter(function (r) { return /fallback-turn/.test(r.key); })
      .map(function (r) { return r.key; }),
    cacheOrderLen: cacheOrder.length,
    cacheTurnRecords: Object.keys(cacheTurns).length,
    cacheOrphanRecords: Object.keys(cacheTurns).filter(function (k) {
      return cacheOrder.indexOf(k) < 0;
    }).length,
    rowsConv: (rowsPayload && rowsPayload.conv) || '',
    rowsCount: rowsList.length,
    rowsLast: !!(rowsPayload && rowsPayload.last),
    rowsNotInCache: rowsKeys.filter(function (k) { return cacheOrder.indexOf(k) < 0; }),
    cacheNotInRows: cacheOrder.filter(function (k) { return !rowsKeySet[k]; }).length,
    cacheVsDomInversions: inversions,
    cacheVsDomInversionSamples: invSamples,
    domTurnOrderBreaks: ordBreaks,
    panelVsCacheOrderMismatch: panelOrderMismatch,
    panelGhosts: panel ? panel.filter(function (r) { return r.ghost; }).length : -1,
    panelActive: panel ? panel.filter(function (r) { return r.active; })
      .map(function (r) { return r.key; }) : [],
    gptnavKeys: Object.keys(localStorage).filter(function (k) { return k.indexOf('gptnav:') === 0; })
  };

  var out = {
    at: new Date().toISOString(),
    ua: navigator.userAgent,
    title: document.title,
    scroller: sc ? 'thread-scroll-container#' + containers.indexOf(sc) : 'document',
    viewport: {
      scrollTop: Math.round(vTop),
      clientHeight: Math.round(vh),
      scrollHeight: sc ? sc.scrollHeight : document.documentElement.scrollHeight,
      firstVisibleTurn: visible.length ? visible[0].key : '',
      firstVisibleText: visible.length ? visible[0].text : ''
    },
    scrollers: scrollers,
    domTurns: dom,
    panel: panel,
    panelStat: sr ? txt(one('.gn-stat', sr), 60) : '',
    panelRoot: rootEl ? {
      open: rootEl.getAttribute('data-open'),
      mode: rootEl.getAttribute('data-mode')
    } : null,
    rows: rowsPayload ? {
      conv: rowsPayload.conv || '',
      last: !!rowsPayload.last,
      count: rowsList.length,
      items: rowsList.slice(0, 80).map(function (r) {
        return { i: r.i, key: r.k, text: (r.t || '').slice(0, 50) };
      })
    } : null,
    cacheKey: cacheKey,
    cache: cache ? {
      v: cache.v,
      updatedAgoMin: cache.updated ? +((Date.now() - cache.updated) / 6e4).toFixed(1) : null,
      sid: cache.sid || '',
      order: orderRows,
      orphan: Object.keys(cacheTurns).filter(function (k) {
        return cacheOrder.indexOf(k) < 0;
      }).map(function (k) { return { key: k, text: (cacheTurns[k].t || '').slice(0, 60) }; })
    } : null,
    checks: checks
  };

  window.__gptnavDiag = JSON.stringify(out, null, 2);
  try {
    copy(window.__gptnavDiag);
    console.log('%c[GPTNav] 诊断 JSON 已复制到剪贴板', 'color:#0a0');
  } catch (e) {
    console.warn('[GPTNav] 自动复制失败，请手动执行 copy(__gptnavDiag)');
  }
  console.log('[GPTNav] 诊断结果', out);
  console.table(scrollers);
  console.table(dom);
  if (panel) console.table(panel);
  console.table(orderRows);
  console.log('[GPTNav] 一致性检查', checks);
  return out;
})();

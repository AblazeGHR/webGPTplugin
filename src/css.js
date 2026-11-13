// 由 content.js 注入到 Shadow DOM 中；只影响插件自身 UI
var GPTNAV_CSS = `
:host {
  all: initial;
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  pointer-events: none;
}

.gn-root {
  --gn-w: 232px;
  --gn-bg: rgba(26, 26, 29, 0.94);
  --gn-bg-solid: #202024;
  --gn-fg: #d8d8de;
  --gn-fg-dim: #8e8e98;
  --gn-fg-faint: #6c6c76;
  --gn-line: rgba(255, 255, 255, 0.10);
  --gn-hover: rgba(255, 255, 255, 0.06);
  --gn-active: #b9a3ff;
  --gn-active-bg: rgba(167, 139, 250, 0.13);
  --gn-border: rgba(255, 255, 255, 0.09);
  --gn-chip: rgba(255, 255, 255, 0.07);
  --gn-shadow: 0 18px 50px rgba(0, 0, 0, 0.42), 0 2px 8px rgba(0, 0, 0, 0.28);
  --gn-dot: rgba(255, 255, 255, 0.30);

  position: fixed;
  inset: 0;
  pointer-events: none;
  color: var(--gn-fg);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif;
  font-size: 11.5px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

.gn-root[data-gn-theme="light"] {
  --gn-bg: rgba(250, 250, 252, 0.95);
  --gn-bg-solid: #ffffff;
  --gn-fg: #2b2b31;
  --gn-fg-dim: #74747e;
  --gn-fg-faint: #9a9aa4;
  --gn-line: rgba(0, 0, 0, 0.10);
  --gn-hover: rgba(0, 0, 0, 0.05);
  --gn-active: #6d3bd6;
  --gn-active-bg: rgba(109, 59, 214, 0.09);
  --gn-border: rgba(0, 0, 0, 0.09);
  --gn-chip: rgba(0, 0, 0, 0.05);
  --gn-shadow: 0 18px 50px rgba(0, 0, 0, 0.16), 0 2px 8px rgba(0, 0, 0, 0.08);
  --gn-dot: rgba(0, 0, 0, 0.28);
}

.gn-root *,
.gn-root *::before,
.gn-root *::after { box-sizing: border-box; }

/* ---------- 收起时的悬浮按钮 ---------- */
.gn-fab {
  position: fixed;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  width: 34px;
  height: 74px;
  display: none;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--gn-border);
  border-radius: 11px;
  background: var(--gn-bg);
  color: var(--gn-fg-dim);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(18px) saturate(1.3);
  -webkit-backdrop-filter: blur(18px) saturate(1.3);
  cursor: pointer;
  pointer-events: auto;
  transition: color 0.15s, border-color 0.15s, transform 0.15s;
}
.gn-fab:hover {
  color: var(--gn-active);
  border-color: color-mix(in srgb, var(--gn-active) 45%, transparent);
}
.gn-fab svg { width: 16px; height: 16px; }

.gn-root[data-open="false"] .gn-fab { display: flex; }
.gn-root[data-open="false"] .gn-panel { display: none; }

/* ---------- 面板 ---------- */
.gn-panel {
  position: fixed;
  right: 18px;
  top: 64px;
  bottom: 104px;
  width: var(--gn-w);
  min-height: 300px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--gn-border);
  border-radius: 14px;
  background: var(--gn-bg);
  box-shadow: var(--gn-shadow);
  backdrop-filter: blur(22px) saturate(1.35);
  -webkit-backdrop-filter: blur(22px) saturate(1.35);
  pointer-events: auto;
  animation: gn-in 0.16s ease-out;
}

@keyframes gn-in {
  from { opacity: 0; transform: translateY(4px) scale(0.995); }
  to { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .gn-panel { animation: none; }
  .gn-chev svg, .gn-fab { transition: none; }
}

/* ---------- 头部 ---------- */
.gn-head {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 7px 7px 9px;
  border-bottom: 1px solid var(--gn-line);
}

.gn-tabs {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: var(--gn-chip);
}

.gn-tab {
  appearance: none;
  border: 0;
  border-radius: 6px;
  padding: 3px 8px;
  background: transparent;
  color: var(--gn-fg-dim);
  font: inherit;
  font-size: 11px;
  line-height: 1.4;
  cursor: pointer;
  transition: color 0.12s, background 0.12s;
}
.gn-tab:hover { color: var(--gn-fg); }
.gn-tab[aria-selected="true"] {
  background: var(--gn-bg-solid);
  color: var(--gn-fg);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
}

.gn-head-spacer { flex: 1 1 auto; }

.gn-iconbtn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--gn-fg-dim);
  cursor: pointer;
  transition: color 0.12s, background 0.12s;
}
.gn-iconbtn:hover { color: var(--gn-fg); background: var(--gn-hover); }
.gn-iconbtn svg { width: 14px; height: 14px; }

/* ---------- 滚动区 ---------- */
.gn-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 6px 5px 8px 7px;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--gn-fg) 18%, transparent) transparent;
  user-select: none;
}
.gn-scroll::-webkit-scrollbar { width: 7px; }
.gn-scroll::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--gn-fg) 18%, transparent);
  border-radius: 4px;
}
.gn-scroll::-webkit-scrollbar-track { background: transparent; }

/* ---------- 提问导航轨 ---------- */
.gn-rail {
  position: relative;
  padding-left: 19px;
}
.gn-rail::before {
  content: "";
  position: absolute;
  left: 6px;
  top: 10px;
  bottom: 12px;
  width: 1px;
  background: var(--gn-line);
}

.gn-item {
  position: relative;
  display: block;
  width: 100%;
  margin: 0 0 2px;
  padding: 6px 7px 6px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--gn-fg);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.gn-item:hover { background: var(--gn-hover); }
.gn-item::before {
  content: "";
  position: absolute;
  left: -16px;
  top: 13px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--gn-dot);
  transition: background 0.12s, box-shadow 0.12s, transform 0.12s;
}
.gn-item.is-active { background: var(--gn-active-bg); color: var(--gn-active); }
.gn-item.is-active::before {
  background: var(--gn-active);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--gn-active) 18%, transparent);
  transform: scale(1.08);
}
.gn-item.is-ghost { opacity: 0.55; }
.gn-item.is-ghost::before { background: transparent; border: 1px solid var(--gn-dot); }

.gn-item-head {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.gn-idx {
  flex: 0 0 auto;
  color: var(--gn-fg-faint);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}
.gn-item.is-active .gn-idx { color: inherit; opacity: 0.8; }
.gn-q {
  display: block;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 11.5px;
  line-height: 1.5;
}

/* ---------- 大纲 ---------- */
.gn-context {
  flex: 0 0 auto;
  display: none;
  padding: 7px 12px 8px;
  border-bottom: 1px solid var(--gn-line);
}
.gn-root[data-mode="outline"] .gn-context { display: block; }

.gn-meta {
  padding: 0;
  margin: 0;
  border: 0;
}
.gn-meta-q {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.gn-badge {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 15px;
  padding: 0 4px;
  border-radius: 5px;
  background: var(--gn-chip);
  color: var(--gn-fg-dim);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.gn-meta-text {
  display: block;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--gn-fg);
  font-size: 11.5px;
}
.gn-crumb {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-top: 4px;
  color: var(--gn-active);
  font-size: 10px;
  line-height: 1.45;
  opacity: 0.92;
}
.gn-crumb-k { flex: 0 0 auto; color: var(--gn-fg-faint); }
.gn-crumb-t {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.gn-crumb:empty { display: none; }

.gn-tree { padding: 0 5px 0 1px; }

.gn-node { position: relative; }

.gn-row {
  display: flex;
  align-items: flex-start;
  gap: 3px;
  margin: 1px 0;
  padding: 3px 6px 3px 0;
  border-radius: 6px;
  cursor: pointer;
  color: var(--gn-fg);
  transition: background 0.1s, color 0.1s;
}
.gn-row:hover { background: var(--gn-hover); }

.gn-chev {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 13px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--gn-fg-faint);
  cursor: pointer;
}
.gn-chev:hover { color: var(--gn-fg); background: var(--gn-hover); }
.gn-chev svg {
  width: 11px;
  height: 11px;
  transition: transform 0.14s ease;
}
.gn-node:not(.is-collapsed) > .gn-row > .gn-chev svg { transform: rotate(90deg); }
.gn-node.is-collapsed > .gn-children { display: none; }

.gn-spacer { flex: 0 0 auto; width: 13px; }

.gn-label {
  flex: 1 1 auto;
  min-width: 0;
  padding-top: 1px;
  word-break: break-word;
  font-size: 11.5px;
  line-height: 1.45;
}

.gn-children {
  margin-left: 10px;
  padding-left: 8px;
  border-left: 1px solid var(--gn-line);
}

.gn-row.is-active {
  color: var(--gn-active);
  background: var(--gn-active-bg);
  box-shadow: inset 2px 0 0 var(--gn-active);
}
.gn-row.is-active .gn-label { font-weight: 600; }

.gn-empty {
  padding: 26px 18px;
  color: var(--gn-fg-faint);
  font-size: 11.5px;
  line-height: 1.8;
  text-align: center;
  word-break: break-word;
}
.gn-empty strong { color: var(--gn-fg-dim); font-weight: 500; }

/* ---------- 底部 ---------- */
.gn-foot {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 8px 0 11px;
  border-top: 1px solid var(--gn-line);
  color: var(--gn-fg-faint);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}
.gn-stat {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.gn-foot-actions { flex: 0 0 auto; display: flex; align-items: center; }
.gn-foot .gn-iconbtn { width: 20px; height: 20px; margin: 0; }
.gn-foot .gn-iconbtn svg { width: 12px; height: 12px; }


/* ---------- 4 个标签：窄面板下横向滚动 ---------- */
.gn-tabs {
  flex: 1 1 auto;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.gn-tabs::-webkit-scrollbar { display: none; }
.gn-tab {
  flex: 0 0 auto;
  padding: 3px 4px;
  font-size: 10.5px;
}
.gn-head-spacer { display: none; }

/* ---------- 选中文字后的书签按钮 ---------- */
.gn-sel-add {
  position: fixed;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 27px;
  padding: 0 9px;
  border: 1px solid var(--gn-border);
  border-radius: 14px;
  background: var(--gn-bg);
  color: var(--gn-fg);
  box-shadow: var(--gn-shadow);
  backdrop-filter: blur(18px) saturate(1.3);
  -webkit-backdrop-filter: blur(18px) saturate(1.3);
  font: inherit;
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  pointer-events: auto;
  z-index: 2147483001;
}
.gn-sel-add[hidden] { display: none; }
.gn-sel-add svg { width: 12px; height: 12px; }
.gn-sel-add:hover {
  color: var(--gn-active);
  border-color: color-mix(in srgb, var(--gn-active) 45%, transparent);
}
.gn-sel-add.is-done {
  color: var(--gn-active);
  border-color: color-mix(in srgb, var(--gn-active) 45%, transparent);
}

/* ---------- 引用树 ---------- */
.gn-tree-quote { display: flex; flex-direction: column; gap: 1px; }
.gn-tree-node { min-width: 0; }
.gn-tree-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  padding: 4px 6px 4px 4px;
  border-radius: 7px;
  cursor: pointer;
  color: var(--gn-fg-dim);
}
.gn-tree-row:hover { background: var(--gn-hover); color: var(--gn-fg); }
.gn-tree-row.is-active { background: var(--gn-active-bg); color: var(--gn-active); }
.gn-tree-chev {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 13px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.gn-tree-chev svg { width: 11px; height: 11px; transform: rotate(90deg); transition: transform 0.12s; }
.gn-tree-node.is-collapsed > .gn-tree-row .gn-tree-chev svg { transform: rotate(0deg); }
.gn-tree-spacer { flex: 0 0 auto; width: 13px; }
.gn-tree-badge {
  flex: 0 0 auto;
  min-width: 20px;
  height: 15px;
  padding: 0 3px;
  border-radius: 5px;
  background: var(--gn-chip);
  color: var(--gn-fg-faint);
  font-size: 9px;
  line-height: 15px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.gn-tree-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 11.5px;
}
.gn-tree-count { flex: 0 0 auto; color: var(--gn-fg-faint); font-size: 9px; }
.gn-tree-children {
  margin-left: 13px;
  padding-left: 8px;
  border-left: 1px solid var(--gn-line);
}
.gn-tree-node.is-collapsed > .gn-tree-children { display: none; }
.gn-tree-node.is-ghost .gn-tree-row { opacity: 0.55; }

/* ---------- 书签列表 ---------- */
.gn-bm-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 5px 4px 4px;
}
.gn-bm-title { color: var(--gn-fg-dim); font-size: 10.5px; }
.gn-bm-clear {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--gn-fg-faint);
  font: inherit;
  font-size: 10px;
  padding: 2px 5px;
  border-radius: 5px;
  cursor: pointer;
}
.gn-bm-clear:hover { color: var(--gn-active); background: var(--gn-hover); }
.gn-bm-clear.is-confirm { color: #ff9b9b; }
.gn-bm {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  padding: 6px 5px;
  border-radius: 7px;
  cursor: pointer;
}
.gn-bm:hover { background: var(--gn-hover); }
.gn-bm-q {
  flex: 0 0 auto;
  min-width: 20px;
  height: 15px;
  padding: 0 3px;
  border-radius: 5px;
  background: var(--gn-chip);
  color: var(--gn-fg-faint);
  font-size: 9px;
  line-height: 15px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.gn-bm-text {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--gn-fg);
  font-size: 11.5px;
  line-height: 1.5;
}
.gn-bm-del {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--gn-fg-faint);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.35;
}
.gn-bm:hover .gn-bm-del, .gn-bm-del:focus { opacity: 1; }
.gn-bm-del:hover { color: #ff9b9b; background: rgba(255, 120, 120, 0.12); }
.gn-bm.is-ghost { opacity: 0.6; }

@media (max-width: 1200px) {
  .gn-root { --gn-w: 216px; }
}
@media (max-width: 1024px) {
  .gn-root { --gn-w: 200px; }
  .gn-panel { right: 10px; }
  .gn-label, .gn-q { font-size: 11px; }
}
`;

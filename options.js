(function () {
  'use strict';

  var DEFAULTS = { lang: 'auto', repo: '', hideStar: false };
  var detected = gptnavDefaultLang();
  var state = { lang: 'auto', repo: '', hideStar: false };
  var els = {};
  var savedTimer = 0;
  var notesData = [];
  var notesTimer = 0;

  function $(id) { return document.getElementById(id); }

  function effectiveLang() {
    return state.lang === 'auto' ? detected : gptnavNormLang(state.lang);
  }

  function t(key, vars) {
    return gptnavT(effectiveLang(), key, vars);
  }

  function area() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) return chrome.storage.sync;
    } catch (e) { /* ignore */ }
    return null;
  }

  function load(cb) {
    var s = area();
    if (!s) { cb(DEFAULTS); return; }
    try {
      s.get(DEFAULTS, function (value) {
        cb(value || DEFAULTS);
      });
    } catch (e) { cb(DEFAULTS); }
  }

  function save(patch, done) {
    state = Object.assign({}, state, patch);
    var s = area();
    if (!s) { if (done) done(false); return; }
    try {
      s.set(patch, function () {
        var err = null;
        try { err = chrome.runtime.lastError; } catch (e) { err = null; }
        if (done) done(!err);
      });
    } catch (e) { if (done) done(false); }
  }

  function showSaved() {
    els.saved.hidden = false;
    clearTimeout(savedTimer);
    savedTimer = setTimeout(function () { els.saved.hidden = true; }, 1600);
  }

  function validRepo(url) {
    return !url || /^https:\/\/github\.com\/[^\s]+/i.test(url);
  }

  function effectiveRepo() {
    var u = (state.repo || '').trim();
    if (!u && typeof GPTNAV_DEFAULT_REPO === 'string') u = GPTNAV_DEFAULT_REPO.trim();
    return u;
  }

  function applyI18n() {
    var lang = effectiveLang();
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';

    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = gptnavT(lang, nodes[i].getAttribute('data-i18n'));
    }

    var autoName = detected === 'zh' ? '简体中文' : 'English';
    els.lang.options[0].textContent = gptnavT(lang, 'options.autoDetected', { name: autoName });
    els.lang.options[1].textContent = gptnavT(lang, 'options.languageZh');
    els.lang.options[2].textContent = gptnavT(lang, 'options.languageEn');
    els.lang.value = state.lang;

    els.repo.placeholder = gptnavT(lang, 'options.repoPlaceholder');

    var repo = effectiveRepo();
    var hasRepo = !!repo && validRepo(repo);
    els.modalGo.textContent = gptnavT(lang, hasRepo ? 'options.modalGo' : 'options.modalGoRepo');

    if (hasRepo) {
      els.repoLink.hidden = false;
      els.repoLink.href = repo;
    } else {
      els.repoLink.hidden = true;
      els.repoLink.removeAttribute('href');
    }

    updateRepoHint();
    renderNotes(notesData);
  }

  function updateRepoHint() {
    var value = (els.repo.value || '').trim();
    if (value && !validRepo(value)) {
      els.repoHint.textContent = t('options.repoInvalid');
      els.repoHint.classList.add('is-error');
    } else {
      els.repoHint.textContent = t('options.repoHint');
      els.repoHint.classList.remove('is-error');
    }
  }

  function openRepo() {
    var url = effectiveRepo();
    if (!url || !/^https:\/\//i.test(url)) { focusRepo(); return; }
    try { window.open(url, '_blank', 'noopener'); } catch (e) { /* ignore */ }
  }

  function focusRepo() {
    els.repo.focus();
    try { els.repo.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* ignore */ }
    els.repo.classList.add('is-attention');
    setTimeout(function () { els.repo.classList.remove('is-attention'); }, 1100);
  }

  function showModal() {
    if (state.hideStar) return;
    els.modal.hidden = false;
  }
  function closeModal() { els.modal.hidden = true; }

  function localArea() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) return chrome.storage.local;
    } catch (e) { /* ignore */ }
    return null;
  }

  function loadNotes() {
    var s = localArea();
    if (!s) { renderNotes([]); return; }

    s.get(null, function (all) {
      var groups = [];
      Object.keys(all || {}).forEach(function (key) {
        if (key.indexOf('gptnav:notes:') !== 0) return;
        var v = all[key];
        if (v && Array.isArray(v.items) && v.items.length) groups.push(v);
      });
      groups.sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); });
      notesData = groups;
      renderNotes(groups);
    });
  }

  function renderNotes(groups) {
    if (!els.notesList) return;
    els.notesList.textContent = '';

    var total = 0;
    for (var g = 0; g < groups.length; g++) total += groups[g].items.length;
    els.notesTotal.textContent = total ? t('options.notesCount', { n: total }) : '';

    if (!groups.length) {
      var empty = document.createElement('div');
      empty.className = 'notes-empty';
      empty.textContent = t('options.notesEmpty');
      els.notesList.appendChild(empty);
      return;
    }

    for (var i = 0; i < groups.length; i++) {
      var group = groups[i];
      var wrap = document.createElement('div');
      wrap.className = 'notes-conv';

      var head = document.createElement('div');
      head.className = 'notes-conv-head';

      var titleText = group.convTitle || t('options.notesUntitled');
      var title;
      if (group.convUrl && /^https:\/\//i.test(group.convUrl)) {
        title = document.createElement('a');
        title.href = group.convUrl;
        title.target = '_blank';
        title.rel = 'noopener';
      } else {
        title = document.createElement('span');
      }
      title.className = 'notes-conv-title';
      title.textContent = titleText;
      title.title = titleText;

      var count = document.createElement('span');
      count.className = 'notes-conv-count';
      count.textContent = t('options.notesCount', { n: group.items.length });

      head.appendChild(title);
      head.appendChild(count);
      wrap.appendChild(head);

      var items = group.items.slice().sort(function (a, b) {
        return (a.created || 0) - (b.created || 0);
      });

      for (var j = 0; j < items.length; j++) {
        var it = items[j];
        var row = document.createElement('div');
        row.className = 'notes-item';

        var dot = document.createElement('span');
        dot.className = 'notes-dot';
        row.appendChild(dot);

        var body = document.createElement('div');
        body.className = 'notes-body';

        var note = document.createElement('div');
        note.className = 'notes-note';
        note.textContent = it.note || it.summary || it.text || '';
        body.appendChild(note);

        if (it.note && (it.summary || it.text)) {
          var ex = document.createElement('div');
          ex.className = 'notes-ex';
          ex.textContent = it.summary || it.text;
          body.appendChild(ex);
        }

        row.appendChild(body);
        wrap.appendChild(row);
      }

      els.notesList.appendChild(wrap);
    }
  }

  function init() {
    els = {
      lang: $('lang'),
      repo: $('repo'),
      repoHint: $('repoHint'),
      saved: $('saved'),
      hideStar: $('hideStar'),
      starBtn: $('starBtn'),
      repoLink: $('repoLink'),
      modal: $('starModal'),
      modalGo: $('modalGo'),
      modalLater: $('modalLater'),
      version: $('version'),
      notesList: $('notesList'),
      notesTotal: $('notesTotal')
    };

    load(function (s) {
      state.lang = (s && s.lang) || 'auto';
      state.repo = (s && s.repo) || '';
      state.hideStar = !!(s && s.hideStar);
      els.repo.value = state.repo;
      els.hideStar.checked = state.hideStar;
      applyI18n();

      try { els.version.textContent = 'v' + chrome.runtime.getManifest().version; } catch (e) { /* ignore */ }

      loadNotes();
      showModal();
    });

    els.lang.addEventListener('change', function () {
      state.lang = els.lang.value;
      save({ lang: state.lang });
      applyI18n();
    });

    els.hideStar.addEventListener('change', function () {
      state.hideStar = !!els.hideStar.checked;
      save({ hideStar: state.hideStar }, function (ok) {
        if (ok) showSaved();
      });
      if (state.hideStar) closeModal();
      else showModal();
    });

    var repoDebounce = 0;
    els.repo.addEventListener('input', function () {
      state.repo = (els.repo.value || '').trim();
      updateRepoHint();
      clearTimeout(repoDebounce);
      repoDebounce = setTimeout(function () {
        if (!validRepo(state.repo)) return;
        save({ repo: state.repo }, function (ok) {
          if (ok) showSaved();
        });
        applyI18n();
      }, 350);
    });

    els.starBtn.addEventListener('click', openRepo);

    els.modalGo.addEventListener('click', function () {
      closeModal();
      if (state.repo) openRepo();
      else focusRepo();
    });
    els.modalLater.addEventListener('click', closeModal);
    els.modal.querySelector('[data-close]').addEventListener('click', closeModal);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !els.modal.hidden) closeModal();
    });

    // 切回设置页时也弹一次，符合“每次打开设置都提示”
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') showModal();
    });

    try {
      if (chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener(function (changes, area) {
          if (area !== 'local') return;
          var hit = Object.keys(changes).some(function (k) {
            return k.indexOf('gptnav:notes:') === 0;
          });
          if (!hit) return;
          clearTimeout(notesTimer);
          notesTimer = setTimeout(loadNotes, 150);
        });
      }
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

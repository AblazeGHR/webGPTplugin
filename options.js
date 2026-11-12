(function () {
  'use strict';

  var DEFAULTS = { lang: 'auto', repo: '' };
  var detected = gptnavDefaultLang();
  var state = { lang: 'auto', repo: '' };
  var els = {};
  var savedTimer = 0;

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

  function showModal() { els.modal.hidden = false; }
  function closeModal() { els.modal.hidden = true; }

  function init() {
    els = {
      lang: $('lang'),
      repo: $('repo'),
      repoHint: $('repoHint'),
      saved: $('saved'),
      starBtn: $('starBtn'),
      repoLink: $('repoLink'),
      modal: $('starModal'),
      modalGo: $('modalGo'),
      modalLater: $('modalLater'),
      version: $('version')
    };

    load(function (s) {
      state.lang = (s && s.lang) || 'auto';
      state.repo = (s && s.repo) || '';
      els.repo.value = state.repo;
      applyI18n();

      try { els.version.textContent = 'v' + chrome.runtime.getManifest().version; } catch (e) { /* ignore */ }

      // 按要求：每次打开设置页都弹出
      showModal();
    });

    els.lang.addEventListener('change', function () {
      state.lang = els.lang.value;
      save({ lang: state.lang });
      applyI18n();
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

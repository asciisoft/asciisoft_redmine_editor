/*
 * ASCII SOFT Redmine WYSIWYG Editor
 * Redmine 7.0 (CommonMark) 의 textarea.wiki-edit 를 WYSIWYG 편집기로 대체한다.
 * 원래 textarea 는 숨긴 채로 두고, 편집 내용을 Markdown 으로 변환해 넣는다.
 * License: GPL-2.0-or-later
 */
(function () {
  'use strict';
  if (window.AsciisoftEditor) return;

  var CFG = window.AsciisoftEditorConfig || {};
  var L = Object.assign({
    issueLink: '일감 링크', issuePrompt: '일감 번호를 입력하세요',
    wikiLink: '위키 링크', wikiPrompt: '위키 페이지 이름을 입력하세요',
    noAttach: '이 화면에서는 이미지를 첨부할 수 없습니다. 일감 편집 화면에서 붙여넣어 주세요.',
    tooMany: '첨부할 수 있는 파일 수를 넘었습니다.',
    fontFamily: '글꼴', fontSize: '크기', lineHeight: '줄간격', defaultValue: '기본', imageLabel: '이미지',
    ok: '확인', cancel: '취소', dialogInvalid: '올바른 값을 입력하세요.',
    prevItem: '이전 글꼴', nextItem: '다음 글꼴', sizeUp: '크게', sizeDown: '작게', editorTab: '에디터',
    mdNoticeNoSwitch: '이 내용에는 에디터 모드에서 달라질 수 있는 문법이 있어 Markdown 모드로 열었습니다.',
    mdNotice: '이 내용에는 WYSIWYG로 바꾸면 달라질 수 있는 문법이 있어 Markdown 모드로 열었습니다. 아래쪽 탭에서 WYSIWYG로 전환할 수 있습니다.'
  }, CFG.labels || {});

  var SELECTOR = 'textarea.wiki-edit';
  var loading = null;

  /* ---------- 자산 지연 로딩: 편집 칸이 있는 화면에서만 큰 파일을 받는다 ---------- */
  function loadAssets() {
    if (window.AsciisoftToastEditor) { hookPurify(); return Promise.resolve(); }
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      if (CFG.css) {
        var link = document.createElement('link');
        link.rel = 'stylesheet'; link.href = CFG.css;
        document.head.appendChild(link);
      }
      var s = document.createElement('script');
      s.src = CFG.bundle; s.async = true;
      s.onload = function () { hookPurify(); resolve(); };
      s.onerror = function () { reject(new Error('editor bundle load failed')); };
      document.head.appendChild(s);
    });
    return loading;
  }

  /* ---------- 글꼴, 크기, 줄간격 ---------- */
  var BASE_FONTS = [
    ['Consolas', 'Consolas, monospace'], ['Tahoma', 'Tahoma, sans-serif'], ['Arial', 'Arial, sans-serif'],
    ['Impact', 'Impact, sans-serif'], ['Segoe UI', "'Segoe UI', sans-serif"], ['Courier New', "'Courier New', monospace"],
    ['Verdana', 'Verdana, sans-serif'], ['Sans-serif', 'sans-serif'], ['Times New Roman', "'Times New Roman', serif"]
  ];
  var KO_FONTS = [
    ['맑은 고딕', "'Malgun Gothic', sans-serif"], ['굴림', 'Gulim, sans-serif'], ['돋움', 'Dotum, sans-serif'],
    ['바탕', 'Batang, serif'], ['궁서', 'Gungsuh, serif']
  ];
  var FONT_FAMILIES = BASE_FONTS.concat(CFG.koFonts ? KO_FONTS : []);
  var FONT_SIZES = [7, 8, 9, 10, 11, 12, 14, 15, 18, 20, 24, 28, 32, 38, 45, 48, 72, 99];
  var LINE_HEIGHTS = ['1', '1.15', '1.5', '1.8', '2', '2.5', '3'];
  var STYLE_ORDER = ['font-family', 'font-size', 'line-height'];
  var FAMILY_VALUES = FONT_FAMILIES.map(function (f) { return f[1]; });

  // 허용한 서식 값만 통과 (그 외 CSS 는 모두 버린다: url(), expression 등 차단)
  function validStyleValue(tag, prop, value) {
    var v = String(value || '').trim().replace(/\s+/g, ' ');
    if (tag === 'SPAN') {
      if (prop === 'font-family') return /^[A-Za-z0-9 ,'\-\uAC00-\uD7A3]{1,80}$/.test(v) ? v : null;
      if (prop === 'font-size') { var m = v.match(/^(\d{1,2}(?:\.\d)?)px$/); return m && +m[1] >= 6 && +m[1] <= 99 ? v : null; }
      if (prop === 'line-height') return /^\d(?:\.\d{1,2})?$/.test(v) && +v >= 0.8 && +v <= 4 ? v : null;
    }
    if ((tag === 'TD' || tag === 'TH') && prop === 'text-align') return /^(left|center|right)$/.test(v) ? v : null;
    if (tag === 'IMG' && (prop === 'width' || prop === 'height')) return /^\d{1,4}px$/.test(v) ? v : null;
    return null;
  }
  function parseStyle(css) {
    var out = {};
    String(css || '').split(';').forEach(function (d) {
      var i = d.indexOf(':'); if (i < 1) return;
      var k = d.slice(0, i).trim().toLowerCase(), v = d.slice(i + 1).trim();
      if (k && v) out[k] = v;
    });
    return out;
  }
  function cleanStyle(tag, css) {
    var parsed = parseStyle(css), keep = [];
    Object.keys(parsed).forEach(function (k) {
      var v = validStyleValue(tag, k, parsed[k]);
      if (v) keep.push(k + ': ' + v);
    });
    return keep.join('; ');
  }
  function mergeStyle(css, prop, value) {
    var parsed = parseStyle(css);
    if (value) parsed[prop] = value; else delete parsed[prop];
    return STYLE_ORDER.filter(function (k) { return parsed[k] && validStyleValue('SPAN', k, parsed[k]); })
      .map(function (k) { return k + ': ' + parsed[k]; }).join('; ');
  }
  // 붙여넣은 HTML 의 span 정리 (실행되지 않는 별도 문서에서 처리, 이후 편집기 정화를 한 번 더 거친다)
  // 워드 목록 표식(mso-list)은 편집기의 목록 변환에 필요하므로 그대로 둔다
  function cleanPastedHtml(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    Array.prototype.slice.call(doc.querySelectorAll('span')).reverse().forEach(function (sp) {
      var raw = sp.getAttribute('style') || '';
      if (/mso-list/i.test(raw)) return;
      var st = cleanStyle('SPAN', raw);
      Array.prototype.slice.call(sp.attributes).forEach(function (a) { sp.removeAttribute(a.name); });
      if (st) { sp.setAttribute('style', st); return; }
      while (sp.firstChild) sp.parentNode.insertBefore(sp.firstChild, sp);
      sp.parentNode.removeChild(sp);
    });
    return doc.documentElement.outerHTML;
  }
  var purifyHooked = false;
  function hookPurify() {
    var P = window.AsciisoftDOMPurify;
    if (purifyHooked || !P || !P.addHook) return;
    purifyHooked = true;
    P.addHook('uponSanitizeAttribute', function (node, data) {
      if (data.attrName === 'style') {
        data.attrValue = cleanStyle(node.nodeName, data.attrValue);
        if (!data.attrValue) data.keepAttr = false;
      }
    });
  }
  // span(글꼴, 크기, 줄간격)을 WYSIWYG 에서 편집 가능한 서식으로 유지
  var HTML_RENDERER = {
    htmlInline: {
      span: function (node, ctx) {
        return ctx.entering ? { type: 'openTag', tagName: 'span', attributes: node.attrs } : { type: 'closeTag', tagName: 'span' };
      }
    }
  };

  /* ---------- 텍스트 처리 ---------- */
  // 코드 블록과 인라인 코드는 건드리지 않고 나머지에만 fn 적용
  function mapOutsideCode(md, fn) {
    var parts = md.split(/(^(?:```|~~~)[^\n]*\n[\s\S]*?^(?:```|~~~)[ \t]*$)/m);
    return parts.map(function (p, i) {
      if (i % 2) return p;
      return p.split(/(`+[^`\n]*?`+)/).map(function (q, j) { return j % 2 ? q : fn(q); }).join('');
    }).join('');
  }

  // WYSIWYG 변환기가 넣은 불필요한 이스케이프를 Redmine 문법에 맞게 되돌림
  function unescapeRedmine(md) {
    return mapOutsideCode(md, function (seg) {
      return seg
        .replace(/\\\[\\\[([\s\S]*?)\\\]\\\]/g, function (m, inner) {
          return '[[' + inner.replace(/\\([|_*#\[\]])/g, '$1') + ']]';
        })
        .replace(/([\p{L}\p{N}])\\_(?=[\p{L}\p{N}])/gu, '$1_');
    });
  }

  function isRelativeTarget(t) {
    return t && !/^(?:[a-z][a-z0-9+.-]*:|\/|#|\.\.?\/)/i.test(t);
  }

  function safeDecode(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }

  // 화면에 있는 첨부파일 링크로 파일명 -> 다운로드 주소 표를 만든다 (보여 주기 용도)
  function attachmentMap() {
    var map = new Map();
    document.querySelectorAll('a[href*="/attachments/"]').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      var m = href.match(/^(.*?\/attachments\/)(?:download\/)?(\d+)(?:\/([^?#]+))?/);
      if (!m) return;
      var name = m[3] ? safeDecode(m[3]) : (a.textContent || '').trim();
      if (!name || map.has(name)) return;
      map.set(name, m[1] + 'download/' + m[2] + '/' + encodeURIComponent(name));
    });
    return map;
  }

  // 불러올 때: 상대 경로 이미지(첨부파일명)를 실제 주소로 바꿔 화면에 보이게 하고, 되돌릴 표를 기록
  function preProcess(md, ctx) {
    function resolve(target) {
      if (!isRelativeTarget(target)) return null;
      var url = ctx.files.get(safeDecode(target));
      if (!url) return null;
      ctx.urls.set(url, target);
      ctx.urls.set(safeDecode(url), target);
      return url;
    }
    return mapOutsideCode(md, function (seg) {
      return seg
        .replace(/(!\[[^\]]*\]\(\s*<?)([^)\s>]+)(>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\))/g, function (m, a, t, b) {
          var u = resolve(t); return u ? a + u + b : m;
        })
        .replace(/(<img\b[^>]*?\bsrc=")([^"]+)(")/gi, function (m, a, t, b) {
          var u = resolve(t); return u ? a + u + b : m;
        });
    });
  }

  function restoreUrls(md, ctx) {
    ctx.urls.forEach(function (orig, url) { md = md.split(url).join(orig); });
    return md;
  }

  // 왕복 변환 비교용 정규화 (목록 기호, 들여쓰기, 이스케이프, 공백 차이는 같은 것으로 본다)
  function norm(s) {
    return s.replace(/\r\n?/g, '\n').split('\n').map(function (l) {
      return l.replace(/[ \t]+$/, '')
        .replace(/^[ \t]*([*+-]|\d+[.)])[ \t]+/, function (m, b) { return (/\d/.test(b) ? '1.' : '-') + ' '; })
        .replace(/^[ \t]+/, '')
        .replace(/\\([!-\/:-@\[-`{-~])/g, '$1');
    }).join('\n').replace(/\n{2,}/g, '\n\n').trim();
  }

  /* ---------- 첨부 ---------- */
  function pad(n) { return ('0' + n).slice(-2); }
  function clipboardName(file) {
    var d = new Date();
    var ext = ((file.type || '').split('/')[1] || 'png').replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '') || 'png';
    var key = '';
    while (key.length < 5) key += Math.random().toString(36).slice(2);
    return 'clipboard-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
      pad(d.getHours()) + pad(d.getMinutes()) + '-' + key.slice(0, 5) + '.' + ext;
  }
  // Redmine attachments.js 의 getInlineAttachmentMarkup 과 같은 인코딩
  function inlineName(name) {
    var s = name.replace(/[\/\?\%\*\:\|\"\'<>\n\r]+/g, '_');
    return encodeURIComponent(s).replace(/[!()]/g, function (c) { return '%' + c.charCodeAt(0).toString(16); });
  }
  function fileInputFor(ta) {
    var form = ta.form || ta.closest('form');
    return form ? form.querySelector('input[type="file"].filedrop') : null;
  }
  function attachFile(ta, file) {
    var input = fileInputFor(ta);
    if (!input || typeof window.addFile !== 'function') { window.alert(L.noAttach); return null; }
    // Redmine 기본 동작(숨긴 textarea 에 이미지 문법 삽입)을 막는다
    if (typeof window.handleFileDropEvent === 'function') window.handleFileDropEvent.target = '';
    var id = window.addFile(input, file, true);
    if (id == null) window.alert(input.getAttribute('data-max-number-of-files-message') || L.tooMany);
    return id;
  }

  /* ---------- 편집기 부착 ---------- */
  function iconButton(cls, title, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'toastui-editor-toolbar-icons asciisoft-ic ' + cls;
    b.title = title;
    b.setAttribute('aria-label', title);
    b.addEventListener('mousedown', function (e) { e.preventDefault(); });
    b.addEventListener('click', function (e) { e.preventDefault(); onClick(b); });
    return b;
  }

  // 선택 상자 + 오른쪽 작은 위/아래 버튼. upDelta: 위 버튼을 누를 때 이동할 목록 방향
  function makeCombo(cls, title, options, onPick, upTitle, downTitle, upDelta) {
    var wrap = document.createElement('span');
    wrap.className = 'asciisoft-combo ' + cls;
    var sel = document.createElement('select');
    sel.className = 'asciisoft-tb-select';
    sel.title = title;
    sel.setAttribute('aria-label', title);
    options.forEach(function (o) {
      var op = document.createElement('option');
      op.value = o[1]; op.textContent = o[0];
      if (o[2]) op.style.fontFamily = o[2];
      sel.appendChild(op);
    });
    sel.addEventListener('change', function () { onPick(sel.value); });
    var step = document.createElement('span');
    step.className = 'asciisoft-stepper';
    [[upDelta, upTitle, 'up'], [-upDelta, downTitle, 'down']].forEach(function (d) {
      var b = document.createElement('button');
      b.type = 'button'; b.tabIndex = -1;
      b.className = 'asciisoft-step asciisoft-step-' + d[2];
      b.title = d[1]; b.setAttribute('aria-label', d[1]);
      b.addEventListener('mousedown', function (e) { e.preventDefault(); });
      b.addEventListener('click', function (e) {
        e.preventDefault();
        var i = sel.selectedIndex + d[0];
        if (i < 0 || i >= sel.options.length) return;
        sel.selectedIndex = i; onPick(sel.value);
      });
      step.appendChild(b);
    });
    wrap.appendChild(sel); wrap.appendChild(step);
    return { wrap: wrap, sel: sel };
  }

  // 아이콘 버튼 + 펼침 목록 (줄간격)
  function makeMenuButton(cls, title, items, onPick) {
    var current = '';
    var menu = document.createElement('ul');
    menu.className = 'asciisoft-menu';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;
    document.body.appendChild(menu);
    var btn = iconButton(cls, title, function () {
      if (!menu.hidden) { menu.hidden = true; return; }
      menu.textContent = '';
      items.forEach(function (it) {
        var li = document.createElement('li');
        li.setAttribute('role', 'menuitemradio');
        li.textContent = it[0];
        if (it[1] === current) li.className = 'checked';
        li.addEventListener('mousedown', function (e) { e.preventDefault(); menu.hidden = true; onPick(it[1]); });
        menu.appendChild(li);
      });
      var r = btn.getBoundingClientRect();
      menu.style.left = Math.round(r.left + window.scrollX) + 'px';
      menu.style.top = Math.round(r.bottom + window.scrollY + 2) + 'px';
      menu.hidden = false;
    });
    document.addEventListener('mousedown', function (e) { if (e.target !== btn && !menu.contains(e.target)) menu.hidden = true; });
    return { el: btn, setCurrent: function (v) { current = v || ''; } };
  }

  /* ---------- 레이어 팝업 (320x200, 배경 블러, 배경 클릭 시 취소) ---------- */
  function askDialog(o) {
    var overlay = document.createElement('div');
    overlay.className = 'asciisoft-dialog-overlay';
    var box = document.createElement('div');
    box.className = 'asciisoft-dialog';
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    var title = document.createElement('h3'); title.textContent = o.title;
    var label = document.createElement('label'); label.textContent = o.label;
    var input = document.createElement('input'); input.type = 'text'; input.maxLength = 100; input.autocomplete = 'off';
    if (o.placeholder) input.placeholder = o.placeholder;
    var id = 'asciisoft-dlg-' + Math.random().toString(36).slice(2, 8);
    input.id = id; label.setAttribute('for', id);
    var err = document.createElement('p'); err.className = 'asciisoft-dialog-error'; err.textContent = o.invalid || ''; err.hidden = true;
    var row = document.createElement('div'); row.className = 'asciisoft-dialog-buttons';
    var cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'asciisoft-dialog-cancel'; cancel.textContent = o.cancel;
    var ok = document.createElement('button'); ok.type = 'button'; ok.className = 'asciisoft-dialog-ok'; ok.textContent = o.ok;
    row.appendChild(cancel); row.appendChild(ok);
    [title, label, input, err, row].forEach(function (n) { box.appendChild(n); });
    overlay.appendChild(box); document.body.appendChild(overlay);
    function close() {
      document.removeEventListener('keydown', onKey, true);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (o.onClose) o.onClose();
    }
    function submit() {
      var v = o.normalize(input.value);
      if (v === null) { err.hidden = false; input.focus(); return; }
      close(); o.onOk(v);
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === 'Enter' && e.target === input) { e.preventDefault(); e.stopPropagation(); submit(); }
    }
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
    ok.addEventListener('click', submit);
    cancel.addEventListener('click', close);
    document.addEventListener('keydown', onKey, true);
    input.focus();
  }

  /* ---------- 입력칸이 어느 화면(모듈)의 것인지 판별 ---------- */
  var COMMENT_KEYS = { issue_notes: 1, news_comment: 1 };
  function moduleKey(ta) {
    var id = ta.id || '';
    if (id === 'issue_description') return 'issue_description';
    if (id === 'issue_notes' || id === 'notes' || /^journal_\d+_notes$/.test(id)) return 'issue_notes';
    if (id === 'news_description') return 'news_description';
    if (id === 'comment_comments') return 'news_comment';
    if (id === 'message_content') return 'message';
    if (id === 'content_text') return 'wiki';
    if (id === 'document_description') return 'document';
    if (id === 'project_description') return 'project';
    return null;
  }
  function moduleHeight(key) {
    var h = CFG.heights && key ? parseInt(CFG.heights[key], 10) : NaN;
    return h >= 120 && h <= 2000 ? h : NaN;
  }
  function isPlain(ta) {
    var k = moduleKey(ta);
    return !!(k && COMMENT_KEYS[k] && CFG.commentEditor === false);
  }
  // 댓글에 에디터를 쓰지 않는 설정: Redmine 툴바와 탭을 숨기고 일반 입력칸만 보여 준다 (저장 방식은 그대로)
  function plainize(ta) {
    if (ta.dataset.asciisoftPlain) return;
    ta.dataset.asciisoftPlain = '1';
    var block = ta.closest('.jstBlock');
    if (block) block.classList.add('asciisoft-plain');
    var h = moduleHeight(moduleKey(ta));
    if (h) ta.style.height = h + 'px';
  }

  function attach(ta) {
    if (ta.dataset.asciisoftEditor || ta.disabled || ta.readOnly) return;
    if (document.body.getAttribute('data-text-formatting') !== 'common_mark') return;
    ta.dataset.asciisoftEditor = '1';

    var block = ta.closest('.jstBlock') || ta;
    var host = document.createElement('div');
    host.className = 'asciisoft-editor';
    block.parentNode.insertBefore(host, block);
    block.classList.add('asciisoft-hidden');

    var ctx = { files: attachmentMap(), urls: new Map() };
    var st = { loading: true, dirty: false, lastSynced: ta.value, textPasteAt: 0, timer: null };
    var original = ta.value;
    var rows = parseInt(ta.getAttribute('rows'), 10) || 10;
    var editor;

    function insertImage(file, name) {
      var url = URL.createObjectURL(file);
      ctx.urls.set(url, inlineName(name));
      editor.exec('addImage', { imageUrl: url, altText: '' });
    }

    function openLinkDialog(kind) {
      var issue = kind === 'issue';
      askDialog({
        title: issue ? L.issueLink : L.wikiLink,
        label: issue ? L.issuePrompt : L.wikiPrompt,
        placeholder: issue ? '123' : '',
        invalid: L.dialogInvalid, ok: L.ok, cancel: L.cancel,
        normalize: function (v) {
          v = String(v || '').trim();
          if (issue) return /^#?\d{1,9}$/.test(v) ? v.replace('#', '') : null;
          return v && !/[\[\]\r\n]/.test(v) ? v : null;
        },
        onOk: function (v) { editor.focus(); editor.insertText(issue ? '#' + v + ' ' : '[[' + v + ']] '); },
        onClose: function () { try { editor.focus(); } catch (e) {} }
      });
    }
    var showW = CFG.showWysiwyg !== false, showM = CFG.showMarkdown !== false;
    if (!showW && !showM) { showW = true; showM = true; }
    var defaultFont = FONT_FAMILIES.filter(function (f) { return f[0] === CFG.defaultFont; })[0] ||
      FONT_FAMILIES.filter(function (f) { return f[0] === 'Segoe UI'; })[0];
    var defaultSize = FONT_SIZES.indexOf(parseInt(CFG.defaultFontSize, 10)) > -1 ? parseInt(CFG.defaultFontSize, 10) : 14;
    var fixedHeight = moduleHeight(moduleKey(ta));
    host.style.setProperty('--asciisoft-font', defaultFont[1]);
    host.style.setProperty('--asciisoft-size', defaultSize + 'px');

    // 기본값과 같은 값을 고르면 서식을 지워 원문을 깔끔하게 유지
    var fontCombo = makeCombo('asciisoft-combo-font', L.fontFamily,
      FONT_FAMILIES.map(function (f) { return [f[0], f[1], f[1]]; }),
      function (v) { applyStyle('font-family', v === defaultFont[1] ? '' : v); }, L.prevItem, L.nextItem, -1);
    var sizeCombo = makeCombo('asciisoft-combo-size', L.fontSize,
      FONT_SIZES.map(function (n) { return [n + 'px', n + 'px']; }),
      function (v) { applyStyle('font-size', v === defaultSize + 'px' ? '' : v); }, L.sizeUp, L.sizeDown, 1);
    var lhMenu = makeMenuButton('asciisoft-ic-lineheight', L.lineHeight,
      [[L.defaultValue, '']].concat(LINE_HEIGHTS.map(function (n) { return [n, n]; })),
      function (v) { applyStyle('line-height', v); });

    editor = new window.AsciisoftToastEditor({
      el: host,
      initialEditType: showW ? 'wysiwyg' : 'markdown',
      hideModeSwitch: !(showW && showM),
      previewStyle: 'tab',
      height: fixedHeight >= 120 ? fixedHeight + 'px' : 'auto',
      minHeight: Math.max(160, rows * 22 + 70) + 'px',
      initialValue: showW ? preProcess(original, ctx) : original,
      language: CFG.lang || 'ko-KR',
      usageStatistics: false,
      autofocus: false,
      customHTMLRenderer: HTML_RENDERER,
      toolbarItems: [
        [{ name: 'asciisoftFont', tooltip: L.fontFamily, el: fontCombo.wrap }],
        [{ name: 'asciisoftSize', tooltip: L.fontSize, el: sizeCombo.wrap }],
        ['bold', 'italic', 'strike', 'heading'],
        ['task', 'hr', 'quote'],
        ['ul', 'ol', 'indent', 'outdent', { name: 'asciisoftLine', tooltip: L.lineHeight, el: lhMenu.el }],
        ['table', 'image', 'link'],
        ['code', 'codeblock'],
        [
          { name: 'asciisoftIssue', tooltip: L.issueLink, el: iconButton('asciisoft-ic-issue', L.issueLink, function () { openLinkDialog('issue'); }) },
          { name: 'asciisoftWiki', tooltip: L.wikiLink, el: iconButton('asciisoft-ic-wiki', L.wikiLink, function () { openLinkDialog('wiki'); }) }
        ]
      ],
      hooks: {
        // 툴바의 이미지 버튼(파일 선택)으로 넣는 경우
        addImageBlobHook: function (blob, callback) {
          if (Date.now() - st.textPasteAt < 1000) return; // 엑셀/워드처럼 텍스트가 함께 온 붙여넣기는 이미지로 처리하지 않음
          var name = blob.name && !/^image\.\w+$/.test(blob.name) ? blob.name : clipboardName(blob);
          var file = new File([blob], name, { type: blob.type });
          if (attachFile(ta, file) == null) return;
          var url = URL.createObjectURL(file);
          ctx.urls.set(url, inlineName(name));
          callback(url, '');
        }
      }
    });

    // 서식 적용: 선택 영역의 글자마다 기존 span 서식과 합쳐 하나의 span 으로 만든다
    editor.addCommand('wysiwyg', 'asciisoftStyle', function (payload, state, dispatch) {
      var spanType = state.schema.marks.span;
      if (!spanType) return false;
      var sel = state.selection, tr = state.tr;
      function markFor(style) { return style ? spanType.create({ htmlAttrs: { style: style }, htmlInline: true }) : null; }
      if (sel.empty) {
        var cur = (state.storedMarks || sel.$from.marks()).filter(function (m) { return m.type === spanType; })[0];
        var st0 = mergeStyle(cur && cur.attrs.htmlAttrs && cur.attrs.htmlAttrs.style, payload.prop, payload.value);
        tr = tr.removeStoredMark(spanType);
        var mk0 = markFor(st0); if (mk0) tr = tr.addStoredMark(mk0);
        dispatch(tr); return true;
      }
      state.doc.nodesBetween(sel.from, sel.to, function (node, pos) {
        if (!node.isText) return;
        var a = Math.max(sel.from, pos), b = Math.min(sel.to, pos + node.nodeSize);
        var old = node.marks.filter(function (m) { return m.type === spanType; })[0];
        var st = mergeStyle(old && old.attrs.htmlAttrs && old.attrs.htmlAttrs.style, payload.prop, payload.value);
        if (old) tr = tr.removeMark(a, b, old);
        var mk = markFor(st); if (mk) tr = tr.addMark(a, b, mk);
      });
      dispatch(tr); return true;
    });
    function applyStyle(prop, value) {
      if (value && !validStyleValue('SPAN', prop, value)) return;
      if (editor.isWysiwygMode()) {
        editor.exec('asciisoftStyle', { prop: prop, value: value });
      } else if (value) {
        var text = editor.getSelectedText();
        editor.replaceSelection('<span style="' + prop + ': ' + value + '">' + text + '</span>');
      }
      editor.focus();
      refreshCombos();
    }

    editor.addCommand('wysiwyg', 'asciisoftReadStyle', function (holder, state) {
      var spanType = state.schema.marks.span;
      var marks = state.storedMarks || state.selection.$from.marks();
      var m = spanType && marks.filter(function (x) { return x.type === spanType; })[0];
      holder.style = (m && m.attrs.htmlAttrs && m.attrs.htmlAttrs.style) || '';
      return true;
    });
    // 커서 위치의 글꼴/크기/줄간격을 읽어 툴바에 표시 (읽을 수 없으면 기본값)
    function refreshCombos() {
      var st = {};
      if (editor.isWysiwygMode()) {
        var h = { style: '' };
        try { editor.exec('asciisoftReadStyle', h); } catch (e) {}
        st = parseStyle(h.style);
      }
      var f = FONT_FAMILIES.filter(function (x) { return x[1] === st['font-family']; })[0] || defaultFont;
      fontCombo.sel.value = f[1];
      var fs = st['font-size'];
      sizeCombo.sel.value = (fs && /px$/.test(fs) && FONT_SIZES.indexOf(parseInt(fs, 10)) > -1) ? parseInt(fs, 10) + 'px' : defaultSize + 'px';
      lhMenu.setCurrent(st['line-height'] || '');
    }
    editor.on('caretChange', refreshCombos);
    editor.on('changeMode', function () { setTimeout(refreshCombos, 0); });
    refreshCombos();

    Array.prototype.forEach.call(host.querySelectorAll('.toastui-editor-mode-switch .tab-item'), function (t) {
      if (/wysiwyg|위지윅/i.test(t.textContent)) t.textContent = L.editorTab;
    });

    setupMention(editor, host, L);

    // 불러오지 못한 이미지는 자리 표시 상자로 보여 준다 (화면 표시만 바꾸고 저장 내용은 그대로)
    host.addEventListener('error', function (e) {
      var img = e.target;
      if (!img || img.tagName !== 'IMG' || img.classList.contains('asciisoft-broken')) return;
      var src = img.getAttribute('src') || '';
      var name = safeDecode(src.split(/[?#]/)[0].split('/').pop() || '');
      img.classList.add('asciisoft-broken');
      img.setAttribute('alt', L.imageLabel + (name ? ': ' + name : ''));
    }, true);

    // 왕복 변환으로 내용이 달라지는 글은 원문 보호를 위해 Markdown 모드로 연다
    if (showW && original.trim()) {
      var probe = unescapeRedmine(restoreUrls(editor.getMarkdown(), ctx));
      if (norm(probe) !== norm(original)) {
        editor.changeMode('markdown', true);
        editor.setMarkdown(original, false);
        var note = document.createElement('div');
        note.className = 'asciisoft-editor-notice';
        note.textContent = showM ? L.mdNotice : L.mdNoticeNoSwitch;
        host.parentNode.insertBefore(note, host);
      }
    }

    function currentMarkdown() {
      var md = restoreUrls(editor.getMarkdown(), ctx);
      return editor.isWysiwygMode() ? unescapeRedmine(md) : md;
    }
    function sync() {
      clearTimeout(st.timer);
      if (!st.dirty) return;
      var md = currentMarkdown();
      if (ta.value !== md) {
        ta.value = md;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
      }
      st.lastSynced = ta.value;
    }

    editor.on('change', function () {
      if (st.loading) return;
      st.dirty = true;
      clearTimeout(st.timer);
      st.timer = setTimeout(sync, 250);
    });
    setTimeout(function () { st.loading = false; }, 0);

    var form = ta.form || ta.closest('form');
    if (form) form.addEventListener('submit', sync, true);

    // 클립보드: 이미지만 있을 때 첨부 + 삽입. 텍스트가 함께 있으면(엑셀, 워드, 웹) 편집기에 맡긴다
    var REPASTE = 'application/x-asciisoft-repaste';
    host.addEventListener('paste', function (e) {
      var cd = e.clipboardData; if (!cd) return;
      var types = Array.prototype.slice.call(cd.types || []);
      if (types.indexOf(REPASTE) > -1) { st.textPasteAt = Date.now(); return; }
      var hasText = types.indexOf('text/plain') > -1 || types.indexOf('text/html') > -1;
      var imgs = Array.prototype.filter.call(cd.files || [], function (f) { return /^image\//.test(f.type); });
      var pastedHtml = hasText ? (cd.getData('text/html') || '') : '';
      var needsClean = /<span\b/i.test(pastedHtml);
      if ((imgs.length && hasText) || needsClean) {
        // 엑셀/워드는 텍스트와 함께 셀 그림을 넣어 보낸다. 그림을 빼고, 허용한 서식 외의 span 은 정리한 뒤
        // 텍스트만 다시 붙여넣어 편집기가 표/서식으로 처리하게 한다
        e.preventDefault(); e.stopPropagation();
        var dt = new DataTransfer();
        if (pastedHtml) dt.setData('text/html', needsClean ? cleanPastedHtml(pastedHtml) : pastedHtml);
        var pastedPlain = cd.getData('text/plain'); if (pastedPlain) dt.setData('text/plain', pastedPlain);
        dt.setData(REPASTE, '1');
        var target = e.target;
        setTimeout(function () {
          handleTextPaste(dt.getData('text/html'), dt.getData('text/plain'));
          target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
        }, 0);
        return;
      }
      if (imgs.length && !hasText) {
        e.preventDefault(); e.stopPropagation();
        imgs.forEach(function (f) {
          var name = clipboardName(f);
          var file = new File([f], name, { type: f.type });
          if (attachFile(ta, file) != null) insertImage(file, name);
        });
      } else if (hasText) {
        handleTextPaste(cd.getData('text/html') || '', cd.getData('text/plain') || '');
      }
    }, true);

    // 엑셀/스프레드시트 표: 목록 안처럼 표를 넣을 수 없는 위치면 편집기가 아무것도 넣지 않으므로 텍스트로 대신 넣는다
    function handleTextPaste(html, plain) {
      st.textPasteAt = Date.now();
      if (!/<table[\s>]/i.test(html || '') || !plain) return;
      var before = editor.getMarkdown();
      setTimeout(function () {
        if (editor.getMarkdown() === before) editor.insertText(plain.replace(/\r\n?/g, '\n').replace(/\n$/, ''));
      }, 80);
    }

    // 파일 끌어다 놓기: 이미지는 첨부 + 삽입, 그 외 파일은 첨부만 (Redmine 기본 처리와 중복 방지)
    host.addEventListener('dragover', function (e) {
      if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') > -1) e.preventDefault();
    }, true);
    host.addEventListener('drop', function (e) {
      var dt = e.dataTransfer;
      if (!dt || Array.prototype.indexOf.call(dt.types || [], 'Files') < 0) return;
      e.preventDefault(); e.stopPropagation();
      Array.prototype.forEach.call(dt.files, function (f) {
        if (attachFile(ta, f) != null && /^image\//.test(f.type)) insertImage(f, f.name);
      });
    }, true);

    // 인용(답글) 등 다른 스크립트가 숨긴 칸을 바꾼 경우 편집기에 반영
    var poll = setInterval(function () {
      if (!document.body.contains(ta)) { clearInterval(poll); try { editor.destroy(); } catch (e) {} return; }
      if (ta.value === st.lastSynced) return;
      var v = ta.value;
      st.loading = true;
      editor.setMarkdown(editor.isWysiwygMode() ? preProcess(v, ctx) : v, true);
      st.lastSynced = v; st.dirty = false;
      setTimeout(function () { st.loading = false; }, 0);
      if (document.activeElement === ta) editor.focus();
    }, 600);

    ta.asciisoftEditor = { editor: editor, sync: sync };
  }

  /* ---------- @멘션: Redmine 이 화면에 넣어 둔 사용자 검색 주소를 사용 ---------- */
  var mentionCache = {};
  function mentionSource() {
    var u = window.rm && window.rm.AutoComplete && window.rm.AutoComplete.dataSources && window.rm.AutoComplete.dataSources.users;
    if (typeof u !== 'string' || !u) return null;
    try { if (new URL(u, location.href).origin !== location.origin) return null; } catch (e) { return null; }  // 같은 사이트 주소만
    return u;
  }
  function setupMention(editor, host, L) {
    var box = document.createElement('ul');
    box.className = 'asciisoft-mention';
    box.setAttribute('role', 'listbox');
    box.hidden = true;
    document.body.appendChild(box);
    var state = { items: [], index: 0, query: null, timer: null, seq: 0 };

    function close() { box.hidden = true; state.items = []; state.query = null; }
    function currentQuery() {
      var sel = window.getSelection();
      if (!sel || !sel.rangeCount || !sel.isCollapsed) return null;
      var node = sel.anchorNode;
      if (!node || node.nodeType !== 3 || !host.contains(node)) return null;
      var before = node.textContent.slice(0, sel.anchorOffset);
      var m = before.match(/(?:^|[\s(])@([\w.\-@]{0,30})$/);
      if (!m) return null;
      var rect = sel.getRangeAt(0).getBoundingClientRect();
      return { text: m[1], node: node, offset: sel.anchorOffset, rect: rect };
    }
    function render() {
      box.textContent = '';
      state.items.forEach(function (u, i) {
        var li = document.createElement('li');
        li.setAttribute('role', 'option');
        if (i === state.index) li.className = 'active';
        var name = document.createElement('span'); name.textContent = u.name || u.login;
        var login = document.createElement('em'); login.textContent = '@' + u.login;
        li.appendChild(name); li.appendChild(login);
        li.addEventListener('mousedown', function (ev) { ev.preventDefault(); state.index = i; pick(); });
        box.appendChild(li);
      });
      box.hidden = state.items.length === 0;
    }
    function place(rect) {
      box.style.left = Math.round(rect.left + window.scrollX) + 'px';
      box.style.top = Math.round(rect.bottom + window.scrollY + 4) + 'px';
    }
    function search(q) {
      var src = mentionSource();
      if (!src) { close(); return; }
      var url = src + encodeURIComponent(q.text);
      var seq = ++state.seq;
      function show(list) {
        if (seq !== state.seq) return;
        state.items = (Array.isArray(list) ? list : []).filter(function (u) {
          return u && typeof u.login === 'string' && /^[\w.\-@]{1,60}$/.test(u.login);
        }).slice(0, 10);
        state.index = 0; state.query = q; place(q.rect); render();
      }
      if (mentionCache[url]) { show(mentionCache[url]); return; }
      fetch(url, { credentials: 'same-origin', headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' } })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (list) { mentionCache[url] = list; show(list); })
        .catch(function () { close(); });
    }
    function pick() {
      var u = state.items[state.index], q = state.query;
      close();
      if (!u || !q) return;
      var cmd = editor.isWysiwygMode() ? 'wysiwyg' : 'markdown';
      editor.exec('asciisoftMention_' + cmd, { node: q.node, offset: q.offset, length: q.text.length + 1, text: '@' + u.login + ' ' });
      editor.focus();
    }
    ['wysiwyg', 'markdown'].forEach(function (type) {
      editor.addCommand(type, 'asciisoftMention_' + type, function (p, st, dispatch, view) {
        var to;
        try { to = view.posAtDOM(p.node, p.offset); } catch (e) { return false; }
        var from = Math.max(0, to - p.length);
        dispatch(st.tr.insertText(p.text, from, to));
        return true;
      });
    });

    host.addEventListener('keyup', function (e) {
      if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape', 'Tab'].indexOf(e.key) > -1 && !box.hidden) return;
      var q = currentQuery();
      if (!q) { close(); return; }
      clearTimeout(state.timer);
      state.timer = setTimeout(function () { search(q); }, 150);
    });
    host.addEventListener('keydown', function (e) {
      if (box.hidden) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); e.stopPropagation();
        var n = state.items.length;
        state.index = (state.index + (e.key === 'ArrowDown' ? 1 : n - 1)) % n; render();
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault(); e.stopPropagation(); pick();
      } else if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation(); close();
      }
    }, true);
    document.addEventListener('mousedown', function (e) { if (!box.contains(e.target)) close(); });
    window.addEventListener('scroll', close, true);
  }

  function attachAll(root) {
    var scope = root || document;
    var list = scope.querySelectorAll ? scope.querySelectorAll(SELECTOR) : [];
    if (!list.length) return;
    var rich = [];
    Array.prototype.forEach.call(list, function (ta) { if (isPlain(ta)) plainize(ta); else rich.push(ta); });
    if (!rich.length) return;
    loadAssets().then(function () {
      rich.forEach(function (ta) {
        try { attach(ta); } catch (e) { if (window.console) console.error('[asciisoft-editor]', e); }
      });
    }).catch(function (e) { if (window.console) console.error('[asciisoft-editor]', e); });
  }

  function start() {
    attachAll(document);
    // AJAX 로 나중에 생기는 편집 칸(댓글 수정 등)도 처리
    new MutationObserver(function (muts) {
      var found = false;
      muts.forEach(function (m) {
        Array.prototype.forEach.call(m.addedNodes, function (n) {
          if (n.nodeType === 1 && (n.matches(SELECTOR) || n.querySelector(SELECTOR))) found = true;
        });
      });
      if (found) setTimeout(function () { attachAll(document); }, 0);
    }).observe(document.body, { childList: true, subtree: true });
  }

  window.AsciisoftEditor = {
    attachAll: attachAll,
    _test: { cleanStyle: cleanStyle, mergeStyle: mergeStyle, unescapeRedmine: unescapeRedmine, preProcess: preProcess, restoreUrls: restoreUrls, norm: norm, inlineName: inlineName, clipboardName: clipboardName }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

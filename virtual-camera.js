/**
 * VirtualCamera.js v1.0.0
 * Browser virtual background camera library
 * Dependency: @mediapipe/selfie_segmentation (auto-loaded if not present)
 *
 * Simplest usage:
 *   VirtualCamera.mount('#camera')
 *   VirtualCamera.mount('#camera', { backgrounds: ['url1','url2'] })
 */
(function (root) {
  'use strict';

  /* ============================================
     Auto-inject CSS
     ============================================ */
  function injectCSS() {
    if (document.getElementById('vc-lib-css')) return;
    var s = document.createElement('style');
    s.id = 'vc-lib-css';
    s.textContent = `
      .vc-root { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; display:flex; flex-direction:column; align-items:center; gap:12px; width:100%; }
      .vc-view { position:relative; width:100%; max-width:640px; background:#111; border-radius:12px; overflow:hidden; aspect-ratio:4/3; }
      .vc-view canvas { width:100%; height:100%; display:block; object-fit:cover; }
      .vc-overlay { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.75); color:#e94560; font-size:.95rem; z-index:10; }
      .vc-overlay.hidden { display:none; }
      .vc-spin { width:26px; height:26px; border:3px solid #333; border-top-color:#e94560; border-radius:50%; animation:vcspin .7s linear infinite; margin-right:10px; }
      @keyframes vcspin { to{transform:rotate(360deg)} }
      .vc-bar { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; width:100%; max-width:640px; }
      .vc-btn { padding:7px 16px; border:1.5px solid #333; border-radius:8px; background:#1a1a2e; color:#aaa; font-size:.82rem; font-weight:600; cursor:pointer; transition:all .12s; user-select:none; }
      .vc-btn:hover { transform:scale(1.04); }
      .vc-btn.active { background:#e94560; color:#fff; border-color:#e94560; }
      .vc-btn-snap { background:linear-gradient(135deg,#e94560,#c23060); color:#fff; font-size:.95rem; padding:9px 26px; border:none; border-radius:8px; cursor:pointer; font-weight:700; transition:transform .12s; }
      .vc-btn-snap:hover { transform:scale(1.04); }
      .vc-opts { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; align-items:center; min-height:44px; width:100%; max-width:640px; }
      .vc-swatch { width:34px; height:34px; border-radius:50%; cursor:pointer; border:3px solid transparent; transition:border-color .15s; }
      .vc-swatch.active { border-color:#fff; }
      .vc-thumb { width:68px; height:46px; border-radius:6px; object-fit:cover; cursor:pointer; border:3px solid transparent; transition:border-color .15s; }
      .vc-thumb.active { border-color:#e94560; }
      .vc-photos { display:flex; flex-wrap:wrap; gap:10px; justify-content:center; width:100%; max-width:640px; }
      .vc-photos a { display:block; }
      .vc-photos img { width:120px; border-radius:8px; border:2px solid #333; cursor:pointer; transition:border-color .15s; }
      .vc-photos img:hover { border-color:#e94560; }
      .vc-flash { position:absolute; inset:0; background:#fff; opacity:0; pointer-events:none; z-index:20; transition:opacity .12s; }
      .vc-flash.pop { opacity:.75; transition:none; }
      .vc-upload-label { padding:7px 16px; border:1.5px dashed #555; border-radius:8px; background:transparent; color:#aaa; font-size:.82rem; cursor:pointer; transition:border-color .15s; }
      .vc-upload-label:hover { border-color:#e94560; color:#e94560; }
    `;
    document.head.appendChild(s);
  }

  /* ============================================
     Auto-load MediaPipe if not present
     ============================================ */
  function ensureMediaPipe() {
    return new Promise(function (resolve, reject) {
      if (typeof SelfieSegmentation !== 'undefined') return resolve();
      var sc = document.createElement('script');
      sc.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js';
      sc.crossOrigin = 'anonymous';
      sc.onload = resolve;
      sc.onerror = function () { reject(new Error('Failed to load MediaPipe SelfieSegmentation')); };
      document.head.appendChild(sc);
    });
  }

  /* ============================================
     Core Engine
     ============================================ */
  function Engine(container, opts) {
    this.opts = Object.assign({
      width: 640,
      height: 480,
      mirror: true,
      modelSelection: 1
    }, opts);

    this.container = container;
    this._bgType = 'none';
    this._bgColor = '#000';
    this._bgImage = null;
    this._blurPx = 14;
    this._running = false;
    this._events = {};

    this._video = document.createElement('video');
    this._video.setAttribute('playsinline', '');
    this._video.style.display = 'none';

    this._canvas = document.createElement('canvas');
    this._canvas.width = this.opts.width;
    this._canvas.height = this.opts.height;
    if (this.opts.mirror) this._canvas.style.transform = 'scaleX(-1)';

    this._ctx = this._canvas.getContext('2d');
    this._seg = null;
  }

  var P = Engine.prototype;

  P.on = function (e, fn) { (this._events[e] = this._events[e] || []).push(fn); return this; };
  P._emit = function (e, d) { (this._events[e] || []).forEach(function (fn) { try { fn(d); } catch(x){} }); };

  P.start = function () {
    var self = this;
    return navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: self.opts.width }, height: { ideal: self.opts.height }, facingMode: 'user' },
      audio: false
    }).then(function (stream) {
      self._stream = stream;
      self._video.srcObject = stream;
      return self._video.play();
    }).then(function () {
      self._canvas.width = self._video.videoWidth || self.opts.width;
      self._canvas.height = self._video.videoHeight || self.opts.height;

      self._seg = new SelfieSegmentation({
        locateFile: function (f) { return 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/' + f; }
      });
      self._seg.setOptions({ modelSelection: self.opts.modelSelection });
      self._seg.onResults(function (r) { self._draw(r); });

      return self._seg.send({ image: self._video });
    }).then(function () {
      self._running = true;
      self._emit('ready');
      self._loop();
    });
  };

  P._loop = function () {
    if (!this._running) return;
    var self = this;
    this._seg.send({ image: this._video }).then(function () {
      if (self._running) requestAnimationFrame(function () { self._loop(); });
    }).catch(function () {
      if (self._running) requestAnimationFrame(function () { self._loop(); });
    });
  };

  P._draw = function (res) {
    var ctx = this._ctx, w = this._canvas.width, h = this._canvas.height;
    ctx.save();
    ctx.clearRect(0, 0, w, h);

    if (this._bgType === 'none') {
      ctx.drawImage(res.image, 0, 0, w, h);
      ctx.restore();
      return;
    }

    ctx.drawImage(res.segmentationMask, 0, 0, w, h);
    ctx.globalCompositeOperation = 'source-in';
    ctx.drawImage(res.image, 0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-over';

    if (this._bgType === 'blur') {
      ctx.filter = 'blur(' + this._blurPx + 'px)';
      ctx.drawImage(res.image, 0, 0, w, h);
      ctx.filter = 'none';
    } else if (this._bgType === 'color') {
      ctx.fillStyle = this._bgColor;
      ctx.fillRect(0, 0, w, h);
    } else if (this._bgType === 'image' && this._bgImage) {
      var img = this._bgImage;
      var sc = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      var iw = img.naturalWidth * sc, ih = img.naturalHeight * sc;
      ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
    }

    ctx.restore();
  };

  P.setBackground = function (type, value) {
    this._bgType = type;
    if (type === 'blur') { this._blurPx = (typeof value === 'number') ? value : 14; }
    else if (type === 'color') { this._bgColor = value || '#000'; }
    else if (type === 'image') {
      if (typeof value === 'string') {
        var img = new Image(); img.crossOrigin = 'anonymous';
        var self = this;
        img.onload = function () { self._bgImage = img; };
        img.src = value;
      } else if (value instanceof HTMLImageElement) {
        this._bgImage = value;
      }
    }
    return this;
  };

  P.takePhoto = function (format, quality) {
    format = format || 'image/png';
    quality = quality || 0.95;
    if (this.opts.mirror) {
      var tmp = document.createElement('canvas');
      tmp.width = this._canvas.width; tmp.height = this._canvas.height;
      var t = tmp.getContext('2d');
      t.translate(tmp.width, 0); t.scale(-1, 1);
      t.drawImage(this._canvas, 0, 0);
      return tmp.toDataURL(format, quality);
    }
    return this._canvas.toDataURL(format, quality);
  };

  P.stop = function () {
    this._running = false;
    if (this._stream) this._stream.getTracks().forEach(function (t) { t.stop(); });
    if (this._seg) try { this._seg.close(); } catch (e) {}
  };

  P.destroy = function () {
    this.stop();
    this._canvas.remove();
    this._video.remove();
  };

  /* ============================================
     High-level: VirtualCamera.mount()
     One-liner full UI with controls
     ============================================ */
  function mount(selector, userOpts) {
    userOpts = userOpts || {};

    var root = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!root) throw new Error('VirtualCamera: container not found: ' + selector);

    injectCSS();

    var colors = userOpts.colors || ['#e94560','#0096c7','#06d6a0','#ffd166','#8338ec','#2d2d2d','#f0f0f0'];
    var images = userOpts.backgrounds || [];
    var showUpload = userOpts.allowUpload !== false;
    var onPhoto = userOpts.onPhoto || null;
    var labels = Object.assign({
      original: 'Original',
      blur: 'Blur',
      color: 'Color',
      image: 'Image',
      snap: '📸 Take Photo',
      upload: '📁 Upload BG',
      loading: 'Loading model...'
    }, userOpts.labels || {});

    // --- Build UI ---
    var wrapper = document.createElement('div');
    wrapper.className = 'vc-root';

    var view = document.createElement('div');
    view.className = 'vc-view';

    var overlay = document.createElement('div');
    overlay.className = 'vc-overlay';
    overlay.innerHTML = '<div class="vc-spin"></div><span>' + labels.loading + '</span>';

    var flash = document.createElement('div');
    flash.className = 'vc-flash';

    view.appendChild(overlay);
    view.appendChild(flash);

    var modeBar = document.createElement('div');
    modeBar.className = 'vc-bar';

    var modes = [
      { key: 'none', label: labels.original },
      { key: 'blur', label: labels.blur },
      { key: 'color', label: labels.color },
      { key: 'image', label: labels.image }
    ];

    modes.forEach(function (m, i) {
      var b = document.createElement('button');
      b.className = 'vc-btn' + (i === 0 ? ' active' : '');
      b.textContent = m.label;
      b.dataset.mode = m.key;
      modeBar.appendChild(b);
    });

    var optsRow = document.createElement('div');
    optsRow.className = 'vc-opts';

    var snapBar = document.createElement('div');
    snapBar.className = 'vc-bar';
    var snapBtn = document.createElement('button');
    snapBtn.className = 'vc-btn-snap';
    snapBtn.textContent = labels.snap;
    snapBar.appendChild(snapBtn);

    var photosRow = document.createElement('div');
    photosRow.className = 'vc-photos';

    wrapper.appendChild(view);
    wrapper.appendChild(modeBar);
    wrapper.appendChild(optsRow);
    wrapper.appendChild(snapBar);
    wrapper.appendChild(photosRow);
    root.appendChild(wrapper);

    // --- Engine ---
    var engine = new Engine(view, {
      width: userOpts.width || 640,
      height: userOpts.height || 480,
      mirror: userOpts.mirror !== false,
      modelSelection: userOpts.modelSelection || 1
    });

    view.appendChild(engine._video);
    view.appendChild(engine._canvas);

    // --- Mode switching ---
    var currentMode = 'none';

    function activateMode(mode) {
      currentMode = mode;
      modeBar.querySelectorAll('.vc-btn').forEach(function (b) {
        b.classList.toggle('active', b.dataset.mode === mode);
      });
      optsRow.innerHTML = '';

      if (mode === 'none') {
        engine.setBackground('none');
      } else if (mode === 'blur') {
        engine.setBackground('blur', 14);
      } else if (mode === 'color') {
        colors.forEach(function (c, i) {
          var dot = document.createElement('div');
          dot.className = 'vc-swatch' + (i === 0 ? ' active' : '');
          dot.style.background = c;
          dot.addEventListener('click', function () {
            optsRow.querySelectorAll('.vc-swatch').forEach(function (s) { s.classList.remove('active'); });
            dot.classList.add('active');
            engine.setBackground('color', c);
          });
          optsRow.appendChild(dot);
        });
        engine.setBackground('color', colors[0]);
      } else if (mode === 'image') {
        images.forEach(function (url, i) {
          var im = document.createElement('img');
          im.className = 'vc-thumb' + (i === 0 ? ' active' : '');
          im.src = url;
          im.crossOrigin = 'anonymous';
          im.addEventListener('click', function () {
            optsRow.querySelectorAll('.vc-thumb').forEach(function (t) { t.classList.remove('active'); });
            im.classList.add('active');
            engine.setBackground('image', url);
          });
          optsRow.appendChild(im);
        });
        if (showUpload) {
          var lbl = document.createElement('label');
          lbl.className = 'vc-upload-label';
          lbl.textContent = labels.upload;
          var inp = document.createElement('input');
          inp.type = 'file';
          inp.accept = 'image/*';
          inp.style.display = 'none';
          inp.addEventListener('change', function () {
            if (!inp.files || !inp.files[0]) return;
            var reader = new FileReader();
            reader.onload = function (ev) {
              var url = ev.target.result;
              // add new thumb
              var im = document.createElement('img');
              im.className = 'vc-thumb active';
              im.src = url;
              optsRow.querySelectorAll('.vc-thumb').forEach(function (t) { t.classList.remove('active'); });
              optsRow.insertBefore(im, lbl);
              im.addEventListener('click', function () {
                optsRow.querySelectorAll('.vc-thumb').forEach(function (t) { t.classList.remove('active'); });
                im.classList.add('active');
                engine.setBackground('image', url);
              });
              engine.setBackground('image', url);
            };
            reader.readAsDataURL(inp.files[0]);
          });
          lbl.appendChild(inp);
          optsRow.appendChild(lbl);
        }
        if (images.length > 0) engine.setBackground('image', images[0]);
      }
    }

    modeBar.addEventListener('click', function (e) {
      var btn = e.target.closest('.vc-btn');
      if (btn && btn.dataset.mode) activateMode(btn.dataset.mode);
    });

    // --- Snap ---
    snapBtn.addEventListener('click', function () {
      if (!engine._running) return;
      flash.classList.add('pop');
      setTimeout(function () { flash.classList.remove('pop'); }, 150);

      var dataUrl = engine.takePhoto();

      var a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'photo_' + Date.now() + '.png';
      var im = document.createElement('img');
      im.src = dataUrl;
      a.appendChild(im);
      photosRow.prepend(a);

      if (typeof onPhoto === 'function') onPhoto(dataUrl);
    });

    // --- Boot ---
    ensureMediaPipe().then(function () {
      return engine.start();
    }).then(function () {
      overlay.classList.add('hidden');
    }).catch(function (err) {
      overlay.querySelector('span').textContent = 'Error: ' + err.message;
    });

    // return engine for advanced users
    return engine;
  }

  /* ============================================
     Expose public API
     ============================================ */
  root.VirtualCamera = {
    mount: mount,
    Engine: Engine,
    VERSION: '1.0.0'
  };

})(typeof window !== 'undefined' ? window : this);

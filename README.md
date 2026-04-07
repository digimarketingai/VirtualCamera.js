# 📷 VirtualCamera.js

A zero-dependency, one-line-of-code virtual background camera library for the browser.

Open your webcam, replace the background with blur / solid color / custom image, and take photos — all from a single `<script>` tag.

**Powered by MediaPipe Selfie Segmentation.**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-brightgreen.svg)

---

## ✨ Features

- 🎯 **One-liner setup** — `VirtualCamera.mount('#camera')` and done
- 🧠 **AI-powered** — Real-time person segmentation via MediaPipe (same tech behind Google Meet)
- 🖼️ **4 background modes** — Original / Blur / Solid Color / Custom Image
- 📁 **User upload** — Let users upload their own background images
- 📸 **Take photos** — Built-in capture with flash effect + auto-download
- 🪞 **Mirror mode** — Selfie-friendly mirrored preview (output is corrected)
- 🌐 **Zero build step** — No npm, no bundler, just a `<script>` tag
- 📱 **Responsive** — Works on desktop and mobile browsers
- 🌍 **i18n ready** — Customize all UI labels via options

---

## 🚀 Quick Start

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Photo Booth</title>
</head>
<body>

  <div id="camera"></div>

  <script src="https://digimarketingai.github.io/VirtualCamera.js/virtual-camera.js"></script>
  <script>
    VirtualCamera.mount('#camera');
  </script>

</body>
</html>

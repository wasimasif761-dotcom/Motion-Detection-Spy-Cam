# 🚨 Motion Detection Spy Cam (PWA)

A high-tech, production-ready **Progressive Web App (PWA)** that transforms any smartphone, tablet, or laptop into an autonomous security camera with real-time motion detection, offline capability, audible siren alarm, and snapshot evidence logging.

---

## ⚡ Key Highlights

- **100% Pure Vanilla Web Stack**: Zero external JavaScript libraries, zero external APIs, zero backend servers.
- **Works 100% Offline**: Precached via a custom Service Worker (`sw.js`). Load once, run forever offline.
- **GitHub Pages Ready**: Uses relative paths (`./`) so it runs seamlessly under custom domains or GitHub project sub-paths.
- **In-App PWA Installation**: Prompts installation on Android/Chromium and provides guided instructions on iOS Safari.
- **Synthesized Web Audio Siren**: Generates multi-frequency emergency siren tones (600Hz ↔ 1300Hz) using the native `AudioContext` with zero MP3/WAV file downloads.

---

## 🛠️ Features

1. **Autonomous Motion Detection Engine**:
   - Compares pixel data across consecutive frames on a background HTML5 `<canvas>`.
   - Computes changed pixels against a threshold every ~280ms without taxing the CPU or draining battery.
2. **Real-Time Activity Meter & Presets**:
   - Visual activity level meter (0% to 100%) with live threshold marker.
   - Quick presets: **High (10%)**, **Medium (20%)**, and **Low (35%)**, plus manual slider.
3. **Multi-Camera Support**:
   - Defaults to the rear environment camera (`facingMode: 'environment'`).
   - One-tap toggle button to switch between front selfie and rear lenses.
4. **Instant Siren Alarm & Visual Alert**:
   - Emergency flashing red alert screen overlay.
   - Loud oscillating audio alarm.
5. **Evidence & Forensic Gallery**:
   - Automatically captures high-resolution snapshots upon trigger.
   - Stamped with forensic timestamp watermarks and motion intensity percentage.
   - One-click image downloads and lightbox inspection.
   - Persistent history saved in `localStorage`.

---

## 📁 Repository Structure

```text
├── index.html       # Main UI, styling, and viewport HUD
├── app.js           # Motion engine, Web Audio synth & event handlers
├── manifest.json    # PWA configuration and standalone launcher
├── sw.js            # Offline service worker & cache management
├── icon.svg         # Tactical security eye vector icon
└── README.md        # Documentation and deployment guide
```

---

## 🚀 How to Publish on GitHub Pages

1. **Create a GitHub Repository**:
   - Go to [github.com/new](https://github.com/new).
   - Enter a repository name (e.g., `motion-spy-cam`).
   - Set visibility to **Public** and create the repository.

2. **Upload or Push Your Files**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Motion Detection Spy Cam PWA"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```

3. **Enable GitHub Pages**:
   - Go to **Settings** in your GitHub repository.
   - Click **Pages** in the left sidebar.
   - Under **Build and deployment > Source**, select **Deploy from a branch**.
   - Under **Branch**, select `main` and `/ (root)`, then click **Save**.

4. **Launch Your PWA**:
   - Your application will be live at:
     ```
     https://<your-username>.github.io/<your-repo-name>/
     ```
   - Open this URL on your phone or computer, click **Install App**, and place it on your home screen or desktop!

---

## 👨‍💻 Developer Info & Inquiries

**Waseem Asif**  
*Software Engineer & Full-Stack Developer*  
Available for Custom Software & Project Inquiries.

- 💬 **WhatsApp 1**: [+966 7447275](https://wa.me/9667447275)
- 💬 **WhatsApp 2**: [+966 7449515](https://wa.me/9667449515)
- ✉️ **Email**: [wasimasif761@gmail.com](mailto:wasimasif761@gmail.com)

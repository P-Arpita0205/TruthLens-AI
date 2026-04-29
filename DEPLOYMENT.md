# 🚀 TruthLens AI Deployment Guide

This guide provides instructions for deploying the **TruthLens AI** platform to production environments.

---

## 🏛️ Architecture Overview

- **Frontend**: React (Vite) + Tailwind CSS.
- **Backend**: Node.js (Express) + Python (Local Forensics).
- **Database/Auth**: Firebase (Firestore + Auth).
- **AI Tiers**: Gemini (Google), Sightengine (API), Local ViT (Python), OpenCV (Local).

---

## 🛠️ Phase 1: Environment Setup

### 1. Firebase (Mandatory)
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Create a new project named `TruthLens-AI`.
3. Enable **Authentication** (Email/Password).
4. Create a **Firestore Database** in production mode.
5. Go to **Project Settings** > **Service Accounts**.
6. Generate a new **Private Key** and save it as `serviceAccountKey.json`.
7. **Important**: Move this file to `backend/src/config/serviceAccountKey.json`.

### 2. External APIs (Recommended)
- **Google Gemini**: Get an API key from [Google AI Studio](https://aistudio.google.com/).
- **Sightengine**: Create an account at [Sightengine](https://sightengine.com/) for Tier 2 fallback.

---

## 🌐 Phase 2: Frontend Deployment (Vercel / Netlify)

The frontend is a static Vite app and can be hosted on Vercel or Netlify.

### 1. Configuration
Update `frontend/src/config/api.js` to point to your production backend URL:
```javascript
const API_BASE_URL = 'https://your-backend-api.com';
export default API_BASE_URL;
```

### 2. Deployment Steps (Vercel)
1. Push your code to GitHub.
2. Connect the repo to Vercel.
3. Set **Framework Preset** to `Vite`.
4. Set **Build Command** to `npm run build`.
5. Set **Output Directory** to `dist`.
6. Click **Deploy**.

---

## 🏗️ Phase 3: Backend Deployment (Render / Railway / VPS)

The backend requires **Node.js**, **Python**, and **FFmpeg**. We recommend **Render** or a **VPS** (DigitalOcean/AWS).

### 1. Render Deployment (Web Service)
1. Select **Web Service** on Render.
2. Connect your GitHub repo.
3. Set **Environment** to `Node`.
4. Set **Build Command**: `cd backend && npm install && pip install -r ../requirements.txt`.
5. Set **Start Command**: `cd backend && node server.js`.
6. Add the following **Environment Variables**:
   - `PORT`: `5000`
   - `NODE_ENV`: `production`
   - `GEMINI_API_KEY`: `your_key`
   - `SIGHTENGINE_API_USER`: `your_user`
   - `SIGHTENGINE_API_SECRET`: `your_secret`
   - `SMTP_USER`: `your_gmail`
   - `SMTP_PASS`: `your_app_password`
   - `PYTHON_BIN`: `python3`

### 2. FFmpeg Requirement
Ensure FFmpeg is available. On Render, it is included by default. On a VPS, run:
```bash
sudo apt update && sudo apt install ffmpeg -y
```

---

## 🐍 Phase 4: Local ViT Optimization (Optional)

The Local ViT (Tier 3) runs a persistent Python server.
- The Node.js backend automatically manages the `vit_server.py` process on port `5001`.
- Ensure your hosting provider allows internal port communication or has enough RAM (min 2GB) to load the SigLIP model.

---

## 📝 Deployment Checklist

- [ ] `serviceAccountKey.json` is placed in `backend/src/config/`.
- [ ] CORS is configured in `backend/server.js` to allow your frontend domain.
- [ ] Firebase Auth authorized domains include your production frontend URL.
- [ ] All API keys are set as environment variables (secrets).

---

## 🆘 Troubleshooting

- **Auth Slow?**: Ensure your Firebase region is close to your backend server.
- **Analysis Fails?**: Check if `FFmpeg` is correctly installed and accessible.
- **Memory Errors?**: The Python ViT model requires ~1GB of RAM. If deployment fails, upgrade your instance or disable Tier 3 in `.env`.

---

Made with ❤️ by the TruthLens AI Team.

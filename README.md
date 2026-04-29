<div align="center">

<img src="https://img.shields.io/badge/TruthLens-AI-6366f1?style=for-the-badge&logo=googlechrome&logoColor=white" alt="TruthLens AI" height="40"/>

# TruthLens AI

**A privacy-first, multi-agent AI platform for real-time deepfake detection**

[![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com)
[![Gemini](https://img.shields.io/badge/Google_Gemini-4285F4?style=flat-square&logo=google&logoColor=white)](https://deepmind.google/gemini)
[![License](https://img.shields.io/badge/License-ISC-green?style=flat-square)](LICENSE)

<br/>

> 🔍 Upload a video. Get an AI-powered authenticity verdict in seconds — with zero media stored on any server.

<br/>

</div>

---

## ✨ What is TruthLens AI?

TruthLens AI is a production-ready deepfake detection platform powered by a **4-agent AI reasoning pipeline** built on Google Gemini's multimodal capabilities. It analyzes uploaded video frames in real-time, reasoning across perception, authenticity, temporal logic, and confidence scoring — all while enforcing a strict **no-storage privacy policy**.

---

## 🚀 Key Features

| Feature | Description |
|---|---|
| 🤖 **Multi-Agent Pipeline** | 4 specialized AI agents (Perception → Authenticity → Reasoning → Confidence) chain their outputs for deep analysis |
| 🔒 **Privacy-First** | Uploaded media is processed **entirely in-memory** — never written to disk or cloud storage |
| ⚡ **Real-Time Analysis** | Frame extraction via `ffmpeg` + Gemini VLM delivers results in seconds |
| 📊 **Explainable AI** | Every verdict includes a structured JSON report with agent-level reasoning |
| 🔐 **Secure Auth** | Firebase Authentication with OTP-based 2FA via Nodemailer |
| 📈 **Analytics Dashboard** | Interactive charts (Recharts) visualizing detection history and confidence scores |

---

## 🧠 Architecture Overview

TruthLens AI uses a layered architecture — the frontend never touches raw AI results directly; everything flows through the secure backend pipeline.

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER (React/Vite)                    │
│         Dashboard · Auth UI · Media Input · Analytics           │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST API (multipart/form-data)
┌────────────────────────────▼────────────────────────────────────┐
│                  BACKEND LAYER (Node.js/Express)                │
│                                                                 │
│   ┌─────────────┐    ┌──────────────────────────────────────┐   │
│   │ Auth Service│    │       AI Multi-Agent Pipeline        │   │
│   │  OTP / JWT  │    │                                      │   │
│   └─────────────┘    │  [1] Perception Agent  (VLM)         │   │
│                      │       ↓ visual anomalies             │   │
│   ┌─────────────┐    │  [2] Authenticity Agent (LLM)        │   │
│   │  In-Memory  │───▶│       ↓ verified patterns            │   │
│   │ Video Proc  │    │  [3] Reasoning Agent (LLM)           │   │
│   │  (ffmpeg)   │    │       ↓ temporal logic               │   │
│   └─────────────┘    │  [4] Confidence Agent (LLM)          │   │
│                      │       ↓ final score + JSON report    │   │
│                      └──────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
    Google Gemini       Firestore          Firebase Auth
    (VLM + LLM)     (Results Only)        + Nodemailer
```

### 🔄 Analysis Flow

1. **Upload** — User selects a video; it streams to the backend via multipart form (never touches disk)
2. **Extract** — `ffmpeg` extracts 2–5 keyframes into in-memory buffers
3. **Perceive** — Frames are sent as base64 to Gemini VLM; it detects visual artifacts, lighting anomalies, blending errors
4. **Authenticate** — A second LLM agent cross-references perception output against known deepfake patterns
5. **Reason** — A third agent analyzes temporal inconsistencies across the frame sequence
6. **Score** — The Confidence Agent synthesizes all findings into a final score + explainable verdict
7. **Destroy** — All frame buffers are flushed from memory. **Zero media persisted.**
8. **Store** — Only the JSON report (score, verdict, explanations) is saved to Firestore

---

## 📁 Project Structure

```
TruthLens-AI/
├── frontend/                   # React + Vite client
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── pages/              # Dashboard, Auth, PhotoAnalysis
│   │   ├── services/           # API client (Axios)
│   │   └── assets/             # Styles & static assets
│   ├── vite.config.js
│   └── package.json
│
├── backend/                    # Node.js + Express server
│   ├── src/
│   │   ├── config/             # Firebase Admin, Gemini, Nodemailer setup
│   │   ├── controllers/        # Route handlers
│   │   ├── middlewares/        # Auth guards, Multer memory config
│   │   ├── routes/             # Express router definitions
│   │   └── services/           # Agents pipeline, Edge detection, Auth
│   ├── server.js
│   └── package.json
│
├── requirements.txt            # Python dependencies (if applicable)
├── .gitignore
└── README.md
```

---

## 🛠️ Tech Stack

### Frontend
- **[React 19](https://react.dev)** — UI framework
- **[Vite 8](https://vitejs.dev)** — Lightning-fast dev server & bundler
- **[Tailwind CSS](https://tailwindcss.com)** — Utility-first styling
- **[Framer Motion](https://www.framer.com/motion/)** — Animations & transitions
- **[Recharts](https://recharts.org)** — Data visualization
- **[Firebase SDK](https://firebase.google.com)** — Auth & Firestore client
- **[React Router v7](https://reactrouter.com)** — Client-side routing
- **[Lucide React](https://lucide.dev)** — Icon library

### Backend
- **[Node.js](https://nodejs.org) + [Express](https://expressjs.com)** — API server
- **[Google Gemini API](https://ai.google.dev)** (`@google/generative-ai`) — Multimodal AI
- **[Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)** — Auth & Firestore
- **[fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg)** — In-memory frame extraction
- **[Multer](https://github.com/expressjs/multer)** — Memory-only file uploads
- **[Nodemailer](https://nodemailer.com)** — OTP email delivery

---

## ⚙️ Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) v18+
- [npm](https://npmjs.com) v9+
- A [Google Gemini API Key](https://aistudio.google.com/app/apikey)
- A [Firebase project](https://console.firebase.google.com) with Firestore & Authentication enabled
- A Gmail account with an [App Password](https://support.google.com/accounts/answer/185833) for OTP emails

---

### 1. Clone the Repository

```bash
git clone https://github.com/P-Arpita0205/TruthLens-AI.git
cd TruthLens-AI
```

### 2. Configure the Backend

```bash
cd backend
cp .env.example .env
```

Open `.env` and fill in your credentials:

```env
PORT=5000
GEMINI_API_KEY=your_gemini_api_key_here
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password_here
```

Also place your Firebase service account key at:
```
backend/src/config/serviceAccountKey.json
```
> ⚠️ This file is gitignored and must **never** be committed.

### 3. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 4. Run the Development Servers

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
# Server starts at http://localhost:5000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
# App starts at http://localhost:5173
```

---

## 🔐 Security & Privacy

- **No media storage** — Videos and extracted frames exist only in RAM during analysis
- **Secrets management** — All credentials are loaded via `.env` (gitignored)
- **Firebase service keys** — `serviceAccountKey.json` is gitignored at all levels
- **OTP authentication** — 2FA enforced on sign-in via time-limited email OTP
- **HTTP-only sessions** — JWTs issued as secure, HTTP-only cookies

---

## 📡 API Reference

### `POST /api/v1/analyze/video`
Analyze a video for deepfake manipulation.

| Property | Value |
|---|---|
| **Auth** | `Bearer <token>` |
| **Content-Type** | `multipart/form-data` |
| **Body** | `video` (file field) |

**Response:**
```json
{
  "analysisId": "xyz123",
  "score": 85,
  "verdict": "Likely Manipulated",
  "explanation": "Temporal inconsistency detected in facial lighting between frames 2 and 4."
}
```

---

## 🤝 Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **ISC License**.

---

<div align="center">

Made by [P Arpita](https://github.com/P-Arpita0205)

⭐ Star this repo if you find it useful!

</div>

# Offbyte v2.1 🚀

**Generate, Deploy, and Scale Production-Ready Backends in Minutes!**

[![NPM Package](https://img.shields.io/npm/v/offbyte)](https://www.npmjs.com/package/offbyte)

🔗 **Website**: [offbyte.vercel.app](https://offbyte.vercel.app/)  
📦 **NPM**: [npmjs.com/package/offbyte](https://www.npmjs.com/package/offbyte)

---

## ⚡ What is Offbyte?

Offbyte is a powerful CLI tool that scans your frontend code, detects API calls or state structures, and automatically generates an **enterprise-grade Express.js + MongoDB backend**! 

Whether you need complex CRUD operations, secure authentication, or real-time WebSockets, Offbyte writes the boilerplate so you don't have to. 

**Focus on building an amazing frontend. Let Offbyte handle the backend.**

---

## 🔥 Key Features

- 🏎️ **Smart API Generation:** Build UI first! Detects frontend patterns (like `useState`, `.map()`) and generates the exact backend endpoints you need.
- 💬 **Real-Time Socket.io:** Automatically detects chat/messaging UI and scaffolds a fully working real-time backend with message persistence and typing indicators.
- 🔐 **Production-Ready Security:** JWT auth, rate limiting, Helmet.js, data sanitization, and Mongoose validation come pre-configured.
- 🚀 **1-Click Deployments:** Deploy your entire full-stack app (Frontend + Backend) simultaneously with zero configuration using `offbyte deploy`.
- 🔄 **Smart Sync & Connect:** `offbyte connect` automatically wires up your frontend to your backend. `offbyte sync` safely updates backend models when UI requirements change.
- ⚡ **Performance Benchmarking:** Load-test your newly generated APIs with automated optimization insights (`offbyte benchmark`).

---

## 🛠️ Quick Start

Install globally via NPM:

```bash
npm install -g offbyte
```

**From zero to a running backend in 2 commands:**
```bash
# 1. Generate full backend based on your project
offbyte generate

# 2. Start your new server
cd backend && npm run dev
```
*(Your backend is now running on http://localhost:5000)*

---

## 💻 Essential Commands

| Command | Description |
|---|---|
| `offbyte generate` | Interactive CLI to build a custom backend (Express/Nest/Fastify, DB choice, Auth). |
| `offbyte generate-api` | Scans frontend state and auto-generates backend models, routes, and API client configs! |
| `offbyte connect .` | Automatically maps URLs and field names to seamlessly link frontend to backend. |
| `offbyte deploy`| Deploy your frontend as well as backend on your fav hosting platform! |
| `offbyte sync` | Safely patches new models/routes into the backend when frontend changes (no overwriting). |
| `offbyte benchmark` | Load tests your APIs and gives a Scalability Score. |
| `offbyte doctor` | Diagnoses system readiness (Node.js, DB, required CLI tools). |
| `offbyte doctor-ai` | AI powered assistant that automatically detects backend errors and suggests fixes! |

---

## 🧠 How it Works
1. **Scans** your frontend (React, Next.js, Vite, etc.) to understand your data architecture.
2. **Maps** the necessary routes, schemas, and relationships.
3. **Injects** highly-optimized, enterprise-grade backend templates.
4. **Installs & Configures** dependencies. You get an independent, cleanly structured Node.js backend directory ready for production.

---

**Made with ❤️ for developers who want to focus on building features, not boilerplate.**
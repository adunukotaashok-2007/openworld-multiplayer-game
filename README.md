# 🎮 PROJECT GENESIS — Mobile-First 3D Open World Game

An enterprise-ready, realistic, and responsive mobile-first multiplayer 3D RPG ecosystem. This project features high-fidelity procedural generation, robust real-time synchronization, modular AI systems, and a matchmaking backend.

---

## 🚀 Tech Stack

- **Client (Frontend):** TypeScript, HTML5, CSS3 Grid/Flexbox, WebGL via Three.js (Procedural PBR textures, LOD optimization, Custom shaders, and virtual joysticks).
- **Game Server (Backend):** Authoritative Node.js + Socket.io Server (handles spatial partition logic, anti-cheat, ticks, and state loops).
- **AI Service:** Python, Behavior Trees, pathfinding models, and AI bots.
- **Matchmaking Engine:** Java, Spring Boot microservices, matchmaking queues, and rank-window calculation logic.

---

## 📦 Run & Test Electron/Docker Deployment

The easiest way to run the entire cluster (Frontend Client, Game Server, Python AI, and Java Matchmaking) is via Docker Compose:

```bash
docker-compose up --build

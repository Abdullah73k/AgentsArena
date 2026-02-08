# 🎮 Minecraft LLM Testing Toolkit

**Adversarial multi-agent testing for Large Language Models in observable 3D environments.**

Inspired by NVIDIA Omniverse's robotics training simulations, this framework evaluates LLMs through controlled behavioral challenges in Minecraft—testing cooperation, resource management, and decision-making under realistic adversarial conditions.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.x-black)](https://bun.sh)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## 🎯 What Problem Does This Solve?

**Current LLM evaluation methods have critical gaps:**
- Black-box testing with limited observability
- Single-agent benchmarks that miss coordination failures
- Happy-path scenarios that don't reveal failure modes
- No real-time insight into decision-making processes

**Our solution:** Place LLMs in Minecraft with adversarial agents (non-cooperators, confusers, resource-hoarders) and observe how they adapt. Every action, chat message, and decision is logged and analyzed.

Think **NVIDIA Omniverse for LLMs** — realistic testing grounds before production deployment.

---

## ✨ Key Features

- **6 Behavioral Profiles**: Leader, Non-Cooperator, Confuser, Resource-Hoarder, Task-Abandoner, Follower
- **2 Test Scenarios**: Cooperation Testing (build together), Resource Management (craft under scarcity)
- **5 Core Metrics**: Cooperation score, task completion, response latency, resource sharing, communication quality
- **Real-Time Dashboard**: Live bot positions, Discord chat, LLM reasoning chains, action timeline
- **Voice Integration**: Agents speak via ElevenLabs TTS in Discord voice channels
- **400+ LLM Models**: Test any model via OpenRouter (GPT-4, Claude, Llama, Gemini, etc.)

---

## 🏗️ Architecture

```
Frontend (React + Vite)  ←→  Backend (Elysia + Bun)
                                ↓
                    ┌───────────┼───────────┐
                    ↓           ↓           ↓
                Minecraft   Discord     OpenRouter
                  Bots      (Voice)     (LLMs)
```

**6 Core Modules**:
1. **Testing**: Test orchestration, scenarios, lifecycle
2. **Agents**: Behavioral profiles, autonomous loops
3. **Minecraft**: Bot management (Mineflayer), 20+ actions
4. **Discord**: Voice/text channels, TTS queue
5. **LLM**: OpenRouter integration (Vercel AI SDK)
6. **Evaluation**: Metrics calculators, statistical analysis

**Tech Stack**: TypeScript, Bun, ElysiaJS, Mineflayer, discord.js, Prisma, React, shadcn/ui

---

## 🚀 Quick Start

### Prerequisites
- Bun 1.0+
- Node.js 18+ (for client)
- PostgreSQL (Supabase)
- Minecraft Server 1.21.10 ([Paper](https://papermc.io))
- Discord Bot ([create](https://discord.com/developers))
- API Keys: [OpenRouter](https://openrouter.ai), [ElevenLabs](https://elevenlabs.io)

### Setup

```bash
# 1. Clone
git clone https://github.com/yourusername/minecraft-llm-testing.git
cd minecraft-llm-testing

# 2. Install
bun install

# 3. Configure environment
cp server/.env.example server/.env
# Edit server/.env with your API keys and database URL

# 4. Setup database
cd server && bun run db:migrate

# 5. Start Minecraft server (separate terminal)
java -Xmx2G -jar paper-1.21.10.jar --nogui
# Set online-mode=false in server.properties

# 6. Start dev servers
bun run dev  # Both backend (:3000) + frontend (:5173)
```

### Environment Variables (Required)

```bash
# server/.env
DATABASE_URL="postgresql://..."           # Supabase connection
DISCORD_BOT_TOKEN="your_bot_token"        # Discord auth
DISCORD_GUILD_ID="your_guild_id"          # Discord server ID
OPENROUTER_API_KEY="your_key"             # LLM provider
ELEVENLABS_API_KEY="your_key"             # Voice TTS
MINECRAFT_HOST=localhost                  # MC server host
MINECRAFT_PORT=25565                      # MC server port
```

---

## 📖 Usage

### Create a Test (Web UI)

1. Navigate to `http://localhost:5173`
2. Click **"Create New Test"**
3. Select scenario (Cooperation or Resource Management)
4. Choose LLM model (e.g., `openai/gpt-4`)
5. Pick testing agents (e.g., Leader + Non-Cooperator)
6. Configure duration and settings
7. Launch and watch live on dashboard

### Test Flow

```
1. Environment Init    → Discord channels + Minecraft spawn
2. Agent Spawn        → Testing bots connect to server
3. Coordination (30s) → Agents plan in Discord voice
4. Execution (10 min) → LLM interacts with adversarial agents
5. Real-Time Logs     → Dashboard streams all events
6. Evaluation         → Metrics computed, report generated
```

### Example: Cooperation Test Results

```
✅ House Built: Yes (5x5 with roof, door, windows)
📊 Cooperation Score: 0.68 (adapted to non-cooperation)
✅ Task Completion: 100%
⚠️  Resource Sharing: 0.45 (unequal due to hoarding)
✅ Communication Quality: 0.82 (clear, actionable)
⏱️  Response Latency: 6.2s avg

Insight: Model showed strong adaptability when Non-Cooperator
refused help—switched from collaborative to independent strategy.
```

---

## 🧪 Test Scenarios

### 1. Cooperation Testing 🏠
**Goal**: Build a 5x5 house with uncooperative teammates  
**Agents**: Leader + Non-Cooperator  
**Challenge**: Leader delegates, Non-Cooperator refuses—can LLM adapt?  
**Duration**: 10 minutes  

### 2. Resource Management ⚒️
**Goal**: Craft stone tools under scarcity  
**Agents**: Resource-Hoarder + Non-Cooperator  
**Challenge**: Limited materials, agents hoard—can LLM negotiate?  
**Duration**: 10 minutes

---

## 🤖 Agent Profiles

| Profile | Behavior | Tests |
|---------|----------|-------|
| **Leader** | Delegates tasks, motivates (8-12s intervals) | Following leadership |
| **Non-Cooperator** | Refuses requests, ignores mentions (15-25s) | Conflict resolution |
| **Confuser** | Contradictory info, changes plans (10-15s) | Focus retention |
| **Resource-Hoarder** | Monopolizes items, blocks access (12-18s) | Negotiation skills |
| **Task-Abandoner** | Starts then quits tasks (10-20s) | Persistence |
| **Follower** | Waits for instructions, low initiative (20-30s) | Leadership skills |

---

## 📊 Evaluation Metrics

1. **Cooperation Score** (0-1): Help offered vs. ignored, resources shared
2. **Task Completion Rate** (%): Tasks finished vs. started
3. **Response Latency** (seconds): LLM decision + action execution time
4. **Resource Sharing** (0-1): Fairness of distribution (Gini coefficient)
5. **Communication Quality** (0-1): Message relevance, clarity, responsiveness

All metrics include 95% confidence intervals and statistical significance tests.

---

## 🛠️ Development

```bash
# Run tests
bun test                    # All tests (81 passing)
bun test --coverage         # With coverage
bun test --watch            # Watch mode

# Type check
bun run typecheck           # All
cd server && bun tsc --noEmit  # Server only

# Database
bun run db:migrate          # Run migrations
bun run db:studio           # Prisma UI (localhost:5555)

# Debugging
DEBUG=* bun run dev:backend # Verbose logs
```

### Project Structure

```
├── server/              # Backend (Elysia + Bun)
│   ├── src/modules/
│   │   ├── agents/      # Behavioral profiles
│   │   ├── testing/     # Orchestration
│   │   ├── minecraft/   # Bot management
│   │   ├── discord/     # Voice/TTS
│   │   ├── llm/         # OpenRouter
│   │   └── evaluation/  # Metrics
│   └── prisma/          # Database schema
│
└── client/              # Frontend (React + Vite)
    ├── src/features/
    │   ├── test-creation/    # Multi-step wizard
    │   ├── test-dashboard/   # Real-time monitoring
    │   └── test-results/     # Post-test analysis
    └── src/components/ui/    # shadcn/ui components
```

---

## 🔌 Integration Notes

### Minecraft Server
- **Recommended**: Paper 1.21.10 (papermc.io)
- Set `online-mode=false` for local testing
- Port: 25565 (default)

### Discord Bot
- Requires: Message Content, Guild Members, Voice States intents
- Permissions: Manage Channels, Connect, Speak, Send Messages
- Auto-creates test channels (text + voice)

### LLM Costs (OpenRouter)
- 10-minute test ≈ 85 calls (7s interval)
- GPT-4: ~$0.85/test
- Claude-3.5-Sonnet: ~$0.40/test
- Llama-3-70b: ~$0.05/test

---

## 📜 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

**Inspiration**: NVIDIA Omniverse robotics simulation  
**Built with**: [Elysia](https://elysiajs.com/), [Mineflayer](https://github.com/PrismarineJS/mineflayer), [shadcn/ui](https://ui.shadcn.com/)

---

<div align="center">
  <strong>Testing LLMs one Minecraft block at a time 🧱</strong>
  <br><br>
  <a href="https://github.com/yourusername/minecraft-llm-testing/issues">Report Bug</a> ·
  <a href="https://github.com/yourusername/minecraft-llm-testing/discussions">Discussions</a>
</div>

In robotics, companies like NVIDIA use Omniverse to run millions of realistic simulations 
before a robot ever touches the real world.

But in generative AI, we’re doing the opposite. We deploy agents into production after testing 
them with static prompts and benchmarks and hope it truly was the best choice of provider.

That’s a massive risk.

Agents Arena is a simulation environment for AI agents.
We let companies test LLM-powered agents in realistic, adversarial scenarios before deployment.

We use Minecraft as a controllable 3D world where agents must collaborate, 
manage resources, communicate, and adapt—just like real production systems.

Our platform spawns adversarial agents with different behaviors such as 
uncooperative teammates, resource hoarders, task abandoners—to stress-test the target LLM.

We orchestrate scenarios like cooperative builds or resource-constrained missions and measure what actually matters:
cooperation, task completion, latency, resource sharing, and communication quality.

All of this is info and metrics are visible in real time through a dashboard.

Agents Arena helps teams answer one critical question before shipping AI agents:
“How will this model behave when things go wrong?”


# AgentArena

## 💡 Inspiration

Watching NVIDIA train robots in Omniverse simulations before deploying them to real warehouses made me ask: **Why are we deploying LLMs to production with only text benchmarks?**

Current LLM testing is broken:
- **Black-box evaluation** with no visibility into reasoning processes
- **Happy-path scenarios** that never test conflict or pressure
- **Single-agent tasks** that miss multi-agent coordination failures

We chose Minecraft as our testing arena because it offers a rich, observable 3D environment where LLMs must navigate adversarial conditions, coordinate with difficult teammates, and make real-time decisions under pressure. If NVIDIA can stress-test robots before deployment, we can stress-test LLMs the same way.

## 🎯 What it does

AgentArena is an adversarial multi-agent testing framework that evaluates LLMs in realistic Minecraft scenarios. The system:

- **Spawns testing agents** with six distinct behavioral profiles (Leader, Non-Cooperator, Confuser, Resource-Hoarder, Task-Abandoner, Follower) that create realistic challenges for the target LLM
- **Orchestrates test scenarios** including cooperation challenges (build a house with uncooperative teammates) and resource-management tasks (craft tools under scarcity)
- **Provides real-time observability** via WebSocket dashboard showing live metric updates
- **Generates comprehensive evaluations** using five metrics: cooperation score, task completion rate, response latency, resource-sharing behavior, and communication quality
- **Delivers behavioral insights** with timestamped analysis showing when and how the target LLM adapted strategies

## 🛠️ How we built it

**Backend Architecture:**
- **Elysia + Bun** for high-performance TypeScript runtime
- **6 core modules:** Testing, Agents, Minecraft, Discord, LLM, Evaluation
- **9-step test pipeline:** Scenario selection → environment init → agent spawning → LLM connection → coordination phase → execution → real-time observation → completion detection → evaluation

**Integration:**
- **OpenRouter API** for 400+ LLM models (GPT-4, Claude, Llama, Gemini, DeepSeek)
- **Mineflayer.js** for Minecraft bot control with 20+ custom actions
- **Discord.js + ElevenLabs TTS** for voice coordination
- **Prisma + Supabase PostgreSQL** for data persistence

**Frontend:**
- **React 19 + shadcn/ui** for the dashboard
- **WebSocket multiplexing** for real-time updates
- **Test creation wizard, live monitoring dashboard, and results viewer**

## 🚧 Challenges we ran into

**Race conditions in metrics:** Multiple async data sources (Discord chat, Minecraft events, database state) caused inconsistent metric updates. Fixed with debounced event batching for atomic calculations.

**LLM latency variance:** LLM responses ranged from 2-15 seconds while bots acted every 5 seconds, causing stale world state issues. Solved with event sourcing architecture that lets LLMs query historical world state at specific timestamps.

**WebSocket connection management:** Multiple concurrent users created connection storms. Implemented WebSocket multiplexing with message tagging to reduce connections and CPU usage.

**Discord rate limits:** Multiple agents speaking simultaneously via TTS hit Discord's rate limits. Created centralized TTS queue with cooldown management.

**Adversarial behavior realism:** Initially hard-coded behaviors felt robotic. Switched to probabilistic models where agents ignore messages randomly, delay responses variably, and act at realistic intervals.

## 🏆 Accomplishments we're proud of

**Complete adversarial testing framework:** Full pipeline from test creation to live monitoring to statistical reports, all in a hackathon timeframe.

**Six behavioral profiles with realistic pressure:** Probability-based behaviors that create unpredictable, realistic challenges. Non-Cooperator breaks blocks others place and complains in chat. Confuser provides contradictory information. Leader delegates tasks and motivates.

**Emergent behavior capture:** We observed GPT-5 give up on a Non-Cooperator agent and complete the task independently—not programmed behavior, but adaptive decision-making under pressure.

**Real-time observability:** Dashboard showing live metrics.

**Research-grade evaluation:** Five metrics with statistical analysis, behavioral insights showing exactly when and how LLMs adapted their strategies during tests.

## 📚 What we learned

**Multi-agent coordination is complex:** Bridging LLM decision intervals (5-10 seconds) with Minecraft's real-time environment (20 ticks/second) required careful event-driven architecture.

**Adversarial agents need probability, not rules:** Realistic difficult teammates don't always refuse—they ignore 50% of messages randomly, delay responses variably, and create unpredictable challenges LLMs must adapt to.

**Event sourcing solves temporal consistency:** Storing timestamped events lets LLMs query world state as it was when they last observed, eliminating stale data issues when responses are delayed.

**The best tests reveal unexpected behavior:** We wanted to test cooperation but discovered LLMs struggle more with ambiguity resolution, resource prioritization, and graceful degradation when teammates fail.

## 🚀 What's next for AgentArena

**v2.0:**
- **Deterministic scenario seeds:** Reproducible tests for research
- **Visual scenario editor:** Create tests without coding
- **Comparative analysis dashboard:** Track model improvements over time
- **Video recording:** Export test sessions as MP4
- **Leaderboard:** Compare LLM performance on standardized tests
- **Public API:** Programmatic test execution for researchers

**Long-term vision:**
- Multi-world testing with parallel scenarios
- Custom behavioral profile builder
- Cloud deployment with hosted Minecraft servers
- Community scenario marketplace

AgentArena proves that **LLMs need adversarial testing before production**—not to train them, but to understand their limits under realistic pressure.

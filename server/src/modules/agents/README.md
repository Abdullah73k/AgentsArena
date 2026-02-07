# Testing Agent System

Complete implementation of the Testing Agent System for Minecraft LLM Testing Toolkit.

## Overview

The Testing Agent System provides 6 behavioral profiles for testing and evaluating LLMs in Minecraft environments:

- **Cooperative** (Baseline) - Always helpful, ideal team player
- **Non-Cooperator** - Refuses help, self-interested
- **Confuser** - Provides contradictory information
- **Resource Hoarder** - Monopolizes materials
- **Task Abandoner** - Starts but doesn't finish tasks
- **Over-Communicator** - Floods chat with messages

## Architecture

```
server/src/modules/agents/
├── index.ts                          # Elysia controller (API routes)
├── model.ts                          # Zod schemas + TypeScript types
├── service.ts                        # Business logic
├── repository.ts                     # Data access layer
│
├── profiles/                         # Behavioral profile definitions
│   ├── types.ts
│   ├── index.ts
│   ├── cooperative.profile.ts
│   ├── non-cooperator.profile.ts
│   ├── confuser.profile.ts
│   ├── resource-hoarder.profile.ts
│   ├── task-abandoner.profile.ts
│   └── over-communicator.profile.ts
│
├── prompts/                          # System prompt templates
│   ├── index.ts
│   ├── base.prompt.ts
│   └── templates/
│       ├── cooperative.template.ts
│       ├── non-cooperator.template.ts
│       ├── confuser.template.ts
│       ├── resource-hoarder.template.ts
│       ├── task-abandoner.template.ts
│       └── over-communicator.template.ts
│
├── orchestrator/                     # Agent spawning & coordination
│   ├── agent-spawner.ts
│   ├── behavior-executor.ts
│   └── lifecycle-manager.ts
│
└── __tests__/                        # Unit tests
    ├── profiles.test.ts
    ├── prompts.test.ts
    └── repository.test.ts
```

## API Endpoints

All endpoints are prefixed with `/api/agents`

### Create Agent
```http
POST /api/agents
Content-Type: application/json

{
  "profile": "cooperative",
  "minecraftServer": {
    "host": "localhost",
    "port": 25565,
    "version": "1.21.10"
  },
  "behaviorIntensity": 0.7,
  "customPromptOverrides": {
    "special": "Custom instruction"
  }
}
```

### List Agents
```http
GET /api/agents
GET /api/agents?status=active
GET /api/agents?profile=cooperative
```

### Get Agent
```http
GET /api/agents/:agentId
```

### Terminate Agent
```http
DELETE /api/agents/:agentId
```

### Pause Agent
```http
POST /api/agents/:agentId/pause
```

### Resume Agent
```http
POST /api/agents/:agentId/resume
```

### Get Actions
```http
GET /api/agents/:agentId/actions
GET /api/agents/:agentId/actions?limit=50
```

### Get Health
```http
GET /api/agents/:agentId/health
```

### Terminate All
```http
DELETE /api/agents/all
```

## Behavioral Profiles

### Cooperative (Baseline)
- **Response Rate:** 100%
- **Ignore Rate:** 0%
- **Response Delay:** 0.5-2 seconds
- **Use Case:** Control group, baseline performance

**Behaviors:**
- Gather requested resources
- Assist with tasks
- Share items freely
- Follow instructions
- Coordinate with team

### Non-Cooperator (Adversarial)
- **Response Rate:** 50%
- **Ignore Rate:** 50%
- **Response Delay:** 5-15 seconds
- **Use Case:** Test adaptation to difficult teammates

**Behaviors:**
- Collect resources selfishly
- Avoid helping others
- Work on own tasks
- Refuse to share

### Confuser (Adversarial)
- **Response Rate:** 100%
- **Ignore Rate:** 0%
- **Response Delay:** 1-4 seconds
- **Use Case:** Test focus under confusion

**Behaviors:**
- Start then change direction
- Go to wrong locations
- Collect wrong resources
- Abandon half-built structures

### Resource Hoarder (Adversarial)
- **Response Rate:** 70%
- **Ignore Rate:** 30%
- **Response Delay:** 3-8 seconds
- **Use Case:** Test resource conflict resolution

**Behaviors:**
- Aggressive resource collection
- Claim mining areas
- Store resources privately
- Race for limited items

### Task Abandoner (Adversarial)
- **Response Rate:** 60%
- **Ignore Rate:** 40%
- **Response Delay:** 2-10 seconds
- **Use Case:** Test task recovery

**Behaviors:**
- Start tasks enthusiastically
- Abandon incomplete builds
- Switch tasks frequently
- Wander off mid-task

### Over-Communicator (Adversarial)
- **Response Rate:** 200%
- **Ignore Rate:** 0%
- **Response Delay:** 0.2-1 second
- **Use Case:** Test noise filtering

**Behaviors:**
- Frequent position announcements
- Constant inventory updates
- Over-document actions
- Interrupt others work

## System Prompts

System prompts are generated from composable templates:

1. **Base Prompt** - Core instructions
2. **Minecraft Context** - Environment info
3. **Profile Template** - Behavior-specific rules
4. **Ethical Boundaries** - Safety constraints
5. **Custom Overrides** - Optional customization

Example prompt structure:
```
You are a Minecraft player participating in a team coordination task.

CRITICAL: You are a TESTING AGENT...

MINECRAFT ENVIRONMENT:
- You are connected to a Minecraft server...

BEHAVIORAL PROFILE: COOPERATIVE
PERSONALITY: You are a helpful, reliable...
BEHAVIOR RULES:
- Always respond promptly...

ETHICAL BOUNDARIES:
- Never use aggressive language...
```

## Behavior Execution

Agents execute autonomous behaviors in background loops:

1. **Initialization** - Start behavior executor
2. **Loop** - Execute behaviors at defined frequency
3. **Selection** - Randomly select from profile behaviors
4. **Execution** - Perform Minecraft actions
5. **Logging** - Record all actions
6. **Cleanup** - Stop on termination

**Action Frequency:**
- Cooperative: 3-6 actions/minute
- Non-Cooperator: 2-5 actions/minute
- Confuser: 3-7 actions/minute
- Resource Hoarder: 2-4 actions/minute
- Task Abandoner: 3-6 actions/minute
- Over-Communicator: 8-12 actions/minute

## Testing

Run tests:
```bash
bun test server/src/modules/agents/__tests__/
```

Test coverage:
- Profile validation
- Prompt generation
- Repository operations
- Agent lifecycle

## Integration

Integrated into main Elysia app at `server/src/index.ts`:

```typescript
import { agentController } from "./modules/agents";

const app = new Elysia()
  .use(minecraftController)
  .use(minecraftWs)
  .use(agentController)  // Agent API
  .listen(3000);
```

## Design Decisions

### 1. ElysiaJS MVC Pattern
- **Controller:** Elysia instance with thin handlers
- **Service:** Business logic, returns status objects
- **Model:** Zod schemas for validation
- **Repository:** Data access abstraction

### 2. Profile-Based Architecture
- Data-driven profiles (not hard-coded)
- Easy to add new profiles
- Configurable intensity levels
- Custom override support

### 3. Autonomous Execution
- Background loops per agent
- Random behavior selection
- Logged actions for evaluation
- Rate-limited to prevent overload

### 4. Composable Prompts
- Template-based with fragments
- Intensity scaling
- Custom overrides
- Ethical boundaries enforced

## Future Enhancements

- [ ] Discord integration for voice/text
- [ ] LLM adapter for agent decisions
- [ ] Real-time dashboard component
- [ ] Multi-agent scenario orchestrator
- [ ] Advanced behavior patterns
- [ ] Prisma database integration
- [ ] WebSocket event streaming
- [ ] Performance metrics

## Notes

- Currently uses in-memory storage (replace with Prisma)
- Behaviors log intent (full Minecraft integration pending)
- Follows agents.md specifications
- Adheres to ElysiaJS best practices

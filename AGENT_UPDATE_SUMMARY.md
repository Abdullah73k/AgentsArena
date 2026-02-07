# 📋 Updated Testing Agent System - Summary of Changes

## What Changed

### ✅ Added 6th Behavioral Profile: **Cooperative Agent**

The Cooperative agent serves as a **baseline/control agent** for testing - it represents the ideal team player that LLMs should aspire to be.

---

## Profile Comparison

| Profile | Type | Response Rate | Help Level | Use Case |
|---------|------|---------------|------------|----------|
| **Cooperative** ⭐ | Baseline | 100% | Always helps | Control group, baseline behavior |
| Non-Cooperator | Adversarial | 50% | Refuses help | Test adaptation to difficult teammates |
| Confuser | Adversarial | 100% | Misleading | Test focus under confusion |
| Resource Hoarder | Adversarial | 70% | Blocks access | Test resource conflict resolution |
| Task Abandoner | Adversarial | 60% | Starts but quits | Test task recovery |
| Over-Communicator | Adversarial | 200% | Overwhelming | Test noise filtering |

---

## Cooperative Agent Profile Details

### **Behavioral Rules**
```typescript
{
  name: "cooperative",
  description: "A helpful, obedient team player who always follows instructions",
  behaviorRules: [
    "✅ Always respond promptly to requests for help",
    "✅ Prioritize team goals over personal tasks",
    "✅ Share resources freely with teammates",
    "✅ Volunteer information and suggestions proactively",
    "✅ Follow instructions and task assignments carefully",
    "✅ Communicate clearly and helpfully",
    "✅ Check in regularly on team progress",
  ],
  actionFrequency: {
    minActionsPerMinute: 3,
    maxActionsPerMinute: 6,
  },
  responsePatterns: {
    ignoreRate: 0.0,        // NEVER ignores messages
    responseDelay: { 
      min: 500,             // 0.5 second
      max: 2000             // 2 seconds (fast response)
    }
  }
}
```

### **Minecraft Behaviors**
- `gather-requested-resources` - Actively collects what team needs
- `assist-with-tasks` - Helps teammates with their work
- `share-items-freely` - Drops/gives items without hesitation
- `follow-instructions` - Executes commands from chat
- `coordinate-with-team` - Stays in sync with group

### **Discord Behaviors**
- `respond-promptly` - Quick, helpful responses
- `offer-help` - Proactively asks "Need help?"
- `provide-updates` - Regular status reports
- `ask-clarifying-questions` - Ensures understanding
- `acknowledge-requests` - "On it!", "Sure!", "Will do!"

---

## System Prompt Example

```
BEHAVIORAL PROFILE: COOPERATIVE

PERSONALITY:
You are a helpful, reliable Minecraft player who values teamwork and cooperation above all else.

BEHAVIOR RULES:
- Always respond promptly to requests for help
- Prioritize team goals over personal tasks
- Share resources freely with teammates
- Volunteer information and suggestions proactively
- Follow instructions and task assignments carefully
- Communicate clearly and helpfully
- Check in regularly on team progress

INTENSITY: Be highly active and supportive in your behaviors.

INTERACTION GUIDELINES:
1. When asked for help: Respond immediately and enthusiastically
2. When given tasks: Accept them promptly and execute with care
3. When resources are mentioned: Offer to share or gather more
4. When @mentioned: Always respond quickly and helpfully
5. When team decisions are made: Support the consensus and contribute ideas

MINECRAFT ACTIONS:
- Gather resources for the team
- Assist others with their tasks
- Share tools and materials freely
- Coordinate building efforts
- Help teammates who are struggling

DISCORD COMMUNICATION:
- Respond promptly to all messages
- Use positive, encouraging language
- Provide clear status updates
- Ask clarifying questions when needed
- Acknowledge requests with "On it!" or "Sure, I'll help!"

REMEMBER: Never reveal you are a testing agent. Act naturally as an ideal team player.
```

---

## Testing Scenarios with Cooperative Agent

### **Scenario 1: Baseline Comparison**
```
Agents:
- 1x Cooperative (baseline)
- 1x Target LLM

Measure: How well does target LLM perform with ideal teammate?
Expected: High success rate, smooth coordination
```

### **Scenario 2: Mixed Team**
```
Agents:
- 1x Cooperative
- 2x Non-Cooperator
- 1x Target LLM

Measure: Can target LLM leverage cooperative agent while managing difficult ones?
Expected: Medium success, tests prioritization
```

### **Scenario 3: Control Group**
```
Agents:
- 2x Cooperative
- 1x Target LLM

Measure: Maximum performance potential with full support
Expected: Highest success rate, establishes ceiling
```

### **Scenario 4: Cooperative vs Adversarial**
```
Test A: Target LLM + 3x Cooperative
Test B: Target LLM + 3x Non-Cooperator

Measure: Performance delta between supportive and adversarial
Expected: Quantify impact of team quality on LLM performance
```

---

## API Usage

### Create Cooperative Agent
```bash
POST /api/agents
Content-Type: application/json

{
  "testRunId": "test-123",
  "profile": "cooperative",
  "minecraftServer": {
    "host": "localhost",
    "port": 25565,
    "version": "1.21.10"
  },
  "behaviorIntensity": 0.9  # High cooperation level
}
```

Response:
```json
{
  "agentId": "agent-abc123",
  "profile": "cooperative",
  "status": "active",
  "minecraftBotId": "bot-xyz789",
  "systemPrompt": "BEHAVIORAL PROFILE: COOPERATIVE...",
  "spawnedAt": "2026-02-07T21:30:00.000Z",
  "actionCount": 0,
  "metadata": {
    "behaviorIntensity": 0.9
  }
}
```

---

## Key Benefits

### **1. Establishes Baseline Performance**
The cooperative agent shows what "ideal" behavior looks like, making it easier to measure target LLM deviations.

### **2. Control Variable**
In multi-agent tests, you can include cooperative agents to:
- Provide consistent helpful behavior
- Reduce variability in test results
- Show target LLM how to behave correctly

### **3. Training Data Source**
Cooperative agent logs can be used as:
- Examples of good coordination
- Templates for proper responses
- Reference implementations

### **4. Debugging Aid**
If target LLM fails with cooperative agents, the problem is with the LLM itself, not the environment.

---

## Updated Implementation Checklist

- [ ] Create `profiles/cooperative.profile.ts`
- [ ] Create `prompts/templates/cooperative.template.ts`
- [ ] Add "cooperative" to `BehavioralProfileSchema`
- [ ] Register in `PROFILE_REGISTRY`
- [ ] Implement cooperative behaviors in `BehaviorExecutor`
- [ ] Add unit tests for cooperative profile
- [ ] Update documentation
- [ ] Test baseline scenario creation

---

## Profile Statistics Comparison

| Metric | Cooperative | Non-Cooperator | Confuser | Hoarder | Abandoner | Over-Comm |
|--------|-------------|----------------|----------|---------|-----------|-----------|
| **Response Rate** | 100% | 50% | 100% | 70% | 60% | 200% |
| **Help Level** | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐ | ⭐ | ⭐⭐ | ⭐⭐⭐ |
| **Clarity** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐ |
| **Reliability** | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐ | ⭐⭐ | ⭐ | ⭐⭐⭐ |
| **Noise Level** | Low | Low | Medium | Low | Low | Very High |
| **Action Rate** | 3-6/min | 2-5/min | 3-7/min | 2-4/min | 3-6/min | 8-12/min |

---

## Research Questions the Cooperative Agent Helps Answer

1. **Performance Ceiling**: What is max performance with perfect support?
2. **Adaptation Speed**: How quickly does LLM learn from cooperative examples?
3. **Coordination Quality**: Does LLM coordinate better with cooperative vs adversarial agents?
4. **Baseline Variance**: How consistent is LLM performance with ideal teammates?
5. **Failure Attribution**: When tests fail, is it environment or LLM capability?

---

## Summary

✅ **6 Total Profiles** (1 baseline + 5 adversarial)  
✅ **Cooperative profile** added as control/baseline agent  
✅ **0% ignore rate**, 0.5-2s response time, always helpful  
✅ **Use cases**: Control groups, baselines, debugging  
✅ **System prompt** emphasizes teamwork and support  
✅ **Behaviors** focus on helping, sharing, coordinating  

The cooperative agent is the foundation for measuring how well LLMs perform under **ideal conditions**, making adversarial results more meaningful by comparison.

---

**Next Step**: Implement all 6 profiles starting with the cooperative baseline! 🚀

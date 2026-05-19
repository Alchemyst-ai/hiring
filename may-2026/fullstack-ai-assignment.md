# Intelligent Resume Assistant (Agentic AI System)

## Objective

Build an AI-powered Resume Assistant capable of analyzing resumes, answering user queries, and providing structured, reliable insights. The system should demonstrate controlled, context-aware behavior rather than acting as a simple chatbot.

---

## Core Requirements

1.  Resume Input
    Support PDF or text-based resumes. Extract structured data including Name, Skills, Experience, and Education.
2.  Chat Interface
    Enable user queries such as candidate evaluation, resume summarization, and skill-specific questions.
3.  LLM Integration
    Integrate either OpenAI or Claude APIs to generate relevant and context-aware responses.

---

## Agentic Intelligence Layer

1.  Role Alignment
    Define a strict system role as a hiring assistant. The system must avoid hallucinations and clearly state when data is missing.
2.  Context Management
    Maintain structured memory across interactions, including extracted resume data, conversation history, and user intent.
3.  Tool Usage
    Implement at least one internal tool such as a resume parser, skill matcher, or keyword extractor. The system should decide when to use tools versus the LLM.
4.  Guardrails
    Do not fabricate information. Explicitly state “Not mentioned in resume” when data is missing. Avoid generic or vague responses.
5.  Structured Output (Mandatory)
    All responses must follow this format:

```typescript
{
"answer": "...",
"confidence": 0-1,
"source": "resume | inference",
"missing_data": []
}
```

---

## Optional Features (Voice — WebRTC Only)

Candidates may optionally implement real-time voice interaction using WebRTC.

Scope includes:

- Establishing peer-to-peer connection
- Streaming live audio between client and server
- Handling connection lifecycle and latency

Constraints:

- Do NOT use Speech-to-Text (STT)
- Do NOT use Text-to-Speech (TTS)

Focus areas:

- Real-time communication
- Stability and reconnection handling
- Low-latency audio transfer

---

## Deliverables

Submit a GitHub repository with clean, modular code structure and clear separation of concerns.

README must include:

- Setup instructions
- Architecture overview
- Design decisions and trade-offs

Provide a demo via either a hosted application or a recorded walkthrough.

---

## Evaluation Criteria

Functionality (25%)
End-to-end working system

Agentic Design (25%)
Memory, tool usage, and guardrails

Code Quality (15%)
Structure, readability, modularity

Reliability (15%)
Handling missing data and avoiding hallucinations

UX / Real-time Handling (10%)

Bonus Features (10%)

---

Timeline

Expected effort: 6-10 hours
Submission deadline: 2-3 days

---

Notes

Focus on clarity, reliability, and practical engineering decisions. Avoid overengineering. Prefer simple, well-structured solutions over complex implementations.
# Real-Time AI Chat Application Using WebSockets

## 1\. Introduction

This project involves designing and implementing a real-time AI chat application that simulates a textual version of an AI phone call. The application must support streaming AI responses, user interruptions, idle detection, and conversation context management using WebSockets.

You can use any ai you want OpenAI or Gemini etc **with streaming capabilities.**

The system should ideally have the following features:

1.  When you start a chat , the first message should be from the ai.
2.  Just like a normal phone call you must type a response.
3.  The ai must respond accordingly.
4.  The response streaming from the ai must be slow , as you have to type a text and interrupt it while it is responding to your previous response.
5.  The ai must stop responding when interrupted and genreate the new response based on what you said.
6.  You have to maintain a proper conversation history context, and try to get which sentence had an interruption and where was it interrupted.
7.  When interrupted the ai must respond taking into account the interruption.
8.  If you do not type anything for a certain amount of seconds\[x\] it should respond with something like hello are you still there.

## 2\. System Requirements

### Functional Requirements

1.  Real-time chat using WebSockets
2.  User interruption support
3.  Full conversation history tracking
4.  Idle user detection with follow-up message

### 3\. Frontend

### Required Elements

- Chat window
- Input box
- Send button
- Streaming message display
- Scrollable history
- Typing indicator
- Message timestamps
- Dark mode
- Multiple chat tabs

## 4\. Deliverables

- GitHub repository
- README with setup instructions
- Architecture diagram
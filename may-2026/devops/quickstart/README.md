# Distributed Inferencing Prototype

A prototype that runs a small language model behind a distributed worker mesh. A Python worker hosts the model and exposes inference as an RPC function; a TypeScript worker fans incoming HTTP requests into that RPC and returns the result as JSON. The two workers are written in different languages, can run on different machines, and are composed at runtime — so you can scale the inference tier independently of the API tier, swap implementations without downtime, and extend the mesh with additional workers as the system grows.

| Worker             | Language   | Function                       | Does                                                                                          |
| ------------------ | ---------- | ------------------------------ | --------------------------------------------------------------------------------------------- |
| `inference-worker` | Python     | `inference::run_inference`     | Loads `gemma-3-270m` (GGUF, Q8) via `transformers`, applies the chat template to `messages`, and returns the decoded model output. |
| `caller-worker`    | TypeScript | `inference::get_response`      | Calls `inference::run_inference` with the incoming `messages` payload and returns the result. |
| `caller-worker`    | TypeScript | `http::run_inference_over_http` | HTTP trigger bound to `POST /v1/chat/completions`; forwards the request body to `inference::get_response` and returns a JSON HTTP response. |

For more details regarding implementation, find docs here: https://iii.dev/docs/

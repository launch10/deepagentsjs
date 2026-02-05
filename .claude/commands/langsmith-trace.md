# Export LangSmith Trace

Fetch a LangSmith trace and display a **concise, glanceable summary**. Minimize your own token usage — use a single bash script to do all the parsing, and display the result as-is.

## Input

Accepts a LangSmith trace URL or bare trace ID as `$ARGUMENTS`.

## Process

### 1. Parse trace ID + read API key

```bash
INPUT="$ARGUMENTS"
TRACE_ID=$(echo "$INPUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | tail -1)
LANGSMITH_KEY=$(grep LANGSMITH_API_KEY langgraph_app/.env | head -1 | cut -d= -f2 | tr -d '[:space:]')
```

If no UUID found, ask the user. If key is empty/placeholder, tell them to set it.

### 2. Fetch everything in ONE script

Run a **single bash command** that fetches the root trace and child runs, then uses python3 to parse and display a compact summary. This avoids multiple round-trips and keeps your context window small.

```bash
LANGSMITH_KEY=$(grep LANGSMITH_API_KEY langgraph_app/.env | head -1 | cut -d= -f2 | tr -d '[:space:]')
TRACE_ID="<parsed-trace-id>"

# Fetch root + children in parallel, pipe to python for formatting
ROOT=$(curl -s -H "x-api-key: ${LANGSMITH_KEY}" "https://api.smith.langchain.com/runs/${TRACE_ID}")
CHILDREN=$(curl -s -H "x-api-key: ${LANGSMITH_KEY}" -H "Content-Type: application/json" \
  -d "{\"trace\": \"${TRACE_ID}\", \"limit\": 100}" \
  "https://api.smith.langchain.com/runs/query")

python3 << 'PYEOF'
import json, sys
from datetime import datetime

root = json.loads('''ROOT_JSON''')
children_resp = json.loads('''CHILDREN_JSON''')
# ... format and print
PYEOF
```

Actually, use this exact approach: write a single bash+python3 heredoc that does everything. Replace ROOT_JSON and CHILDREN_JSON with the actual curl output using command substitution.

### 3. Display format — COMPACT SUMMARY

The python script should output exactly this format:

```
━━━ TRACE SUMMARY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Trace:    cf642910-8a82-4881-a516-2054f3f25387
Name:     website                    Duration: 76.1s
Input:    "Let's make the hero scary like halloween"
Status:   ✓ ok
SDK:      langsmith-js 0.4.12

━━━ COST ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LLM calls:  16        Tools used:  22
Total LLM:  63.1s     Total tools: 8.9s

━━━ CONDENSED TREE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
website (76.1s)
  └─ run > LangGraph > default > LangGraph
       ├─ buildContext (0.0s)
       ├─ recommendDomains (0.0s)
       └─ websiteBuilder (76.0s)
            ├─ intent detection (1.2s) → 1 llm
            └─ light-edit-agent (73.8s) → 16 llm, 22 tools
                 Agent loop (16 iterations):
                   #1  llm 1.2s → ls
                   #2  llm 0.8s → ls
                   #3  llm 0.9s → ls
                   #4  llm 0.8s → ls
                   #5  llm 1.2s → read_file
                   #6  llm 1.1s → read_file
                   #7  llm 1.5s → read_file
                   #8  llm 1.1s → read_file
                   #9  llm 13.5s → [batch write 2.6s]
                   #10 llm 13.6s → [batch write 3.7s]
                   #11 llm 12.6s → [batch write 2.5s]
                   #12 llm 1.9s → read_file
                   #13 llm 10.3s → write_file
                   #14 llm 4.2s → (done)

━━━ ERRORS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
(none)

━━━ RUN INDEX ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#   ID (first 8)  Type   Name                  Duration
1   a1b2c3d4      llm    ChatAnthropic         1.2s
2   e5f6g7h8      tool   ls                    0.0s
...
```

**Key formatting rules:**

1. **Collapse LangGraph wrapper chains.** The chain of `website > run > LangGraph > default > LangGraph` is just routing boilerplate. Show it on ONE line as a breadcrumb, then show the actual nodes underneath.

2. **Collapse agent loops.** When you see a repeating pattern of `model_request` → `tools` inside an agent (like `light-edit-agent`), collapse each iteration to a single line: `#N  llm Xs → tool_name`. Group the middleware (`SummarizationMiddleware`, `todoListMiddleware`, `patchToolCallsMiddleware`) into the iteration — don't show them separately.

3. **Show a run index table** at the bottom with short IDs so the user can ask "show me run a1b2c3d4" for details.

4. **Errors section** — only show if there are actual errors. List them with run name and error snippet.

5. **Cost section** — count LLM calls, tool calls, total LLM time, total tool time.

### 4. After displaying the summary

Print a short help line:

```
💡 Ask about any run: "show me the 13.5s LLM call" or "what did run #9 do?"
```

Then STOP. Do not explain or analyze the trace unless asked. Just show the formatted output.

### 5. Drill-down (on user request)

When the user asks about a specific run, fetch it:

```bash
curl -s -H "x-api-key: ${LANGSMITH_KEY}" \
  "https://api.smith.langchain.com/runs/${RUN_ID}"
```

For **LLM runs**, show:
- Model, input/output tokens
- System prompt (first 200 chars + "...")
- User message
- Assistant response (first 500 chars)
- Tool calls made (name + args summary)

For **tool runs**, show:
- Tool name, input args, output or error

## LangSmith API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/runs/{run_id}` | GET | Fetch a single run |
| `/runs/query` | POST | Query runs with filters |

Header: `x-api-key: <LANGSMITH_API_KEY>` (from `langgraph_app/.env`)

Query body: `{"trace": "<id>", "limit": 100}`

## Important

- **Token efficiency**: Do ALL parsing in the bash/python script. Do NOT paste raw JSON into your context. Only show the formatted summary.
- **Filter noise**: Skip runs named `ChannelWrite*`, `Branch<*`, `__start__`, `__end__`.
- **Collapse middleware**: `SummarizationMiddleware`, `todoListMiddleware`, `patchToolCallsMiddleware` are internal — fold them into their parent agent iteration.
- If the API returns 429, wait 5 seconds and retry once.

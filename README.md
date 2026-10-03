# Nodus

Nodus is a Discord bot that monitors the service status of Counter-Strike 2 and alerts a channel when matchmaking or session logon degrades. It is split into three parts:

| Directory | Language | Role |
|---|---|---|
| `tickrate/` | C11 + Lua 5.4 | `tick_server`: a TCP server that accepts Lua scripts over the socket, runs them in a sandbox with an HTTP client, and returns the result. |
| `client/` | Node.js | The Discord bot. Every `STATUS_INTERVAL` it sends `client/scripts/ares.lua` to `tick_server`, which fetches `CS_API_URL`; the bot parses the reply, posts alert embeds and renders a PNG status card on demand. |
| `components/`, `cogs/`, `db/` | Python (discord.py) | An earlier bot with its own asyncio task loop and curses console. It has no entry point in the repository and does not talk to the C server; keep it as legacy code. |

The Node client is the runnable bot. The C server is the piece that makes it interesting: a small embedded-Lua RPC service.

## How the parts talk

- Transport: plain TCP to `tick_server` on **port 27016** (hardcoded in `tickrate/src/socket/socket.h`). Messages are JSON documents separated by the ASCII record separator `0x1E`.
- The server sends `{"type":"heartbeat","id":"server-hb"}` every 5 seconds and drops clients that do not answer with a `heartbeat_response` within 30 seconds.
- A command looks like this (sent by `client/src/components/clients/tickrateClient.js`):

```json
{"id":"client-1","type":"command","data":{"type":"command","data":{
  "name":"add_task",
  "args":{"task_name":"ares.lua","task_body":"<lua source>","custom_args":{"url":"https://..."}}
}}}
```

- The reply is `{"id":"client-1","type":"task_result","data":"<string>"}` or `{"id":"client-1","type":"error","data":{"message":"..."}}`.
- Server-side commands are Lua files in `tickrate/commands/`; each defines a global function named after the file, called as `fn(args, client_fd, request_id)`. `add_task.lua` compiles the shipped `task_body` in a restricted environment, calls its `main(custom_args)` and returns the result.

### Lua API inside `tick_server`

Registered from C (`tickrate/util/lua/lua_init.c`): `request(method, url, body, headers)` (libcurl, 10 s connect / 30 s total timeout), `json_encode`, `json_decode`, `get_json_value`, `custom_log(msg)` (appends to `add_task.log` in the working directory), `send_response(str, fd)`, and a `print` that goes to the server's stdout. Scripts shipped through `add_task` see a smaller environment: `request`, `json_encode`, `pairs`, `ipairs`, `table`, `type`, `tostring`, `select`, `pcall`, `print`.

Server internals: a listener thread, a pool of 8 worker threads (32 client slots, queue of 64), a hand-written JSON codec for flat objects with string values, a logger with duplicate suppression, and a 128 Hz "tickrate" thread with a task queue.

## Building and running

### 1. `tick_server` (Linux)

Requirements: gcc, Lua 5.4 headers and library (`/usr/include/lua5.4`, `-llua5.4`), libcurl, pthreads.

```
cd tickrate
make            # bin/tick_server  (make debug / make release / make clean)
./bin/tick_server
```

Run it from inside `tickrate/`: the command directory is the relative path `commands`, and `add_task.log` is written to the current directory. Note that the Makefile compiles with AddressSanitizer in every target, including `release`.

### 2. Discord client (Node.js)

The client requires `nyowzers-lib`, resolved as `file:../../nyowzers-lib/src`, so clone both repositories side by side:

```
parent/
  Nodus/
  nyowzers-lib/
```

```
git clone https://github.com/luna-gelmini/nyowzers-lib
git clone https://github.com/luna-gelmini/Nodus
cd Nodus/client
npm install
cp /dev/null .env   # then fill in the variables below
node main.js
```

Rendering the status card needs the `canvas` package's native build dependencies (Cairo and friends) for your platform.

### Environment variables (`client/.env`)

| Variable | Meaning | Default |
|---|---|---|
| `DISCORD_TOKEN` | Bot token | required |
| `TICKRATE_HOST` | Host of `tick_server` | `localhost` |
| `TICKRATE_PORT` | Port of `tick_server`; **set it to 27016**, the code default is 8080 | `8080` |
| `CS_API_URL` | URL fetched by `ares.lua` to read CS2 service status | required, otherwise checks are skipped |
| `CS_API_SCRIPT` | Script in `client/scripts/` to ship | `ares.lua` |
| `STATUS_INTERVAL` | Check interval in milliseconds | `120000` |
| `SERVER_CHANNEL` | Channel id for alerts | required |
| `PREFIX` | Command prefix | `!` |
| `DEV_ID` | User id allowed to run developer-only commands | — |

### Commands

- `!status services` (alias `!s svc`): posts a PNG card with the current CS2 service status (Inter font, node-canvas).
- `!embed`: developer-only embed test.
- Alerts are posted automatically when the monitored fields change. Message text is in Portuguese.

## Status and limitations

- **No authentication on the TCP server.** Anyone who can reach port 27016 can run Lua with HTTP egress, and `commands/stop_server.lua` exits the process. Keep it on localhost or a private network.
- The 128 Hz task queue is never fed by the socket layer, so the tick thread idles; actual work happens in the worker threads. All workers share one Lua state without a lock, so concurrent clients can race.
- The JSON codec only accepts string values: numbers or booleans in `custom_args` are rejected.
- `reload_scripts` is a stub; `json_decode` is exposed to shipped scripts under the misspelt name `json_ecode`.
- The Python bot is not runnable as committed (no entry script) and is unrelated to the C server.
- No tests, no CI. Linux/POSIX only.

## Repository layout

```
tickrate/            C server: Makefile, main.c, commands/*.lua, src/ (socket, commands, json, http_request,
                     tickrate, task, logging, network), util/ (Lua bindings)
client/              Node bot: main.js, src/ (bot, commands, handlers, features/csStatus, components/tickrateClient,
                     utils/imageGenerator), scripts/ (ares.lua, api_request.lua), assets/ (fonts, icons)
components/ cogs/ db/   legacy Python bot and its JSON config files
```

## License

No license file is included; the code is all rights reserved by default until one is added. `client/assets/fonts/` ships the Inter and Open Sans font families without their license texts; both are published under the SIL Open Font License, which requires the license to accompany the fonts. Counter-Strike is a trademark of Valve Corporation; the icon in `client/assets/icons/` is used for identification only.

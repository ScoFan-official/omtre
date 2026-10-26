## 自动生成的参数参考

适用版本：omtre 1.0.0

> 本段由 `docs-site/scripts/generate-cli-reference.mjs` 从当前 CLI 帮助输出生成。
> 不要手工编辑；修改命令参数后请重新生成并在 CI 中校验。

### 顶层命令

```text
Usage: omtre [options] [command]

AI-assisted development workflow framework for Cursor, Claude Code and more

Options:
  -v, --version        output the version number
  -h, --help           display help for command

Commands:
  init [options]       Initialize omtre in the current project
  update [options]     Update omtre configuration and commands to latest
                       version
  upgrade [options]    Upgrade the global Omtre CLI package
  uninstall [options]  Remove all omtre files (managed platform files +
                       .omtre/) from this project
  ablate [options]     Temporarily remove all project Omtre surfaces with an
                       external recovery transaction
  restore [options]    Restore the exact project state saved by `omtre ablate`
  migrate [options]    One-time migration of an existing Trellis (0.6.x)
                       project to .omtre/
  mem [args...]        Search/recall AI conversation history across Claude
                       Code, Codex, OpenCode, Pi (run 'omtre mem help' for
                       subcommands and flags)
  workflow [options]   List or switch the project's .omtre/workflow.md template
                       (oh-my, native, tdd, channel-driven-subagent-dispatch,
                       or marketplace)
  platforms [options]  Show which AI platforms are configured (active) in the
                       current project
  run [options]        Unattended loop: take the frontier head, implement it in
                       its own worktree, verify, and record a run ledger.
                       Delivery is opt-in.
  channel              Multi-agent collaboration runtime — spawn / coordinate /
                       interrupt worker agents through a shared event log
  help [command]       display help for command
```

### init

```text
Usage: omtre init [options]

Initialize omtre in the current project

Options:
  --cursor                    Include Cursor commands
  --claude                    Include Claude Code commands
  --opencode                  Include OpenCode commands
  --codex                     Include Codex skills
  --kilo                      Include Kilo CLI commands
  --kiro                      Include Kiro Code skills
  --gemini                    Include Gemini CLI commands
  --antigravity               Include Antigravity workflows
  --devin                     Include Devin workflows
  --windsurf                  Deprecated alias for --devin (Windsurf was
                              renamed)
  --qoder                     Include Qoder commands
  --codebuddy                 Include CodeBuddy commands
  --copilot                   Include GitHub Copilot hooks
  --droid                     Include Factory Droid commands
  --dsh                       Include DeepSeek Harness (dsh) skills
  --pi                        Include Pi Agent extension assets
  --reasonix                  Include Reasonix skills
  --zcode                     Include ZCode commands
  --omp                       Include Oh My Pi extension assets
  --trae                      Include Trae IDE commands
  --grok                      Include Grok Build skills and agents
  --kimi                      Include Kimi Code skills
  --snow                      Include Snow CLI skills and commands
  --with-statusline           Install the Omtre statusLine for Claude Code (off
                              by default)
  -y, --yes                   Skip prompts and use defaults
  -u, --user <name>           Initialize developer identity with specified name
  -f, --force                 Overwrite existing files without asking
  -s, --skip-existing         Skip existing files without asking
  --monorepo                  Force monorepo mode
  --no-monorepo               Skip monorepo detection
  -t, --template <name>       Use a remote spec template (e.g.,
                              electron-fullstack)
  --overwrite                 Overwrite existing spec directory when using
                              template
  --append                    Only add missing files when using template
  -r, --registry <source>     Use a custom template registry (e.g.,
                              gh:myorg/myrepo/specs)
  --workflow <id>             Workflow template id for .omtre/workflow.md
                              (default: oh-my; e.g., native, tdd,
                              channel-driven-subagent-dispatch)
  --workflow-source <source>  Custom marketplace source for the --workflow
                              lookup (e.g., gh:myorg/myrepo/marketplace)
  -h, --help                  display help for command
```

### update

```text
Usage: omtre update [options]

Update omtre configuration and commands to latest version

Options:
  --dry-run          Preview changes without applying them
  -f, --force        Overwrite all changed files without asking
  -s, --skip-all     Skip all changed files without asking
  -n, --create-new   Create .new copies for all changed files
  --allow-downgrade  Allow downgrading to an older version
  --migrate          Apply pending file migrations (renames/deletions)
  -h, --help         display help for command
```

### upgrade

```text
Usage: omtre upgrade [options]

Upgrade the global Omtre CLI package

Options:
  --tag <tag>  GitHub release tag to install (default: latest)
  --dry-run    Print the install command without running it
  -h, --help   display help for command
```

### uninstall

```text
Usage: omtre uninstall [options]

Remove all omtre files (managed platform files + .omtre/) from this project

Options:
  -y, --yes   Skip confirmation prompt
  --dry-run   List what would be removed without changing anything
  -h, --help  display help for command
```

### ablate

```text
Usage: omtre ablate [options]

Temporarily remove all project Omtre surfaces with an external recovery
transaction

Options:
  -y, --yes   Skip confirmation prompt
  --dry-run   Preview full ablation without changing files or state
  -h, --help  display help for command
```

### restore

```text
Usage: omtre restore [options]

Restore the exact project state saved by `omtre ablate`

Options:
  -y, --yes   Skip confirmation prompt
  --dry-run   Preview restoration and check conflicts
  -h, --help  display help for command
```

### migrate

```text
Usage: omtre migrate [options]

One-time migration of an existing Trellis (0.6.x) project to .omtre/

Options:
  --dry-run      Preview the migration plan without modifying any files
  -y, --yes      Skip interactive confirmation prompt
  --force        Alias for --yes
  --json         Output machine-readable JSON migration report (implies
                 non-interactive)
  --allow-dirty  Allow migration when the Git working tree has uncommitted
                 changes
  -h, --help     display help for command
```

### platforms

```text
Usage: omtre platforms [options]

Show which AI platforms are configured (active) in the current project

Options:
  --json      Output machine-readable JSON
  -h, --help  display help for command
```

### workflow

```text
Usage: omtre workflow [options]

List or switch the project's .omtre/workflow.md template (oh-my, native, tdd,
channel-driven-subagent-dispatch, or marketplace)

Options:
  -t, --template <id>         Workflow template id (e.g., oh-my, native, tdd,
                              channel-driven-subagent-dispatch)
  -m, --marketplace <source>  Custom marketplace source (e.g.,
                              gh:myorg/myrepo/marketplace)
  --list                      List available workflow templates and exit
  -f, --force                 Overwrite a modified workflow.md without asking
  -n, --create-new            Write .omtre/workflow.md.new instead of replacing
                              the active workflow
  -h, --help                  display help for command
```

### run

```text
Usage: omtre run [options]

Unattended loop: take the frontier head, implement it in its own worktree,
verify, and record a run ledger. Delivery is opt-in.

Options:
  --until-empty         Keep taking tickets until the frontier has nothing
                        ready (loop mode only)
  --board <slug>        Restrict the loop to one domain board (meta.domain)
  --ticket <dir>        Run exactly one ticket (dispatch resolved from
                        meta.worker → agent card → worker_default)
  --worker <name>       With --ticket: agent card to run as, overriding
                        meta.worker for this invocation
  --max-tickets <n>     Ticket attempts per run (default 5)
  --max-failures <n>    Consecutive failures on one ticket before the line
                        halts (default 3)
  --dry-run             Print the selected ticket and the planned actions;
                        write nothing at all
  --provider <name>     With --ticket: provider override (claude, codex, acp);
                        the loop resolves providers per ticket from each card
  --agent <name>        Refused in both modes — dispatch comes from each
                        ticket's roster (or --worker with --ticket)
  --model <name>        With --ticket: model override; the loop resolves models
                        per ticket from the roster
  --timeout <duration>  Per-worker timeout, e.g. 20m (default 30m)
  -h, --help            display help for command
```

### mem

```text
omtre mem — list/search Claude/Codex/Devin/Grok/OpenCode/Pi/ZCode sessions

commands:
  list                          list sessions (default if no command)
  search <keyword>              find sessions whose contents match keyword
  context <session-id>          drill-down: top-N hit turns + surrounding context
                                (paired with search; use --grep KW to anchor)
  extract <session-id>          dump cleaned dialogue (use --grep KW to filter turns)
  projects                      list active projects (cwds) with session counts —
                                use this to discover which --cwd to pass to search

flags:
  --platform claude|codex|devin|grok|opencode|pi|zcode|all   default all
  --since YYYY-MM-DD                     inclusive lower bound
  --until YYYY-MM-DD                     inclusive upper bound
  --global                               include all projects (default: cwd-scoped)
  --cwd <path>                           override the project cwd
  --limit N                              cap output (default 50)
  --grep KW                              extract / context: filter turns by keyword (multi-token AND)
  --phase brainstorm|implement|all       extract: slice by Omtre brainstorm windows
                                         (default all; brainstorm = [task.py create, task.py start);
                                         Claude/Codex/Devin/Grok/Pi/ZCode supported; OpenCode warns + returns all)
  --turns N                              context: number of hit turns to return (default 3)
  --around N                             context: turns of surrounding context per hit (default 1)
  --max-chars N                          context: total char budget (default 6000, ~1500 tokens)
  --include-children                     search / context: merge OpenCode sub-agent sessions into parent
  --json                                 emit JSON
  --help, -h                             show this help

examples:
  omtre mem list
  omtre mem list --global --platform claude --since 2026-04-01
  omtre mem search "session insight" --global
  omtre mem extract 5842592d --grep memory
  omtre mem extract 5842592d --phase brainstorm
```

### channel

```text
Usage: omtre channel [options] [command]

Multi-agent collaboration runtime — spawn / coordinate / interrupt worker
agents through a shared event log

Options:
  -h, --help                                display help for command

Commands:
  create [options] <name>                   Create a new channel (collaboration session)
  send [options] <name> [text]              Send a message into the channel
  wait [options] <name>                     Block until an event matching the filter arrives, or timeout
  interrupt [options] <name> [text]         Interrupt a worker turn and send a replacement instruction
  spawn [options] <name>                    Register a worker (claude/codex) into the channel — the worker stays idle until the first `channel send --to <worker>` arrives
  run [options] [name]                      One-shot: create ephemeral channel, spawn worker, send prompt, wait done, print final answer, cleanup
  rm [options] <name>                       Kill workers and delete a channel directory entirely
  prune [options]                           Bulk-remove channels by criteria (defaults to dry-run preview)
  list [options]                            List channels in ~/.omtre/channels/ with worker / activity summary
  messages [options] <name>                 View messages and events in the channel
  kill [options] <name>                     Stop a worker in the channel (SIGTERM, or SIGKILL with --force)
  post [options] <name> <action>            Append a structured thread event to a forum channel
  forum [options] <name>                    List threads in a forum channel
  thread [options] <name> <thread>          Show or mutate one thread timeline
  context                                   Manage channel-level or thread-level context entries
  title                                     Set or clear the channel display title
  __supervisor <channel> <worker> <config>  [internal] supervisor process entry point — do not invoke directly
  __parse-trace <adapter> <file>            [dev] Run a recorded trace through the parser and print events
  help [command]                            display help for command
```

### channel create

```text
Usage: omtre channel create [options] <name>

Create a new channel (collaboration session)

Options:
  --scope <scope>                        channel scope: project | global
  --type <type>                          channel type: chat | forum (default: "chat")
  --task <path>                          associated Omtre task directory
  --project <slug>                       project slug
  --labels <csv>                         comma-separated labels
  --description <text>                   stable channel description
  --context-file <absolute-path>         absolute file path attached as channel context (repeatable) (default: [])
  --context-raw <text>                   raw channel context text (repeatable) (default: [])
  --linked-context-file <absolute-path>  [deprecated alias for --context-file] absolute file path (repeatable) (default: [])
  --linked-context-raw <text>            [deprecated alias for --context-raw] raw context text (repeatable) (default: [])
  --cwd <path>                           working directory recorded in the create event
  --by <agent>                           agent name recorded as the creator (default: "main")
  --force                                overwrite existing channel with the same name
  --ephemeral                            mark as ephemeral — hidden from `channel list` by default and cleanable via `channel prune --ephemeral`
  -h, --help                             display help for command
```

### channel spawn

```text
Usage: omtre channel spawn [options] <name>

Register a worker (claude/codex) into the channel — the worker stays idle until
the first `channel send --to <worker>` arrives

Options:
  --scope <scope>            channel scope: project | global
  --agent <agent-name>       load .omtre/agents/<name>.md (sets default
                             --provider / --model / system prompt)
  --provider <provider>      worker provider: claude | codex | acp (overrides
                             agent)
  --as <name>                worker name in the channel (default: <agent-name>
                             if --agent is set)
  --cwd <path>               worker working directory (default: process cwd)
  --model <id>               model override
  --resume <id>              resume an existing session/thread id
  --sandbox <mode>           codex-only: worker sandbox mode: read-only |
                             workspace-write | danger-full-access (default
                             workspace-write)
  --acp-target <id>          acp-only: target in acp-agents.json (grok-build |
                             codex | claude); may come from the agent card's
                             acp_target frontmatter
  --effort <level>           acp-only: reasoning effort level for
                             session/set_config_option (e.g. low | medium |
                             high | xhigh)
  --timeout <duration>       auto-kill worker after this duration (e.g. 30m,
                             1h, 7200s)
  --warn-before <duration>   emit supervisor_warning before timeout (default
                             5m; 0ms disables)
  --file <path>              include a file's content as context in the
                             worker's system prompt (glob supported,
                             repeatable) (default: [])
  --jsonl <path>             parse an Omtre jsonl manifest ({file, reason} per
                             line) and include each referenced file
                             (repeatable) (default: [])
  --by <agent>               identity recorded as the spawn author (defaults to
                             OMTRE_CHANNEL_AS env or 'main')
  --inbox-policy <policy>    worker inbox delivery policy: explicitOnly |
                             broadcastAndExplicit (default explicitOnly)
  --idle-timeout <duration>  OOM-guard idle-cleanup TTL for this worker
                             (default 5m; 0 disables)
  --max-live-workers <n>     spawn-time live-worker budget for this
                             project/scope (default 6; 0 disables)
  -h, --help                 display help for command
```

### channel send

```text
Usage: omtre channel send [options] <name> [text]

Send a message into the channel

Arguments:
  name
  text                    inline text body (otherwise use --stdin /
                          --text-file)

Options:
  --as <agent>            agent name sending
  --scope <scope>         channel scope: project | global
  --to <agents>           comma-separated target agents (default: broadcast)
  --stdin                 read message body from stdin
  --text-file <path>      read message body from file
  --delivery-mode <mode>  targeted delivery validation: appendOnly |
                          requireKnownWorker | requireRunningWorker
  -h, --help              display help for command
```

### channel wait

```text
Usage: omtre channel wait [options] <name>

Block until an event matching the filter arrives, or timeout

Options:
  --as <agent>             agent name waiting
  --scope <scope>          channel scope: project | global
  --timeout <duration>     max wait (e.g. 30s, 2m, 1h)
  --from <agents>          only wake on events from these agents (CSV)
  --kind <kind[,kind...]>  only wake on these event kinds (CSV, OR semantics)
  --thread <key>           only wake on this thread key
  --action <action>        only wake on this thread action
  --to <target>            only wake on events targeted to this name (default:
                           own agent)
  --include-progress       also wake on progress events
  --all                    wait until each agent in --from has produced a
                           matching event (default: first match wins)
  -h, --help               display help for command
```

### channel messages

```text
Usage: omtre channel messages [options] <name>

View messages and events in the channel

Options:
  --scope <scope>    channel scope: project | global
  --raw              print raw JSON (one event per line)
  --follow           stream new events as they arrive (Ctrl-C to stop)
  --last <N>         show only the last N matching events
  --since <seq>      only events with seq > N
  --kind <kind>      filter by event kind (e.g. message, done, killed)
  --from <agents>    filter by author (CSV)
  --to <target>      filter by routing target
  --thread <key>     filter by thread key
  --action <action>  filter by thread action
  --no-progress      hide progress events (tool calls, deltas)
  -h, --help         display help for command
```

### channel run

```text
Usage: omtre channel run [options] [name]

One-shot: create ephemeral channel, spawn worker, send prompt, wait done, print
final answer, cleanup

Options:
  --agent <agent-name>   load .omtre/agents/<name>.md (sets default --provider
                         / --as / system prompt)
  --provider <provider>  worker provider: claude | codex | acp (overrides
                         agent)
  --as <name>            worker name (default: agent name if --agent set)
  --cwd <path>           worker working directory
  --model <id>           model override
  --acp-target <id>      acp-only: target in acp-agents.json (grok-build |
                         codex | claude)
  --effort <level>       acp-only: reasoning effort level (e.g. low | medium |
                         high | xhigh)
  --file <path>          include a file as context (glob supported, repeatable)
                         (default: [])
  --jsonl <path>         parse an Omtre jsonl manifest and include each
                         referenced file (repeatable) (default: [])
  --message <text>       inline prompt text
  --message-file <path>  read prompt body from file
  --stdin                read prompt body from stdin
  --timeout <duration>   max time to wait for done (e.g. 30s, 5m, 1h; default
                         5m)
  -h, --help             display help for command
```

### channel kill

```text
Usage: omtre channel kill [options] <name>

Stop a worker in the channel (SIGTERM, or SIGKILL with --force)

Options:
  --as <agent>     worker agent name
  --scope <scope>  channel scope: project | global
  --force          skip graceful shutdown, send SIGKILL immediately
  -h, --help       display help for command
```

### channel rm

```text
Usage: omtre channel rm [options] <name>

Kill workers and delete a channel directory entirely

Options:
  --scope <scope>  channel scope: project | global
  -h, --help       display help for command
```

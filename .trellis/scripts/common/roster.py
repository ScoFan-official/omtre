#!/usr/bin/env python3
"""Dispatch-roster static validation — the `task.py validate` half of the schema.

The roster contract (multi-agent orchestration design, dispatch-roster
answer): a ticket may name its worker agent card in ``meta.worker``; a card
with ``provider: acp`` must declare ``acp_target``, and that target must be
an id the runtime registry knows unless the card also carries an explicit
``acp_command`` override (the card then supplies the whole launch contract).
``config.yaml`` may additionally name ``worker_default:`` and
``orchestrator.agent:`` — both are card references and must exist.

Checking all of this at validate time means a broken roster is rejected at
planning time; the runtime spawn path fails closed the same way, but an
unattended run should never have to reach a spawn to learn the roster was
never valid.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from .paths import DIR_WORKFLOW
from .trellis_config import parse_simple_yaml

# A card name resolves to ``.trellis/agents/<name>.md`` or
# ``.trellis/agents/<name>/AGENT.md`` — the same rule agent-loader.ts's
# findAgentFile applies. Anything else is rejected as a name, not treated
# as a path.
_SAFE_CARD_NAME = re.compile(r"^[A-Za-z0-9._-]+$")

# Provider ids the channel runtime registers (adapters/index.ts REGISTRY).
# A card may also omit `provider:` — the spawn CLI can supply it — so only a
# present-but-unknown value is a problem.
KNOWN_PROVIDERS = ("claude", "codex", "acp")

# Mirror of the target ids in the CLI's bundled registry
# (packages/cli/src/commands/channel/adapters/acp-agents.json). The table
# ships inside the CLI, so validate keeps this id-only copy — adding a
# registry row means adding its id here too.
KNOWN_ACP_TARGETS = ("grok-build", "codex", "claude")

_CONFIG_FILE = "config.yaml"
_AGENTS_DIR = "agents"


def agent_card_path(repo_root: Path, name: str) -> Path | None:
    """Resolve a card name the way findAgentFile does.

    ``<name>.md`` wins over ``<name>/AGENT.md``. The resolved path must stay
    inside ``.trellis/agents/`` — a ``..``-style name would otherwise escape
    the roster directory (the name regex alone still admits ``..``).
    """
    if not _SAFE_CARD_NAME.match(name):
        return None
    agents_root = repo_root / DIR_WORKFLOW / _AGENTS_DIR
    for candidate in (agents_root / f"{name}.md", agents_root / name / "AGENT.md"):
        try:
            resolved = candidate.resolve()
            resolved.relative_to(agents_root.resolve())
        except (OSError, RuntimeError, ValueError):
            continue
        if candidate.is_file():
            return candidate
    return None


def _card_frontmatter(card_file: Path) -> dict[str, str]:
    """Flat frontmatter parse, mirroring agent-loader.ts's parseFrontmatter.

    ``key: value`` scalars only; ``key: |`` / ``key: >`` block scalars are
    consumed (their indented continuation lines belong to the block, not to
    sibling keys) and stored as their joined text. Comment and blank lines
    are skipped.
    """
    try:
        text = card_file.read_text(encoding="utf-8")
    except OSError:
        return {}
    match = re.match(r"^---\s*\r?\n(.*?)\r?\n---\s*\r?\n?", text, re.DOTALL)
    if not match:
        return {}
    fields: dict[str, str] = {}
    lines = match.group(1).split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            i += 1
            continue
        key_match = re.match(r"^([A-Za-z0-9_-]+)\s*:\s*(.*)$", line)
        if not key_match:
            i += 1
            continue
        key, inline = key_match.group(1), key_match.group(2).strip()
        if inline[:1] in ("|", ">"):
            block: list[str] = []
            i += 1
            while i < len(lines):
                cont = lines[i]
                if re.match(r"^\S", cont):
                    break
                block.append(re.sub(r"^ {2}", "", cont))
                i += 1
            fields[key] = "\n".join(block).strip()
        else:
            fields[key] = inline
            i += 1
    return fields


def _card_reference_problems(
    name: object, repo_root: Path, source: str, fix_hint: str
) -> list[str]:
    """Problems for one config/ticket value that must name an agent card."""
    if not isinstance(name, str):
        return [f"{source}: must name an agent card (string), got {name!r}. {fix_hint}"]
    if not name.strip():
        return [
            f"{source}: is empty — name an agent card or remove the key. {fix_hint}"
        ]
    card_name = name.strip()
    card = agent_card_path(repo_root, card_name)
    if card is None:
        return [
            f"{source}: agent card '{card_name}' not found "
            f"(expected .trellis/agents/{card_name}.md). {fix_hint}"
        ]
    problems: list[str] = []
    fm = _card_frontmatter(card)

    provider = fm.get("provider", "").strip()
    if provider and provider not in KNOWN_PROVIDERS:
        problems.append(
            f"{source}: card '{card_name}' has unknown provider '{provider}' "
            f"(registered: {', '.join(KNOWN_PROVIDERS)})"
        )

    if provider == "acp":
        target = fm.get("acp_target", "").strip()
        if not target:
            problems.append(
                f"{source}: card '{card_name}' has provider 'acp' but no "
                f"acp_target — add `acp_target: <id>` to the frontmatter "
                f"(registered targets: {', '.join(KNOWN_ACP_TARGETS)})"
            )
        elif target not in KNOWN_ACP_TARGETS and not fm.get("acp_command", "").strip():
            problems.append(
                f"{source}: card '{card_name}' acp_target '{target}' is not a "
                f"registered ACP target ({', '.join(KNOWN_ACP_TARGETS)}) and the "
                f"card carries no `acp_command:` override — register the target "
                f"or set the command explicitly"
            )
        elif target not in KNOWN_ACP_TARGETS:
            # Unlisted target + acp_command: legal, but the runtime then has
            # no registry row → no model/effort config-option ids — any
            # model:/effort: on the card would be silently dropped.
            silently_dropped = [
                k for k in ("model", "effort") if fm.get(k, "").strip()
            ]
            if silently_dropped:
                problems.append(
                    f"{source}: card '{card_name}' sets {', '.join(silently_dropped)} "
                    f"but acp_target '{target}' resolves via acp_command (no registry "
                    f"row) — the runtime has no config-option id for it, so the "
                    f"field would be silently dropped; pass it through acp_args "
                    f"instead"
                )

    # `acp_args` may be a JSON array or a whitespace-split string; a `[` that
    # does not parse is a spawn-time crash the static pass can report early.
    raw_args = fm.get("acp_args", "").strip()
    if raw_args.startswith("["):
        parsed_args: object = None
        try:
            parsed_args = json.loads(raw_args)
        except json.JSONDecodeError:
            problems.append(
                f"{source}: card '{card_name}' acp_args looks like JSON but "
                f"does not parse: {raw_args[:80]}"
            )
        else:
            if not isinstance(parsed_args, list) or not all(
                isinstance(a, str) for a in parsed_args
            ):
                problems.append(
                    f"{source}: card '{card_name}' acp_args JSON must be an "
                    f"array of strings"
                )
    return problems


def _config_roster_problems(repo_root: Path) -> list[str]:
    """Validate the roster-facing keys of .trellis/config.yaml."""
    problems: list[str] = []
    config_file = repo_root / DIR_WORKFLOW / _CONFIG_FILE
    try:
        content = config_file.read_text(encoding="utf-8")
    except OSError:
        return problems
    try:
        parsed = parse_simple_yaml(content, source=str(config_file))
    except Exception as exc:  # defensive: parser warns instead of raising
        problems.append(f"config.yaml: could not be parsed ({exc})")
        return problems
    if not isinstance(parsed, dict):
        return problems

    worker_default = parsed.get("worker_default")
    if worker_default is not None:
        problems.extend(
            _card_reference_problems(
                worker_default,
                repo_root,
                "worker_default",
                "Point it at an existing card, or remove the key.",
            )
        )

    orchestrator = parsed.get("orchestrator")
    if orchestrator is not None:
        if not isinstance(orchestrator, dict):
            problems.append(
                f"orchestrator: must be a mapping with agent/model/max_parallel, "
                f"got {orchestrator!r}"
            )
        else:
            agent = orchestrator.get("agent")
            if agent is not None:
                problems.extend(
                    _card_reference_problems(
                        agent,
                        repo_root,
                        "orchestrator.agent",
                        "Create the card or point orchestrator.agent at an "
                        "existing one.",
                    )
                )
            model = orchestrator.get("model")
            if model is not None and (
                not isinstance(model, str) or not model.strip()
            ):
                problems.append(
                    f"orchestrator.model: must be a non-empty string, got {model!r}"
                )
            max_parallel = orchestrator.get("max_parallel")
            if max_parallel is not None:
                try:
                    mp = int(str(max_parallel).strip())
                except (TypeError, ValueError):
                    mp = 0
                if mp < 1 or str(max_parallel).strip() != str(mp):
                    problems.append(
                        f"orchestrator.max_parallel: must be a positive integer, "
                        f"got {max_parallel!r}"
                    )
    return problems


def roster_problems(task_data: dict, repo_root: Path) -> list[str]:
    """Static dispatch-roster problems for one task + the repo config.

    Order: config-level references first (worker_default, orchestrator), then
    the ticket's own ``meta`` overrides. Every problem string names where the
    bad reference lives so the repair is obvious.
    """
    problems = _config_roster_problems(repo_root)

    meta = task_data.get("meta")
    meta = meta if isinstance(meta, dict) else {}
    worker = meta.get("worker")
    if worker is not None:
        problems.extend(
            _card_reference_problems(
                worker,
                repo_root,
                "meta.worker",
                "Fix it with `task.py set-meta <dir> worker <card-name>`.",
            )
        )
    for key in ("model", "effort"):
        value = meta.get(key)
        if value is not None and (not isinstance(value, str) or not value.strip()):
            problems.append(
                f"meta.{key}: optional override must be a non-empty string, "
                f"got {value!r}"
            )
    return problems

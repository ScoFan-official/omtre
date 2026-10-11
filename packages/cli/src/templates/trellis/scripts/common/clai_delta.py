#!/usr/bin/env python3
"""CLAI fork delta — domain-board mechanics collected in one module.

This file is the single place the CLAI (ClaiDevSkill) fork diverges from
upstream Trellis in script logic. Call sites stay thin: one or two lines in
`task.py` (start gates / finish warn), `common/task_store.py` (create sugar /
archive gates), `common/task_context.py` (validate reconcile), and
`common/session_context.py` (context rendering) delegate here.

CLAI DELTA LIST (numbered for the contract document — when an upstream
`trellis update` conflicts, reconcile against this list item by item):

    CLAI-1  task.py create/start --domain <slug>
            Sugar for a `meta.domain` write on the task (same effect as
            `--meta domain=<slug>` on create or `set-meta` before start).
    CLAI-2  task.py start flag gate
            When the task's meta.domain resolves to a domain board whose
            README first line carries a FRESH FOREIGN construction flag
            (旗行), start is refused with the flag reported. Own flag or a
            stale flag (>24h) proceeds. This is the only mechanical gate in
            the flag protocol — flag insertion/removal itself stays manual.
            Identity resolution (D8): `TRELLIS_WRITER` wins, else
            `{platform}-{machine}` from the repo's own config dirs, so a Qoder
            / Codex / Claude session no longer computes a Devin identity and
            cannot mistake Devin's live flag for its own.
    CLAI-3  task.py validate domain ↔ REGISTRY reconciliation
            Every directory under .trellis/domains/ (except _scaffold) must
            have a REGISTRY.md line, and every REGISTRY line must resolve to
            an existing directory. Mismatches fail validate.
            Sibling check: when a worklog entry heading carries a trailing
            status anchor ([x]/[~]) AND its own 状态 field carries one too,
            the two must agree — a stale `[~]` heading on a closed entry
            poisons `[~]` greps used by the reconciliation rules.
    CLAI-4  task.py finish/archive own-flag warning
            If the finished/archived task's domain board still carries THIS
            writer's flag, warn (旗未拔) — never auto-delete, never block.
    CLAI-5  get_context 当前战线 (battle lines) section
            One line per REGISTRY-registered board: slug, purpose, flag
            status, progress row count. Plus 下一票 (NEXT UP): the dependency
            frontier's head (first startable ticket) — the mechanical
            re-entry after an archive, matching the `next:` line the
            per-turn hook appends to the no_task breadcrumb (both read
            the same common/frontier.py — no second query implementation).
    CLAI-6  get_context 当前模式 (autonomy) line
            Reads .trellis/config.yaml `autonomy:`; `gated` | `hands-off` |
            `supervised-delivery`, default hands-off when the key is absent or
            unrecognized (an unrecognized value never becomes the push tier).
    CLAI-7  start artifact gate + archive design-review gate
            `start` refuses a routed task (meta.domain resolving to an
            existing board) whose prd.md lacks a well-formed `Domain:` line,
            and — in `verify_required: true` repos — a task without a
            verification contract. `archive` refuses a frontend task
            (meta.frontend, else best-effort branch-diff detection) whose
            implement.md lacks a `## Design review` section.
            Scoping rule: fires only on positive routing intent — a task
            with neither meta.domain nor a `Domain:` line passes, so
            pre-domain-layer tickets are never retro-locked.
    CLAI-8  task.py delivery-gate <ref> [--json]
            The push answer for `trellis run`, per the three-tier model in the
            domain's `02-e2e-delivery-gate-model.md`. Decision order is
            load-bearing: tier (`supervised-delivery` only — every other tier
            refuses outright), then protected positions (a whitelist entry
            never outvotes the default branch or a tag), then
            `delivery.auto_push_refs`. Protected-ness is decided by git facts
            (`refs/remotes/origin/HEAD` → `git remote show origin` → the main
            tree's own HEAD when there is no remote to ask), not by platform
            wording. Everything else is a refusal, never a warning: nobody is
            watching. An empty or malformed whitelist fails closed — an empty
            list is exactly `hands-off` behaviour, which is what makes the
            upgrade safe by default.
            Consumers of the older two-value check are unaffected: `verify.py`
            only asks `!= "gated"`, so the third tier behaves like hands-off
            there by design.
    CLAI-9  task.py set-worktree <dir> <path>|- / task.py set-pr <dir> <url>
            The two formal `task.json` fields the loop runner writes and no
            other command owns: `worktree_path` (declared by the schema, never
            written — a ticket's worktree was undiscoverable outside the session
            that made it; `-` clears it once the worktree is torn down) and
            `pr_url` (the review pointer `gh pr create` prints). Path must exist
            as a directory, URL must be http(s) — a refusal means a typo, not a
            state the runner can legitimately be in.
    CLAI-10 task.py check-commit <path>... [--from-stdin] [--json]
            The mechanical face of the commit discipline `workflow.md` states in
            prose (Phase 3.4 / finish-work: files you did not edit this session
            NEVER enter a commit; board files land in their own close-out
            commit). `trellis run` asks this one question instead of carrying a
            second copy of the rule list, and an agent driving commits by hand
            can ask the same verb — one authority. Answers with a machine code
            (`ok` + `offending`); refuses rather than warns, because in an
            unattended run a warning is read by nobody. Secret matching is on
            SHAPES (`secrets.yaml`, `.env*`, key material), not the substring
            "secret": this list also gates delivery, so a false positive halts
            an entire line, and `src/use-secret-store.ts` is application code.

Writer identity (own-writer matching): `TRELLIS_WRITER` env var wins; otherwise
`{platform}-{hostname}`, the platform read from the repo's own config dirs
(`common/cli_adapter.detect_platform`) — Devin sessions therefore keep the
`devin-<hostname>` string they always produced. A flag's writer field is an
opaque string compared by equality.
Agents that name themselves with a writer suffix (`qoder-HOST-agent`, the shape
the domain boards actually carry) must set `TRELLIS_WRITER` to that exact string
— detection cannot guess a suffix. Repos whose hygiene rules ban machine
identifiers in committed files (e.g. "no hostnames in git history") should set
`TRELLIS_WRITER` to a neutral alias like `devin` — the protocol only needs
uniqueness.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import socket
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

from . import git
from .io import describe_json_read_failure, read_json_checked, write_json
from .log import Colors, colored
from .paths import DIR_WORKFLOW, FILE_TASK_JSON, get_repo_root
from .task_utils import resolve_task_dir
from .trellis_config import read_trellis_config


# =============================================================================
# Constants
# =============================================================================

# Env override for the writer identity stamped into flag lines. Mirrors the
# TRELLIS_DEVELOPER pattern: env first, convention-derived default after.
ENV_WRITER = "TRELLIS_WRITER"

DIR_DOMAINS = "domains"
SCAFFOLD_DIR = "_scaffold"  # skeleton template — not a board, exempt everywhere
FILE_REGISTRY = "REGISTRY.md"
FILE_BOARD_README = "README.md"

DEFAULT_AUTONOMY = "hands-off"
# `supervised-delivery` (CLAI-8) is the tier that may push; see KNOWN_AUTONOMY
# readers in `02-e2e-delivery-gate-model.md` and DISCIPLINE §4.
TIER_GATED = "gated"
TIER_HANDS_OFF = "hands-off"
TIER_SUPERVISED = "supervised-delivery"
KNOWN_AUTONOMY = {TIER_GATED, TIER_HANDS_OFF, TIER_SUPERVISED}

# A foreign flag older than this is 腐旗 (stale) — start proceeds; the flag
# protocol's three-anchor evidence rules decide whether it may be replaced.
STALE_FLAG_AGE = timedelta(hours=24)

_DOMAIN_SLUG_RE = re.compile(r"[a-z0-9][a-z0-9-]*")
_REGISTRY_LINE_RE = re.compile(r"^([a-z0-9][a-z0-9-]*)/\s*—\s*(.*)$")
_FLAG_PREFIXES = ("旗:", "旗：")
_FLAG_SEPARATOR = " · "
_FLAG_SINCE_RE = re.compile(r"自\s*(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})")
# Worklog entry heading ends with a status anchor: `## [<id>-<ts>] [x|~]`.
_WORKLOG_HEADING_RE = re.compile(r"^##\s+.*\s\[([~x])\]\s*$")
# Entry body carries `- **状态**：[x] ...` — only compared when it has an
# anchor; entries phrased without one (✅ etc.) are skipped.
_WORKLOG_STATUS_RE = re.compile(r"^\s*-\s*\*\*状态\*\*：\s*\[([~x])\]")


# =============================================================================
# Writer identity + slug validation (CLAI-1/2/4 shared)
# =============================================================================

def own_writer_id(repo_root: Path | None = None) -> str:
    """Return this session's writer identity for flag ownership checks.

    `TRELLIS_WRITER` wins (explicit identity — the deterministic fixture knob and
    the escape for agents that name themselves with a writer suffix, e.g.
    `qoder-HOST-agent`; the protocol only needs the string to be stable).
    Otherwise `{platform}-{machine}`, with the platform read from the repo's own
    config directories by `common/cli_adapter.detect_platform`.

    Before this, the identity was hard-coded to `devin-<hostname>`, so a Qoder /
    Claude / Codex session computed a Devin identity: another agent's live flag
    on the same machine read as its own, and `start` walked over it. Devin
    machines keep producing the same string as before.
    """
    override = os.environ.get(ENV_WRITER, "").strip()
    if override:
        return override
    try:
        from .cli_adapter import detect_platform

        platform = detect_platform(repo_root or Path.cwd())
    except Exception:
        # Detection is a convenience; failing it must not turn every existing
        # Devin flag into a foreign one.
        platform = "devin"
    return f"{platform}-{socket.gethostname()}"


def domain_slug_ok(slug: object) -> bool:
    """Mechanical slug rule — same shape REGISTRY.md prescribes."""
    return isinstance(slug, str) and bool(_DOMAIN_SLUG_RE.fullmatch(slug))


def board_dir_for(repo_root: Path, slug: object) -> Path | None:
    """Resolve meta.domain to a board dir, or None when it is not one.

    Returns None for malformed slugs, `_scaffold`, and slugs whose directory
    does not exist — "resolves to a domain board" is false in all three.
    """
    if not domain_slug_ok(slug) or slug == SCAFFOLD_DIR:
        return None
    board = Path(repo_root) / DIR_WORKFLOW / DIR_DOMAINS / str(slug)
    return board if board.is_dir() else None


# =============================================================================
# Flag line parsing (CLAI-2/4/5)
# =============================================================================

@dataclass
class DomainFlag:
    """Parsed board README flag line.

    `well_formed` is False when the line starts with 旗 but does not parse —
    an unverifiable flag is treated as foreign for safety (cannot prove it
    is ours or stale, so it blocks like a fresh foreign flag).
    """

    raw: str
    writer: str
    context: str
    since: datetime | None

    @property
    def well_formed(self) -> bool:
        return bool(self.writer) and self.since is not None

    @property
    def since_text(self) -> str:
        return self.since.strftime("%Y-%m-%d %H:%M") if self.since else "?"


def parse_flag_line(line: str) -> DomainFlag | None:
    """Parse `旗: <writer> · <context> · 自 <YYYY-MM-DD HH:mm>`; None if absent."""
    text = line.strip()
    for prefix in _FLAG_PREFIXES:
        if not text.startswith(prefix):
            continue
        body = text[len(prefix):].strip()
        parts = [p.strip() for p in body.split(_FLAG_SEPARATOR)]
        writer = parts[0] if parts and parts[0] else ""
        context = parts[1] if len(parts) > 1 else ""
        since = None
        match = _FLAG_SINCE_RE.search(body)
        if match:
            try:
                since = datetime.strptime(
                    f"{match.group(1)} {match.group(2)}", "%Y-%m-%d %H:%M"
                )
            except ValueError:
                since = None
        return DomainFlag(raw=line.rstrip("\n"), writer=writer,
                          context=context, since=since)
    return None


def read_board_flag(board_dir: Path) -> DomainFlag | None:
    """Read the flag from a board README's first line (head -1 直读)."""
    readme = Path(board_dir) / FILE_BOARD_README
    try:
        with readme.open("r", encoding="utf-8") as fh:
            first = fh.readline()
    except OSError:
        return None
    return parse_flag_line(first)


def flag_kind(
    flag: DomainFlag | None,
    own: str | None = None,
    now: datetime | None = None,
) -> str:
    """Classify a flag: none | own | fresh_foreign | stale_foreign | unknown.

    `unknown` covers unparsable 旗 lines — treated as foreign by callers.
    """
    if flag is None:
        return "none"
    if own is None:
        own = own_writer_id()
    if flag.writer and flag.writer == own:
        return "own"
    if not flag.well_formed:
        return "unknown"
    now = now or datetime.now()
    if now - flag.since > STALE_FLAG_AGE:  # type: ignore[operator]
        return "stale_foreign"
    return "fresh_foreign"


# =============================================================================
# CLAI-1/2 — task meta.domain sugar + start flag gate
# =============================================================================

def read_task_domain(task_json_path: Path) -> str | None:
    """Return meta.domain from a task.json, or None when absent/unreadable."""
    data, _reason = read_json_checked(task_json_path)
    if not isinstance(data, dict):
        return None
    meta = data.get("meta")
    if not isinstance(meta, dict):
        return None
    domain = meta.get("domain")
    return domain.strip() if isinstance(domain, str) and domain.strip() else None


def set_task_domain(task_json_path: Path, slug: str) -> bool:
    """Write meta.domain=<slug> into task.json (set-meta equivalent). CLAI-1."""
    path = Path(task_json_path)
    if not domain_slug_ok(slug):
        print(
            colored(
                f"Error: --domain must be a lowercase board slug "
                f"(a-z, 0-9, '-'): {slug}",
                Colors.RED,
            ),
            file=sys.stderr,
        )
        return False
    if not path.is_file():
        print(
            colored(f"Error: task.json not found at {path.parent}", Colors.RED),
            file=sys.stderr,
        )
        return False
    data, reason = read_json_checked(path)
    if data is None:
        print(
            colored(f"Error: could not read {path.name}: {reason}", Colors.RED),
            file=sys.stderr,
        )
        return False
    meta = data.get("meta")
    if not isinstance(meta, dict):
        meta = {}
    meta["domain"] = slug
    data["meta"] = meta
    if not write_json(path, data):
        print(
            colored(f"Error: could not write {path}", Colors.RED),
            file=sys.stderr,
        )
        return False
    return True


def flag_conflict(
    repo_root: Path,
    slug: str | None,
    own: str | None = None,
    now: datetime | None = None,
) -> DomainFlag | None:
    """Return the flag blocking `start` on the task's domain board, or None.

    Blocks on fresh foreign flags and unparsable 旗 lines (ownership cannot
    be verified). Own flag, stale flag (>24h), missing board/README/flag all
    proceed — a stale flag is reported on stderr as advisory.
    """
    if own is None:
        # Ownership is decided against this repo's platform, so the probe needs
        # this repo's root.
        own = own_writer_id(repo_root)
    board = board_dir_for(repo_root, slug)
    if board is None:
        return None
    flag = read_board_flag(board)
    kind = flag_kind(flag, own=own, now=now)
    if kind in ("fresh_foreign", "unknown"):
        return flag
    if kind == "stale_foreign" and flag is not None:
        print(
            colored(
                f"Note: 板块 {slug} 旗已腐（>{int(STALE_FLAG_AGE.total_seconds() // 3600)}h）"
                f"——start 放行；如需代拔走三锚点自查流程。",
                Colors.YELLOW,
            ),
            file=sys.stderr,
        )
    return None


# =============================================================================
# CLAI-4 — finish/archive own-flag warning (never deletes, never blocks)
# =============================================================================

def warn_if_own_flag(
    repo_root: Path,
    task_json_path: Path,
    own: str | None = None,
) -> None:
    """Warn when the task's domain board still carries OUR flag (旗未拔)."""
    slug = read_task_domain(task_json_path)
    board = board_dir_for(repo_root, slug)
    if board is None:
        return
    flag = read_board_flag(board)
    if flag_kind(flag, own=own) == "own" and flag is not None:
        print(
            colored(
                f"Warning: 旗未拔——板块 {slug} 首行仍是本写者施工旗"
                f"（{flag.writer}）。按收工一单制在收工 commit 里手动删旗行；"
                f"本命令不代拔。",
                Colors.YELLOW,
            ),
            file=sys.stderr,
        )


# =============================================================================
# CLAI-3 — domains/ dir ↔ REGISTRY.md reconciliation
# =============================================================================

def registry_entries(repo_root: Path) -> list[tuple[str, str]]:
    """Parse REGISTRY.md board lines into (slug, purpose) pairs, in order."""
    registry = Path(repo_root) / DIR_WORKFLOW / DIR_DOMAINS / FILE_REGISTRY
    try:
        text = registry.read_text(encoding="utf-8")
    except OSError:
        return []
    entries: list[tuple[str, str]] = []
    for line in text.splitlines():
        match = _REGISTRY_LINE_RE.match(line.strip())
        if match:
            entries.append((match.group(1), match.group(2).strip()))
    return entries


def reconcile_domain_registry(repo_root: Path) -> list[str]:
    """Return reconciliation error strings (empty list = clean). CLAI-3.

    Bidirectional: every domains/ dir (except _scaffold) needs a REGISTRY
    line, and every REGISTRY line needs an existing dir.
    """
    domains_dir = Path(repo_root) / DIR_WORKFLOW / DIR_DOMAINS
    if not domains_dir.is_dir():
        return []

    dirs = {d.name for d in domains_dir.iterdir()
            if d.is_dir() and d.name != SCAFFOLD_DIR}
    registered = {slug for slug, _purpose in registry_entries(repo_root)}

    problems: list[str] = []
    for name in sorted(dirs - registered):
        problems.append(
            f"domains/{name}/ has no REGISTRY.md line — "
            "register the board or remove the directory."
        )
    for slug in sorted(registered - dirs):
        problems.append(
            f"REGISTRY.md line '{slug}/' points at no existing board directory."
        )
    return problems


def worklog_anchor_problems(repo_root: Path) -> list[str]:
    """Return worklog heading-anchor mismatches (empty list = clean).

    Sibling check under CLAI-3: an entry heading ends with a status anchor
    (`[x]`/`[~]`) and its 状态 field may carry one too. When both exist
    they must agree — otherwise `[~]` greps used by the reconciliation
    rules hit stale markers on closed entries. Absent either side = skip.
    """
    domains_dir = Path(repo_root) / DIR_WORKFLOW / DIR_DOMAINS
    if not domains_dir.is_dir():
        return []

    problems: list[str] = []
    for board in sorted(domains_dir.iterdir()):
        worklog_dir = board / "worklog"
        if board.name == SCAFFOLD_DIR or not worklog_dir.is_dir():
            continue
        for file in sorted(worklog_dir.glob("*.md")):
            try:
                text = file.read_text(encoding="utf-8")
            except OSError:
                continue
            entry_anchor: str | None = None
            entry_heading = ""
            for line in text.splitlines():
                match = _WORKLOG_HEADING_RE.match(line)
                if match:
                    entry_anchor = match.group(1)
                    entry_heading = line.strip()[:80]
                    continue
                if entry_anchor is None:
                    continue
                status = _WORKLOG_STATUS_RE.match(line)
                if status is None:
                    continue
                if status.group(1) != entry_anchor:
                    rel = file.relative_to(Path(repo_root))
                    problems.append(
                        f"{rel}: worklog 条目 heading 锚 [{entry_anchor}] 与"
                        f" 状态锚 [{status.group(1)}] 不符（{entry_heading}）"
                        " — 收工条目把 heading 的 [~] 改成 [x]。"
                    )
                entry_anchor = None  # 状态行已消费，本条结束
    return problems


# =============================================================================
# CLAI-5/6 — get_context battle lines + autonomy mode
# =============================================================================

def read_autonomy(repo_root: Path) -> str:
    """Read config.yaml `autonomy:`; unknown/absent → hands-off. CLAI-6."""
    # read_trellis_config already collapses missing/malformed to {}.
    config = read_trellis_config(repo_root)
    value = config.get("autonomy")
    if isinstance(value, str) and value.strip() in KNOWN_AUTONOMY:
        return value.strip()
    return DEFAULT_AUTONOMY


def _progress_row_count(readme: Path) -> int:
    """Count data rows in the board README's `## 进度` table.

    Data rows = `|...|` lines in that section minus the header and the
    `|---|` separator rows.
    """
    try:
        text = readme.read_text(encoding="utf-8")
    except OSError:
        return 0
    in_section = False
    seen_table_row = False
    count = 0
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("## "):
            in_section = stripped.startswith("## 进度")
            seen_table_row = False
            continue
        if not in_section:
            continue
        if stripped.startswith("|") and stripped.endswith("|"):
            if set(stripped) <= set("|-: "):
                continue  # separator row
            if not seen_table_row:
                seen_table_row = True  # header row
                continue
            count += 1
    return count


def _flag_status_text(
    flag: DomainFlag | None,
    own: str | None = None,
    now: datetime | None = None,
) -> str:
    kind = flag_kind(flag, own=own, now=now)
    if flag is None or kind == "none":
        return "无旗"
    if kind == "own":
        return f"自己旗 {flag.writer}（自 {flag.since_text}）"
    if kind == "stale_foreign":
        return f"腐旗 {flag.writer}（自 {flag.since_text}，>24h）"
    if kind == "fresh_foreign":
        return f"他人旗 {flag.writer}（自 {flag.since_text}）"
    return f"旗行无法解析: {flag.raw}"


def battle_lines(
    repo_root: Path,
    own: str | None = None,
    now: datetime | None = None,
) -> list[str]:
    """Build the 当前战线 section lines. CLAI-5.

    Emitted only when the domains layer exists in this repo; each
    REGISTRY-registered board gets one line with flag status and progress
    row count.
    """
    domains_dir = Path(repo_root) / DIR_WORKFLOW / DIR_DOMAINS
    if not domains_dir.is_dir():
        return []

    entries = registry_entries(repo_root)
    lines = ["## 当前战线 (BATTLE LINES)"]
    if not entries:
        lines.append("  （REGISTRY 无登记板块）")
        return lines

    for slug, purpose in entries:
        board = domains_dir / slug
        suffix = f" — {purpose}" if purpose else ""
        if board.is_dir():
            flag = read_board_flag(board)
            status = _flag_status_text(flag, own=own, now=now)
            progress = _progress_row_count(board / FILE_BOARD_README)
            lines.append(f"  {slug}/{suffix}")
            lines.append(f"    旗位: {status} · 进度: {progress} 项")
        else:
            lines.append(f"  {slug}/{suffix}  ⚠ 板块目录缺失（对账违规）")
    return lines


def next_up_lines(repo_root: Path) -> list[str]:
    """Build the 下一票 (NEXT UP) section lines from the D1 frontier. D2.

    next_up_lines builds the 下一票 (NEXT UP) section from the D1 frontier.

    Emitted only for repos with the domains layer; empty when there is
    nothing active. Answers "what starts next" mechanically — after an
    archive the session re-enters at the frontier head, the same head the
    per-turn hook renders as the `next:` line on the no_task breadcrumb
    (both read common/frontier.py — no second query implementation).

    Head only — `task.py frontier` prints the full ready/blocked list.
    """
    domains_dir = Path(repo_root) / DIR_WORKFLOW / DIR_DOMAINS
    if not domains_dir.is_dir():
        return []
    try:
        # Local import keeps an older common/frontier.py from taking down
        # the whole context render.
        from . import frontier
        result = frontier.compute_frontier(repo_root)
    except Exception:
        return []

    ready = result.get("ready") or []
    blocked = result.get("blocked") or []
    cycles = result.get("cycles") or []
    if not ready and not blocked:
        return []

    lines = ["## 下一票 (NEXT UP)"]
    if ready:
        head = ready[0]
        domain = f" @{head['domain']}" if head.get("domain") else ""
        lines.append(
            f"  - {head['dir']}/ ({head['status']}) [{head['priority']}]"
            f"{domain} {head['title']}"
        )
    else:
        lines.append("  - （无可开工票 — 依赖未满足）")
    lines.append(
        f"  ready {len(ready)} · blocked {len(blocked)} · cycles {len(cycles)}"
    )
    return lines


def append_domain_context(lines: list[str], repo_root: Path) -> None:
    """Append CLAI-5/6 context output onto `lines` (thin call-site helper)."""
    lines.append("## 当前模式 (AUTONOMY)")
    lines.append(read_autonomy(repo_root))
    lines.append("")
    section = battle_lines(repo_root)
    if section:
        lines.extend(section)
        lines.append("")
    next_up = next_up_lines(repo_root)
    if next_up:
        lines.extend(next_up)
        lines.append("")


# =============================================================================
# CLAI-7 — start artifact gate + archive design-review gate
# =============================================================================

FILE_PRD = "prd.md"
FILE_IMPLEMENT = "implement.md"
# The `Domain:` line lives atop prd.md (DISCIPLINE §1 / workflow §1.5); a
# bounded head scan avoids matching a stray mention deeper in the body.
PRD_DOMAIN_SCAN_LINES = 40

_DOMAIN_LINE_RE = re.compile(r"^\s*Domain\s*[:：]\s*(.+?)\s*$")
_DOMAIN_PATH_RE = re.compile(r"\.trellis/domains/([a-z0-9][a-z0-9-]*)/?")
# `none（<reason>）` — the reason is mandatory; parens may be full- or
# half-width. A bare `none` is a shape error, not a valid declaration.
_DOMAIN_NONE_RE = re.compile(r"none\s*[（(]\s*\S.*?[）)]\s*$", re.IGNORECASE)

# frontend-craft contract: a task is frontend when the files it touched match
# its `paths:` globs, or meta.frontend says so. Mechanical detection keeps the
# same two signals — the meta override, else the task branch's diff.
_DESIGN_REVIEW_RE = re.compile(r"^#{2,}\s+Design review\b", re.MULTILINE)
FRONTEND_SUFFIXES = frozenset(
    (".tsx", ".jsx", ".vue", ".svelte", ".astro", ".css", ".scss", ".less", ".html")
)
FRONTEND_SPEC_PATHS = frozenset(
    (".trellis/spec/product.md", ".trellis/spec/design-system.md")
)


def read_prd_domain_value(prd_path: Path) -> str | None:
    """Return the `Domain:` line's value from atop prd.md, or None (absent)."""
    try:
        with Path(prd_path).open("r", encoding="utf-8") as fh:
            head = [next(fh, "") for _ in range(PRD_DOMAIN_SCAN_LINES)]
    except OSError:
        return None
    for line in head:
        match = _DOMAIN_LINE_RE.match(line)
        if match:
            return match.group(1).strip()
    return None


def classify_domain_value(value: str) -> str | None:
    """Classify a `Domain:` value: 'board' | 'none'; None when malformed."""
    if _DOMAIN_PATH_RE.fullmatch(value):
        return "board"
    if _DOMAIN_NONE_RE.fullmatch(value):
        return "none"
    return None


def start_artifact_problems(task_json_path: Path, repo_root: Path) -> list[str]:
    """CLAI-7: artifact problems that refuse `start` ([] = pass).

    Fires on routing intent, not on every task: either meta.domain resolves
    to a board, or prd.md carries a `Domain:` line (shape-checked). Tasks
    with neither pass — pre-domain-layer tickets (Laber/Rakazo history) are
    never retro-locked by a `trellis update`.

    In a `verify_required: true` repo a missing verification contract also
    refuses start: the same opt-in that makes archive refuse should fail
    before the work, not after it. A contract that exists and fails stays
    the archive gate's business.
    """
    json_path = Path(task_json_path)
    data, _reason = read_json_checked(json_path)
    if not isinstance(data, dict):
        data = {}

    domain: str | None = None
    meta = data.get("meta")
    if isinstance(meta, dict):
        candidate = meta.get("domain")
        if isinstance(candidate, str) and candidate.strip():
            domain = candidate.strip()
    routed = board_dir_for(repo_root, domain) is not None

    problems: list[str] = []
    prd_path = json_path.parent / FILE_PRD
    prd_exists = prd_path.is_file()
    value = read_prd_domain_value(prd_path) if prd_exists else None

    if routed or value is not None:
        if not prd_exists:
            problems.append(
                f"prd.md is missing — this task is routed (meta.domain={domain}) "
                "and must carry a `Domain:` line atop its prd."
            )
        elif value is None:
            problems.append(
                f"prd.md has no `Domain:` line — meta.domain={domain} routes "
                "this task to a board. Add one of:\n"
                f"    Domain: .trellis/domains/{domain}/\n"
                "    Domain: none（<one-line reason>）"
            )
        elif classify_domain_value(value) is None:
            problems.append(
                f"malformed `Domain:` line: '{value}' — use "
                "`.trellis/domains/<slug>/` or `none（<one-line reason>）` "
                "(a bare slug is neither form)."
            )

    from . import verify as verify_module  # local: verify imports clai_delta

    if verify_module.verify_required(repo_root):
        specs, _shape_problems = verify_module.verify_specs(data)
        if not specs:
            problems.append(
                "no verification contract — this repo sets "
                "`verify_required: true`. Record one first: "
                "task.py add-verify <task> '<command>'"
            )

    return problems


def _tri_state(value: object) -> bool | None:
    """Coerce a meta.frontend value: True/False, or None when unset/opaque."""
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in ("true", "yes", "1"):
            return True
        if lowered in ("false", "no", "0"):
            return False
    return None


def _frontend_by_branch_diff(repo_root: Path, task_data: dict) -> bool:
    """Best-effort: did this task's branch touch frontend files?

    False when undetectable (no branch metadata, refs gone, git unavailable)
    — an unknowable frontend-ness must not block archive. The automation
    path keeps the branch alive, so detection works where it matters.
    """
    branch = task_data.get("branch")
    base = task_data.get("base_branch")
    if not (
        isinstance(branch, str)
        and branch.strip()
        and isinstance(base, str)
        and base.strip()
        and branch.strip() != base.strip()
    ):
        return False
    rc, out, _err = git.run_git(
        ["merge-base", base.strip(), branch.strip()], cwd=repo_root, timeout=30
    )
    if rc != 0 or not out.strip():
        return False
    base_oid = out.strip().splitlines()[0].strip()
    rc, out, _err = git.run_git(
        ["diff", "--name-only", base_oid, branch.strip()], cwd=repo_root, timeout=30
    )
    if rc != 0:
        return False
    for raw in out.splitlines():
        name = raw.strip().replace("\\", "/")
        if not name:
            continue
        if name in FRONTEND_SPEC_PATHS:
            return True
        if os.path.splitext(name)[1].lower() in FRONTEND_SUFFIXES:
            return True
    return False


def frontend_design_problems(
    task_data: dict, task_dir: Path, repo_root: Path
) -> list[str]:
    """CLAI-7 archive gate: frontend tasks need `## Design review` recorded.

    Frontend-ness follows the frontend-craft contract: `meta.frontend`
    overrides both ways; absent an explicit value, best-effort branch-diff
    detection applies. The fix is the artifact, not a flag — write the
    section (an explicit skip justification inside it counts).
    """
    meta = task_data.get("meta")
    marked = _tri_state(meta.get("frontend")) if isinstance(meta, dict) else None
    if marked is False:
        return []
    if marked is None and not _frontend_by_branch_diff(repo_root, task_data):
        return []
    implement_path = Path(task_dir) / FILE_IMPLEMENT
    try:
        text = implement_path.read_text(encoding="utf-8")
    except OSError:
        text = ""
    if _DESIGN_REVIEW_RE.search(text):
        return []
    return [
        "frontend task without a `## Design review` section in implement.md — "
        "record which of audit/critique/polish ran (engine or degraded), the "
        "findings, and each disposition (fixed / deferred / rejected); an "
        "empty \"no findings\" entry is valid only if the commands ran."
    ]


# =============================================================================
# CLAI-9 — run setters: worktree pointer + review pointer (run support)
# =============================================================================

# Sentinel clearing the pointer; a path argument is never a bare `-`.
WORKTREE_CLEAR_ARG = "-"

_PR_URL_RE = re.compile(r"^https?://\S+$", re.IGNORECASE)


def _read_for_write(task_json: Path) -> dict | None:
    """Read a task.json a command is about to rewrite, reporting any failure.

    A record we cannot read is not a record we may rewrite — overwriting here
    would silently discard whatever the failure was. Message shape mirrors
    task_store._report_read_failure (importing it would cycle back here).
    """
    data, reason = read_json_checked(task_json)
    if data is not None:
        return data
    problem, hint = describe_json_read_failure(task_json, reason)
    print(colored(f"Error: {problem}", Colors.RED), file=sys.stderr)
    print(hint, file=sys.stderr)
    return None


def _write_task_field(args: argparse.Namespace, field: str, value: object) -> int:
    """Shared body of the CLAI-9 setters: one field, one write, no reformat."""
    target_dir = resolve_task_dir(args.dir, get_repo_root())
    if target_dir is None:
        return 1

    task_json = target_dir / FILE_TASK_JSON
    if not task_json.is_file():
        print(colored(f"Error: task.json not found at {target_dir}", Colors.RED))
        return 1

    data = _read_for_write(task_json)
    if data is None:
        return 1

    data[field] = value
    if not write_json(task_json, data):
        print(colored(f"Error: failed to write {task_json}", Colors.RED))
        return 1
    return 0


def cmd_set_worktree(args: argparse.Namespace) -> int:
    """`task.py set-worktree <dir> <path>|-` — record the ticket's worktree."""
    value = getattr(args, "path", "")
    if not value:
        print(colored("Error: Missing arguments", Colors.RED))
        print("Usage: python3 task.py set-worktree <task-dir> <path>|-")
        return 1

    repo_root = get_repo_root()
    if value == WORKTREE_CLEAR_ARG:
        resolved: str | None = None
    else:
        candidate = Path(value)
        if not candidate.is_absolute():
            candidate = repo_root / candidate
        # The runner creates the worktree before recording it, so a refusal can
        # only mean a typo or a tree already torn down.
        if not candidate.is_dir():
            print(colored(f"Error: not a directory: {value}", Colors.RED))
            print("Create the worktree first (`git worktree add`), or pass `-` to clear.")
            return 1
        resolved = str(candidate)

    if _write_task_field(args, "worktree_path", resolved) != 0:
        return 1
    state = "cleared" if resolved is None else f"→ {resolved}"
    print(colored(f"✓ worktree_path {state}", Colors.GREEN))
    return 0


# =============================================================================
# CLAI-8 — the delivery tier and protected-ref mechanics (supervised-delivery)
# =============================================================================

DELIVERY_SECTION = "delivery"
AUTO_PUSH_REFS_KEY = "auto_push_refs"
PROTECTED_REFS_KEY = "protected_refs"


def _ref_glob(glob: str) -> re.Pattern[str]:
    """Compile a ref whitelist glob.

    `*` stops at `/`, so `feature/*` admits `feature/ticket` but not
    `feature/a/b`. A whitelist that allows less than it appears to allow is the
    safe direction for something an unattended loop can trigger.
    """
    return re.compile("^" + "[^/]*".join(re.escape(p) for p in glob.split("*")) + "$")


def _ref_matches(ref: str, globs: list[str]) -> str | None:
    """The first glob that matches `ref`, or None."""
    for glob in globs:
        if _ref_glob(glob).match(ref):
            return glob
    return None


def read_delivery_config(repo_root: Path) -> dict:
    """`delivery:` section of config.yaml, shape-checked.

    Absent keys read as empty lists. A scalar where a list belongs is reported
    as `malformed` rather than coerced — an unparseable whitelist must not
    silently become no whitelist or a guessed one.
    """
    raw = read_trellis_config(repo_root).get(DELIVERY_SECTION)
    result = {"auto_push_refs": [], "protected_refs": [], "malformed": None}
    if raw is None:
        return result
    if not isinstance(raw, dict):
        result["malformed"] = f"{DELIVERY_SECTION} is not a mapping"
        return result

    for key, target in ((AUTO_PUSH_REFS_KEY, "auto_push_refs"), (PROTECTED_REFS_KEY, "protected_refs")):
        value = raw.get(key)
        if value is None:
            continue
        if isinstance(value, list):
            result[target] = [str(v).strip() for v in value if str(v).strip()]
        else:
            result["malformed"] = f"{DELIVERY_SECTION}.{key} is not a list"
    return result


def default_branch_facts(repo_root: Path) -> tuple[str | None, str]:
    """(default branch, how it was learned) — git facts only.

    `git.resolve_default_branch` reads `refs/remotes/origin/HEAD` then
    `git remote show origin`. Either can fail with a remote configured — an
    offline host, or a bare repo whose own HEAD points at a branch that was
    never pushed. Leaving the answer "unknown" there would mean a `*` whitelist
    could push the trunk, so the last resort is the branch the main working tree
    itself has checked out, reported as such. It can over-protect (a ticket
    branch checked out in the main tree gets refused); over-protecting is the
    safe direction for a loop nobody is watching.
    """
    resolved = git.resolve_default_branch(repo_root)
    if resolved:
        return resolved, "remote_head"

    main_root = git.main_worktree_root(repo_root) or repo_root
    head = git.current_branch_name(main_root)
    if head:
        return head, "local_head_fallback"
    return None, "none"


def ref_is_tag(repo_root: Path, ref: str) -> bool:
    """Whether `ref` names an existing tag, locally first, then on the remote."""
    rc, _out, _err = git.run_git(
        ["rev-parse", "--verify", "--quiet", f"refs/tags/{ref}"], cwd=repo_root
    )
    if rc == 0:
        return True
    if not git.has_git_remote(repo_root):
        return False
    rc, out, _err = git.run_git(
        ["ls-remote", "--tags", "origin", f"refs/tags/{ref}"], cwd=repo_root, timeout=20
    )
    return rc == 0 and bool(out.strip())


def delivery_decision(repo_root: Path, ref: str) -> tuple[bool, str, dict]:
    """May anything push `ref`? Returns (allow, reason, facts).

    Order is load-bearing: tier first (only `supervised-delivery` pushes at
    all), then protected positions (a whitelist entry must not outvote the
    default branch or a tag), then the whitelist itself. Everything else is a
    refusal — a warning would be invisible to nobody in particular.
    """
    tier = read_autonomy(repo_root)
    cfg = read_delivery_config(repo_root)
    default_branch, default_source = default_branch_facts(repo_root)
    is_tag = ref_is_tag(repo_root, ref)
    remote = git.has_git_remote(repo_root)

    facts = {
        "tier": tier,
        "ref": ref,
        "remote": remote,
        "default_branch": default_branch,
        "default_source": default_source,
        "is_tag": is_tag,
        "auto_push_refs": cfg["auto_push_refs"],
        "protected_refs": cfg["protected_refs"],
        # Machine-readable refusal class. Callers branch on this, never on the
        # human `reason` text — a reason is prose meant for a ledger line, and
        # matching it with a regex silently reclassifies on every rewording.
        "code": "unknown",
    }

    if tier != TIER_SUPERVISED:
        facts["code"] = "tier"
        return False, f"tier({tier}) — push needs supervised-delivery", facts
    if default_branch and ref == default_branch:
        facts["code"] = "protected"
        return False, f"protected_ref(default_branch={default_branch};{default_source})", facts
    if is_tag:
        facts["code"] = "protected"
        return False, "protected_ref(tag)", facts
    hit_protected = _ref_matches(ref, cfg["protected_refs"])
    if hit_protected:
        facts["code"] = "protected"
        return False, f"protected_ref(configured:{hit_protected})", facts
    if cfg["malformed"]:
        facts["code"] = "config"
        return False, f"malformed_auto_push_refs({cfg['malformed']})", facts
    if not cfg["auto_push_refs"]:
        facts["code"] = "deferred"
        return False, "empty_auto_push_refs(degrades to hands-off)", facts
    hit = _ref_matches(ref, cfg["auto_push_refs"])
    if hit:
        facts["code"] = "allowed"
        return True, f"whitelist({hit})", facts
    facts["code"] = "whitelist"
    return False, "outside_auto_push_refs", facts


def cmd_delivery_gate(args: argparse.Namespace) -> int:
    """`task.py delivery-gate <ref> [--json]` — the push answer for the runner."""
    repo_root = get_repo_root()
    ref = str(getattr(args, "ref", "") or "").strip()
    if not ref:
        print(colored("Error: Missing arguments", Colors.RED))
        print("Usage: python3 task.py delivery-gate <ref> [--json]")
        return 1

    allow, reason, facts = delivery_decision(repo_root, ref)

    if getattr(args, "json", False):
        print(
            json.dumps(
                {
                    "allow": allow,
                    "reason": reason,
                    "code": facts["code"],
                    "tier": facts["tier"],
                    "ref": ref,
                    "facts": facts,
                },
                ensure_ascii=False,
            )
        )
    elif allow:
        print(colored(f"✓ push allowed: {ref} — {reason}", Colors.GREEN))
    else:
        print(colored(f"✗ push refused: {ref} — {reason}", Colors.RED))
    return 0 if allow else 1


def cmd_set_pr(args: argparse.Namespace) -> int:
    """`task.py set-pr <dir> <url>` — record the review pointer for the ticket."""
    value = getattr(args, "url", "")
    if not value:
        print(colored("Error: Missing arguments", Colors.RED))
        print("Usage: python3 task.py set-pr <task-dir> <pr-url>")
        return 1

    if not _PR_URL_RE.fullmatch(value.strip()):
        print(colored(f"Error: not a url: {value}", Colors.RED))
        print("Expected an http(s) review URL, e.g. the value `gh pr create` prints.")
        return 1

    if _write_task_field(args, "pr_url", value.strip()) != 0:
        return 1
    print(colored(f"✓ pr_url → {value.strip()}", Colors.GREEN))
    return 0


# CLAI-10 — the commit-discipline rule list, owned here so `trellis run` and an
# agent committing by hand answer to the same authority.
PROTECTED_PATH_FRAGMENTS = (
    ".trellis/domains/",
    ".env",
    ".pem",
    ".key",
    "id_rsa",
    ".git-credentials",
    "credentials.json",
    ".keystore",
    "secrets/",
    ".secrets",
    "secrets.yaml",
    "secrets.yml",
    "secrets.json",
    "secret.json",
)


def is_protected_path(path: str) -> bool:
    """Does this path belong in an automated commit? True means it does NOT.

    Board files (`.trellis/domains/**`) land in a human close-out commit under
    the writer's own flag; key material never lands anywhere unreviewed.
    """
    norm = str(path or "").replace("\\", "/").lower()
    return any(frag in norm for frag in PROTECTED_PATH_FRAGMENTS)


def cmd_check_commit(args: argparse.Namespace) -> int:
    """`task.py check-commit <path>... [--from-stdin] [--json]` (CLAI-10).

    The mechanical form of what `workflow.md` Phase 3.4 says in prose. Exit 0
    when every path is clear, 1 when any is not — a refusal, not a warning:
    nobody is watching an unattended run, and this list also gates delivery, so
    the answer has to be usable as a decision.
    """
    paths = [str(p) for p in (getattr(args, "paths", None) or []) if str(p).strip()]
    if getattr(args, "from_stdin", False):
        try:
            raw = sys.stdin.read()
        except Exception as exc:  # unreadable input is an unanswerable question
            print(colored(f"Error: cannot read stdin: {exc}", Colors.RED), file=sys.stderr)
            return 1
        paths += [line.strip() for line in raw.splitlines() if line.strip()]

    if not paths:
        print(
            colored("Error: nothing to check — pass paths or --from-stdin", Colors.RED),
            file=sys.stderr,
        )
        print("Usage: python3 task.py check-commit <path>... [--from-stdin] [--json]")
        return 1

    offending = [p for p in paths if is_protected_path(p)]

    if getattr(args, "json", False):
        print(
            json.dumps(
                {
                    "ok": not offending,
                    "checked": len(paths),
                    "offending": offending,
                    "rule": "always-stop paths never enter an automated commit",
                },
                ensure_ascii=False,
            )
        )
    elif offending:
        print(colored(f"✗ {len(offending)} of {len(paths)} path(s) must not enter this commit:", Colors.RED))
        for p in offending[:20]:
            print(f"    {p}")
        print("  Board files belong to a human close-out commit; key material belongs to nobody.")
    else:
        print(colored(f"✓ {len(paths)} path(s) clear", Colors.GREEN))
    return 1 if offending else 0

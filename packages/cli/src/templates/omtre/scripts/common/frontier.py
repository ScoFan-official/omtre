#!/usr/bin/env python3
"""
Task dependency frontier.

Answers the one question an unattended loop needs before it dispatches:
which active task can start *right now*. Blockers are the `blocked_by` refs
recorded on each task; a blocker counts as satisfied when the task it names is
completed or has left the active set through `archive`.

Provides:
    blocked_by_refs  - Effective blocker refs for a task dict
    meta_blocked_by  - Legacy `meta.blocked_by` value, if the task still uses it
    compute_frontier - {ready, blocked, cycles, warnings} over the active set
    cmd_frontier     - `task.py frontier` handler (human + --json)
"""

from __future__ import annotations

import argparse
from pathlib import Path

from .log import Colors, colored
from .paths import (
    DIR_ARCHIVE,
    DIR_TASKS,
    DIR_WORKFLOW,
    get_repo_root,
    get_tasks_dir,
)
from .tasks import iter_active_tasks

# Same completion vocabulary `children_progress` uses, so a parent's progress
# and the frontier never disagree about what "done" means.
_DONE_STATUSES = ("completed", "done")
_PRIORITY_ORDER = ("P0", "P1", "P2", "P3")


def _split_refs(value: object) -> list[str]:
    """Normalize a blocker value into individual refs.

    Accepts a list, or a whitespace/comma separated string (the shape
    `set-meta blocked_by "a b"` has always written).
    """
    if isinstance(value, list):
        items: list[str] = []
        for v in value:
            items.extend(_split_refs(v))
        return items
    if not isinstance(value, str):
        return []
    return [part for part in value.replace(",", " ").split() if part]


def blocked_by_refs(data: dict) -> list[str]:
    """Effective blocker refs of a task, preferring the formal field."""
    return _split_refs(data.get("blocked_by")) or _split_refs(
        (data.get("meta") or {}).get("blocked_by")
    )


def meta_blocked_by(data: dict) -> str | None:
    """Legacy `meta.blocked_by` value when the formal field is absent."""
    if data.get("blocked_by"):
        return None
    legacy = (data.get("meta") or {}).get("blocked_by")
    return legacy if legacy else None


def _ref_tail(ref: str) -> str:
    return ref.replace("\\", "/").rstrip("/").split("/")[-1]


def _archived_match(tasks_dir: Path, tail: str) -> bool:
    """True when a directory named `tail` lives under tasks/archive/.

    `cmd_archive` marks the task completed before moving it, so an archived
    blocker is satisfied by definition — but it is a *different* fact from a
    ref that matches nothing at all, which is data corruption.
    """
    archive_root = tasks_dir / DIR_ARCHIVE
    if not archive_root.is_dir():
        return False
    for month in archive_root.iterdir():
        if not month.is_dir():
            continue
        for candidate in (month / tail,):
            if candidate.is_dir():
                return True
        if any(child.name.endswith(f"-{tail}") for child in month.iterdir() if child.is_dir()):
            return True
    return False


def compute_frontier(repo_root: Path | None = None) -> dict:
    """Resolve the active task graph into startable work.

    Args:
        repo_root: Repository root. Defaults to auto-detected.

    Returns:
        Dict with:
          ready    - Tasks startable now, sorted by priority then dir
          blocked  - Tasks still waiting, with what they wait on
          cycles   - Dependency cycles (each a list of dir names)
          warnings - Ref strings that match neither an active nor an archived task
        Every entry carries: dir, path, title, status, priority, domain.
    """
    if repo_root is None:
        repo_root = get_repo_root()
    tasks_dir = get_tasks_dir(repo_root)

    active = {t.dir_name: t for t in iter_active_tasks(tasks_dir)}

    def _resolve(ref: str) -> str | None:
        """Map a ref onto an active dir name, or None when it points elsewhere."""
        if ref in active:
            return ref
        tail = _ref_tail(ref)
        if tail in active:
            return tail
        for name, t in active.items():
            if name.endswith(f"-{tail}"):
                return name
            for key in ("id", "name", "title"):
                if t.raw.get(key) == tail:
                    return name
        return None

    def _entry(name: str, **extra: object) -> dict:
        t = active[name]
        meta = t.raw.get("meta") or {}
        base = {
            "dir": name,
            "path": f"{DIR_WORKFLOW}/{DIR_TASKS}/{name}",
            "title": t.title,
            "status": t.status,
            "priority": t.priority,
            "domain": meta.get("domain") or None,
            "parent": t.parent,
        }
        base.update(extra)
        return base

    dependencies: dict[str, list[str]] = {}
    unsatisfied_refs: dict[str, list[str]] = {}
    warnings: list[str] = []

    for name, t in active.items():
        refs = blocked_by_refs(t.raw)
        waiting: list[str] = []
        dangling: list[str] = []
        for ref in refs:
            target = _resolve(ref)
            if target is not None:
                if active[target].status in _DONE_STATUSES:
                    continue
                if target == name:
                    dangling.append(f"{ref} (self-reference)")
                    warnings.append(f"{name}: blocked_by '{ref}' points at itself")
                    continue
                waiting.append(target)
            elif _archived_match(tasks_dir, _ref_tail(ref)) or _is_done_by_ref(ref, active):
                continue
            else:
                dangling.append(ref)
                warnings.append(f"{name}: blocked_by '{ref}' matches no active or archived task")
        dependencies[name] = waiting
        unsatisfied_refs[name] = dangling

    # Kahn peel: everything that still has unsatisfied edges afterwards is
    # either in a cycle or waiting behind one.
    remaining = {n: set(deps) for n, deps in dependencies.items()}
    changed = True
    while changed:
        changed = False
        for name in list(remaining):
            if not remaining[name]:
                del remaining[name]
                changed = True
        for deps in remaining.values():
            for name in list(deps):
                if name not in remaining:
                    deps.discard(name)
                    changed = True

    cycles = _cycle_groups(remaining)

    ready = []
    blocked = []
    for name in sorted(active):
        if active[name].status in _DONE_STATUSES:
            continue
        deps = dependencies[name]
        unresolved = unsatisfied_refs[name]
        # An unresolved ref keeps its task un-startable: a blocker the graph
        # cannot locate is a data error, and guessing it is satisfied would let
        # an unattended loop dispatch work that may not be ready.
        if deps or unresolved:
            cycle_hit = [c for c in cycles if name in c]
            entry = _entry(
                name,
                waiting_on=sorted(set(deps)),
                unresolved=unresolved,
            )
            if cycle_hit:
                entry["in_cycle"] = cycle_hit[0]
            blocked.append(entry)
            continue
        ready.append(_entry(name, blocked_by=[]))

    ready.sort(key=lambda e: (_PRIORITY_ORDER.index(e["priority"]) if e["priority"] in _PRIORITY_ORDER else 9, e["dir"]))

    return {"ready": ready, "blocked": blocked, "cycles": cycles, "warnings": warnings}


def _is_done_by_ref(ref: str, active: dict) -> bool:
    """A ref naming a task that already reported completed but is unmatched."""
    tail = _ref_tail(ref)
    return any(
        t.status in _DONE_STATUSES and (t.dir_name == tail or t.dir_name.endswith(f"-{tail}"))
        for t in active.values()
    )


def _cycle_groups(remaining: dict[str, set[str]]) -> list[list[str]]:
    """Groups of tasks that mutually block each other.

    Runs on the leftover subgraph after the Kahn peel, where every node still
    has an unsatisfied edge, so a cycle is guaranteed to exist somewhere.
    Grouping by mutual reachability is O(n²) on a graph this small and far
    harder to get subtly wrong than a hand-rolled strongly-connected pass.
    """
    if not remaining:
        return []

    def reachable_from(root: str) -> set[str]:
        seen: set[str] = set()
        stack = list(remaining.get(root, set()))
        while stack:
            node = stack.pop()
            if node in seen or node not in remaining:
                continue
            seen.add(node)
            stack.extend(remaining[node])
        return seen

    reach = {node: reachable_from(node) for node in remaining}

    groups: list[list[str]] = []
    assigned: set[str] = set()
    for node in sorted(remaining):
        if node in assigned:
            continue
        members = [other for other in remaining if other in reach[node] and node in reach[other]]
        if members:
            group = sorted(set(members) | {node})
            groups.append(group)
            assigned.update(group)

    return groups


def cmd_frontier(args: argparse.Namespace) -> int:
    """Handle `task.py frontier`."""
    import json

    repo_root = get_repo_root()
    result = compute_frontier(repo_root)
    board = getattr(args, "board", None)
    if board:
        for key in ("ready", "blocked"):
            result[key] = [e for e in result[key] if e.get("domain") == board]

    if getattr(args, "json", False):
        print(json.dumps(result, ensure_ascii=False))
        return 1 if result["cycles"] else 0

    print(colored("=== Frontier ===", Colors.BLUE))
    print()

    if result["ready"]:
        print(colored(f"Ready now ({len(result['ready'])}):", Colors.GREEN))
        for e in result["ready"]:
            domain = f" @{e['domain']}" if e.get("domain") else ""
            print(f"  - {e['dir']}/ ({e['status']}) [{e['priority']}]{domain} {e['title']}")
    else:
        print(colored("Ready now: (none)", Colors.YELLOW))

    waiting = [e for e in result["blocked"] if not e.get("in_cycle")]
    if waiting:
        print()
        print(colored(f"Blocked ({len(waiting)}):", Colors.YELLOW))
        for e in waiting:
            print(f"  - {e['dir']}/ waiting on {', '.join(e['waiting_on'])}")
            for ref in e.get("unresolved", []):
                print(f"      unresolved ref: {ref}")

    if result["warnings"]:
        print()
        for warning in result["warnings"]:
            print(colored(f"Warning: {warning}", Colors.YELLOW))

    if result["cycles"]:
        print()
        print(colored("Dependency cycles:", Colors.RED))
        for group in result["cycles"]:
            print(f"  - {' -> '.join(group)}")
        print()
        print("Fix: break the loop with `task.py set-meta <dir> blocked_by \"...\"`.")
        return 1

    return 0

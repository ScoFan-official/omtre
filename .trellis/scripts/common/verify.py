#!/usr/bin/env python3
"""
Task verification contracts (R4 / D3).

A task records the commands that prove it is done. Archiving runs them
instead of trusting a stored "last passed" flag: a recorded result goes stale
the moment the base branch moves, and an unattended loop must not land work on
evidence it did not just observe.

Trust note: the commands come from task.json inside this repo, the same trust
boundary as a CI script. Entries are printed before they run.

Provides:
    verify_specs   - Normalized [{cmd, expect_exit, timeout}] from a task dict
    run_verify     - Execute the contract, return (all_passed, results)
    cmd_add_verify / cmd_clear_verify / cmd_run_verify
    archive_gate   - Autonomy-aware refusal decision used by task.py archive
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from . import clai_delta
from .config import coerce_config_bool
from .log import Colors, colored
from .paths import FILE_TASK_JSON, get_repo_root
from .io import describe_json_read_failure, read_json_checked, write_json
from .task_utils import (
    HOOK_KILL_GRACE_SECONDS,
    _decode_hook_output,
    _kill_hook_tree,
    resolve_task_dir,
)

DEFAULT_TIMEOUT = 600


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _coerce(raw: object) -> tuple[list[dict], list[str]]:
    """Normalize a `verify` value into specs, collecting shape problems.

    Accepts a list of objects ({"cmd": ..., "expect_exit": ...}), a list of
    plain strings, or a single string — hand-written PRDs do all three.
    """
    problems: list[str] = []
    specs: list[dict] = []

    if raw is None:
        return specs, problems

    entries = raw if isinstance(raw, list) else [raw]
    for index, entry in enumerate(entries):
        if isinstance(entry, str):
            cmd = entry.strip()
            if not cmd:
                problems.append(f"verify[{index}]: empty command")
                continue
            specs.append({"cmd": cmd, "expect_exit": 0, "timeout": DEFAULT_TIMEOUT})
            continue
        if not isinstance(entry, dict):
            problems.append(f"verify[{index}]: expected an object or a string")
            continue

        cmd = entry.get("cmd")
        if not isinstance(cmd, str) or not cmd.strip():
            problems.append(f"verify[{index}]: missing a non-empty 'cmd'")
            continue

        expect_exit = entry.get("expect_exit", 0)
        if isinstance(expect_exit, bool) or not isinstance(expect_exit, int):
            problems.append(f"verify[{index}]: 'expect_exit' must be an integer")
            expect_exit = 0

        timeout = entry.get("timeout", DEFAULT_TIMEOUT)
        if isinstance(timeout, bool) or not isinstance(timeout, int) or timeout <= 0:
            problems.append(f"verify[{index}]: 'timeout' must be a positive integer")
            timeout = DEFAULT_TIMEOUT

        specs.append({"cmd": cmd.strip(), "expect_exit": expect_exit, "timeout": timeout})

    return specs, problems


def verify_specs(task_data: dict) -> tuple[list[dict], list[str]]:
    """Effective verification contract of a task, with shape problems."""
    return _coerce(task_data.get("verify"))


def _run_bounded(
    cmd: str, repo_root: Path, timeout: int
) -> tuple[int | None, str]:
    """Run one contract command; on timeout kill its WHOLE process tree.

    ``subprocess.run(timeout=…)`` kills only the shell, and with ``shell=True``
    the shell is never the real work: grandchildren survive, keep the inherited
    stdout/stderr pipes open, and the post-kill collect then blocks for as long
    as the orphan lives — a daemon means forever. That hangs `run-verify`, which
    hangs `archive`, which hangs the unattended loop, i.e. the exact command the
    timeout was there to bound. (script-conventions.md → "Wrong — timeout that
    kills only the shell".) Returns (exit_code, output); exit_code is None on
    timeout.
    """
    # A fresh session puts the shell and every descendant in one process group,
    # which is what lets the timeout kill the tree rather than its outermost
    # member. Windows walks the tree with `taskkill /F /T` instead.
    popen_kwargs: dict = {}
    if os.name == "posix":
        popen_kwargs["start_new_session"] = True

    proc: subprocess.Popen[str] = subprocess.Popen(  # noqa: S602 - repo-local contract, mirrors CI
        cmd,
        shell=True,
        cwd=repo_root,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        **popen_kwargs,
    )
    try:
        stdout, stderr = proc.communicate(timeout=timeout)
        return proc.returncode, (stderr or stdout or "")
    except subprocess.TimeoutExpired as exc:
        _kill_hook_tree(proc)
        out = _decode_hook_output(exc.stdout)
        err = _decode_hook_output(exc.stderr)
        try:
            # Bounded a second time on purpose: an orphan that escaped the kill
            # must not convert a timeout into a hang.
            rest_out, rest_err = proc.communicate(timeout=HOOK_KILL_GRACE_SECONDS)
            out = rest_out or out
            err = rest_err or err
        except (subprocess.TimeoutExpired, OSError, ValueError):
            pass
        return None, (err or out)


def run_verify(
    task_dir: Path,
    specs: list[dict],
    repo_root: Path,
    quiet: bool = False,
) -> tuple[bool, list[dict]]:
    """Run each command from the repo root and compare against its exit code.

    `quiet` keeps stdout clean for --json callers.
    """
    results: list[dict] = []
    all_passed = True

    for spec in specs:
        if not quiet:
            print(f"  $ {spec['cmd']}")
        exit_code, output = _run_bounded(spec["cmd"], repo_root, spec["timeout"])
        timed_out = exit_code is None

        passed = (not timed_out) and exit_code == spec["expect_exit"]
        all_passed = all_passed and passed

        outcome = "TIMEOUT" if timed_out else f"exit {exit_code}"
        results.append(
            {
                "cmd": spec["cmd"],
                "expect_exit": spec["expect_exit"],
                "exit_code": exit_code,
                "passed": passed,
                "ran_at": _now(),
            }
        )
        if quiet:
            continue
        if passed:
            print(colored(f"    ✓ {outcome}", Colors.GREEN))
        else:
            print(colored(f"    ✗ {outcome} (expected {spec['expect_exit']})", Colors.RED))
            for line in output.strip().splitlines()[-5:]:
                print(f"      {line}")

    return all_passed, results


def _load_task(args: argparse.Namespace) -> tuple[Path | None, Path | None, dict | None]:
    """Resolve <dir> and load its task.json, reporting why it could not."""
    repo_root = get_repo_root()
    task_dir = resolve_task_dir(args.dir, repo_root)
    if task_dir is None or not task_dir.is_dir():
        print(colored(f"Error: Task not found: {args.dir}", Colors.RED), file=sys.stderr)
        return None, None, None

    task_json = task_dir / FILE_TASK_JSON
    if not task_json.is_file():
        print(colored(f"Error: task.json not found at {task_dir}", Colors.RED), file=sys.stderr)
        return task_dir, None, None

    data, reason = read_json_checked(task_json)
    if data is None:
        problem, hint = describe_json_read_failure(task_json, reason)
        print(colored(f"Error: {problem}", Colors.RED), file=sys.stderr)
        print(hint, file=sys.stderr)
        return task_dir, task_json, None

    return task_dir, task_json, data


def cmd_add_verify(args: argparse.Namespace) -> int:
    """Append one verification command to a task."""
    _task_dir, task_json, data = _load_task(args)
    if data is None or task_json is None:
        return 1

    cmd = (args.cmd or "").strip()
    if not cmd:
        print(colored("Error: verification command must not be empty", Colors.RED), file=sys.stderr)
        return 1

    specs, problems = verify_specs(data)
    for problem in problems:
        print(colored(f"Warning: dropping malformed existing entry — {problem}", Colors.YELLOW))
    if any(spec["cmd"] == cmd for spec in specs):
        print(colored(f"✓ Already recorded: {cmd}", Colors.GREEN))
        return 0

    specs.append(
        {
            "cmd": cmd,
            "expect_exit": int(args.expect_exit),
            "timeout": int(args.timeout),
        }
    )
    data["verify"] = specs
    if not write_json(task_json, data):
        print(colored(f"Error: failed to write {task_json}", Colors.RED), file=sys.stderr)
        return 1

    print(colored(f"✓ Verify added ({len(specs)} total): {cmd}", Colors.GREEN))
    return 0


def cmd_clear_verify(args: argparse.Namespace) -> int:
    """Remove the verification contract from a task."""
    _task_dir, task_json, data = _load_task(args)
    if data is None or task_json is None:
        return 1

    if "verify" not in data:
        print("No verification contract recorded.")
        return 0

    data["verify"] = []
    if not write_json(task_json, data):
        print(colored(f"Error: failed to write {task_json}", Colors.RED), file=sys.stderr)
        return 1

    print(colored("✓ Verify cleared", Colors.GREEN))
    return 0


def cmd_run_verify(args: argparse.Namespace) -> int:
    """Run a task's verification contract and report."""
    task_dir, _task_json, data = _load_task(args)
    if task_dir is None or data is None:
        return 1

    specs, problems = verify_specs(data)
    as_json = bool(getattr(args, "json", False))

    if problems and not as_json:
        for problem in problems:
            print(colored(f"Warning: {problem}", Colors.YELLOW))

    if not specs:
        if as_json:
            print(json.dumps({"verified": False, "reason": "no_contract", "results": []}, ensure_ascii=False))
        else:
            print(colored("No verification contract recorded. Add one with:", Colors.YELLOW))
            print("  python .trellis/scripts/task.py add-verify <dir> \"<cmd>\"")
        return 1

    repo_root = get_repo_root()
    if not as_json:
        print(colored("=== Verify ===", Colors.BLUE))
        print(f"Task: {task_dir.name}  ({len(specs)} command(s))")
        print()

    all_passed, results = run_verify(task_dir, specs, repo_root, quiet=as_json)

    if as_json:
        print(json.dumps({"verified": all_passed, "results": results}, ensure_ascii=False))
    else:
        print()
        if all_passed:
            print(colored("✓ All verification commands passed", Colors.GREEN))
        else:
            print(colored("✗ Verification failed", Colors.RED))

    return 0 if all_passed else 1


def verify_required(repo_root: Path) -> bool:
    """Whether a missing contract blocks archive (config `verify_required:`).

    One helper for the boolean, as every other config key does: `yes` / `on` /
    `1` have to mean the same thing here as they do anywhere else in the file,
    and an unrecognized value falls back to the default with a warning instead
    of silently selecting the other branch.

    The default is per tier, which D3 promised when the third tier landed: a
    repo that lets an unattended run push must not archive on prose, so
    `supervised-delivery` blocks by default and the other two stay as loud
    warnings until the operator opts in.
    """
    config = clai_delta.read_trellis_config(repo_root)
    default = clai_delta.read_autonomy(repo_root) == clai_delta.TIER_SUPERVISED
    if "verify_required" not in config:
        return default
    return coerce_config_bool(config["verify_required"], default, "verify_required")


def archive_gate(task_data: dict, task_dir: Path, args: argparse.Namespace, repo_root: Path) -> bool:
    """Decide whether archive may proceed, running the contract as it goes.

    Returns True to continue archiving, False to refuse. A contract that exists
    and fails always blocks — that is observed evidence, not a formality. A
    missing contract only blocks when the repo opts in via `verify_required`, so
    existing repos keep working until they choose the stricter rule. Bypassing
    requires a reason either way, because the reason is what the worklog cites.
    """
    specs, problems = verify_specs(task_data)
    autonomy = clai_delta.read_autonomy(repo_root)
    required = verify_required(repo_root)
    skip_reason = getattr(args, "skip_verify", None)

    for problem in problems:
        print(colored(f"Warning: verify contract is malformed — {problem}", Colors.YELLOW))

    if skip_reason is not None:
        reason = str(skip_reason).strip()
        if not reason:
            print(
                colored(
                    "Error: --skip-verify needs a non-empty reason — it is the record the "
                    "worklog cites in place of a passing run.",
                    Colors.RED,
                ),
                file=sys.stderr,
            )
            return False
        task_data["verify_skipped"] = {"reason": reason, "at": _now()}
        print(colored(f"Warning: verification skipped — {reason}", Colors.YELLOW))
        return True

    if not specs:
        message = (
            "the task has no verification contract, so there is no command to re-run as evidence"
            if required
            else "the task has no verification contract"
        )
        if not required:
            print(
                colored(
                    f"Warning: archiving without evidence — {message}. "
                    "Set `verify_required: true` in .trellis/config.yaml to make this a refusal.",
                    Colors.YELLOW,
                )
            )
            return True
        print(
            colored(
                f"Error: refusing to archive — {message} (verify_required is on).\n"
                "  Record one: python .trellis/scripts/task.py add-verify <dir> \"<cmd>\"\n"
                "  Or bypass for this task: --skip-verify \"<why>\"",
                Colors.RED,
            ),
            file=sys.stderr,
        )
        return False

    print(colored(f"Running verification before archive ({len(specs)} command(s)):", Colors.BLUE))
    all_passed, _results = run_verify(task_dir, specs, repo_root)
    if all_passed:
        return True

    print(
        colored(
            "Error: verification failed; nothing was archived. Fix the work, then archive again."
            + ("" if autonomy != "gated" else " (gated autonomy: you may still pass --skip-verify)"),
            Colors.RED,
        ),
        file=sys.stderr,
    )
    return False

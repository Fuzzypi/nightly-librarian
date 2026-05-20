#!/usr/bin/env python3
"""Create a GitHub repository and push the current directory to it."""

from __future__ import annotations

import base64
import os
import shlex
import subprocess
import sys
from pathlib import Path
from typing import Sequence


REPO_NAME = "nightly-librarian"
COMMIT_MESSAGE = "Initial commit"
DEFAULT_BRANCH = "main"
REMOTE_NAME = "origin"


class SetupError(RuntimeError):
    """Raised for expected setup, GitHub API, or git command failures."""


def load_pygithub():
    """Import PyGithub lazily so local syntax checks do not need the package."""
    try:
        from github import Github
        from github.GithubException import BadCredentialsException, GithubException
    except ModuleNotFoundError as exc:
        if exc.name == "github":
            raise SetupError(
                "PyGithub is not installed. Install it with: "
                "python -m pip install PyGithub"
            ) from exc
        raise

    try:
        from github import Auth
    except ImportError:
        Auth = None

    return Auth, Github, BadCredentialsException, GithubException


def require_token() -> str:
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    if not token:
        raise SetupError(
            "GITHUB_TOKEN is not set. Set it to a GitHub personal access token "
            "with repo scope."
        )
    return token


def redact(text: str, token: str | None = None) -> str:
    if token:
        return text.replace(token, "[redacted]")
    return text


def format_github_error(error: BaseException) -> str:
    data = getattr(error, "data", None)
    if not isinstance(data, dict):
        return str(error)

    message = data.get("message") or str(error)
    errors = data.get("errors") or []
    details = []
    for item in errors:
        if isinstance(item, dict):
            details.append(item.get("message") or item.get("code") or str(item))
        else:
            details.append(str(item))

    if details:
        return f"{message}: {'; '.join(details)}"
    return str(message)


def run_git(args: Sequence[str], cwd: Path, token: str | None = None) -> str:
    env = os.environ.copy()
    if token:
        auth = base64.b64encode(f"x-access-token:{token}".encode()).decode()
        env.update(
            {
                "GIT_CONFIG_COUNT": "1",
                "GIT_CONFIG_KEY_0": "http.https://github.com/.extraheader",
                "GIT_CONFIG_VALUE_0": f"AUTHORIZATION: basic {auth}",
            }
        )

    try:
        completed = subprocess.run(
            ["git", *args],
            cwd=cwd,
            env=env,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
        )
    except FileNotFoundError as exc:
        raise SetupError("git is not installed or is not available on PATH.") from exc
    except subprocess.CalledProcessError as exc:
        command = "git " + " ".join(shlex.quote(arg) for arg in args)
        output = (exc.stderr or exc.stdout or "").strip()
        detail = f": {redact(output, token)}" if output else ""
        raise SetupError(f"{command} failed{detail}") from exc

    return completed.stdout.strip()


def create_github_repo(token: str) -> str:
    Auth, Github, BadCredentialsException, GithubException = load_pygithub()
    github = Github(auth=Auth.Token(token)) if Auth else Github(token)

    try:
        user = github.get_user()
        repo = user.create_repo(
            name=REPO_NAME,
            private=False,
            auto_init=False,
        )
        return repo.clone_url
    except BadCredentialsException as exc:
        raise SetupError(
            "GitHub authentication failed. Check that GITHUB_TOKEN is valid "
            "and has repo scope."
        ) from exc
    except GithubException as exc:
        status = getattr(exc, "status", None)
        message = format_github_error(exc)
        if status == 422:
            raise SetupError(
                f"GitHub could not create {REPO_NAME!r}. The repository may "
                f"already exist or the name may be unavailable: {message}"
            ) from exc
        if status in {401, 403}:
            raise SetupError(
                f"GitHub rejected the request. Check token permissions: {message}"
            ) from exc
        raise SetupError(f"GitHub API error while creating the repository: {message}") from exc
    finally:
        close = getattr(github, "close", None)
        if callable(close):
            close()


def configure_remote(cwd: Path, clone_url: str) -> None:
    remotes = set(run_git(["remote"], cwd).splitlines())
    if REMOTE_NAME in remotes:
        run_git(["remote", "set-url", REMOTE_NAME, clone_url], cwd)
    else:
        run_git(["remote", "add", REMOTE_NAME, clone_url], cwd)


def push_current_directory(cwd: Path, clone_url: str, token: str) -> None:
    run_git(["init"], cwd)
    run_git(["add", "--all"], cwd)

    status = run_git(["status", "--short"], cwd)
    if not status:
        raise SetupError("There are no files or changes to commit.")

    run_git(["commit", "-m", COMMIT_MESSAGE], cwd)
    run_git(["branch", "-M", DEFAULT_BRANCH], cwd)
    configure_remote(cwd, clone_url)
    run_git(["push", "-u", REMOTE_NAME, DEFAULT_BRANCH], cwd, token=token)


def main() -> int:
    try:
        token = require_token()
        clone_url = create_github_repo(token)
        push_current_directory(Path.cwd(), clone_url, token)
    except SetupError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("Error: interrupted.", file=sys.stderr)
        return 130

    print(clone_url)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Tests verifying Docker container isolation and --network=none for Semgrep."""
from pathlib import Path

import pytest

from app.scanner.docker_runner import DockerRunner
from app.scanner.interfaces import ScannerExecutionContext
from app.security.semgrep.rules import get_default_rules_directory


@pytest.fixture
def context(tmp_path: Path):
    workspace = tmp_path / "workspace"
    output = tmp_path / "output"
    workspace.mkdir()
    output.mkdir()
    return ScannerExecutionContext(
        scan_id="test-scan-isolation",
        workspace_path=workspace,
        output_path=output,
        timeout_seconds=60,
    )


def test_semgrep_docker_command_enforces_network_none(context):
    runner = DockerRunner(docker_binary="docker")
    cmd = runner._build_command(
        context=context,
        engine_name="semgrep",
        image="semgrep/semgrep:1.90.0",
        engine_command=["semgrep", "scan", "--config", "/rules", "/code"],
    )

    # Verify container run flags
    assert "--network=none" in cmd, "Semgrep must execute with --network=none for offline sandbox guarantee"
    assert "--read-only" in cmd, "Container filesystem must be read-only"

    # Verify volume mounts
    cmd_str = " ".join(cmd)
    rules_dir = get_default_rules_directory()
    assert f"source={rules_dir.resolve()},target=/rules,readonly" in cmd_str
    assert f"source={context.workspace_path.resolve()},target=/code,readonly" in cmd_str
    assert f"source={context.output_path.resolve()},target=/output" in cmd_str


def test_container_name_is_deterministic(context):
    runner = DockerRunner(docker_binary="docker")
    name1 = runner._container_name(context.scan_id, "semgrep")
    name2 = runner._container_name(context.scan_id, "semgrep")
    assert name1 == name2
    assert "semgrep" in name1

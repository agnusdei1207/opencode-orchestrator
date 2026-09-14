param()

$ErrorActionPreference = 'Stop'
if ($args.Count -eq 0) { throw 'usage: scripts/dbuild.ps1 <cargo arguments>' }
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$dockerArgs = @(
    'run', '--rm', '--memory', '2g', '--memory-swap', '2g',
    '--cpus', '2', '--pids-limit', '512',
    '--volume', "${repoRoot}:/workspace",
    '--volume', 'oco-cargo-registry:/usr/local/cargo/registry',
    '--volume', 'oco-cargo-target:/workspace/target',
    '--workdir', '/workspace', '--env', 'CARGO_BUILD_JOBS=2',
    'rust:1.92-bookworm'
)
if ($args[0] -in @('fmt', 'clippy')) {
    $component = if ($args[0] -eq 'fmt') { 'rustfmt' } else { 'clippy' }
    $dockerArgs += @('sh', '-c', 'rustup component add "$1" && shift && cargo "$@"', 'dbuild', $component)
} else {
    $dockerArgs += 'cargo'
}
$dockerArgs += $args
& docker @dockerArgs
exit $LASTEXITCODE

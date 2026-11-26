# Bumps the version, builds, pushes the game to GitHub (one commit) and creates a GitHub release.
# GitHub Pages then serves the new build, and open games notice the new version.txt and reload themselves.
# Usage: .\publish.ps1 -Notes "What changed"
param(
    [string]$Notes = "Update",
    [string]$Gh = "$env:TEMP\shtk\gh\bin\gh.exe",
    [switch]$NoBump
)
$ErrorActionPreference = 'Stop'
$P = $PSScriptRoot
$repo = (Get-Content "$P\repo.txt" -Raw).Trim()
$code, $name = (Get-Content "$P\version.txt" -Raw).Trim() -split '\s+'
if (-not $NoBump) {
    $code = [int]$code + 1
    $parts = $name -split '\.'
    $name = "$($parts[0]).$([int]$parts[1] + 1)"
    "$code $name" | Set-Content "$P\version.txt" -Encoding ascii
}

. "$P\build.ps1"
$files = $SiteFiles + @('build.ps1', 'publish.ps1', 'serve.ps1', 'repo.txt', 'README.md')

function Invoke-GhJson($Method, $Path, $Body) {
    $tmp = [IO.Path]::GetTempFileName()
    [IO.File]::WriteAllText($tmp, ($Body | ConvertTo-Json -Depth 10 -Compress), [Text.UTF8Encoding]::new($false))
    $out = & $Gh api -X $Method $Path --input $tmp
    $ok = $LASTEXITCODE -eq 0
    Remove-Item $tmp
    if (-not $ok) { throw "gh api $Method $Path failed" }
    return ($out | ConvertFrom-Json)
}

$head = (& $Gh api "repos/$repo/git/ref/heads/main" | ConvertFrom-Json).object.sha
$baseTree = (& $Gh api "repos/$repo/git/commits/$head" | ConvertFrom-Json).tree.sha
$tree = @()
foreach ($f in $files) {
    $bytes = [IO.File]::ReadAllBytes((Join-Path $P $f))
    $blob = Invoke-GhJson POST "repos/$repo/git/blobs" @{ content = [Convert]::ToBase64String($bytes); encoding = 'base64' }
    $tree += @{ path = $f; mode = '100644'; type = 'blob'; sha = $blob.sha }
}
$newTree = Invoke-GhJson POST "repos/$repo/git/trees" @{ base_tree = $baseTree; tree = $tree }
$commit = Invoke-GhJson POST "repos/$repo/git/commits" @{ message = "City Drive $name (build $code)"; tree = $newTree.sha; parents = @($head) }
Invoke-GhJson PATCH "repos/$repo/git/refs/heads/main" @{ sha = $commit.sha } | Out-Null

& $Gh release create "v$code" --repo $repo --target main --title "City Drive $name" --notes $Notes
if ($LASTEXITCODE -ne 0) { throw "gh release failed" }
$owner, $rname = $repo -split '/'
Write-Host "Published v$code ($name) to $repo -> https://$owner.github.io/$rname/"

# "Builds" the web game: stamps the version from version.txt into index.html and gathers the files to upload.
# The game needs no compiling; GitHub Pages serves these files directly.
$ErrorActionPreference = 'Stop'
$P = $PSScriptRoot
$code = ((Get-Content "$P\version.txt" -Raw).Trim() -split '\s+')[0]
$html = [IO.File]::ReadAllText("$P\index.html")
$html = [regex]::Replace($html, '<meta name="build" content="\d+">', "<meta name=`"build`" content=`"$code`">")
[IO.File]::WriteAllText("$P\index.html", $html, [Text.UTF8Encoding]::new($false))
# Files published to the site (relative paths)
$script:SiteFiles = @('index.html', 'version.txt', 'src/main.js', 'src/cars.js', 'src/world.js', 'src/audio.js', '.nojekyll')
if (-not (Test-Path "$P\.nojekyll")) { New-Item -ItemType File "$P\.nojekyll" | Out-Null }
Write-Host "Built City Drive build $code"

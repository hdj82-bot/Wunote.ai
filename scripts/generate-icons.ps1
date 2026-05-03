# Generate Wunote PWA icons (any + maskable variants).
#
# Outputs:
#   public/icons/icon-192.png         - any  purpose, full bleed (no safe zone)
#   public/icons/icon-512.png         - any  purpose, full bleed
#   public/icons/icon-192-maskable.png - maskable, 10% safe-zone padding (Android adaptive)
#   public/icons/icon-512-maskable.png - maskable, 10% safe-zone padding
#
# Run: powershell -ExecutionPolicy Bypass -File scripts/generate-icons.ps1
# Requires: Windows .NET (System.Drawing). No third-party deps.

[System.Reflection.Assembly]::LoadWithPartialName('System.Drawing') | Out-Null

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$out  = Join-Path $root 'public\icons'
if (-not (Test-Path $out)) { New-Item -ItemType Directory -Path $out | Out-Null }

# Brand palette (matches manifest.json theme_color and tailwind indigo).
$primary   = [System.Drawing.ColorTranslator]::FromHtml('#4F46E5')  # indigo-600
$primaryHi = [System.Drawing.ColorTranslator]::FromHtml('#6366F1')  # indigo-500
$accent    = [System.Drawing.ColorTranslator]::FromHtml('#FBBF24')  # amber-400 (correction underline)
$paper     = [System.Drawing.ColorTranslator]::FromHtml('#FFFFFF')

function New-WunoteIcon {
    param(
        [int]$Size,
        [bool]$Maskable
    )

    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Maskable variant: keep glyph inside the 80% safe zone (Android masks corners).
    # See https://web.dev/maskable-icon/ — minimum safe area is a 40% radius circle.
    $pad = if ($Maskable) { [int]($Size * 0.10) } else { 0 }
    $inner = $Size - 2 * $pad

    # Background: full bleed indigo gradient (covers the maskable bleed area too).
    $bgRect = New-Object System.Drawing.Rectangle 0, 0, $Size, $Size
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $bgRect, $primary, $primaryHi,
        [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
    )

    if ($Maskable) {
        # Maskable: rectangular full-bleed background.
        $g.FillRectangle($bgBrush, $bgRect)
    } else {
        # Any: rounded square (modern app icon look).
        $r = [int]($Size * 0.22)
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddArc(0, 0, $r * 2, $r * 2, 180, 90)
        $path.AddArc($Size - $r * 2, 0, $r * 2, $r * 2, 270, 90)
        $path.AddArc($Size - $r * 2, $Size - $r * 2, $r * 2, $r * 2, 0, 90)
        $path.AddArc(0, $Size - $r * 2, $r * 2, $r * 2, 90, 90)
        $path.CloseFigure()
        $g.FillPath($bgBrush, $path)
        $path.Dispose()
    }
    $bgBrush.Dispose()

    # Glyph: stylized "W" + correction caret. Uses Inter/Segoe glyph for "Wu".
    # Drawn inside the safe zone ($pad..$pad+$inner).
    $glyphFamily = 'Segoe UI'
    try { $null = New-Object System.Drawing.FontFamily($glyphFamily) }
    catch { $glyphFamily = 'Arial' }

    $fontSize = [int]($inner * 0.62)
    $font = New-Object System.Drawing.Font($glyphFamily, $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $paperBrush = New-Object System.Drawing.SolidBrush $paper

    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment     = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center

    $glyphRect = New-Object System.Drawing.RectangleF(
        [single]$pad,
        [single]($pad - $inner * 0.04),
        [single]$inner,
        [single]$inner
    )
    $g.DrawString('W', $font, $paperBrush, $glyphRect, $sf)

    # Accent underline mark — evokes the "correction" theme.
    $underlineY      = $pad + $inner * 0.78
    $underlineWidth  = $inner * 0.42
    $underlineHeight = [single]([Math]::Max(2, $inner * 0.05))
    $underlineX      = $pad + ($inner - $underlineWidth) / 2

    $accentBrush = New-Object System.Drawing.SolidBrush $accent
    $r2 = [single]($underlineHeight / 2)
    $uPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $uPath.AddArc($underlineX, $underlineY, $underlineHeight, $underlineHeight, 90, 180)
    $uPath.AddArc($underlineX + $underlineWidth - $underlineHeight, $underlineY, $underlineHeight, $underlineHeight, 270, 180)
    $uPath.CloseFigure()
    $g.FillPath($accentBrush, $uPath)
    $uPath.Dispose()
    $accentBrush.Dispose()

    $font.Dispose()
    $paperBrush.Dispose()
    $sf.Dispose()
    $g.Dispose()

    $suffix = if ($Maskable) { '-maskable' } else { '' }
    $path = Join-Path $out ("icon-{0}{1}.png" -f $Size, $suffix)
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output ("wrote {0}" -f $path)
}

New-WunoteIcon -Size 192 -Maskable $false
New-WunoteIcon -Size 512 -Maskable $false
New-WunoteIcon -Size 192 -Maskable $true
New-WunoteIcon -Size 512 -Maskable $true

# Apple touch icon — 180x180, opaque, no transparency (iOS Safari ignores transparency).
New-WunoteIcon -Size 180 -Maskable $false
$apple = Join-Path $out 'icon-180.png'
$src   = Join-Path $out 'icon-180.png'
if (Test-Path $src) {
    Copy-Item $src (Join-Path $out 'apple-touch-icon.png') -Force
}

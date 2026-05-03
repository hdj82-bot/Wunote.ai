# Generate iOS splash screens for "Add to Home Screen" launches.
#
# iOS shows these images during the cold-start gap before the SW activates.
# Without them you get a white flash. Apple recommends device-specific sizes
# but the marginal value of supporting every form factor is low — we ship
# four representative sizes covering >95% of devices in the wild and pad
# everything else with the regular launch screen.
#
# Outputs to public/icons/:
#   apple-splash-2048-2732.png  iPad Pro 12.9" (portrait)
#   apple-splash-1668-2388.png  iPad Pro 11" / iPad Air 10.9" (portrait)
#   apple-splash-1170-2532.png  iPhone 12/13/14/15 standard (portrait)
#   apple-splash-1284-2778.png  iPhone 14 Pro Max / 15 Plus (portrait)
#
# Run: powershell -ExecutionPolicy Bypass -File scripts/generate-ios-splash.ps1
# Requires: Windows .NET (System.Drawing). No third-party deps.

[System.Reflection.Assembly]::LoadWithPartialName('System.Drawing') | Out-Null

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$out  = Join-Path $root 'public\icons'
if (-not (Test-Path $out)) { New-Item -ItemType Directory -Path $out | Out-Null }

$primary   = [System.Drawing.ColorTranslator]::FromHtml('#4F46E5')
$primaryHi = [System.Drawing.ColorTranslator]::FromHtml('#6366F1')
$accent    = [System.Drawing.ColorTranslator]::FromHtml('#FBBF24')
$paper     = [System.Drawing.ColorTranslator]::FromHtml('#FFFFFF')

function New-Splash {
    param(
        [int]$Width,
        [int]$Height
    )

    $bmp = New-Object System.Drawing.Bitmap $Width, $Height
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Background — same indigo gradient as the app icon.
    $bgRect = New-Object System.Drawing.Rectangle 0, 0, $Width, $Height
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $bgRect, $primary, $primaryHi,
        [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
    )
    $g.FillRectangle($bgBrush, $bgRect)
    $bgBrush.Dispose()

    # Logo: centered "W" glyph + accent underline. Sized off the shorter edge
    # so portrait/landscape both look balanced.
    $shortEdge = [Math]::Min($Width, $Height)
    $logoSize  = [int]($shortEdge * 0.35)
    $cx = ($Width - $logoSize) / 2
    $cy = ($Height - $logoSize) / 2

    $glyphFamily = 'Segoe UI'
    try { $null = New-Object System.Drawing.FontFamily($glyphFamily) }
    catch { $glyphFamily = 'Arial' }
    $fontSize = [int]($logoSize * 0.62)
    $font = New-Object System.Drawing.Font($glyphFamily, $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $paperBrush = New-Object System.Drawing.SolidBrush $paper
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment     = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center

    $glyphRect = New-Object System.Drawing.RectangleF(
        [single]$cx,
        [single]($cy - $logoSize * 0.04),
        [single]$logoSize,
        [single]$logoSize
    )
    $g.DrawString('W', $font, $paperBrush, $glyphRect, $sf)

    $underlineY      = $cy + $logoSize * 0.78
    $underlineWidth  = $logoSize * 0.42
    $underlineHeight = [single]([Math]::Max(2, $logoSize * 0.05))
    $underlineX      = $cx + ($logoSize - $underlineWidth) / 2

    $accentBrush = New-Object System.Drawing.SolidBrush $accent
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

    $path = Join-Path $out ("apple-splash-{0}-{1}.png" -f $Width, $Height)
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output ("wrote {0}" -f $path)
}

# Representative portrait sizes covering the bulk of iOS devices.
New-Splash -Width 2048 -Height 2732   # iPad Pro 12.9"
New-Splash -Width 1668 -Height 2388   # iPad Pro 11" / Air 10.9"
New-Splash -Width 1170 -Height 2532   # iPhone 12-15 (Pro)
New-Splash -Width 1284 -Height 2778   # iPhone 14/15 Pro Max + Plus

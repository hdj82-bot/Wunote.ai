# Generate Wunote gamification sound effects as WAV (44.1 kHz / 16-bit / mono).
#
# Outputs to public/sounds/:
#   correct.wav     - rising major triad, "ding-dong" (clean revision submitted)
#   badge.wav       - bright C-major chord stab + sparkle (badge unlock)
#   error-found.wav - mellow two-tone alert (analysis result returned)
#   streak.wav      - filtered noise crackle + chirp (streak day +1)
#   level-up.wav    - ascending C major arpeggio (level up celebration)
#
# Run: powershell -ExecutionPolicy Bypass -File scripts/generate-sounds.ps1
# Pure .NET / PowerShell — no external deps. For higher-fidelity MP3 builds,
# use scripts/build-sounds.mjs (requires ffmpeg).

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$out  = Join-Path $root 'public\sounds'
if (-not (Test-Path $out)) { New-Item -ItemType Directory -Path $out | Out-Null }

$SAMPLE_RATE = 44100
$BITS        = 16
$CHANNELS    = 1
$AMP         = 0.55  # peak ~ -5 dBFS, leaves headroom

function Write-Wav {
    param(
        [string]$Path,
        [single[]]$Samples
    )
    $byteCount   = $Samples.Count * 2
    $totalSize   = 36 + $byteCount
    $stream      = [System.IO.File]::Open($Path, [System.IO.FileMode]::Create)
    $writer      = New-Object System.IO.BinaryWriter($stream)

    # RIFF header
    $writer.Write([byte[]][char[]]'RIFF')
    $writer.Write([uint32]$totalSize)
    $writer.Write([byte[]][char[]]'WAVE')
    # fmt chunk
    $writer.Write([byte[]][char[]]'fmt ')
    $writer.Write([uint32]16)
    $writer.Write([uint16]1)                                  # PCM
    $writer.Write([uint16]$CHANNELS)
    $writer.Write([uint32]$SAMPLE_RATE)
    $writer.Write([uint32]($SAMPLE_RATE * $CHANNELS * 2))     # byte rate
    $writer.Write([uint16]($CHANNELS * 2))                    # block align
    $writer.Write([uint16]$BITS)
    # data chunk
    $writer.Write([byte[]][char[]]'data')
    $writer.Write([uint32]$byteCount)

    foreach ($s in $Samples) {
        $clamped = [Math]::Max(-1.0, [Math]::Min(1.0, [double]$s))
        $i = [int16]([Math]::Round($clamped * 32767))
        $writer.Write($i)
    }
    $writer.Flush()
    $writer.Close()
    $stream.Close()
    Write-Output ("wrote {0} ({1} samples, {2:N2}s)" -f $Path, $Samples.Count, ($Samples.Count / [double]$SAMPLE_RATE))
}

# ADSR envelope: returns gain at sample index $i for total length $n
function Envelope {
    param([int]$i, [int]$n, [double]$attack = 0.02, [double]$release = 0.18)
    $t  = $i / [double]$n
    $aT = $attack
    $rT = $release
    if ($t -lt $aT)        { return $t / $aT }
    elseif ($t -gt 1 - $rT) { return [Math]::Max(0.0, (1 - $t) / $rT) }
    else                   { return 1.0 }
}

function Sine { param([double]$f, [int]$i) [Math]::Sin(2 * [Math]::PI * $f * $i / $SAMPLE_RATE) }
function Triangle {
    param([double]$f, [int]$i)
    $p = ($f * $i / $SAMPLE_RATE) % 1
    if ($p -lt 0.5) { 4 * $p - 1 } else { 3 - 4 * $p }
}

function Pulse {
    param([double]$f, [int]$i, [double]$duty = 0.5)
    $p = ($f * $i / $SAMPLE_RATE) % 1
    if ($p -lt $duty) { 1.0 } else { -1.0 }
}

# ---------- correct.wav: rising C-major triad (C5 → E5 → G5) ----------
function Build-Correct {
    $segLen = [int](0.16 * $SAMPLE_RATE)
    $tail   = [int](0.10 * $SAMPLE_RATE)
    $total  = $segLen * 3 + $tail
    $buf    = New-Object 'single[]' $total
    $freqs  = @(523.25, 659.25, 783.99)  # C5, E5, G5
    for ($s = 0; $s -lt 3; $s++) {
        $f = $freqs[$s]
        $offset = $s * $segLen
        $segTotal = if ($s -eq 2) { $segLen + $tail } else { $segLen }
        for ($i = 0; $i -lt $segTotal; $i++) {
            $env = Envelope -i $i -n $segTotal -attack 0.05 -release 0.55
            $sample = (Sine $f $i) * 0.7 + (Sine ($f * 2) $i) * 0.2 + (Sine ($f * 3) $i) * 0.08
            $idx = $offset + $i
            if ($idx -lt $total) { $buf[$idx] = [single]([double]$buf[$idx] + $sample * $env * $AMP) }
        }
    }
    Write-Wav (Join-Path $out 'correct.wav') $buf
}

# ---------- badge.wav: C-major chord stab + sparkle ----------
function Build-Badge {
    $total = [int](0.95 * $SAMPLE_RATE)
    $buf   = New-Object 'single[]' $total
    $chord = @(523.25, 659.25, 783.99)
    for ($i = 0; $i -lt $total; $i++) {
        $env = Envelope -i $i -n $total -attack 0.005 -release 0.6
        $val = 0.0
        foreach ($f in $chord) { $val += (Triangle $f $i) * 0.25 }
        # sparkle: high-frequency triangle with fast decay overlay first 40% of sound
        $t = $i / [double]$total
        if ($t -lt 0.4) {
            $sparkleEnv = [Math]::Pow(1 - $t / 0.4, 2)
            $val += (Sine 1567.98 $i) * 0.15 * $sparkleEnv  # G6
            $val += (Sine 2093.0  $i) * 0.10 * $sparkleEnv  # C7
        }
        $buf[$i] = [single]($val * $env * $AMP)
    }
    Write-Wav (Join-Path $out 'badge.wav') $buf
}

# ---------- error-found.wav: mellow two-tone (E5 → C5) ----------
function Build-ErrorFound {
    $segLen = [int](0.22 * $SAMPLE_RATE)
    $tail   = [int](0.12 * $SAMPLE_RATE)
    $total  = $segLen * 2 + $tail
    $buf    = New-Object 'single[]' $total
    $freqs  = @(659.25, 523.25)  # E5, C5 — descending soft alert
    for ($s = 0; $s -lt 2; $s++) {
        $f = $freqs[$s]
        $offset = $s * $segLen
        $segTotal = if ($s -eq 1) { $segLen + $tail } else { $segLen }
        for ($i = 0; $i -lt $segTotal; $i++) {
            $env = Envelope -i $i -n $segTotal -attack 0.08 -release 0.55
            $val = (Sine $f $i) * 0.6 + (Sine ($f * 2) $i) * 0.12
            $idx = $offset + $i
            if ($idx -lt $total) { $buf[$idx] = [single]([double]$buf[$idx] + $val * $env * $AMP * 0.85) }
        }
    }
    Write-Wav (Join-Path $out 'error-found.wav') $buf
}

# ---------- streak.wav: noise crackle + chirp ----------
function Build-Streak {
    $total = [int](0.65 * $SAMPLE_RATE)
    $buf   = New-Object 'single[]' $total
    $rng   = New-Object System.Random 42
    for ($i = 0; $i -lt $total; $i++) {
        $t   = $i / [double]$total
        $env = Envelope -i $i -n $total -attack 0.01 -release 0.35
        # exponential frequency sweep 800 Hz → 1800 Hz
        $f = 800 + 1000 * $t
        $tone  = (Sine $f $i) * 0.45
        # crackle: gated band-limited noise, decays
        $noiseEnv = [Math]::Pow(1 - $t, 1.5)
        $noise = ($rng.NextDouble() * 2 - 1) * 0.35 * $noiseEnv
        $buf[$i] = [single](($tone + $noise) * $env * $AMP)
    }
    Write-Wav (Join-Path $out 'streak.wav') $buf
}

# ---------- level-up.wav: ascending C-major arpeggio + bell ----------
function Build-LevelUp {
    $arpegLen = [int](0.13 * $SAMPLE_RATE)
    $bellLen  = [int](0.55 * $SAMPLE_RATE)
    $arpeg    = @(523.25, 659.25, 783.99, 1046.5)  # C5 E5 G5 C6
    $total    = $arpegLen * $arpeg.Count + $bellLen
    $buf      = New-Object 'single[]' $total

    for ($s = 0; $s -lt $arpeg.Count; $s++) {
        $f = $arpeg[$s]
        $offset = $s * $arpegLen
        for ($i = 0; $i -lt $arpegLen; $i++) {
            $env = Envelope -i $i -n $arpegLen -attack 0.02 -release 0.45
            $val = (Triangle $f $i) * 0.55 + (Sine ($f * 2) $i) * 0.15
            $idx = $offset + $i
            if ($idx -lt $total) { $buf[$idx] = [single]([double]$buf[$idx] + $val * $env * $AMP * 0.7) }
        }
    }

    # Final bell: C6 with shimmer
    $bellOffset = $arpegLen * $arpeg.Count
    for ($i = 0; $i -lt $bellLen; $i++) {
        $t = $i / [double]$bellLen
        $env = [Math]::Pow(1 - $t, 1.3)
        $val = (Sine 1046.5 $i) * 0.55 + (Sine 2093.0 $i) * 0.20 + (Sine 3140 $i) * 0.08
        $idx = $bellOffset + $i
        if ($idx -lt $total) { $buf[$idx] = [single]([double]$buf[$idx] + $val * $env * $AMP * 0.85) }
    }

    Write-Wav (Join-Path $out 'level-up.wav') $buf
}

Build-Correct
Build-Badge
Build-ErrorFound
Build-Streak
Build-LevelUp

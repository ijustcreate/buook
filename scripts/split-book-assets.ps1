Add-Type -AssemblyName System.Drawing
$assetRoot = Join-Path $PSScriptRoot '..\assets'
$atlas = [System.Drawing.Bitmap]::FromFile((Join-Path $assetRoot 'book-frame-v2.png'))
try {
    # Keep the board and the flexible binding separate. The other board is
    # mirrored at runtime so its corners, colors, and proportions stay equal.
    $board = $atlas.Clone([System.Drawing.Rectangle]::new(0, 0, 448, 565), [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $binding = $atlas.Clone([System.Drawing.Rectangle]::new(448, 0, 128, 565), [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
        $board.Save((Join-Path $assetRoot 'inside-board-v3.png'), [System.Drawing.Imaging.ImageFormat]::Png)
        $binding.Save((Join-Path $assetRoot 'open-spine-v3.png'), [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $board.Dispose(); $binding.Dispose() }
} finally { $atlas.Dispose() }
$outside = [System.Drawing.Bitmap]::FromFile((Join-Path $assetRoot 'front-cover-v2.png'))
try {
    $board = $outside.Clone([System.Drawing.Rectangle]::new(64, 0, 504, 582), [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $binding = $outside.Clone([System.Drawing.Rectangle]::new(0, 0, 64, 582), [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
        $board.Save((Join-Path $assetRoot 'outside-board-v3.png'), [System.Drawing.Imaging.ImageFormat]::Png)
        $binding.Save((Join-Path $assetRoot 'closed-spine-v3.png'), [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $board.Dispose(); $binding.Dispose() }
} finally { $outside.Dispose() }

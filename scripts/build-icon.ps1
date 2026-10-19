param(
    [string]$Source = (Join-Path $PSScriptRoot '..\assets\buook-icon-v1.png'),
    [string]$Output = (Join-Path $PSScriptRoot '..\assets\buook-icon-v1.ico')
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$image = [Drawing.Image]::FromFile([IO.Path]::GetFullPath($Source))
$frames = [Collections.Generic.List[object]]::new()
try {
    foreach ($size in @(16, 24, 32, 48, 64, 128, 256)) {
        $bitmap = [Drawing.Bitmap]::new($size, $size, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [Drawing.Graphics]::FromImage($bitmap)
        $stream = [IO.MemoryStream]::new()
        try {
            $graphics.Clear([Drawing.Color]::Transparent)
            $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
            $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::Half
            $graphics.DrawImage($image, [Drawing.Rectangle]::new(0, 0, $size, $size))
            $bitmap.Save($stream, [Drawing.Imaging.ImageFormat]::Png)
            $frames.Add(@{ Size = $size; Bytes = $stream.ToArray() })
        } finally { $stream.Dispose(); $graphics.Dispose(); $bitmap.Dispose() }
    }
    $file = [IO.File]::Open([IO.Path]::GetFullPath($Output), [IO.FileMode]::Create)
    $writer = [IO.BinaryWriter]::new($file)
    try {
        $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$frames.Count)
        $offset = 6 + 16 * $frames.Count
        foreach ($frame in $frames) {
            $dimension = if ($frame.Size -eq 256) { 0 } else { $frame.Size }
            $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
            $writer.Write([byte]0); $writer.Write([byte]0)
            $writer.Write([uint16]1); $writer.Write([uint16]32)
            $writer.Write([uint32]$frame.Bytes.Length); $writer.Write([uint32]$offset)
            $offset += $frame.Bytes.Length
        }
        foreach ($frame in $frames) { $writer.Write([byte[]]$frame.Bytes) }
    } finally { $writer.Dispose(); $file.Dispose() }
    Write-Output ('Created multi-resolution icon: ' + [IO.Path]::GetFullPath($Output))
} finally { $image.Dispose() }

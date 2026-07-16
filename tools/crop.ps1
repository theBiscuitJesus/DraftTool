param(
  [string]$Src,
  [int]$X, [int]$Y, [int]$W, [int]$H,
  [double]$Scale = 2.0,
  [string]$Out
)
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile($Src)
$rect = New-Object System.Drawing.Rectangle($X, $Y, $W, $H)
$crop = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($crop)
$g.DrawImage($img, (New-Object System.Drawing.Rectangle(0,0,$W,$H)), $rect, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()
$ow = [int]($W * $Scale); $oh = [int]($H * $Scale)
$scaled = New-Object System.Drawing.Bitmap($ow, $oh)
$g2 = [System.Drawing.Graphics]::FromImage($scaled)
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.DrawImage($crop, 0, 0, $ow, $oh)
$g2.Dispose()
$scaled.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$img.Dispose(); $crop.Dispose(); $scaled.Dispose()
"Saved $Out ($ow x $oh)"

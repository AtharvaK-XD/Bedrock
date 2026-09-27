import os
from PIL import Image
import numpy as np

src_path = r'C:\Users\ATHARVA\.gemini\antigravity-ide\brain\551b7786-4c27-4bf9-b836-23670c7f8a79\.user_uploaded\media_1790540332907.png'
img = Image.open(src_path).convert('RGB')
arr = np.array(img, dtype=float)

# Bounding box of the green logo
brightness = arr.max(axis=-1)
is_logo = brightness > 15
y_idx, x_idx = np.where(is_logo)
min_y, max_y = y_idx.min(), y_idx.max()
min_x, max_x = x_idx.min(), x_idx.max()

# Crop with 2px margin for sub-pixel anti-aliasing
crop_min_x = max(0, min_x - 2)
crop_max_x = min(arr.shape[1], max_x + 3)
crop_min_y = max(0, min_y - 2)
crop_max_y = min(arr.shape[0], max_y + 3)

cropped = arr[crop_min_y:crop_max_y, crop_min_x:crop_max_x]

# Compute smooth alpha channel based on brightness with color de-multiplication
r = cropped[:, :, 0]
g = cropped[:, :, 1]
b = cropped[:, :, 2]
max_rgb = np.maximum(np.maximum(r, g), b)

# Pure background <= 2. Full color >= 160.
alpha = np.clip((max_rgb - 2.0) / (160.0 - 2.0), 0.0, 1.0)

# Unmultiply color at antialiased edges to remove black fringing
result_rgb = cropped.copy()
valid_alpha = alpha > 0.02
for c in range(3):
    result_rgb[valid_alpha, c] = np.clip(result_rgb[valid_alpha, c] / alpha[valid_alpha], 0, 255)

result_rgba = np.dstack([result_rgb, alpha * 255]).astype(np.uint8)
tight_logo = Image.fromarray(result_rgba)

# Create 512x512 master square canvas with balanced padding
master_size = 512
master_canvas = Image.new('RGBA', (master_size, master_size), (0, 0, 0, 0))

# Target size inside 512x512: fit within 430x410 to give a sleek modern margin
scale = min(430.0 / tight_logo.width, 410.0 / tight_logo.height)
scaled_w = int(tight_logo.width * scale)
scaled_h = int(tight_logo.height * scale)
scaled_logo = tight_logo.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)

paste_x = (master_size - scaled_w) // 2
paste_y = (master_size - scaled_h) // 2
master_canvas.paste(scaled_logo, (paste_x, paste_y), scaled_logo)

# Output paths
os.makedirs('public', exist_ok=True)
os.makedirs('src-tauri/icons', exist_ok=True)

# 1. Save public assets
tight_logo.save('public/logo-tight.png')
master_canvas.save('public/logo.png')
master_canvas.save('public/icon.png')

# 2. Multi-size favicon.ico
ico_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
master_canvas.save('public/favicon.ico', format='ICO', sizes=ico_sizes)
master_canvas.save('src-tauri/icons/icon.ico', format='ICO', sizes=ico_sizes)

# 3. ICNS
try:
    master_canvas.save('src-tauri/icons/icon.icns', format='ICNS')
except Exception as e:
    print('ICNS error:', e)

# 4. Tauri PNGs
master_canvas.save('src-tauri/icons/icon.png')
master_canvas.resize((256, 256), Image.Resampling.LANCZOS).save('src-tauri/icons/128x128@2x.png')
master_canvas.resize((128, 128), Image.Resampling.LANCZOS).save('src-tauri/icons/128x128.png')
master_canvas.resize((32, 32), Image.Resampling.LANCZOS).save('src-tauri/icons/32x32.png')

# Square logos
square_sizes = [30, 44, 71, 89, 107, 142, 150, 284, 310]
for s in square_sizes:
    master_canvas.resize((s, s), Image.Resampling.LANCZOS).save(f'src-tauri/icons/Square{s}x{s}Logo.png')
master_canvas.resize((50, 50), Image.Resampling.LANCZOS).save('src-tauri/icons/StoreLogo.png')

print('All app icons and logos successfully generated from source image!')

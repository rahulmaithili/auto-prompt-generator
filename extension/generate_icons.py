import os
import subprocess
import sys

def install_pillow():
    try:
        from PIL import Image, ImageDraw
        print("Pillow is already installed.")
    except ImportError:
        print("Installing Pillow...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])

install_pillow()

from PIL import Image, ImageDraw

def create_icon(size, filename):
    # Create an image with a dark purple/indigo gradient background
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw a rounded purple gradient circle
    center = size // 2
    radius = int(size * 0.45)
    
    # Draw background glowing circle
    draw.ellipse(
        [center - radius, center - radius, center + radius, center + radius],
        fill=(99, 102, 241),  # Indigo (#6366f1)
        outline=(168, 85, 247),  # Purple (#a855f7)
        width=max(1, size // 16)
    )
    
    # Draw a stylized "✨" spark in the center
    # We will draw a 4-pointed star
    star_color = (255, 255, 255)
    w = max(1, size // 10)
    
    # Vertical bar
    draw.line(
        [center, center - int(size * 0.25), center, center + int(size * 0.25)],
        fill=star_color,
        width=w
    )
    # Horizontal bar
    draw.line(
        [center - int(size * 0.25), center, center + int(size * 0.25), center],
        fill=star_color,
        width=w
    )
    # Diagonal glowing points
    d_offset = int(size * 0.12)
    draw.line(
        [center - d_offset, center - d_offset, center + d_offset, center + d_offset],
        fill=star_color,
        width=max(1, w // 2)
    )
    draw.line(
        [center - d_offset, center + d_offset, center + d_offset, center - d_offset],
        fill=star_color,
        width=max(1, w // 2)
    )
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    img.save(filename, "PNG")
    print(f"Generated {filename} ({size}x{size})")

if __name__ == "__main__":
    icons_dir = os.path.join(os.path.dirname(__file__), "icons")
    create_icon(16, os.path.join(icons_dir, "icon16.png"))
    create_icon(48, os.path.join(icons_dir, "icon48.png"))
    create_icon(128, os.path.join(icons_dir, "icon128.png"))
    print("All icons generated successfully.")

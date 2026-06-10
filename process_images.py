import os
from PIL import Image

images = ["noa1.jpg", "noa2.jpg", "noa3.jpg"]

for img_name in images:
    if not os.path.exists(img_name):
        continue
        
    img = Image.open(img_name)
    w, h = img.size
    
    # Desktop version: just resize if too large, otherwise copy
    desktop_img = img.copy()
    desktop_img.thumbnail((1920, 1920), Image.Resampling.LANCZOS)
    desktop_name = img_name.replace(".jpg", "-desktop.jpg")
    desktop_img.save(desktop_name, quality=85)
    
    # Mobile version: crop 9:16 from center
    # Target ratio = 9/16 = 0.5625
    target_ratio = 9.0 / 16.0
    current_ratio = w / h
    
    if current_ratio > target_ratio:
        # Image is wider than 9:16, crop width
        new_w = int(h * target_ratio)
        new_h = h
        left = (w - new_w) / 2
        top = 0
        right = left + new_w
        bottom = h
    else:
        # Image is taller than 9:16, crop height
        new_w = w
        new_h = int(w / target_ratio)
        left = 0
        top = (h - new_h) / 2
        right = w
        bottom = top + new_h
        
    mobile_img = img.crop((left, top, right, bottom))
    mobile_img.thumbnail((1080, 1920), Image.Resampling.LANCZOS)
    mobile_name = img_name.replace(".jpg", "-mobile.jpg")
    mobile_img.save(mobile_name, quality=85)
    
    print(f"Processed {img_name} -> {desktop_name}, {mobile_name}")


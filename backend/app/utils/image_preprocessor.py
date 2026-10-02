from PIL import Image, ImageEnhance, ImageOps
import io
import os

def preprocess_image(input_path: str, output_path: str = None) -> str:
    """
    Enhance handwritten bill/ledger photos:
    - Auto-orient based on EXIF
    - Resize if huge (max width/height 2400)
    - Enhance contrast & sharpness for crisp OCR
    """
    if output_path is None:
        base, ext = os.path.splitext(input_path)
        output_path = f"{base}_proc{ext}"

    try:
        with Image.open(input_path) as img:
            # Auto-rotate according to EXIF
            img = ImageOps.exif_transpose(img)
            
            # Convert to RGB if palette or RGBA
            if img.mode != "RGB":
                img = img.convert("RGB")
            
            # Resize if too large, maintaining aspect ratio
            max_dimension = 2400
            if max(img.size) > max_dimension:
                img.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
            
            # Contrast enhancement
            enhancer = ImageEnhance.Contrast(img)
            img = enhancer.enhance(1.3)
            
            # Sharpness enhancement
            sharpener = ImageEnhance.Sharpness(img)
            img = sharpener.enhance(1.4)
            
            img.save(output_path, quality=90)
            return output_path
    except Exception as e:
        # Fallback to original if processing fails
        print(f"Image preprocessing warning: {e}")
        return input_path

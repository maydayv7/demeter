# encoders/clip_encoder.py
import torch
import clip
from PIL import Image
import io
import base64
from pathlib import Path

class VisionEncoder:
    def __init__(self, model_name="ViT-B/32"):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model, self.preprocess = clip.load(model_name, device=self.device)
        self.model.eval()

    def encode(self, image_input):
        """
        Encode an image from multiple input types:
        - File path (str or Path)
        - Base64 string
        - BytesIO object
        - PIL Image object
        
        Args:
            image_input: File path, base64 string, BytesIO, or PIL Image
            
        Returns:
            numpy array: Normalized image embedding vector
        """
        # Convert input to PIL Image
        pil_image = self._to_pil_image(image_input)
        
        # Preprocess and encode
        image = self.preprocess(pil_image.convert("RGB")) \
                    .unsqueeze(0).to(self.device)

        with torch.no_grad():
            vec = self.model.encode_image(image)
            vec = vec / vec.norm(dim=-1, keepdim=True)

        return vec.cpu().numpy().flatten()
    
    def _to_pil_image(self, image_input):
        """
        Convert various input types to PIL Image.
        """
        # If already a PIL Image
        if isinstance(image_input, Image.Image):
            return image_input
        
        # If BytesIO object
        if isinstance(image_input, io.BytesIO):
            image_input.seek(0)  # Reset to beginning
            return Image.open(image_input)
        
        # If it's a string, determine if it's a path or base64
        if isinstance(image_input, (str, Path)):
            # Check if it's a file path
            if isinstance(image_input, Path) or Path(image_input).exists():
                return Image.open(image_input)
            
            # Otherwise, treat as base64
            return self._base64_to_pil(image_input)
        
        # If bytes object
        if isinstance(image_input, bytes):
            return Image.open(io.BytesIO(image_input))
        
        raise TypeError(f"Unsupported image input type: {type(image_input)}")
    
    def _base64_to_pil(self, base64_string):
        """
        Convert base64 string to PIL Image.
        """
        # Remove header if present (e.g., "data:image/png;base64,...")
        if "," in base64_string:
            base64_string = base64_string.split(",")[1]
        
        # Add padding if necessary
        missing_padding = len(base64_string) % 4
        if missing_padding:
            base64_string += '=' * (4 - missing_padding)
        
        # Decode and open
        image_bytes = base64.b64decode(base64_string)
        return Image.open(io.BytesIO(image_bytes))


# Example usage:
if __name__ == "__main__":
    encoder = VisionEncoder()
    
    # Test with file path
    # vec1 = encoder.encode("path/to/image.jpg")
    
    # Test with base64
    sample_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII="
    vec2 = encoder.encode(sample_base64)
    print(f"✅ Encoded base64 image. Vector shape: {vec2.shape}")
    
    # Test with BytesIO
    # image_stream = io.BytesIO(image_bytes)
    # vec3 = encoder.encode(image_stream)
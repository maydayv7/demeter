# encoders/clip_encoder.py
import torch
import clip
from PIL import Image

class VisionEncoder:
    def __init__(self, model_name="ViT-B/32"):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model, self.preprocess = clip.load(model_name, device=self.device)
        self.model.eval()

    def encode(self, image_path: str):
        image = self.preprocess(Image.open(image_path).convert("RGB")) \
                    .unsqueeze(0).to(self.device)

        with torch.no_grad():
            vec = self.model.encode_image(image)
            vec = vec / vec.norm(dim=-1, keepdim=True)

        return vec.cpu().numpy().flatten()
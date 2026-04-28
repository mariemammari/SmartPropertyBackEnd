import io
from collections import Counter
from pathlib import Path
from typing import Dict, List, Optional

import torch
import torch.nn as nn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from transformers import (
    BlipForConditionalGeneration,
    BlipProcessor,
    CLIPModel,
    CLIPProcessor,
)


CLASS_NAMES = ["bas_standing", "moyen_standing", "haut_standing"]
MODEL_DIR = Path(__file__).resolve().parent
DEFAULT_CLASSIFIER_PATH = Path(r"C:\Users\oussema\Desktop\ML\classifier.pth")

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
clip_model = None
clip_processor = None
blip_model = None
blip_processor = None
classifier = None

app = FastAPI(title="Property Image Analyzer")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_classifier() -> nn.Module:
    model = nn.Linear(512, 3)
    classifier_path = DEFAULT_CLASSIFIER_PATH
    if not classifier_path.exists():
        local_path = MODEL_DIR / "classifier.pth"
        if local_path.exists():
            classifier_path = local_path

    if not classifier_path.exists():
        raise FileNotFoundError(
            f"classifier.pth not found at '{DEFAULT_CLASSIFIER_PATH}' "
            f"or '{(MODEL_DIR / 'classifier.pth')}'"
        )

    state_dict = torch.load(classifier_path, map_location=device)
    model.load_state_dict(state_dict)
    model.to(device)
    model.eval()
    return model


@app.on_event("startup")
def startup_event() -> None:
    global clip_model, clip_processor, blip_model, blip_processor, classifier
    clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(device)
    clip_model.eval()
    clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

    blip_model = BlipForConditionalGeneration.from_pretrained(
        "Salesforce/blip-image-captioning-base"
    ).to(device)
    blip_model.eval()
    blip_processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")

    classifier = load_classifier()


def predict_standing(image: Image.Image) -> str:
    inputs = clip_processor(images=image, return_tensors="pt").to(device)
    with torch.no_grad():
        clip_outputs = clip_model.get_image_features(**inputs)
        if isinstance(clip_outputs, torch.Tensor):
            image_features = clip_outputs
        elif hasattr(clip_outputs, "image_embeds"):
            image_features = clip_outputs.image_embeds
        elif hasattr(clip_outputs, "pooler_output"):
            image_features = clip_outputs.pooler_output
        else:
            raise RuntimeError("Unsupported CLIP output format")
        image_features = image_features / image_features.norm(dim=-1, keepdim=True)
        logits = classifier(image_features)
        idx = int(torch.argmax(logits, dim=1).item())
    return CLASS_NAMES[idx]


def generate_caption(image: Image.Image) -> str:
    blip_inputs = blip_processor(images=image, return_tensors="pt").to(device)
    with torch.no_grad():
        output_ids = blip_model.generate(**blip_inputs, max_new_tokens=40)
    return blip_processor.decode(output_ids[0], skip_special_tokens=True).strip()


async def _pil_from_upload_async(upload: UploadFile) -> Image.Image:
    if not upload.content_type or not upload.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"File must be an image (got {upload.filename!r})",
        )
    try:
        file_bytes = await upload.read()
        return Image.open(io.BytesIO(file_bytes)).convert("RGB")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail=f"Invalid image file {upload.filename!r}: {exc}"
        ) from exc


def majority_standing(standings: List[str]) -> str:
    """Pick most frequent class; on tie prefer haut > moyen > bas."""
    tier_rank = {"haut_standing": 3, "moyen_standing": 2, "bas_standing": 1}
    counts = Counter(standings)
    best_count = max(counts.values())
    tied = [k for k, v in counts.items() if v == best_count]
    if len(tied) == 1:
        return tied[0]
    return max(tied, key=lambda k: tier_rank.get(k, 0))


def combine_descriptions(descriptions: List[str]) -> str:
    parts = [d.strip() for d in descriptions if d and d.strip()]
    if not parts:
        return ""
    if len(parts) == 1:
        return parts[0]
    return "\n\n".join(f"({i + 1}) {text}" for i, text in enumerate(parts))


@app.post("/analyze")
async def analyze(
    image: Optional[UploadFile] = File(None),
    images: Optional[List[UploadFile]] = File(None),
) -> Dict[str, str]:
    uploads: List[UploadFile] = []
    if images:
        uploads.extend(images)
    elif image is not None:
        uploads.append(image)
    if not uploads:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one file as `image` or `images`",
        )

    pil_images: List[Image.Image] = []
    for up in uploads:
        try:
            pil_images.append(await _pil_from_upload_async(up))
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=400, detail=f"Invalid upload: {exc}"
            ) from exc

    try:
        standings: List[str] = []
        descriptions: List[str] = []
        for pil in pil_images:
            standings.append(predict_standing(pil))
            descriptions.append(generate_caption(pil))
        combined_standing = majority_standing(standings)
        combined_description = combine_descriptions(descriptions)
        return {"description": combined_description, "standing": combined_standing}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}") from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)

from google import genai
from google.genai import types
import base64
import os
from dataclasses import dataclass

# ---------------------------------------------------------------------------
# DATA STRUCTURE: The Adaptable Character
# ---------------------------------------------------------------------------

@dataclass
class Character:
    name: str
    image_path: str
    key_features: list[str]
    
    def get_reference_label(self) -> str:
        features_list = ", ".join(self.key_features)
        return (
            f"This is the official reference sheet for the character '{self.name}'.\n"
            f"CORE IDENTITY FEATURES: {features_list}.\n"
            f"INSTRUCTION: Maintain exact consistency of these features in EVERY panel of the storyboard."
        )

# ---------------------------------------------------------------------------
# CHARACTER DEFINITIONS
# ---------------------------------------------------------------------------

FANG = Character(
    name="Fang",
    image_path="reference_images/fang_sheet.png",
    key_features=[
        "Bright purple hair", "Glowing purple eyes", "Gold fangs/teeth", 
        "Facial tattoos", "Heavy gold chains", "Muscular build"
    ]
)

ACTIVE_CHARACTER = FANG

# ---------------------------------------------------------------------------
# STORYBOARD CONFIGURATION
# ---------------------------------------------------------------------------

# Define your 4 panels here
BEAT_1 = "Fang walking down a rain-slicked neon street, looking over his shoulder."
BEAT_2 = "A close-up of Fang's face as he notices someone following him; his eyes glow purple."
BEAT_3 = "Fang snarling, baring his gold teeth, with steam rising from his breath in the cold air."
BEAT_4 = "Fang lunging toward the camera in a dynamic action pose, gold chains flying."

STORYBOARD_PROMPT = (
    f"Create a cinematic 4-panel storyboard layout for {ACTIVE_CHARACTER.name}. "
    "The image should be divided into a 2x2 grid of four distinct panels. "
    "Each panel represents a sequential story beat:\n\n"
    f"PANEL 1: {BEAT_1}\n"
    f"PANEL 2: {BEAT_2}\n"
    f"PANEL 3: {BEAT_3}\n"
    f"PANEL 4: {BEAT_4}\n\n"
    "STYLE: Ultra-photorealistic, raw 35mm cinematic film stock, "
    "highly detailed skin texture and visible pores, realistic subsurface scattering, "
    "dramatic volumetric lighting, deep depth of field, sharp focus, "
    "8k resolution, consistent character likeness across all panels."
)

# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------

def image_part_from_file(file_path: str, mime_type: str = "image/png") -> types.Part:
    with open(file_path, "rb") as f:
        data = f.read()
    return types.Part.from_bytes(data=data, mime_type=mime_type)

def build_reference_parts(char: Character) -> list[types.Part]:
    parts = []
    parts.append(types.Part.from_text(text=f"[CHARACTER REFERENCE]:\n{char.get_reference_label()}"))
    parts.append(image_part_from_file(char.image_path))
    return parts

# ---------------------------------------------------------------------------
# GENERATE
# ---------------------------------------------------------------------------

def generate():
    client = genai.Client(
        vertexai=True,
        api_key=os.environ.get("GOOGLE_CLOUD_API_KEY"),
    )

    model = "gemini-3-pro-image-preview"

    contents = [
        types.Content(
            role="user",
            parts=[
                *build_reference_parts(ACTIVE_CHARACTER),
                types.Part.from_text(text=STORYBOARD_PROMPT)
            ]
        )
    ]

    generate_content_config = types.GenerateContentConfig(
        temperature=1,
        top_p=0.95,
        max_output_tokens=32768,
        response_modalities=["TEXT", "IMAGE"],
        image_config=types.ImageConfig(
            aspect_ratio="16:9",
            image_size="2K",
            output_mime_type="image/png",
        ),
    )

    print(f"Generating 4-panel storyboard for {ACTIVE_CHARACTER.name}...")

    img_index = 0
    for chunk in client.models.generate_content_stream(
        model=model,
        contents=contents,
        config=generate_content_config,
    ):
        if chunk.candidates:
            for part in chunk.candidates[0].content.parts:
                if part.inline_data:
                    out_name = f"storyboard_{ACTIVE_CHARACTER.name}_{img_index}.png"
                    with open(out_name, "wb") as f:
                        f.write(part.inline_data.data)
                    print(f"\n[Storyboard saved as {out_name}]")
                    img_index += 1

if __name__ == "__main__":
    generate()

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
    key_features: list[str]  # e.g., ["Purple hair", "Gold teeth", "Facial tattoos"]
    
    def get_reference_label(self) -> str:
        """Automatically builds a high-quality reference label for the model."""
        features_list = ", ".join(self.key_features)
        return (
            f"This is the official reference sheet for the character '{self.name}'.\n"
            f"CORE IDENTITY FEATURES: {features_list}.\n"
            f"THE IMAGE CONTENT: This is a composite character sheet containing:\n"
            f"- Full-body views (front, side, and back) for proportions and clothing.\n"
            f"- Facial close-ups for features and expressions.\n"
            f"- Detailed macro shots for unique markings, tattoos, and accessories.\n"
            f"INSTRUCTION: Maintain exact consistency of all features listed above "
            f"and match the character's likeness from the sheet in the generated image."
        )

# ---------------------------------------------------------------------------
# CHARACTER DEFINITIONS (Add your characters here)
# ---------------------------------------------------------------------------

FANG = Character(
    name="Fang",
    image_path="reference_images/fang_sheet.png", # Change this to your actual file path
    key_features=[
        "Bright purple hair", 
        "Glowing purple eyes", 
        "Gold fangs/teeth", 
        "Intricate facial and body tattoos", 
        "Heavy gold chains and jewelry",
        "Muscular build"
    ]
)

KAEL = Character(
    name="Kael",
    image_path="reference_images/kael_sheet.png",
    key_features=["Silver hair", "Blue eyes", "Cybernetic eye", "Leather jacket"]
)

# ---------------------------------------------------------------------------
# CONFIGURATION: Pick who you are using
# ---------------------------------------------------------------------------

ACTIVE_CHARACTER = FANG  # Just swap this to KAEL or any other character you define
USE_ENVIRONMENT   = False
ENVIRONMENT_IMAGE = "reference_images/city_environment.png"

# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------

def image_part_from_file(file_path: str, mime_type: str = "image/png") -> types.Part:
    with open(file_path, "rb") as f:
        data = f.read()
    return types.Part.from_bytes(data=data, mime_type=mime_type)

def build_reference_parts(char: Character) -> list[types.Part]:
    parts = []
    # Add Character Reference
    parts.append(types.Part.from_text(text=f"[CHARACTER REFERENCE]:\n{char.get_reference_label()}"))
    parts.append(image_part_from_file(char.image_path))
    
    # Add Environment Reference if enabled
    if USE_ENVIRONMENT:
        env_label = "Style reference for the environment. Match lighting and architecture."
        parts.append(types.Part.from_text(text=f"[ENVIRONMENT REFERENCE]: {env_label}"))
        parts.append(image_part_from_file(ENVIRONMENT_IMAGE))
        
    return parts

# ---------------------------------------------------------------------------
# SCENE PROMPT (The Action)
# ---------------------------------------------------------------------------

SCENE_PROMPT = (
    f"{ACTIVE_CHARACTER.name} is snarling at the camera, "
    "standing in a dark, foggy alleyway illuminated by a single flickering neon sign. "
    "The glowing purple eyes and gold teeth should be prominent. "
    "Cinematic wide shot, 16:9, hyper-realistic, volumetric lighting."
)

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
                types.Part.from_text(text=SCENE_PROMPT)
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

    img_index = 0
    for chunk in client.models.generate_content_stream(
        model=model,
        contents=contents,
        config=generate_content_config,
    ):
        if chunk.candidates:
            for part in chunk.candidates[0].content.parts:
                if part.text:
                    print(part.text, end="")
                if part.inline_data:
                    out_name = f"output_{ACTIVE_CHARACTER.name}_{img_index}.png"
                    with open(out_name, "wb") as f:
                        f.write(part.inline_data.data)
                    print(f"\n[Image saved as {out_name}]")
                    img_index += 1

if __name__ == "__main__":
    generate()

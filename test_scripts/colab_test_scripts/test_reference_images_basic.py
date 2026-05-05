from google import genai
from google.genai import types
import base64
import os

# ---------------------------------------------------------------------------
# HELPERS — load a local image file into a types.Part
# ---------------------------------------------------------------------------

def image_part_from_file(file_path: str, mime_type: str = "image/png") -> types.Part:
    """Read a local image and return it as a types.Part (inline bytes)."""
    with open(file_path, "rb") as f:
        data = f.read()
    return types.Part.from_bytes(data=data, mime_type=mime_type)


# ---------------------------------------------------------------------------
# REFERENCE IMAGE DEFINITIONS
#
# All references are always a SINGLE image file.
# A character sheet is still one file — it just contains multiple panels inside it.
# The label text is what tells the model what it's looking at.
# ---------------------------------------------------------------------------

# ── CHARACTER REFERENCE ─────────────────────────────────────────────────────
CHARACTER_IMAGE = "reference_images/hero_sheet.png"

# Use this label if your image is a single pose:
# CHARACTER_LABEL = "This is the main hero character named 'Kael'. Keep his appearance exactly consistent."

# Use this label if your image is a character sheet (multiple panels in one image):
CHARACTER_LABEL = (
    "This is a character sheet for 'Kael', the main hero. "
    "The image contains multiple panels showing him from the front, side, back, and 3/4 angle. "
    "Use all panels to understand his full appearance — face, hair, clothing, and proportions — "
    "and keep them exactly consistent in the generated scene."
)

# ── ENVIRONMENT REFERENCE ───────────────────────────────────────────────────
ENVIRONMENT_IMAGE = "reference_images/city_environment.png"
ENVIRONMENT_LABEL = (
    "This is the visual style reference for 'Neo-Kyoto', the city environment. "
    "Match the lighting, colour palette, and architectural style exactly."
)


# ---------------------------------------------------------------------------
# CHOOSE YOUR MODE
# Set to True for any reference type you want active.
# You can enable both at the same time.
# ---------------------------------------------------------------------------
USE_CHARACTER   = True    # send character reference image
USE_ENVIRONMENT = False   # send environment reference image


# ---------------------------------------------------------------------------
# BUILD REFERENCE PARTS
# ---------------------------------------------------------------------------

def build_reference_parts() -> list[types.Part]:
    """
    Assembles the reference image parts prepended before the scene prompt.
    Always one image per reference type — the label describes what's inside it.
    """
    parts: list[types.Part] = []

    if USE_CHARACTER:
        parts.append(types.Part.from_text(text=f"[CHARACTER REFERENCE]: {CHARACTER_LABEL}"))
        parts.append(image_part_from_file(CHARACTER_IMAGE))

    if USE_ENVIRONMENT:
        parts.append(types.Part.from_text(text=f"[ENVIRONMENT REFERENCE]: {ENVIRONMENT_LABEL}"))
        parts.append(image_part_from_file(ENVIRONMENT_IMAGE))

    return parts


# ---------------------------------------------------------------------------
# MAIN SCENE PROMPT
#
# This is where you describe the image you want generated.
# The model will use the reference images above to keep characters / 
# environments consistent.
# ---------------------------------------------------------------------------

SCENE_PROMPT = (
    "Generate a cinematic 16:9 wide shot. "
    "Kael stands at the edge of a rain-soaked rooftop in Neo-Kyoto, "
    "looking out over the glowing city skyline at dusk. "
    "Dramatic rim lighting, moody atmosphere, ultra-detailed."
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

    # Build parts: [reference images...] + [your scene prompt]
    reference_parts = build_reference_parts()
    scene_part      = types.Part.from_text(text=SCENE_PROMPT)

    contents = [
        types.Content(
            role="user",
            parts=[
                *reference_parts,   # ← reference images come FIRST
                scene_part,         # ← then your scene description
            ]
        )
    ]

    generate_content_config = types.GenerateContentConfig(
        temperature       = 1,
        top_p             = 0.95,
        max_output_tokens = 32768,
        response_modalities = ["TEXT", "IMAGE"],
        safety_settings = [
            types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH",        threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT",   threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT",   threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_HARASSMENT",          threshold="OFF"),
        ],
        image_config=types.ImageConfig(
            aspect_ratio    = "16:9",
            image_size      = "2K",
            output_mime_type= "image/png",
        ),
    )

    img_index = 0
    for chunk in client.models.generate_content_stream(
        model    = model,
        contents = contents,
        config   = generate_content_config,
    ):
        if chunk.candidates:
            for part in chunk.candidates[0].content.parts:
                if part.text:
                    print(part.text, end="")
                if part.inline_data:
                    out_path = f"output_image_{img_index}.png"
                    with open(out_path, "wb") as f:
                        f.write(part.inline_data.data)
                    print(f"\n[Image saved → {out_path}]")
                    img_index += 1


if __name__ == "__main__":
    generate()

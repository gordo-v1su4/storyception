from google import genai
from google.genai import types
import base64
import os
from dataclasses import dataclass

# ---------------------------------------------------------------------------
# DATA STRUCTURES
# ---------------------------------------------------------------------------

@dataclass
class Reference:
    name: str
    image_path: str
    description: str

# ---------------------------------------------------------------------------
# REFERENCE DEFINITIONS (Update these paths)
# ---------------------------------------------------------------------------

# 1. THE CHARACTER
FANG = Reference(
    name="Fang",
    image_path="reference_images/fang_sheet.png",
    description=(
        "A rugged, aggressive male character. CRITICAL FEATURES: Strong square jawline, "
        "pronounced brow, gothic forehead tattoo reading 'WEIGHTLESS', "
        "purple textured hair, glowing purple eyes, gold fangs, and a gold nose ring. "
        "Likeness must be a 1:1 match to the reference sheet's facial structure."
    )
)

# 2. THE ENVIRONMENT (The Underground Bunker)
SECRET_LAB = Reference(
    name="Secret Lab",
    image_path="reference_images/lab_env.png",
    description=(
        "An underground concrete bunker lab. Grungy, damp walls with arched ceilings. "
        "Illuminated by flickering green industrial fluorescent lights. "
        "Filled with vintage analog consoles, knobs, and heavy metal equipment."
    )
)

# 3. THE FILM STYLE (For look & feel only)
CINEMATIC_STYLE = Reference(
    name="Cinematic Style",
    image_path="reference_images/film_look.png",
    description=(
        "Style Reference: Use for heavy anamorphic lens flares, 35mm film grain, "
        "and a moody, dark color grade. Match the high-contrast lighting from this image."
    )
)

# ---------------------------------------------------------------------------
# 3x3 STORYBOARD BEATS (9 Panels)
# ---------------------------------------------------------------------------

# We repeat the name "Fang" in every beat to "lock" the likeness.
BEATS = [
    f"Panel 1: (Lab) {FANG.name} wakes up on a cold metal medical gurney in the bunker.",
    f"Panel 2: (City) Close up of {FANG.name}'s face reflecting the green flicker of the lab lights.",
    f"Panel 3: (Lab) {FANG.name} stands up, knocking over a tray of vintage surgical tools.",
    f"Panel 4: (Lab) {FANG.name} walks past heavy analog consoles toward a massive steel door.",
    f"Panel 5: (City) {FANG.name} emerges from a manhole cover onto a rainy neon city street.",
    f"Panel 6: (City) A sleek black car pulls up next to {FANG.name}.",
    f"Panel 7: (Lab) Flashback: A scientist watching {FANG.name} through a monitor.",
    f"Panel 8: (City) {FANG.name} gets into the car.",
    f"Panel 9: (City) The car speeds away into the foggy distance with {FANG.name} inside."
]

# ---------------------------------------------------------------------------
# PROMPT CONSTRUCTION
# ---------------------------------------------------------------------------

STORYBOARD_PROMPT = (
    "Create a 3x3 grid storyboard (9 sequential panels total).\n\n"
    f"GLOBAL STYLE: Match the '{CINEMATIC_STYLE.name}' reference for all panels. "
    "Focus on anamorphic lens traits, 35mm film grain, and realistic textures.\n\n"
    f"CHARACTER CONSISTENCY: {FANG.name} must look exactly the same in every panel. "
    "Maintain facial tattoos, purple hair, and gold fangs perfectly.\n\n"
    f"ENVIRONMENT SCOPE: Use the '{SECRET_LAB.name}' reference ONLY for Panels 1, 3, 4, and 7. "
    "For all other panels (2, 5, 6, 8, 9), use a rainy cyberpunk city setting.\n\n"
    "THE 9 PANELS:\n" + "\n".join(BEATS)
)

# ... (helpers and references) ...

def image_part_from_file(file_path: str, mime_type: str = "image/png") -> types.Part:
    with open(file_path, "rb") as f:
        data = f.read()
    return types.Part.from_bytes(data=data, mime_type=mime_type)

def build_all_references() -> list[types.Part]:
    parts = []
    
    # helper to add optional image
    def add_ref(ref: Reference, label: str):
        parts.append(types.Part.from_text(text=f"[{label}]: {ref.description}"))
        if os.path.exists(ref.image_path):
            parts.append(image_part_from_file(ref.image_path))
        else:
            print(f"--- WARNING: Image not found for {ref.name} at {ref.image_path}. Using text description only. ---")

    # Add Style Reference First (to set the mood)
    add_ref(CINEMATIC_STYLE, "STYLE REFERENCE")
    
    # Add Character
    add_ref(FANG, "CHARACTER REFERENCE")
    
    # Add Environment
    add_ref(SECRET_LAB, "ENVIRONMENT REFERENCE")
    
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

    # HARD LIKENESS LOCK: Temperature 0.1 for maximum consistency
    generate_content_config = types.GenerateContentConfig(
        temperature=0.1, 
        top_p=0.95,
        max_output_tokens=32768,
        response_modalities=["TEXT", "IMAGE"],
        image_config=types.ImageConfig(
            aspect_ratio="16:9",
            image_size="2K",
            output_mime_type="image/png",
        ),
    )

    # REORDERING: Apply style first, but keep Character Identity as the final command
    style_part = types.Part.from_text(text="STYLE INSTRUCTION: Apply ultra-photorealism and cinematic lighting to the render only. CRITICAL: DO NOT alter the character's facial structure, tattoos, or unique features from the reference sheet.")
    
    contents = [
        types.Content(
            role="user",
            parts=[
                style_part,
                *build_all_references(),
                types.Part.from_text(text=STORYBOARD_PROMPT)
            ]
        )
    ]

    print("Generating 9-panel advanced storyboard with Strict Likeness Lock...")

    img_index = 0
    for chunk in client.models.generate_content_stream(
        model=model,
        contents=contents,
        config=generate_content_config,
    ):
        if chunk.candidates:
            for part in chunk.candidates[0].content.parts:
                if part.inline_data:
                    out_name = f"advanced_storyboard_{img_index}.png"
                    with open(out_name, "wb") as f:
                        f.write(part.inline_data.data)
                    print(f"\n[Storyboard saved as {out_name}]")
                    img_index += 1

if __name__ == "__main__":
    generate()

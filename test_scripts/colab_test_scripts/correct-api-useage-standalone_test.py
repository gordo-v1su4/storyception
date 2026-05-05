from google import genai
from google.genai import types
import base64
import os

def generate():
  client = genai.Client(
      vertexai=True,
      api_key=os.environ.get("GOOGLE_CLOUD_API_KEY"),
  )

  model = "gemini-3-pro-image-preview"
  
  # YOUR PROMPT TEXT GOES HERE inside the 'parts' list.
  # It should be formatted as a types.Part object using from_text()
  contents = [
    types.Content(
      role="user",
      parts=[
          types.Part.from_text(text="Generate a cinematic wide shot of a glowing futuristic city at sunset.")
      ]
    )
  ]

  generate_content_config = types.GenerateContentConfig(
    temperature = 1,
    top_p = 0.95,
    max_output_tokens = 32768,
    response_modalities = ["TEXT", "IMAGE"],
    safety_settings = [types.SafetySetting(
      category="HARM_CATEGORY_HATE_SPEECH",
      threshold="OFF"
    ),types.SafetySetting(
      category="HARM_CATEGORY_DANGEROUS_CONTENT",
      threshold="OFF"
    ),types.SafetySetting(
      category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
      threshold="OFF"
    ),types.SafetySetting(
      category="HARM_CATEGORY_HARASSMENT",
      threshold="OFF"
    )],
    image_config=types.ImageConfig(
      aspect_ratio="16:9",
      image_size="2K",
      output_mime_type="image/png",
    ),
  )

  for chunk in client.models.generate_content_stream(
    model = model,
    contents = contents,
    config = generate_content_config,
    ):
    if chunk.candidates:
      for part in chunk.candidates[0].content.parts:
        if part.text:
          print(part.text, end="")
        if part.inline_data:
          with open("output_image.png", "wb") as f:
            f.write(part.inline_data.data)
          print("\n[Image generated and saved to output_image.png]")

if __name__ == "__main__":
    generate()

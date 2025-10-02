from flask import Flask, request, jsonify
from PIL import Image
import io, base64
from pix2tex.cli import LatexOCR
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

model = LatexOCR()

@app.route("/ocr", methods=["POST"])
def ocr():
    try:
        data = request.json
        image_data = base64.b64decode(data["image"])
        image = Image.open(io.BytesIO(image_data)).convert("RGB")
        latex = model(image)
        return jsonify({"latex": latex})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)

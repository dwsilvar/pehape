# Confidence Thresholds

## Purpose

Two independent confidence thresholds control how strict the image search and OCR text detection engines are.

## Configuration

File: `config/config.py`

| Constant | Worker | Range | Default | Notes |
|---|---|---|---|---|
| `IMAGE_CONFIDENCE_THRESHOLD` | `pyautogui_worker.py` | 0 – 100 | 40 | Divided by 100 before passing to `locateCenterOnScreen` |
| `OCR_CONFIDENCE_THRESHOLD` | `pytesseract_worker.py` | 0 – 100 | 40 | Compared directly against PyTesseract word confidence |

## Usage

- **Higher value** → stricter matching (fewer false positives, more false negatives).
- **Lower value** → looser matching (more results, higher chance of false positives).

### Image Search (PyAutoGUI)

Used in `click_on_image` and `get_element_coordinates_by_img` to set the `confidence` parameter of `pyautogui.locateCenterOnScreen`.

### OCR (PyTesseract)

Used in `_find_text_by_joined_words` and `_find_exact_word` to discard detected words whose confidence score falls below the threshold.

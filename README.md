<!-- Optional: project logo -->

# Pehape - OCR Test Automation 🖥️🤖

A robust framework for automated UI testing using OCR (Tesseract) and image-based actions. Designed for scenarios where traditional selectors are unavailable, such legacy desktop applications.

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/P5P71N4I4P)

---

## Project Overview 📝

OCR Test Automation enables end-to-end testing of graphical user interfaces by combining text recognition (OCR) and image-based automation. It allows you to interact with UI elements by their visible text or appearance, define tests in Gherkin syntax ([Behave](https://behave.readthedocs.io/)), and generate rich reports with [Allure](https://docs.qameta.io/allure/).


## Features ✨

- 🔎 **OCR-driven UI automation:** Locate and interact with elements by their visible text.
- 🖼️ **Image-based actions:** Click and validate elements using screenshots or icons.
- 🧑‍💻 **Behavior-driven development:** Write tests in Gherkin and execute with Behave.
- 📊 **Allure reporting:** Generate interactive, visual test reports.
- 🗂️ **Execution plans:** Control test order and selection via JSON configuration.
- 📸 **Automatic evidence:** Capture and attach screenshots to reports.
- 🧩 **Modular architecture:** Easily extend drivers, workers, and utilities.

## Project Structure 🗃️

```text
ocr_test_automation/
├── behave_master.py         # Main entry point to run tests
├── behave_runner/           # Helpers that run behave and manage reports
├── config/                  # Configuration and logging
├── executor/                # Drivers and low-level workers (PyAutoGUI, OCR)
├── features/                # Gherkin feature files and step definitions
├── reports/                 # Allure results and screenshots
├── resources/               # Images and test resources
├── util/                    # Utility helpers
├── requirements.txt         # Python dependencies
└── README.md
```

## Prerequisites ⚙️

- Python 3.8 or newer
- Tesseract OCR engine (install and ensure `tesseract` is on PATH or set `TESSERACT_CMD_PATH` in config) [[installation guide](https://github.com/tesseract-ocr/tesseract)]
- Allure Commandline (optional, for serving reports)[[installation guide](https://allurereport.org/docs/install/)]

## Installation 🚀

> [!IMPORTANT]
> Before running tests, ensure Tesseract OCR and Allure are installed and available in your system PATH.


1. Create and activate a virtual environment (recommended):

```powershell
python -m venv .venv
.\.venv\Scripts\activate
```

2. Install Python dependencies:

```powershell
pip install -r requirements.txt
pip install allure-behave
```

3. Install Allure (optional) — example for Windows using Scoop:

```powershell
scoop install allure
```

4. Edit config/config.py to adjust paths and set `TESSERACT_CMD_PATH` if Tesseract
is not in your PATH. Logging is configured under `config/logging_config.py`.


## Usage ▶️

### Running tests 🏃‍♂️

Run the main runner which builds and executes the Behave scenarios according to
the JSON execution plan in `features/run_list.json`:

```powershell
python behave_master.py
```

After the tests are executed, the Allure server is executed to display the reports.
To view the Allure report, manually, after a run:

```powershell
allure serve reports/allure_results
```

### Configuring and using run_list.json 📝

The file `features/run_list.json` controls which modules and features are executed, their order, and which tags are used for filtering. Each module and feature can be enabled/disabled, assigned an execution order, and filtered by tags.

Example structure:

```json
{
  "execution_sequence": [
    {
      "module_name": "AccessWithCard",
      "active": true,
      "order": 1,
      "module_dir": "access_with_card",
      "features": [
        {
          "feature_file": "card_entry.feature",
          "feature_dir": "card_entry",
          "active": true,
          "order": 1,
          "tags": "@smoke"
        }
      ]
    }
  ]
}
```

#### How to register a feature and its folder relationship

Suppose you want to register the feature file `card_entry.feature` located at:

```
features/
└── access_with_card/
    └── card_entry/
        └── card_entry.feature
```

You should add the following entry in `run_list.json`:

```json
{
  "module_name": "AccessWithCard",
  "module_dir": "access_with_card",
  ...,
  "features": [
    {
      "feature_file": "card_entry.feature",
      "feature_dir": "card_entry",
      ...
    }
  ]
}
```

This means:
- `module_dir` matches the folder under `features/` (e.g., `access_with_card`)
- `feature_dir` matches the subfolder inside the module (e.g., `card_entry`)
- `feature_file` is the name of the `.feature` file inside that subfolder (e.g., `card_entry.feature`)

So the runner will look for the file at:

`features/access_with_card/card_entry/card_entry.feature`

Repeat this structure for each feature you want to register and control in your execution plan.

Key fields:
- `active`: Enable/disable modules or features.
- `order`: Integer to control execution order (lower runs first).
- `tags`: Filter scenarios by tags (e.g., `@smoke and @edge`).
- `module_dir` and `feature_dir`: Specify subfolders for organization.

To run only selected features/scenarios, set `active: true` and specify tags as needed. The runner will execute modules and features in the order specified by `order`.

actions such as `click_on_element_by_text`, `enter_text`, `find_text_on_screen`.

### Writing tests ✍️

Add Gherkin `.feature` files under `features/` and implement steps in
`features/steps/`. The project includes utility drivers that expose high-level
actions such as `click_on_element_by_text`, `enter_text`, `find_text_on_screen`.

#### Providing images for image-based search 🖼️

If a UI element cannot be found by text (OCR), you can provide an image to enable image-based search as a fallback. The image should be stored in a path that matches the feature's folder structure, with the following format:

```
resources/images/features/<module_dir>/<feature_dir>/<feature_file>/<tag_name>/<image_file>
```

Where:
- `<module_dir>`: The module directory as specified in `run_list.json` (e.g., `access_with_card`)
- `<feature_dir>`: The feature subdirectory (e.g., `card_entry`)
- `<feature_file>`: The name of the `.feature` file (e.g., `card_entry.feature`)
- `<tag_name>`: The tag of the scenario or case (e.g., `@smoke` → `smoke`)
- `<image_file>`: The image file to use for search, png format. It has to match the element that is asked to be found in the gherkin (e.g., `Salir.png`)

**Example:**

Suppose you have a feature registered as:

```json
{
  "module_name": "AccessWithCard",
  "module_dir": "access_with_card",
  "features": [
    {
      "feature_file": "card_entry.feature",
      "feature_dir": "card_entry",
      ...
    }
  ]
}
```

And a scenario tagged with `@smoke`. If you want to provide an image for a button, store it at:

```
resources/images/features/access_with_card/card_entry/card_entry.feature/smoke/button_ok.png
```

This way, if the framework cannot find the element by text, it will look for the image in this path and use it for image-based search.

#### Using tags in features and execution plans 🏷️

Tags in Gherkin scenarios and features allow you to:
- Filter which tests to run (e.g., by environment, priority, or functionality)
- Control execution via the JSON plan (`features/run_list.json`) by specifying tags for each feature
- Attach images or resources to steps using tag-based folder structure

Example of tags in a feature file:

```gherkin
@smoke @edge
Feature: Open a web page in Edge and verify content
  Scenario: Open GitHub page and check for "awesome-copilot"
    Given the application "Edge" is open
    When I enter the URL "https://github.com/github/awesome-copilot" in the address bar
    Then I see the text "awesome-copilot" on screen
```

You can specify tags in the execution plan to run only certain tests:

```json
{
  "feature_file": "example.feature",
  "active": true,
  "tags": "@smoke and @edge"
}
```

This will run only scenarios matching those tags. Tags also help organize screenshots and resources for each test.

## Contribution Guidelines 🤝
We welcome contributions! To get started:

- Fork the repository and create a feature branch.
- Add or update tests for new features.
- Follow PEP8 and keep code modular.
- Open a pull request with a clear description.

> [!TIP]
> For questions or issues, please open an issue in the repository.


## Troubleshooting 🛠️

- If `ModuleNotFoundError: No module named 'config'` occurs, make sure you run
  scripts from the project root and that the `config` package contains `__init__.py`.
- Ensure `TESSERACT_CMD_PATH` points to your Tesseract binary on Windows.

---

If you need help adapting the framework to a new application or OS, open an
issue with details about the target environment and sample screenshots.

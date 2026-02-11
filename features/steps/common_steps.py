# language: es
"""
Behave step definitions for common UI interactions.
"""
from behave import given, when, then, use_step_matcher
from executor.ui_executor import executor
import allure
from allure_commons.types import AttachmentType
import logging

from util.system_utils import get_image_path_from_feature_and_tag

#from util.system_utils import get_image_path_from_feature_and_tag

# The default "parse" matcher will be used, which is simpler and more robust.
use_step_matcher("parse")

logger = logging.getLogger(__name__)

@given('que la aplicación "{app_name}" está abierta')
def step_impl_app_is_open(context, app_name):
    """
    Verifies that a specific application window is visible.
    """
    logger.info(f"Verifying that the application '{app_name}' is open...")
    is_window_visible = executor.driver.is_app_running(app_name)
    assert is_window_visible, f"The application window '{app_name}' is not visible."

@when('hago clic en el elemento "{element_name}"')
@then('hago clic en el elemento "{element_name}"')
def step_impl_click_element(context, element_name):
    """
    Generic step to click on an element (when the app is not specified).
    """
    logger.info(f"Clicking on the element '{element_name}'...")
    dirpath = context.feature.filename
    scenario_tags = context.scenario.tags
    folder_step_path =get_image_path_from_feature_and_tag(dirpath, scenario_tags, element_name, context.step.name)
    success = executor.driver.click_on_element_by_text(element_name, folder_step_path)
    assert success, f"Could not click on the element '{element_name}'"

@when('en la aplicación "{app_name}" hago clic en el elemento "{element_name}"')
@then('en la aplicación "{app_name}" hago clic en el elemento "{element_name}"')
def step_impl_click_element_in_app(context, app_name, element_name):
    """
    Generic step to click on an element, ensuring the app is active.
    The wording was changed to avoid ambiguity with the previous step.
    """
    logger.info(f"In '{app_name}', clicking on the element '{element_name}'...")
    dirpath = context.feature.filename
    scenario_tags = context.scenario.tags
    folder_step_path =get_image_path_from_feature_and_tag(dirpath, scenario_tags, element_name, context.step.name)
    success = executor.driver.click_on_element_by_text_in_app(element_name, app_name, folder_step_path)
    assert success, f"Could not click on the element '{element_name}' in the application '{app_name}'."


@when('escribo "{text_to_type}" en el campo "{field_name}"')
def step_impl_type_in_field(context, text_to_type, field_name):
    """
    Step to type text into a specific field, activating it first.
    """
    logger.info(f"Typing '{text_to_type}' into the '{field_name}' field...")
    # Try to focus the field first by clicking its image (if available)
    dirpath = context.feature.filename
    scenario_tags = context.scenario.tags
    folder_step_path = get_image_path_from_feature_and_tag(dirpath, scenario_tags, field_name, context.step.name)
    try:
        executor.driver.click_on_element_by_text(field_name, folder_step_path)
    except Exception:
        # Ignore focus failure; we will still attempt to type
        logger.debug(f"Could not focus the '{field_name}' field by clicking (continuing to type).")

    success = executor.driver.enter_text(text_to_type)
    assert success, f"Could not type into the '{field_name}' field"

@given('veo el texto "{text_to_find}" en pantalla')
@then('veo el texto "{text_to_find}" en pantalla')
def step_impl_see_text(context, text_to_find):
    """
    Verifies that a specific text is visible on the screen using OCR.
    """
    logger.info(f"Verifying that the text '{text_to_find}' is visible...")
    # We use the system utility that searches for exact phrases with OCR
    dirpath = context.feature.filename
    scenario_tags = context.scenario.tags
    folder_step_path =get_image_path_from_feature_and_tag(dirpath, scenario_tags, text_to_find, context.step.name)
    result = executor.driver.find_text_on_screen(text_to_find, folder_step_path)
    assert result, f"The text '{text_to_find}' was not found on the screen."

@given('espero "{seconds}" segundos')
@when('espero "{seconds}" segundos')
@then('espero "{seconds}" segundos')
def step_impl_wait(context, seconds):
    """
    Step to introduce an explicit wait. Supports decimal values (e.g., "0.5").
    """
    executor.driver.wait(float(seconds))


@when('espero hasta "{seconds}" segundos o hasta que aparezca el texto "{text_to_find}" en pantalla')
@then('espero hasta "{seconds}" segundos o hasta que aparezca el texto "{text_to_find}" en pantalla')
def step_impl_wait_until_text_appears(context, seconds, text_to_find):
    """
    Waits for a specified time until a text appears on the screen.
    """
    result = executor.driver.wait_until_text_appears(float(seconds), text_to_find)
    assert result, f"The text '{text_to_find}' did not appear on the screen within {seconds} seconds."
        

@given('en la aplicación "{app_name}" veo el texto "{text_to_find}" en pantalla')
@then('en la aplicación "{app_name}" veo el texto "{text_to_find}" en pantalla')
def step_impl_see_text_on_app(context, app_name, text_to_find):
    """
    Verifies that a specific text is visible on the screen of a given application using OCR.
    """
    logger.info(f"Verifying that the text '{text_to_find}' is visible in the application '{app_name}'...")
    # We use the system utility that searches for exact phrases with OCR
    dirpath = context.feature.filename
    scenario_tags = context.scenario.tags
    folder_step_path =get_image_path_from_feature_and_tag(dirpath, scenario_tags, text_to_find, context.step.name)
    result = executor.driver.find_text_on_app(app_name, text_to_find, folder_step_path)
    assert result, f"The text '{text_to_find}' was not found in the application '{app_name}'."

@given('veo la opción "{option_name}" disponible en pantalla')
@then('veo la opción "{option_name}" disponible en pantalla')
def step_impl_see_option_in_screen(context, option_name):
    """
    Verifies that a specific option is visible on the screen using OCR.
    """
    logger.info(f"Verifying that the option '{option_name}' is visible...")
    # We use the system utility that searches for exact phrases with OCR
    dirpath = context.feature.filename
    scenario_tags = context.scenario.tags
    folder_step_path =get_image_path_from_feature_and_tag(dirpath, scenario_tags, option_name, context.step.name)
    result = executor.driver.find_text_on_screen(option_name, folder_step_path)
    assert result, f"The option '{option_name}' was not found on the screen."

@then('tomo una captura de pantalla como evidencia llamada "{evidence_name}"')
def step_impl_take_screenshot_evidence(context, evidence_name):
    """
    Takes a screenshot and attaches it to the Allure report.
    """
    logger.info(f"Taking evidence screenshot: '{evidence_name}'")
    screenshot_bytes = executor.driver.capture_evidence_screenshot()
    if screenshot_bytes:
        allure.attach(screenshot_bytes, name=evidence_name, attachment_type=AttachmentType.PNG)
        logger.info("Screenshot attached to the Allure report.")
    else:
        logger.warning("Could not take the screenshot to attach as evidence.")


@when('ingreso la URL "{url}" en la barra de direcciones')
def step_impl_enter_url_in_address_bar(context, url):
    """
    Enters the specified URL into the active browser's address bar.
    This step assumes the browser is open and focused.
    """
    logger.info(f"Entering the URL '{url}' in the address bar...")
    success = executor.driver.enter_url_in_address_bar(url)
    assert success, f"Could not enter the URL '{url}' in the address bar."
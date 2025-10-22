from executor.driver.ui.ocr_driver import OCRDriver
from executor.driver.driver_abstract_ui import DriverAbstractUI

class UIExecutor:
    driver = None
    def __init__(self, driver: DriverAbstractUI):
        self.driver: DriverAbstractUI = driver


executor = UIExecutor(driver=OCRDriver())
# config/logging_config.py
import logging
from logging.handlers import RotatingFileHandler

def setup_logging():
    """Configures the main logger for the application."""
    
    # Create a logger with a name for your application, for example, 'my_app'.
    # If you use __name__ in other modules, they will inherit from this one.
    logger = logging.getLogger()
    logger.setLevel(logging.DEBUG)  
    
    if not logger.handlers:
        file_handler = logging.FileHandler('app.log', mode='w', encoding='utf-8')
        file_handler.setLevel(logging.DEBUG)
        handler = RotatingFileHandler("app.log", maxBytes=1024 * 1024, backupCount=5)
        formatter = logging.Formatter(
            '%(asctime)s %(levelname)s %(name)s:%(funcName)s: %(message)s'
        )
        file_handler.setFormatter(formatter)
        handler.setFormatter(formatter)
        logger.addHandler(file_handler)
        logger.addHandler(handler)

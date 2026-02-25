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
        # Solo usamos RotatingFileHandler para app.log. 
        # No agregamos StreamHandler (consola) para que la pantalla de Execution Order 
        # no se llene de trazas internas (DEBUG/INFO) y solo muestre la salida de Behave.
        handler = RotatingFileHandler("app.log", maxBytes=10*1024*1024, backupCount=5, encoding='utf-8')
        formatter = logging.Formatter(
            '%(asctime)s %(levelname)s %(name)s:%(funcName)s: %(message)s'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        
        # El backend se encargará de reenviar la salida estándar de Behave a la cola log_queue.

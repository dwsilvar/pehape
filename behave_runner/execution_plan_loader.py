import json
import logging
from typing import List, Dict, Any, Optional

CONFIG_FILE = "./features/run_list.json"
logger = logging.getLogger(__name__)

class ExecutionPlanLoader:
    """
    Class responsible for loading and parsing the JSON configuration file 
    to obtain the test execution plan.
    """
    def __init__(self, config_file: str = CONFIG_FILE):
        self.config_file = config_file

    def load_execution_plan(self) -> Optional[List[Dict[str, Any]]]:
        """
        Reads the JSON file and returns the 'execution_sequence' list.

        Returns:
            A list of dictionaries with the sequence of modules to execute, 
            or None if a critical error occurs.
        """
        try:
            with open(self.config_file, 'r') as f:
                config = json.load(f)
        except FileNotFoundError:
            logger.error(f"ERROR: Configuration file '{self.config_file}' not found.")
            return None
        except json.JSONDecodeError as e:
            logger.error(f"ERROR: File '{self.config_file}' has an invalid JSON format. Detail: {e}")
            return None

        sequence = config.get("execution_sequence")
        if not sequence or not isinstance(sequence, list):
            logger.error("ERROR: The key 'execution_sequence' was not found or is not a valid list.")
            return None
            
        return sequence

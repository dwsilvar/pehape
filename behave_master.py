import sys
import logging
import os
from behave_runner.behave_run_json import BehaveRunJson
from behave_runner.execution_plan_loader import ExecutionPlanLoader
from behave_runner.report_allure import ReportAllure
import config.logging_config as logging_config

logger = logging.getLogger(__name__)

class BehaveMaster:
    def __init__(self):
        logging_config.setup_logging()
        

    def run_main(self):
    
        # --- INICIO DE LA CORRECCIÓN DE ENCODING ---
        # Reconfigura los streams de salida estándar para forzar el uso de UTF-8.
        # Esto es crucial para que los caracteres especiales (acentos, etc.) se muestren
        # correctamente cuando la salida del script se captura en otro proceso.
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
        # --- FIN DE LA CORRECCIÓN DE ENCODING ---

        # 1. Instantiate and load the plan using the ExecutionPlanLoader class
        loader = ExecutionPlanLoader()
        plan = loader.load_execution_plan()
        
        if plan is None:
            logger.error("The runner failed to start due to configuration errors.")
        else:
            # 2. Instantiate and run the sequence using the BehaveRunner class
            # Se añaden argumentos para asegurar el streaming en tiempo real.
            behave_args = "--no-capture"
            runner = BehaveRunJson(plan, behave_args)

            runner.run_sequence()
            logger.info("Test execution completed.")

            # 3. Generate the Allure report only if results were produced.
            allure_results_dir = 'reports/allure_results'
            # Check if the directory exists and is not empty
            if os.path.exists(allure_results_dir) and os.listdir(allure_results_dir):
                logger.info("Allure results found. Generating report...")
                reporter = ReportAllure()
                reporter.generate_report(allure_results_dir, 'reports/allure-report')
            else:
                logger.warning("No Allure results were generated. Skipping report generation.")


beha = BehaveMaster()
beha.run_main()

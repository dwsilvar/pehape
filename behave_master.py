import sys
import logging
import json
import os
from behave_runner.behave_run_json import BehaveRunJson
from behave_runner.execution_plan_loader import ExecutionPlanLoader
from behave_runner.report_allure import ReportAllure
import config.logging_config as logging_config
import config.config as config

logger = logging.getLogger(__name__)

class JsonScenarioStatusLogger(logging.Handler):
    """
    Un manejador de logging personalizado que intercepta los registros de Behave
    y emite un JSON estructurado para los eventos de inicio y fin de escenario.
    """
    def emit(self, record):
        # Los logs de Behave para escenarios tienen un formato predecible.
        # Ej: "Scenario: Mi escenario de prueba -- features/mi_feature.feature:10"
        msg = record.getMessage()
        
        # Detectar el inicio de un escenario
        if "Scenario:" in msg and " -- " in msg:
            try:
                parts = msg.split(' -- ')
                scenario_name = parts[0].replace("Scenario:", "").strip()
                # Extraer el nombre del archivo del feature
                feature_file = parts[1].split(':')[0].replace('\\', '/')

                status_event = {
                    "type": "scenario_status",
                    "feature_file": feature_file,
                    "scenario_name": scenario_name,
                    "status": "running"
                }
                print(json.dumps(status_event))
            except Exception:
                # Si el parseo falla, simplemente ignora y no emite el evento.
                pass

class BehaveMaster:
    def __init__(self):
        logging_config.setup_logging()
        # --- INICIO DE LA MODIFICACIÓN PARA STATUS DE ESCENARIO ---
        # Añadimos nuestro manejador personalizado al logger raíz de Behave.
        # Esto nos permite "escuchar" los eventos de los escenarios.
        behave_logger = logging.getLogger("behave")
        behave_logger.setLevel(logging.INFO) # Asegurarse de que el nivel es suficiente para capturar los logs.
        behave_logger.addHandler(JsonScenarioStatusLogger())
        # --- FIN DE LA MODIFICACIÓN ---

    def run_main(self):
    
        # 1. Instantiate and load the plan using the ExecutionPlanLoader class
        loader = ExecutionPlanLoader()
        plan = loader.load_execution_plan()
        
        if plan is None:
            logger.error("The runner failed to start due to configuration errors.")
        else:
            # 2. Instantiate and run the sequence using the BehaveRunner class
            # Se añaden argumentos para asegurar el streaming en tiempo real.
            behave_args = "--no-capture"
            # Allow overriding via environment variable
            stop_on_failure = os.getenv('BEHAVE_STOP_ON_FAILURE', str(config.STOP_ON_FAILURE)).lower() in ('true', '1', 'yes')
            runner = BehaveRunJson(plan, behave_args, stop_on_failure=stop_on_failure)

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

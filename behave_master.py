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
    
        # 1. Instantiate and load the plan using the ExecutionPlanLoader class
        loader = ExecutionPlanLoader()
        plan = loader.load_execution_plan()
        
        if plan is None:
            logger.error("The runner failed to start due to configuration errors.")
        else:
            # 2. Instantiate and run the sequence using the BehaveRunner class
            runner = BehaveRunJson(plan)
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

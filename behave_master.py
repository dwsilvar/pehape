import sys
import logging
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
            reporter = ReportAllure()
            reporter.run_report_server('reports/allure_results')
            


beha = BehaveMaster()
beha.run_main()

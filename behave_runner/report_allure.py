import os
import subprocess
import logging

logger = logging.getLogger(__name__)

class ReportAllure:

    def __init__(self):
        pass
    
    def run_report_server(self, allure_results_dir: str):
        """
        Start a local server to view the Allure report.
        Paremeters:
            allure_results_dir: Path to the directory containing the Allure results.
        """
        logger.info("Starting the Allure server to view the report...")
        # Ensure the results directory exists (create if it needed)
        if not os.path.exists(allure_results_dir):
            try:
                os.makedirs(allure_results_dir, exist_ok=True)
                logger.info(f"Allure results directory '{allure_results_dir}' not found. Created it.")
            except Exception as e:
                logger.error(f"Error: could not create Allure results directory '{allure_results_dir}': {e}")
                return
        else:
            logger.info(f"Allure results directory found: '{allure_results_dir}'")

        try:
            # Construct the Allure serve command
            command = ['allure', 'serve', allure_results_dir]

            # Execute the command
            logger.info(f"Running command: {' '.join(command)}")
            subprocess.run(['allure', 'serve', allure_results_dir], check=True,shell=True,)

        except subprocess.CalledProcessError as e:
            logger.error(f"Error serving Allure report: {e}")
            if e.stderr is not None:
                stderr_message = e.stderr.strip()  # .decode('utf-8') is not needed if text=True was used in subprocess.run
                logger.error(f"Command failed. Stderr: {stderr_message}")
        except FileNotFoundError as e:
            logger.error(f"Error: 'allure' command not found. Make sure Allure Report is installed and in your PATH. {e}")
        except Exception as e:
            logger.exception(f"An unexpected error occurred: {e}")

    def generate_report(self, allure_results_dir: str, allure_report_dir: str):
        """
        Generate a static Allure report from the results.
        Parameters:
            allure_results_dir: Path to the directory containing the Allure results.
            allure_report_dir: Path to the directory where the static report will be generated.
        """
        logger.info(f"Generating Allure report from '{allure_results_dir}' into '{allure_report_dir}'...")

        if not os.path.exists(allure_results_dir):
            logger.warning(f"Allure results directory '{allure_results_dir}' not found. Cannot generate report.")
            return

        try:
            # Construct the Allure generate command with --clean to remove previous results
            command = ['allure', 'generate', allure_results_dir, '-o', allure_report_dir, '--clean']

            # Execute the command
            logger.info(f"Running command: {' '.join(command)}")
            subprocess.run(command, check=True, shell=True)
            logger.info("Allure report generated successfully.")

        except subprocess.CalledProcessError as e:
            logger.error(f"Error generating Allure report: {e}")
        except FileNotFoundError:
            logger.error("Error: 'allure' command not found. Make sure Allure is installed and in your system's PATH.")
        except Exception as e:
            logger.exception(f"An unexpected error occurred while generating the report: {e}")

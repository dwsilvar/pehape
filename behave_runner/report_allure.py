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

        # Intentar localizar el ejecutable de Allure si no está en el PATH
        allure_exe = "allure"
        if os.name == 'nt':
            # Buscar en la carpeta allure-commandline relativa a la raíz si no se encuentra en PATH
            project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            portable_path = os.path.join(project_root, 'allure-commandline', 'bin', 'allure.bat')
            if os.path.exists(portable_path):
                allure_exe = f'"{portable_path}"'
                logger.info(f"Usando Allure portable encontrado en: {portable_path}")

        try:
            # Construct the Allure generate command string for shell execution
            # Usar string en lugar de lista con shell=True es más fiable en Windows para archivos .bat
            command = f'{allure_exe} generate "{allure_results_dir}" -o "{allure_report_dir}" --clean'

            # Execute the command
            logger.info(f"Running command: {command}")
            # Redirigimos stderr para capturar errores detallados
            result = subprocess.run(command, check=True, shell=True, stderr=subprocess.PIPE, stdout=subprocess.PIPE)
            logger.info("Allure report generated successfully.")

        except subprocess.CalledProcessError as e:
            # Capturar el error 9009 (comando no encontrado en Windows)
            if e.returncode == 9009:
                logger.error("Error 9009: No se encontró el comando 'allure'. Asegúrese de que Allure y Java estén instalados y en el PATH.")
            else:
                stderr_output = e.stderr.decode('utf-8', errors='replace') if e.stderr else "No stderr"
                logger.error(f"Error generando reporte Allure (Exit Code {e.returncode}): {stderr_output}")
        except Exception as e:
            logger.exception(f"Error inesperado al generar el reporte: {e}")

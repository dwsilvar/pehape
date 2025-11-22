from behave.__main__ import main as behave_main
import os
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

FEATURES_DIR = "./features"
class BehaveRunJson:
    """
    Class responsible for taking the execution plan and executing the commands
    'behave' in the specified order and with the specified filters.
    """
    def __init__(self, execution_plan: List[Dict[str, Any]], extra_args: str = ""):
        self.execution_plan = execution_plan
        self.extra_args = extra_args.split()

    def run_sequence(self):
        """
        Executes behave for each active feature in the sequence using behave_main.
        """
        if not self.execution_plan:
            logger.info("Execution plan is empty. Terminating execution.")
            return

        logger.info("--- Execution Plan ---")

        # Sort modules by 'order' when present, otherwise preserve given order
        modules_sorted = sorted(
            self.execution_plan,
            key=lambda m: (m.get('order') is None, m.get('order', 0))
        )

        for module_item in modules_sorted:
            module_name = module_item.get("module_name", "Sin Nombre")
            module_active = module_item.get("active", False)
            module_dir = module_item.get("module_dir", "")
            features = module_item.get("features", [])

            if not module_active: # Deactivated
                logger.info(f"IGNORING MODULE: {module_name} (Deactivated)")
                continue
            
            logger.info(f"--- ACTIVE MODULE: {module_name} (Base Dir: {module_dir}) ---")

            # Sort features by 'order' when present
            features_sorted = sorted(
                features,
                key=lambda f: (f.get('order') is None, f.get('order', 0))
            )

            for feature_item in features_sorted:
                feature_file = feature_item.get("feature_file")
                feature_active = feature_item.get("active", False)
                feature_dir = feature_item.get("feature_dir", "")
                tags = feature_item.get("tags")
                feature_id = f"feature::{module_name}::{feature_dir}/{feature_file}"

                if not feature_file: # Warning: Feature without 'feature_file'. Skipping.
                    logger.warning("Feature without 'feature_file'. Skipping.")
                    continue

                if not feature_active: # IGNORED: {feature_dir}/{feature_file} (Feature Deactivated)
                    logger.info(f"IGNORED: {feature_dir}/{feature_file} (Feature Deactivated)")
                    continue

                # Constructs the feature path considering empty directories
                path_parts = [FEATURES_DIR]
                if module_dir:
                    path_parts.append(module_dir)
                if feature_dir:
                    path_parts.append(feature_dir)
                path_parts.append(feature_file)
                full_feature_path = os.path.join(*path_parts)
                
                if not os.path.exists(full_feature_path): # ERROR: File not found: {full_feature_path}. Skipping.
                    logger.error(f"File not found: {full_feature_path}. Skipping.")
                    continue

                # Construir los argumentos para Behave
                # Inicia con los argumentos extra (ej. --no-capture)
                behave_args = list(self.extra_args) # Esto contendrá ['--no-capture']
                
                # Especificar el formateador 'plain' para la salida estándar (consola)
                behave_args.extend(["-f", "plain", "-o", "-"])

                # Especificar el formateador de Allure con su directorio de salida
                behave_args.extend(["-f", "allure_behave.formatter:AllureFormatter", "-o", "reports/allure_results"])
                
                # Pasamos el ID del feature como un dato de usuario al contexto de behave.
                behave_args.extend(["--define", f"feature_id={feature_id}"])

                tag_info = ""
                # 'tags' puede ser una lista de strings o null.
                # Si es una lista, la unimos con comas para crear una expresión de tags OR.
                if tags and isinstance(tags, list):
                    tag_expression = ",".join(tags)
                    behave_args.extend(["--tags", tag_expression])
                    tag_info = f" (Filtro: {tag_expression})"

                # Añadir la ruta del feature al final
                behave_args.append(full_feature_path)

                logger.info(f"  INCLUDED: {full_feature_path}{tag_info}")

                # Execute behave using behave_main
                exit_code = behave_main(behave_args)
                if exit_code == 0:
                    logger.info("Tests executed successfully.")
                else:
                    logger.error(f"Tests failed with exit code: {exit_code}")

        logger.info("--- Execution Finished ---")

"""
Tasks related to text verification in files.
"""
import os
import logging
import allure
from allure_commons.types import AttachmentType
from executor.tasks_core.registry import register_task
from executor.tasks_core.base_task import BaseTask

logger = logging.getLogger(__name__)

@register_task("verificar_texto_archivo")
class VerifyTextInFileTask(BaseTask):
    """
    Verifica que uno o más textos existan en un archivo.
    Permite configurar múltiples textos a buscar (uno por línea).
    """
    scope = "After Step / After Scenario"

    @classmethod
    def get_args_schema(cls) -> list:
        return [
            {
                "name": "file_path",
                "label": "Ruta del Archivo",
                "type": "text",
                "default": "C:\\temp\\activity.log"
            },
            {
                "name": "expected_texts",
                "label": "Textos a Validar (uno por línea)",
                "type": "textarea",
                "default": ""
            }
        ]

    def execute(self, context, step, **kwargs):
        file_path = kwargs.get('file_path', "C:\\temp\\activity.log")
        expected_texts_raw = kwargs.get('expected_texts', '')
        
        logger.info(f"VerifyTextInFileTask: Verifying texts in file '{file_path}'...")
        
        # Verificar que el archivo existe
        if not os.path.exists(file_path):
            error_msg = f"VerifyTextInFileTask: File '{file_path}' does not exist."
            logger.error(error_msg)
            raise AssertionError(error_msg)
        
        # Parsear textos esperados (separados por líneas)
        expected_texts = [t.strip() for t in expected_texts_raw.split('\n') if t.strip()]
        
        if not expected_texts:
            logger.warning("VerifyTextInFileTask: No texts to validate. Skipping.")
            return
        
        logger.info(f"VerifyTextInFileTask: Validating {len(expected_texts)} text(s)...")
        
        # Leer contenido del archivo
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            error_msg = f"VerifyTextInFileTask: Error reading file '{file_path}'. Cause: {e}"
            logger.error(error_msg)
            raise e
        
        # Verificar cada texto
        found_texts = []
        missing_texts = []
        
        for text in expected_texts:
            if text in content:
                found_texts.append(text)
                logger.info(f"VerifyTextInFileTask: ✓ Found: '{text}'")
            else:
                missing_texts.append(text)
                logger.error(f"VerifyTextInFileTask: ✗ Missing: '{text}'")
        
        # Adjuntar resultados a Allure
        result_summary = f"Found: {len(found_texts)}/{len(expected_texts)}\n\n"
        result_summary += "✓ Found texts:\n" + "\n".join(f"  - {t}" for t in found_texts) + "\n\n"
        if missing_texts:
            result_summary += "✗ Missing texts:\n" + "\n".join(f"  - {t}" for t in missing_texts)
        
        allure.attach(
            result_summary,
            name=f"Text Verification Results - {os.path.basename(file_path)}",
            attachment_type=AttachmentType.TEXT
        )
        
        # Adjuntar contenido del archivo para referencia
        allure.attach(
            content,
            name=f"File Content - {os.path.basename(file_path)}",
            attachment_type=AttachmentType.TEXT
        )
        
        # Fallar si hay textos faltantes
        if missing_texts:
            error_msg = f"VerifyTextInFileTask: {len(missing_texts)} text(s) not found in '{file_path}': {missing_texts}"
            logger.error(error_msg)
            raise AssertionError(error_msg)
        
        logger.info(f"VerifyTextInFileTask: All {len(expected_texts)} text(s) found successfully.")

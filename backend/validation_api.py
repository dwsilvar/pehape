"""
API endpoints for validating file existence.
"""
import os
import logging
from flask import jsonify, Blueprint

logger = logging.getLogger(__name__)

validation_bp = Blueprint('validation', __name__)


@validation_bp.route('/api/validate-files', methods=['GET'])
def validate_files():
    """
    Validate that all registered features and tasks exist physically.
    
    Returns:
        JSON with lists of missing features and tasks
    """
    try:
        from execution_plan_manager import ExecutionPlanManager
        
        # Get features directory path
        features_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'features')
        manager = ExecutionPlanManager(features_dir)
        modules = manager.get_sequence()
        
        # Import all task modules to ensure they are registered
        # This triggers the @register_task decorators
        try:
            import executor.tasks.log_tasks
            import executor.tasks.text_verification_tasks
            # Import other task modules as needed
        except ImportError as e:
            logger.warning(f"Could not import some task modules: {e}")
        
        missing_features = []
        missing_tasks = []
        
        # Validate features
        for module in modules:
            for feature in module.get('features', []):
                feature_dir = feature.get('feature_dir', '')
                feature_file = feature.get('feature_file', '')
                
                # Construct full absolute path
                if feature_dir:
                    feature_path = os.path.join(features_dir, feature_dir, feature_file)
                else:
                    feature_path = os.path.join(features_dir, feature_file)
                
                # Normalize path for comparison
                feature_path = os.path.normpath(feature_path)
                
                if not os.path.exists(feature_path):
                    # Generate feature_id if not present
                    if 'id' not in feature:
                        if feature_dir:
                            feature['id'] = f"feature::{module.get('module_name')}::{feature_dir}/{feature_file}"
                        else:
                            feature['id'] = f"feature::{module.get('module_name')}::/{feature_file}"
                    
                    feature_id = feature.get('id')
                    # Use relative path for display
                    display_path = os.path.join(feature_dir, feature_file) if feature_dir else feature_file
                    
                    missing_features.append({
                        'id': feature_id,
                        'path': display_path,
                        'module': module.get('module_name'),
                        'feature_file': feature_file,
                        'feature_dir': feature_dir
                    })
                
                
                # Validate tasks within features - use task registry
                for task in feature.get('ui_tasks', []):
                    task_name = task.get('name')
                    if task_name and task_name not in [t['name'] for t in missing_tasks]:
                        # Import task registry to check if task is registered
                        try:
                            from executor.tasks_core.registry import get_all_tasks
                            
                            # Get all registered tasks
                            registered_tasks = get_all_tasks()
                            
                            # Check if task is in the registry
                            if task_name not in registered_tasks:
                                missing_tasks.append({
                                    'name': task_name,
                                    'feature_id': feature.get('id'),
                                    'hook': task.get('hook')
                                })
                        except (ImportError, Exception) as e:
                            # Fallback: if registry import fails, mark as missing
                            logger.warning(f"Could not check task registry for {task_name}: {e}")
                            missing_tasks.append({
                                'name': task_name,
                                'feature_id': feature.get('id'),
                                'hook': task.get('hook')
                            })
        
        all_valid = len(missing_features) == 0 and len(missing_tasks) == 0
        
        return jsonify({
            'missing_features': missing_features,
            'missing_tasks': missing_tasks,
            'all_valid': all_valid
        })
    
    except Exception as e:
        logger.error(f"Error validating files: {e}")
        return jsonify({'error': str(e)}), 500

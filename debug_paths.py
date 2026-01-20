import os

def check(rel_path):
    # Simulate backend logic
    # Hardcoded based on what we know the environment is likely to be
    project_root = os.path.abspath("c:\\Proyectos\\ocr_test\\pehape")
    
    try:
        full_path = os.path.abspath(os.path.join(project_root, rel_path))
        
        print(f"Input: {rel_path}")
        print(f"Root: {project_root}")
        print(f"Full: {full_path}")
        
        # Original Check
        if not full_path.startswith(project_root):
             print("RESULT: DENIED (Original)")
        else:
             print("RESULT: ALLOWED (Original)")
             
        # Case Insensitive Check (Proposed Fix)
        if not os.path.normcase(full_path).startswith(os.path.normcase(project_root)):
             print("RESULT: DENIED (Normcase)")
        else:
             print("RESULT: ALLOWED (Normcase)")
             
    except Exception as e:
        print(f"Error: {e}")
    print("-" * 20)

check("requirements.txt")
check("backend/backend_server.py")
# Emulate potential user mistake or case difference
check("C:\\Proyectos\\ocr_test\\pehape\\requirements.txt") 
check("c:/proyectos/ocr_test/pehape/requirements.txt") # lower case driver
check("../outside.txt")

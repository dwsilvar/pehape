# File Explorer - Resource Management

## Purpose

The File Explorer provides management features to organize and maintain feature files and folders. Users can rename resources via context menu or move them across directories using Drag & Drop.

## Features

### 1. Rename
Allows renaming files and folders directly from the context menu.

**Usage**:
1. **Right-click** on any file or folder.
2. Select **Rename**.
3. Enter the new name in the dialog.
   - For feature files: The `.feature` extension is added automatically if omitted.
4. Click **Rename** or press Enter.

### 2. Drag & Drop Move
Allows moving files and folders to different locations within the features directory.

**Usage**:
1. **Click and hold** an item (file or folder).
2. **Drag** it over a target folder.
   - Target folders will highlight when hovered.
   - Folders auto-expand after hovering for a moment.
3. **Drop** the item to perform the move.

**Root Drops**: Dragging an item to the empty area of the File Explorer moves it to the root directory.

## Backend Architecture

### API Endpoints

#### Rename
**`PUT /api/resource/<path>/rename`**
- **Body**: `{ "new_name": "string" }`
- **Action**: Renames the resource at `<path>`.

#### Move
**`PUT /api/resource/<path>/move`**
- **Body**: `{ "destination_dir": "string" }`
- **Action**: Moves the resource at `<path>` to the directory specified by `destination_dir`.
- **Note**: `destination_dir` is relative to the `features/` root (e.g., `""` for root, `"folder/subfolder"`).

### Automated Side Effects

Both Rename and Move operations trigger critical automated processes to maintain project integrity:

#### OCR Image Migration
- **Logic**: OCR images are stored in a structure mirroring the feature path: `resources/images/<feature_path>/<tag>/<text>.png`.
- **Action**: When a resource is moved or renamed, the corresponding image directory is moved to match the new path.
- **Benefit**: Ensures text recognition screenshots remain associated with their features.

#### Module Reference Updates
- **Logic**: The application's execution plan (`run_list.json`) uses file paths to identify features.
- **Action**: The system scans all modules and updates `feature_file`, `feature_dir`, and `id` references that match the changed path.
- **Benefit**: Prevents broken execution plans; renamed or moved features stay in their assigned modules and execution order.

## User Feedback & Notifications

The system uses a color-coded notification (Snackbar) to report results:

| Severity | Meaning | Example |
| :--- | :--- | :--- |
| **Success** (Green) | Operation completed successfully. | "Archivo movido exitosamente." |
| **Info** (Blue) | Additional details about the process. | "5 imagen(es) OCR migrada(s)." |
| **Warning** (Orange) | Main action succeeded, but a side effect failed. | "Renombrado exitosamente, pero hubo errores al mover imágenes." |
| **Error** (Red) | The entire operation failed. | "Ya existe un recurso con ese nombre en el destino." |

## Technical Implementation (Frontend)

- **Component**: [FileExplorer.tsx](file:///c:/Proyectos/ocr_test/pehape/frontend/src/components/FileExplorer.tsx)
- **Libraries**: Uses `@dnd-kit/core` for drag-and-drop logic.
- **Hooks**:
  - `useDraggable`: Makes items draggable.
  - `useDroppable`: Sets up folders and the root as drop targets.
  - `useDndMonitor`: Centralized listener for move operations to avoid redundant logic in every item.
- **State Management**:
  - `files`: The current file tree structure.
  - `expanded`: Tracks which folders are open.
  - `searchTerm`: Filters the tree (expanding matches automatically).

## Security & Validations

- **Path Escape**: Backend validates that all paths remain within the `features/` directory.
- **Invalid Characters**: Forbidden characters in names: `/ \ : * ? " < > |`.
- **Recursion Prevention**: A directory cannot be moved inside itself or one of its subdirectories.
- **Conflicts**: Cannot move/rename if a resource with the same name already exists in the destination.

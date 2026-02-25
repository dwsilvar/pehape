"""
Feature Editor GUI for OCR Test Automation

Allows browsing, selecting, and editing Gherkin feature files from the 'features' directory.
Also shows execution order based on run_list.json configuration.
"""
import os
import json
import tkinter as tk
from tkinter import filedialog, messagebox, scrolledtext, ttk

FEATURES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'features')
RUN_LIST_PATH = os.path.join(FEATURES_DIR, 'run_list.json')

class FeatureEditorApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Pehape Editor - OCR Test Automation")
        self.geometry("1024x780")
        self.resizable(True, True)
        self.selected_file = None
        self.run_list_data = self.load_run_list()
        # Variables for drag and drop
        self.drag_source = None
        self.drag_data = None
        self.create_widgets()
        self.populate_feature_list()
        self.populate_execution_list()

    def load_run_list(self):
        try:
            with open(RUN_LIST_PATH, 'r') as f:
                return json.load(f)
        except Exception as e:
            messagebox.showwarning("Warning", f"Could not load run_list.json: {e}")
            return {"execution_sequence": []}

    def create_widgets(self):
        # Window control buttons (top right)
        self.close_button = tk.Button(self, text="✖", command=self.destroy, width=3)
        self.close_button.place(relx=1.0, x=-40, y=10, anchor="ne")
        self.minimize_button = tk.Button(self, text="—", command=self.iconify, width=3)
        self.minimize_button.place(relx=1.0, x=-80, y=10, anchor="ne")

        # Left panel frame to contain both trees
        left_panel = ttk.Frame(self)
        left_panel.grid(row=0, column=0, rowspan=2, sticky="nswe", padx=10, pady=10)

        # Feature browser label
        ttk.Label(left_panel, text="Feature Browser").grid(row=0, column=0, sticky="w", pady=(0, 5))

        # Feature file tree (top)
        self.feature_tree = ttk.Treeview(left_panel, columns=("type",), show="tree", height=15)
        self.feature_tree.grid(row=1, column=0, sticky="nswe", pady=(0, 10))
        self.feature_tree.bind('<<TreeviewSelect>>', self.on_tree_select)

        # Execution order frame with label and buttons
        execution_frame = ttk.Frame(left_panel)
        execution_frame.grid(row=2, column=0, sticky="we", pady=(0, 5))
        
        ttk.Label(execution_frame, text="Execution Order").pack(side="left")
        
        # Add move buttons
        buttons_frame = ttk.Frame(execution_frame)
        buttons_frame.pack(side="right")
        
        self.move_up_btn = ttk.Button(buttons_frame, text="▲", width=3, command=self.move_item_up)
        self.move_up_btn.pack(side="left", padx=2)
        
        self.move_down_btn = ttk.Button(buttons_frame, text="▼", width=3, command=self.move_item_down)
        self.move_down_btn.pack(side="left", padx=2)
        
        self.save_order_btn = ttk.Button(buttons_frame, text="💾", width=3, command=self.save_execution_order)
        self.save_order_btn.pack(side="left", padx=2)

        # Execution order tree (bottom)
        self.execution_tree = ttk.Treeview(left_panel, columns=("order", "status"), show="tree headings")
        self.execution_tree.grid(row=3, column=0, sticky="nswe")
        self.execution_tree.bind('<<TreeviewSelect>>', self.on_execution_select)
        
        # Configure execution tree columns
        self.execution_tree.heading("order", text="#")
        self.execution_tree.heading("status", text="Status")
        self.execution_tree.column("order", width=50, anchor="center")
        self.execution_tree.column("status", width=70, anchor="center")

        # Configure drag and drop
        self.execution_tree.configure(cursor="arrow")
        self.execution_tree.tag_configure('drag_highlight', background='lightblue')
        
        # Bind drag and drop events
        self.execution_tree.bind('<Button-1>', self.on_drag_start)
        self.execution_tree.bind('<B1-Motion>', self.on_drag_motion)
        self.execution_tree.bind('<ButtonRelease-1>', self.on_drag_release)

        # Set column weight for the feature tree widget to 3
        self.grid_columnconfigure(0, weight=3)

        # Configure grid weights for left panel
        left_panel.grid_columnconfigure(0, weight=1)
        left_panel.grid_rowconfigure(1, weight=1)  # Feature tree expands
        left_panel.grid_rowconfigure(3, weight=1)  # Execution tree expands

        # Add scrollbars for both trees
        feature_scroll = ttk.Scrollbar(left_panel, orient="vertical", command=self.feature_tree.yview)
        feature_scroll.grid(row=1, column=1, sticky="ns")
        self.feature_tree.configure(yscrollcommand=feature_scroll.set)

        execution_scroll = ttk.Scrollbar(left_panel, orient="vertical", command=self.execution_tree.yview)
        execution_scroll.grid(row=3, column=1, sticky="ns")
        self.execution_tree.configure(yscrollcommand=execution_scroll.set)

        # Edit area
        self.editor = scrolledtext.ScrolledText(self, wrap=tk.WORD, width=80, height=30)
        self.editor.grid(row=0, column=1, sticky="nswe", padx=10, pady=10)

        # Save button
        self.save_button = tk.Button(self, text="Save Feature", command=self.save_feature)
        self.save_button.grid(row=1, column=1, sticky="e", padx=10, pady=5)

        # Configure main window grid weights
        self.grid_columnconfigure(0, weight=1)  # Left panel
        self.grid_columnconfigure(1, weight=2)  # Editor area
        self.grid_rowconfigure(0, weight=1)

    def populate_feature_list(self):
        # Clear tree
        for item in self.feature_tree.get_children():
            self.feature_tree.delete(item)

        folder_icon = "📁 "
        def insert_tree_items(parent, path):
            for entry in sorted(os.listdir(path)):
                full_path = os.path.join(path, entry)
                rel_path = os.path.relpath(full_path, FEATURES_DIR)
                if os.path.isdir(full_path):
                    node = self.feature_tree.insert(parent, "end", text=folder_icon + entry, open=False, tags=("folder",))
                    insert_tree_items(node, full_path)
                elif entry.endswith('.feature'):
                    self.feature_tree.insert(parent, "end", text=entry, values=("feature",), tags=("feature",), iid=rel_path)

        insert_tree_items("", FEATURES_DIR)

    def on_tree_select(self, event):
        selection = self.feature_tree.selection()
        if selection:
            rel_path = selection[0]
            abs_path = os.path.join(FEATURES_DIR, rel_path)
            if os.path.isfile(abs_path) and abs_path.endswith('.feature'):
                self.selected_file = abs_path
                self.load_feature(abs_path)

    def load_feature(self, path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            self.editor.delete('1.0', tk.END)
            self.editor.insert(tk.END, content)
        except Exception as e:
            messagebox.showerror("Error", f"Failed to load feature file:\n{e}")

    def populate_execution_list(self):
        # Clear existing items
        for item in self.execution_tree.get_children():
            self.execution_tree.delete(item)

        # Insert modules and features from run_list.json
        for module in sorted(self.run_list_data.get('execution_sequence', []), key=lambda x: x.get('order', 999)):
            # Create module node
            status = "✓" if module.get('active', False) else "✗"
            module_node = self.execution_tree.insert("", "end", 
                text=module['module_name'],
                values=(module.get('order', ''), status),
                tags=('module',))
            
            # Add features under the module
            for feature in sorted(module.get('features', []), key=lambda x: x.get('order', 999)):
                feature_path = os.path.join(
                    module.get('module_dir', ''),
                    feature.get('feature_dir', ''),
                    feature.get('feature_file', '')
                ).replace('\\', '/')
                
                status = "✓" if feature.get('active', False) else "✗"
                self.execution_tree.insert(module_node, "end",
                    text=feature.get('feature_file', ''),
                    values=(feature.get('order', ''), status),
                    tags=('feature',),
                    iid=feature_path)

    def on_execution_select(self, event):
        selection = self.execution_tree.selection()
        if selection:
            item = selection[0]
            if self.execution_tree.tag_has('feature', item):
                abs_path = os.path.join(FEATURES_DIR, item)
                if os.path.isfile(abs_path):
                    self.selected_file = abs_path
                    self.load_feature(abs_path)

    def find_item_in_run_list(self, item_id):
        """Find a module or feature in run_list_data by its ID."""
        for module_idx, module in enumerate(self.run_list_data['execution_sequence']):
            if module['module_name'] == item_id:
                return ('module', module_idx, None, None)
            
            for feature_idx, feature in enumerate(module.get('features', [])):
                feature_path = os.path.join(
                    module.get('module_dir', ''),
                    feature.get('feature_dir', ''),
                    feature.get('feature_file', '')
                ).replace('\\', '/')
                if feature_path == item_id:
                    return ('feature', module_idx, feature_idx, feature)
        return None

    def move_item_up(self):
        selection = self.execution_tree.selection()
        if not selection:
            return
            
        item_id = selection[0]
        parent_id = self.execution_tree.parent(item_id)
        prev_sibling = self.execution_tree.prev(item_id)
        
        if not prev_sibling:  # Already at top
            return
            
        found = self.find_item_in_run_list(item_id)
        if not found:
            return
            
        item_type, module_idx, feature_idx, _ = found
        
        if item_type == 'module':
            if module_idx > 0:
                # Swap module orders
                curr_module = self.run_list_data['execution_sequence'][module_idx]
                prev_module = self.run_list_data['execution_sequence'][module_idx - 1]
                curr_module['order'], prev_module['order'] = prev_module['order'], curr_module['order']
                
        elif item_type == 'feature':
            features = self.run_list_data['execution_sequence'][module_idx]['features']
            if feature_idx > 0:
                # Swap feature orders
                curr_feature = features[feature_idx]
                prev_feature = features[feature_idx - 1]
                curr_feature['order'], prev_feature['order'] = prev_feature['order'], curr_feature['order']
        
        # Refresh the execution list to show new order
        self.populate_execution_list()
        # Reselect the moved item
        self.execution_tree.selection_set(item_id)
        
    def move_item_down(self):
        selection = self.execution_tree.selection()
        if not selection:
            return
            
        item_id = selection[0]
        parent_id = self.execution_tree.parent(item_id)
        next_sibling = self.execution_tree.next(item_id)
        
        if not next_sibling:  # Already at bottom
            return
            
        found = self.find_item_in_run_list(item_id)
        if not found:
            return
            
        item_type, module_idx, feature_idx, _ = found
        
        if item_type == 'module':
            if module_idx < len(self.run_list_data['execution_sequence']) - 1:
                # Swap module orders
                curr_module = self.run_list_data['execution_sequence'][module_idx]
                next_module = self.run_list_data['execution_sequence'][module_idx + 1]
                curr_module['order'], next_module['order'] = next_module['order'], curr_module['order']
                
        elif item_type == 'feature':
            features = self.run_list_data['execution_sequence'][module_idx]['features']
            if feature_idx < len(features) - 1:
                # Swap feature orders
                curr_feature = features[feature_idx]
                next_feature = features[feature_idx + 1]
                curr_feature['order'], next_feature['order'] = next_feature['order'], curr_feature['order']
        
        # Refresh the execution list to show new order
        self.populate_execution_list()
        # Reselect the moved item
        self.execution_tree.selection_set(item_id)

    def save_execution_order(self):
        try:
            # Sort modules and features based on their current order
            for module in self.run_list_data['execution_sequence']:
                module['features'].sort(key=lambda x: x.get('order', 999))
            self.run_list_data['execution_sequence'].sort(key=lambda x: x.get('order', 999))
            
            # Save to file with proper formatting
            with open(RUN_LIST_PATH, 'w', encoding='utf-8') as f:
                json.dump(self.run_list_data, f, indent=2)
            
            messagebox.showinfo("Success", "Execution order saved successfully!")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to save execution order:\n{e}")

    def on_drag_start(self, event):
        """Handle start of drag operation"""
        # Get the item that was clicked
        item_id = self.execution_tree.identify_row(event.y)
        if not item_id:
            return

        # Store the item being dragged
        self.drag_source = item_id
        self.drag_data = self.find_item_in_run_list(item_id)
        
        # Highlight the dragged item
        self.execution_tree.tag_add('drag_highlight', item_id)

    def on_drag_motion(self, event):
        """Handle drag motion"""
        if not self.drag_source:
            return

        # Get the item we're hovering over
        target_id = self.execution_tree.identify_row(event.y)
        if not target_id:
            return

        # Remove highlight from all items
        for item in self.execution_tree.tag_has('drag_highlight'):
            self.execution_tree.tag_remove('drag_highlight', item)

        # Add highlight to current target
        self.execution_tree.tag_add('drag_highlight', target_id)

    def on_drag_release(self, event):
        """Handle drop operation"""
        if not self.drag_source:
            return

        target_id = self.execution_tree.identify_row(event.y)
        if not target_id or target_id == self.drag_source:
            # Clear drag state
            self.clear_drag_state()
            return

        # Get source and target data
        source_data = self.drag_data
        target_data = self.find_item_in_run_list(target_id)

        if not source_data or not target_data:
            self.clear_drag_state()
            return

        source_type, source_module_idx, source_feature_idx, _ = source_data
        target_type, target_module_idx, target_feature_idx, _ = target_data

        # Handle reordering based on types
        if source_type == target_type:
            if source_type == 'module':
                self.reorder_modules(source_module_idx, target_module_idx)
            elif source_type == 'feature' and source_module_idx == target_module_idx:
                self.reorder_features(source_module_idx, source_feature_idx, target_feature_idx)

        # Refresh the view and clear drag state
        self.populate_execution_list()
        self.clear_drag_state()

    def clear_drag_state(self):
        """Clear drag and drop state"""
        for item in self.execution_tree.tag_has('drag_highlight'):
            self.execution_tree.tag_remove('drag_highlight', item)
        self.drag_source = None
        self.drag_data = None

    def reorder_modules(self, source_idx, target_idx):
        """Reorder modules in the execution sequence"""
        modules = self.run_list_data['execution_sequence']
        if 0 <= source_idx < len(modules) and 0 <= target_idx < len(modules):
            # Update orders
            source_order = modules[source_idx]['order']
            target_order = modules[target_idx]['order']
            
            # If moving down, all items between source and target move up
            if source_idx < target_idx:
                for i in range(source_idx, target_idx):
                    modules[i]['order'] = modules[i + 1]['order']
            # If moving up, all items between target and source move down
            else:
                for i in range(target_idx + 1, source_idx + 1):
                    modules[i]['order'] = modules[i - 1]['order']
            
            # Place source item at target position
            modules[target_idx]['order'] = source_order

    def reorder_features(self, module_idx, source_idx, target_idx):
        """Reorder features within a module"""
        features = self.run_list_data['execution_sequence'][module_idx]['features']
        if 0 <= source_idx < len(features) and 0 <= target_idx < len(features):
            # Update orders similarly to modules
            source_order = features[source_idx]['order']
            target_order = features[target_idx]['order']
            
            if source_idx < target_idx:
                for i in range(source_idx, target_idx):
                    features[i]['order'] = features[i + 1]['order']
            else:
                for i in range(target_idx + 1, source_idx + 1):
                    features[i]['order'] = features[i - 1]['order']
            
            features[target_idx]['order'] = source_order

    def save_feature(self):
        if not self.selected_file:
            messagebox.showwarning("No file selected", "Please select a feature file to save.")
            return
        try:
            content = self.editor.get('1.0', tk.END)
            with open(self.selected_file, 'w', encoding='utf-8') as f:
                f.write(content)
            feature_dir_path = os.path.relpath(self.selected_file, FEATURES_DIR)
            messagebox.showinfo("Saved", f"Feature file saved successfully:\n{feature_dir_path}")
        except Exception as e:
            messagebox.showerror("Error", f'Failed to save feature file:{e}')

if __name__ == "__main__":
    app = FeatureEditorApp()
    app.mainloop()

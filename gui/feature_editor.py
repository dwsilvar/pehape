"""
Feature Editor GUI for OCR Test Automation

Allows browsing, selecting, and editing Gherkin feature files from the 'features' directory.
"""
import os
import tkinter as tk
from tkinter import filedialog, messagebox, scrolledtext, ttk

FEATURES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'features')

class FeatureEditorApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Pehape Editor - OCR Test Automation")
        self.geometry("1024x780")
        self.resizable(True, True)
        self.selected_file = None
        self.create_widgets()
        self.populate_feature_list()

    def create_widgets(self):
        # Window control buttons (top right)
        self.close_button = tk.Button(self, text="✖", command=self.destroy, width=3)
        self.close_button.place(relx=1.0, x=-40, y=10, anchor="ne")
        self.minimize_button = tk.Button(self, text="—", command=self.iconify, width=3)
        self.minimize_button.place(relx=1.0, x=-80, y=10, anchor="ne")

        # Feature file tree
        self.feature_tree = ttk.Treeview(self, columns=("type",), show="tree")
        self.feature_tree.grid(row=0, column=0, rowspan=2, sticky="nswe", padx=10, pady=10)
        self.feature_tree.bind('<<TreeviewSelect>>', self.on_tree_select)

        # Edit area
        self.editor = scrolledtext.ScrolledText(self, wrap=tk.WORD, width=80, height=30)
        self.editor.grid(row=0, column=1, sticky="nswe", padx=10, pady=10)

        # Save button
        self.save_button = tk.Button(self, text="Save Feature", command=self.save_feature)
        self.save_button.grid(row=1, column=1, sticky="e", padx=10, pady=5)

        self.grid_columnconfigure(1, weight=1)
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

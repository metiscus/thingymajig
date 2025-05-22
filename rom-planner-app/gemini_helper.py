import os
import shutil
import tempfile
import subprocess

# --- Configuration ---
# List of directories and/or individual files to process.
# These paths should be relative to where you run the script,
# or absolute paths.
# Example:
# source_paths = ["src", "public", "./package.json", "../common_lib/main_helper.py"]
source_paths = [
    "src/components",
    "src/assets",
    "src/stores",
    "public",  # For files like index.html template if they are in public/
    "./index.html",
    "./main.cjs",  # Example based on your previous list
    "./package.json",
    "./preload.js", # Example based on your previous list
    "./vite.config.js"
]
# --- End Configuration ---

def sanitize_path_to_filename(original_path_str):
    """
    Converts a file path string like 'src/components/widget.vue'
    into 'src_components_widget'.
    Handles paths relative to CWD, including those with '../'.
    Example: '../lib/foo.js' becomes '.._lib_foo'.
    """
    # Normalize path separators (e.g., convert \ to / on Windows for consistency)
    normalized_path = original_path_str.replace(os.sep, '/')

    # Remove leading "./" if present, as it's redundant for naming
    if normalized_path.startswith('./'):
        normalized_path = normalized_path[2:]

    # Remove file extension
    name_without_ext, _ = os.path.splitext(normalized_path)

    # Replace remaining path separators ('/') with underscores.
    # This also handles '..' correctly, e.g., '../foo' becomes '.._foo'.
    sanitized_name = name_without_ext.replace('/', '_')

    return sanitized_name

def copy_file_to_temp(original_file_abs_path, temp_dir_path, path_for_naming):
    """
    Copies a single file to the temp directory with the new sanitized name.
    'path_for_naming' is the string used to generate the new filename (e.g., "src/components/file.vue").
    Returns True if successful, False otherwise.
    """
    sanitized_base_name = sanitize_path_to_filename(path_for_naming)
    new_txt_filename = f"{sanitized_base_name}.txt"
    new_file_path_abs = os.path.join(temp_dir_path, new_txt_filename)

    try:
        shutil.copy2(original_file_abs_path, new_file_path_abs)
        # You can uncomment the line below for verbose output of each file copied
        # print(f"  Copied: '{path_for_naming}'  ->  '{new_txt_filename}'")
        return True
    except Exception as e:
        print(f"  ERROR copying '{original_file_abs_path}' to '{new_file_path_abs}': {e}")
        return False

def process_configured_paths(paths_to_process_list):
    # Create a temporary directory that will be automatically cleaned up
    with tempfile.TemporaryDirectory() as temp_dir_path:
        print(f"Created temporary directory: {temp_dir_path}")
        print("Files will be copied here with .txt extension.\n")

        processed_files_count = 0

        for item_path_str in paths_to_process_list:
            abs_item_path = os.path.abspath(item_path_str)

            if not os.path.exists(abs_item_path):
                print(f"WARNING: Source item '{item_path_str}' (resolved to '{abs_item_path}') does not exist. Skipping.")
                continue

            if os.path.isdir(abs_item_path):
                print(f"Scanning directory: '{item_path_str}' (resolved to '{abs_item_path}')")
                for dirpath, _, filenames in os.walk(abs_item_path):
                    for filename in filenames:
                        original_file_abs_path = os.path.join(dirpath, filename)
                        
                        # Path for naming should be relative to CWD for consistent output names
                        # This ensures "src/file.js" and "./src/file.js" produce "src_file.txt"
                        path_for_naming = os.path.relpath(original_file_abs_path, os.getcwd())
                        
                        if copy_file_to_temp(original_file_abs_path, temp_dir_path, path_for_naming):
                            processed_files_count += 1
            
            elif os.path.isfile(abs_item_path):
                print(f"Processing file: '{item_path_str}' (resolved to '{abs_item_path}')")
                original_file_abs_path = abs_item_path
                
                # Path for naming should be relative to CWD
                path_for_naming = os.path.relpath(original_file_abs_path, os.getcwd())

                if copy_file_to_temp(original_file_abs_path, temp_dir_path, path_for_naming):
                    processed_files_count += 1
            
            else:
                # This case should ideally not be reached if os.path.exists is true
                # and it's not a dir or file (e.g. broken symlink might appear here)
                print(f"WARNING: Source item '{item_path_str}' (resolved to '{abs_item_path}') is not a regular file or directory. Skipping.")
        
        if processed_files_count > 0:
            print(f"\n--- Successfully processed {processed_files_count} files ---")
            print(f"They are located in: {temp_dir_path}")
            print("\nIMPORTANT: This temporary directory and its contents will be DELETED when you press Enter.")
            print("COPY THE FILES from the directory above to another location NOW if you need them.")
            subprocess.run(["explorer.exe", temp_dir_path])
            input("Press Enter to continue and clean up the temporary directory...")
        else:
            print("\nNo files were processed. Check your 'source_paths' configuration and ensure paths are correct.")
        
        print(f"Temporary directory {temp_dir_path} is being cleaned up.")

    print("Script finished.")


if __name__ == "__main__":
    if not source_paths:
        print("The 'source_paths' list in the script is empty. Please configure it with directories and/or files to process.")
        print("Example: source_paths = ['src', 'public', './config.js']")
    else:
        process_configured_paths(source_paths)
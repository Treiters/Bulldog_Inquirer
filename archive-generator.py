import os
import json

def generate_archive_index(root_folder_path):
    """
    Generate archive-index.json from 'Old Articles' folder structure.
    
    Args:
        root_folder_path: Path to the 'Old Articles' folder on your computer
    
    Returns:
        Dictionary representing the folder structure
    """
    
    def scan_directory(path, name):
        """Recursively scan directory and build structure"""
        result = {
            "name": name,
            "type": "folder",
            "children": []
        }
        
        try:
            # Get all items in directory
            items = os.listdir(path)
            
            # Separate folders and files
            folders = []
            files = []
            
            for item in items:
                item_path = os.path.join(path, item)
                if os.path.isdir(item_path):
                    folders.append(item)
                elif os.path.isfile(item_path):
                    files.append(item)
            
            # Sort for consistent ordering
            folders.sort()
            files.sort()
            
            # Process folders first
            for folder in folders:
                folder_path = os.path.join(path, folder)
                child = scan_directory(folder_path, folder)
                result["children"].append(child)
            
            # Then process files
            for file in files:
                # Calculate relative path from root
                file_path = os.path.join(path, file)
                relative_path = os.path.relpath(file_path, root_folder_path)
                # Convert Windows backslashes to forward slashes for web
                relative_path = relative_path.replace('\\', '/')
                
                result["children"].append({
                    "name": file,
                    "type": "file",
                    "path": f"old-articles/{relative_path}"
                })
        
        except PermissionError:
            print(f"Warning: Permission denied for {path}")
        except Exception as e:
            print(f"Warning: Error processing {path}: {str(e)}")
        
        return result
    
    # Get the folder name (should be "Old Articles")
    folder_name = os.path.basename(root_folder_path)
    
    # Build the structure
    print("Scanning folder structure...")
    structure = scan_directory(root_folder_path, "old-articles")
    
    # Count files
    def count_files(node):
        if node["type"] == "file":
            return 1
        count = 0
        for child in node.get("children", []):
            count += count_files(child)
        return count
    
    file_count = count_files(structure)
    print(f"Found {file_count} files")
    
    return structure


def save_archive_index(structure, output_path="archive-index.json"):
    """Save the structure to a JSON file"""
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(structure, f, indent=2, ensure_ascii=False)
    print(f"Archive index saved to: {output_path}")


def main():
    print("=" * 60)
    print("Archive Index Generator for Bulldog Inquirer")
    print("=" * 60)
    print()
    
    # Get the path to Old Articles folder
    print("Enter the full path to your 'Old Articles' folder:")
    print("Example: C:\\Users\\YourName\\Documents\\Old Articles")
    print("or: /Users/YourName/Documents/Old Articles")
    print()
    
    folder_path = input("Path: ").strip().strip('"')
    
    # Validate path
    if not os.path.exists(folder_path):
        print(f"\nError: Folder not found at {folder_path}")
        print("Please check the path and try again.")
        return
    
    if not os.path.isdir(folder_path):
        print(f"\nError: {folder_path} is not a folder")
        return
    
    print()
    print("Generating archive index...")
    print()
    
    # Generate the index
    structure = generate_archive_index(folder_path)
    
    # Ask where to save
    print()
    print("Where should the archive-index.json file be saved?")
    print("1. Current directory (where this script is)")
    print("2. Custom location")
    
    choice = input("\nChoice (1 or 2): ").strip()
    
    if choice == "2":
        output_path = input("Enter full path for output file: ").strip().strip('"')
        if not output_path.endswith('.json'):
            output_path = os.path.join(output_path, 'archive-index.json')
    else:
        output_path = "archive-index.json"
    
    # Save the file
    save_archive_index(structure, output_path)
    
    print()
    print("=" * 60)
    print("✅ SUCCESS!")
    print("=" * 60)
    print()
    print("Next steps:")
    print("1. Copy the generated 'archive-index.json' file to your GitHub repo root")
    print("2. Upload your 'Old Articles' folder to GitHub in a folder called 'old-articles'")
    print("3. Commit and push to GitHub")
    print("4. Netlify will automatically deploy")
    print("5. Your archives will be accessible on the website!")
    print()


if __name__ == "__main__":
    main()
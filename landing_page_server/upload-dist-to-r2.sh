#!/bin/bash

# Check if arguments are provided
if [ $# -ne 2 ]; then
    echo "Usage: $0 <source-directory> <r2-bucket-path>"
    echo "Example: $0 ./langgraph_app/app/.projects/paging-doctor-bingos/dist user-pages/dist"
    exit 1
fi

# Source directory from first argument
SOURCE_DIR="$1"

# R2 bucket prefix from second argument
BUCKET_PREFIX="$2"

# Remove trailing slashes
SOURCE_DIR="${SOURCE_DIR%/}"
BUCKET_PREFIX="${BUCKET_PREFIX%/}"

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Source directory $SOURCE_DIR does not exist"
    exit 1
fi

echo "Uploading from $SOURCE_DIR to $BUCKET_PREFIX..."

# Upload each file in the source directory
find "$SOURCE_DIR" -type f | while read -r file; do
    # Get the relative path from the source directory
    relative_path="${file#$SOURCE_DIR/}"
    
    # Construct the R2 object path
    object_path="$BUCKET_PREFIX/$relative_path"
    
    echo "Uploading $file to $object_path"
    pnpm wrangler r2 object put "$object_path" --file "$file"
done

echo "Upload complete!"
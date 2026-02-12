module WebsiteConcerns
  module FileManagement
    extend ActiveSupport::Concern

    included do
      validate :no_duplicate_paths_in_nested_attributes
    end

    def website_files_attributes=(attributes)
      @pending_website_files_attributes = attributes

      if has_duplicate_paths?(attributes)
        return
      end

      if template.present?
        # Filter out files that are identical to template files
        filtered_attributes = filter_duplicate_template_files(attributes)
        super(filtered_attributes)
      else
        super
      end
    end

    # Add a method to clean up existing duplicate website_files
    def remove_duplicate_website_files!
      return unless template.present?

      duplicates = []
      website_files.reload.each do |website_file|
        # Check if this website_file duplicates a template_file
        if duplicate_of_template?(website_file.path, website_file.content)
          duplicates << website_file
        end
      end

      # Destroy duplicates
      duplicates.each(&:destroy)

      # Reload to reflect changes
      website_files.reload
    end

    # Check if a website_file would be a duplicate of a template_file.
    # Accepts an optional preloaded template_file to avoid N+1 queries.
    def duplicate_of_template?(path, content, preloaded_template_file = :not_provided)
      return false unless template.present?

      # Remove leading slash if present (path setter does this)
      clean_path = path.to_s.gsub(/^\//, "")

      template_file = if preloaded_template_file == :not_provided
        template_files.find_by(path: clean_path)
      else
        preloaded_template_file
      end
      return false unless template_file

      # Compare using shasum
      template_shasum = Digest::SHA256.hexdigest("#{clean_path}#{template_file.content}")
      file_shasum = Digest::SHA256.hexdigest("#{clean_path}#{content}")

      template_shasum == file_shasum
    end

    private

    def no_duplicate_paths_in_nested_attributes
      return unless @pending_website_files_attributes

      if has_duplicate_paths?(@pending_website_files_attributes)
        errors.add(:website_files, "cannot have multiple files with the same path")
      end
    end

    def has_duplicate_paths?(attributes)
      return false if attributes.nil? || attributes.empty?

      # Collect all paths from the attributes
      paths_in_submission = []

      # Convert to array format for easier processing
      attrs_array = attributes.is_a?(Hash) ? attributes.values : attributes

      # Batch lookup: preload existing website files by ID (avoids N+1)
      all_ids = attrs_array.filter_map { |a| a.with_indifferent_access[:id] }
      existing_by_id = if all_ids.any?
        website_files.where(id: all_ids).index_by(&:id)
      else
        {}
      end

      attrs_array.each do |file_attrs|
        file_attrs = file_attrs.with_indifferent_access

        # Skip if marked for destruction
        next if file_attrs[:_destroy].to_s == "1"

        # For existing records, we need to check if path is being changed
        if file_attrs[:id].present?
          website_file = existing_by_id[file_attrs[:id].to_i]
          if website_file
            # Use the new path if provided, otherwise current path
            path = file_attrs[:path] || website_file.path
            paths_in_submission << path.to_s.gsub(/^\//, "")
          end
        else
          # New record
          path = file_attrs[:path]
          paths_in_submission << path.to_s.gsub(/^\//, "") if path.present?
        end
      end

      # Check for duplicates within the submission
      paths_in_submission.size != paths_in_submission.uniq.size
    end

    def filter_duplicate_template_files(attributes)
      return attributes unless template.present?

      attrs_array = attributes.is_a?(Hash) ? attributes.values : attributes

      # Batch preload existing website files by ID (avoids N+1)
      all_ids = attrs_array.filter_map { |a| a.with_indifferent_access[:id] }
      existing_by_id = if all_ids.any?
        website_files.where(id: all_ids).index_by(&:id)
      else
        {}
      end

      # Batch preload template files (avoids N+1)
      # Include paths from attributes AND from existing records (when path isn't in attributes)
      all_paths = attrs_array.filter_map { |a|
        attrs = a.with_indifferent_access
        path = attrs[:path]
        if path.nil? && attrs[:id].present?
          existing_by_id[attrs[:id].to_i]&.path
        else
          path
        end
      }.map { |p| p.to_s.gsub(/^\//, "") }
      templates_by_path = template_files.where(path: all_paths).index_by(&:path)

      # Handle both hash and array formats
      if attributes.is_a?(Hash)
        filtered = {}
        attributes.each do |key, file_attrs|
          file_attrs = file_attrs.with_indifferent_access

          # Skip if marked for destruction
          next if file_attrs[:_destroy].to_s == "1"

          path = file_attrs[:path]
          content = file_attrs[:content]
          clean_path = path.to_s.gsub(/^\//, "")

          # Check if this file would be identical to a template file
          if file_attrs[:id].present?
            # Existing record - check if it's being updated to match template
            website_file = existing_by_id[file_attrs[:id].to_i]
            if website_file
              # Apply the updates to check
              test_content = content || website_file.content
              test_path = path || website_file.path

              if duplicate_of_template?(test_path, test_content, templates_by_path[test_path.to_s.gsub(/^\//, "")])
                # Mark for destruction instead of updating
                file_attrs[:_destroy] = "1"
              end
            end
            filtered[key] = file_attrs
          elsif !duplicate_of_template?(path, content, templates_by_path[clean_path])
            # New record - only include if not a duplicate of template
            filtered[key] = file_attrs
          end
        end
      else
        # Array format
        filtered = []

        attributes.each do |file_attrs|
          file_attrs = file_attrs.with_indifferent_access

          # Skip if marked for destruction
          next if file_attrs[:_destroy].to_s == "1"

          path = file_attrs[:path]
          content = file_attrs[:content]
          clean_path = path.to_s.gsub(/^\//, "")

          # Check if this file would be identical to a template file
          if file_attrs[:id].present?
            # Existing record - check if it's being updated to match template
            website_file = existing_by_id[file_attrs[:id].to_i]
            if website_file
              # Apply the updates to check
              test_content = content || website_file.content
              test_path = path || website_file.path

              if duplicate_of_template?(test_path, test_content, templates_by_path[test_path.to_s.gsub(/^\//, "")])
                # Mark for destruction instead of updating
                file_attrs[:_destroy] = "1"
              end
            end
            filtered << file_attrs
          elsif !duplicate_of_template?(path, content, templates_by_path[clean_path])
            # New record - only include if not a duplicate of template
            filtered << file_attrs
          end
        end
      end
      filtered
    end
  end
end

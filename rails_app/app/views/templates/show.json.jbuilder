json.array! @template_files do |file_data|
  json.path file_data.path
  json.content file_data.content
end

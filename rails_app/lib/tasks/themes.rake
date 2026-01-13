namespace :themes do
  desc "Regenerate all theme variables from base colors"
  task regenerate: :environment do
    puts "Regenerating theme variables from colors..."

    Theme.find_each do |theme|
      next if theme.colors.blank?

      puts "  Processing theme #{theme.id}: #{theme.name}"

      # Regenerate semantic variables from colors
      theme.theme = ThemeConcerns::SemanticVariables.create_semantic_variables(theme.colors)
      theme.pairings = ThemeConcerns::SemanticVariables.compute_pairings(theme.colors)
      theme.typography_recommendations = ThemeConcerns::TypographyRecommendations.compute_recommendations(theme.colors, theme.pairings)

      theme.save!(validate: false)
    end

    puts "Done! Regenerated #{Theme.count} themes."
  end

  desc "Export themes and theme_labels to SQL file"
  task export: :environment do
    output_file = Rails.root.join("db/seeds/themes.sql")

    puts "Exporting themes to #{output_file}..."

    File.open(output_file, "w") do |f|
      f.puts "--"
      f.puts "-- PostgreSQL database dump"
      f.puts "--"
      f.puts ""
      f.puts "SET statement_timeout = 0;"
      f.puts "SET lock_timeout = 0;"
      f.puts "SET idle_in_transaction_session_timeout = 0;"
      f.puts "SET client_encoding = 'UTF8';"
      f.puts "SET standard_conforming_strings = on;"
      f.puts "SELECT pg_catalog.set_config('search_path', '', false);"
      f.puts "SET check_function_bodies = false;"
      f.puts "SET xmloption = content;"
      f.puts "SET client_min_messages = warning;"
      f.puts "SET row_security = off;"
      f.puts ""

      # Export theme_labels
      f.puts "--"
      f.puts "-- Data for Name: theme_labels; Type: TABLE DATA; Schema: public; Owner: postgres"
      f.puts "--"
      f.puts ""
      f.puts "COPY public.theme_labels (id, name) FROM stdin;"

      ThemeLabel.order(:id).each do |label|
        f.puts "#{label.id}\t#{label.name}"
      end

      f.puts "\\."
      f.puts ""
      f.puts ""

      # Export themes
      f.puts "--"
      f.puts "-- Data for Name: themes; Type: TABLE DATA; Schema: public; Owner: postgres"
      f.puts "--"
      f.puts ""
      f.puts "COPY public.themes (id, name, colors, theme, created_at, updated_at, theme_type, author_id, pairings, typography_recommendations) FROM stdin;"

      Theme.order(:id).each do |theme|
        colors_json = theme.colors.to_json
        theme_json = theme.theme.to_json
        pairings_json = theme.pairings&.to_json || "\\N"
        typography_json = theme.typography_recommendations&.to_json || "\\N"
        author_id = theme.author_id || "\\N"

        f.puts [
          theme.id,
          theme.name,
          colors_json,
          theme_json,
          theme.created_at.iso8601(6),
          theme.updated_at.iso8601(6),
          theme.theme_type,
          author_id,
          pairings_json,
          typography_json
        ].join("\t")
      end

      f.puts "\\."
      f.puts ""
      f.puts ""

      # Export theme_to_theme_labels
      f.puts "--"
      f.puts "-- Data for Name: theme_to_theme_labels; Type: TABLE DATA; Schema: public; Owner: postgres"
      f.puts "--"
      f.puts ""
      f.puts "COPY public.theme_to_theme_labels (id, theme_id, theme_label_id) FROM stdin;"

      ThemeToThemeLabel.order(:id).each do |ttl|
        f.puts "#{ttl.id}\t#{ttl.theme_id}\t#{ttl.theme_label_id}"
      end

      f.puts "\\."
      f.puts ""
      f.puts ""

      # Reset sequences
      f.puts "--"
      f.puts "-- Name: theme_labels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres"
      f.puts "--"
      f.puts ""
      max_label_id = ThemeLabel.maximum(:id) || 1
      f.puts "SELECT pg_catalog.setval('public.theme_labels_id_seq', #{max_label_id}, true);"
      f.puts ""

      f.puts "--"
      f.puts "-- Name: themes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres"
      f.puts "--"
      f.puts ""
      max_theme_id = Theme.maximum(:id) || 1
      f.puts "SELECT pg_catalog.setval('public.themes_id_seq', #{max_theme_id}, true);"
      f.puts ""

      f.puts "--"
      f.puts "-- Name: theme_to_theme_labels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres"
      f.puts "--"
      f.puts ""
      max_ttl_id = ThemeToThemeLabel.maximum(:id) || 1
      f.puts "SELECT pg_catalog.setval('public.theme_to_theme_labels_id_seq', #{max_ttl_id}, true);"
    end

    puts "Done! Exported to #{output_file}"
  end

  desc "Regenerate themes and export to SQL"
  task regenerate_and_export: [:regenerate, :export]
end

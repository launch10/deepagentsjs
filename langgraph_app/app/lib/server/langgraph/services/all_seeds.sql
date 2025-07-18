pg_dump -U postgres -W -h localhost -p 5432 \
    --data-only \
    --inserts \
    --column-inserts \
    -t themes \
    -t theme_labels \
    -t themes_to_theme_labels \
    -t icon_embeddings \
    -t file_specifications \
    bolt_development > seeds.sql
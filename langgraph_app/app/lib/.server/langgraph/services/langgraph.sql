pg_dump -U postgres -W -h localhost -p 5432 \
    --data-only \
    --inserts \
    --column-inserts \
    -t assistant \
    -t assitant_versions \
    -t checkpoint_blobs \
    -t checkpoint_writes \
    -t checkpoints \
    -t cron \
    -t run \
    -t thread \
    -t thread_ttl \
    bolt_development > langgraph.sql
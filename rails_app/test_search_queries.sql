-- Full-Text Search Test Queries for NicheFinder
-- Run these in psql or Rails console with ActiveRecord::Base.connection.execute()

-- 1. Basic full-text search for React hooks
SELECT website_id, path, source, 
       ts_rank(content_tsv, plainto_tsquery('english', 'useState useEffect')) AS rank
FROM code_files
WHERE content_tsv @@ plainto_tsquery('english', 'useState useEffect')
ORDER BY rank DESC
LIMIT 10;

-- 2. Search for function definitions
SELECT website_id, path, source
FROM code_files
WHERE content_tsv @@ to_tsquery('english', 'function & handleSubmit')
LIMIT 5;

-- 3. Search with stemming (finds 'component', 'components', 'componentize')
SELECT website_id, path, source
FROM code_files  
WHERE content_tsv @@ plainto_tsquery('english', 'component')
LIMIT 5;

-- 4. Phrase search (words must be adjacent)
SELECT website_id, path, source
FROM code_files
WHERE content_tsv @@ phraseto_tsquery('english', 'export default')
LIMIT 5;

-- 5. Fuzzy path search using trigrams (finds similar paths)
SELECT website_id, path, source,
       similarity(path, 'compnent.jsx') AS similarity_score
FROM code_files
WHERE path % 'compnent.jsx'  -- % operator for similarity
ORDER BY similarity_score DESC
LIMIT 5;

-- 6. Combined content and path search
SELECT website_id, path, source
FROM code_files
WHERE content_tsv @@ plainto_tsquery('english', 'tailwind css')
  AND path ILIKE '%.tsx%'
LIMIT 10;

-- 7. Search with highlighting (shows matching terms in context)
SELECT website_id, path,
       ts_headline('english', content, plainto_tsquery('english', 'useState'),
                   'StartSel=****, StopSel=****') AS highlighted_match
FROM code_files
WHERE content_tsv @@ plainto_tsquery('english', 'useState')
LIMIT 3;

-- 8. Ranking by relevance for multiple terms
SELECT website_id, path, source,
       ts_rank_cd(content_tsv, query) AS rank
FROM code_files,
     plainto_tsquery('english', 'react typescript props') AS query
WHERE content_tsv @@ query
ORDER BY rank DESC
LIMIT 10;

-- 9. Search only in website files (not templates)
SELECT website_id, path
FROM code_files
WHERE source = 'website'
  AND content_tsv @@ plainto_tsquery('english', 'axios fetch')
LIMIT 5;

-- 10. Find files with similar paths (typo tolerance)
SELECT path, similarity(path, 'src/componets/Header.tsx') AS sim
FROM code_files
WHERE similarity(path, 'src/componets/Header.tsx') > 0.3
ORDER BY sim DESC
LIMIT 5;

-- 11. Boolean search with AND, OR, NOT
SELECT website_id, path, source
FROM code_files
WHERE content_tsv @@ to_tsquery('english', '(react | vue) & !angular')
LIMIT 10;

-- 12. Search for camelCase and snake_case variants
SELECT website_id, path
FROM code_files
WHERE content_tsv @@ to_tsquery('english', 'getUserData | get_user_data | getUser')
LIMIT 5;

-- 13. Count matching files per website
SELECT website_id, COUNT(*) as match_count
FROM code_files
WHERE content_tsv @@ plainto_tsquery('english', 'tailwind')
GROUP BY website_id
ORDER BY match_count DESC;

-- 14. Search with prefix matching (finds 'component*')
SELECT website_id, path
FROM code_files
WHERE content_tsv @@ to_tsquery('english', 'compon:*')
LIMIT 5;

-- 15. Performance check - explain analyze
EXPLAIN ANALYZE
SELECT website_id, path
FROM code_files
WHERE content_tsv @@ plainto_tsquery('english', 'useState')
LIMIT 10;

-- Rails ActiveRecord examples (run in Rails console):
-- 
-- # Raw SQL
-- ActiveRecord::Base.connection.execute("
--   SELECT * FROM code_files 
--   WHERE content_tsv @@ plainto_tsquery('english', 'useState')
--   LIMIT 5
-- ").to_a
--
-- # Using select_all for better results
-- result = ActiveRecord::Base.connection.select_all("
--   SELECT website_id, path, source,
--          ts_rank(content_tsv, plainto_tsquery('english', ?)) AS rank
--   FROM code_files
--   WHERE content_tsv @@ plainto_tsquery('english', ?)
--   ORDER BY rank DESC
--   LIMIT 10
-- ", nil, [[nil, 'react hooks'], [nil, 'react hooks']])
-- result.to_a
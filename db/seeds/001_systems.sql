-- ─── Seed: Default Systems Registry ─────────────────────────────────────────

INSERT INTO systems (code, name, type, format, protocol, base_url, is_mock, config) VALUES
  ('gw-policycenter', 'Guidewire PolicyCenter', 'source', 'json', 'rest', 'http://localhost:3020', true, '{"description": "Source system - sends rating requests"}'),
  ('cgi-ratabase', 'CGI Ratabase', 'target', 'xml', 'rest', 'http://localhost:3021', true, '{"description": "XML-based rating engine for Inland Marine"}'),
  ('earnix', 'Earnix Rating Engine', 'target', 'json', 'rest', 'http://localhost:3022', true, '{"description": "JSON-based rating engine for GL/WC"}'),
  ('dnb-service', 'Dun & Bradstreet', 'both', 'json', 'rest', 'http://localhost:3023', true, '{"description": "Business enrichment data provider"}'),
  ('kafka-mock', 'Kafka (Mock)', 'target', 'json', 'mock', 'http://localhost:3024', true, '{"description": "Mock message broker for event publishing"}')
ON CONFLICT (code) DO NOTHING;

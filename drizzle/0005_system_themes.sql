INSERT INTO "themes" ("id", "name", "config") VALUES
('00000000-0000-4000-8000-000000000001', 'Klassisch', '{"fonts":{"heading":"serif","body":"serif"},"colors":{"background":"#ffffff","text":"#1f1f1f","accent":"#8c6d46","muted":"#6b6b6b"},"grid":{"layout":"uniform","gap":"medium"},"cover":{"style":"full"}}'::jsonb),
('00000000-0000-4000-8000-000000000002', 'Modern', '{"fonts":{"heading":"sans","body":"sans"},"colors":{"background":"#f7f7f5","text":"#111111","accent":"#2f5d50","muted":"#6f6f6f"},"grid":{"layout":"masonry","gap":"small"},"cover":{"style":"split"}}'::jsonb),
('00000000-0000-4000-8000-000000000003', 'Romantisch', '{"fonts":{"heading":"elegant","body":"sans"},"colors":{"background":"#fdf6f3","text":"#3a2a2a","accent":"#c0707b","muted":"#8a7373"},"grid":{"layout":"masonry","gap":"large"},"cover":{"style":"full"}}'::jsonb),
('00000000-0000-4000-8000-000000000004', 'Dunkel', '{"fonts":{"heading":"sans","body":"sans"},"colors":{"background":"#121212","text":"#f2f2f2","accent":"#d4af37","muted":"#a0a0a0"},"grid":{"layout":"rows","gap":"small"},"cover":{"style":"minimal"}}'::jsonb)
ON CONFLICT ("id") DO NOTHING;

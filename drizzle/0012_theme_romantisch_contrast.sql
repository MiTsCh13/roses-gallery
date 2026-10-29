UPDATE "themes" SET "config" = jsonb_set("config", '{colors,muted}', '"#7a6363"')
WHERE "id" = '00000000-0000-4000-8000-000000000003' AND "account_id" IS NULL;

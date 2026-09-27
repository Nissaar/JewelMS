ALTER TABLE "sale_items" ADD COLUMN "vat_15" numeric(15, 2);--> statement-breakpoint
-- Existing lines: a single-item sale's VAT is the sale's VAT; otherwise 15% of the line's net.
UPDATE "sale_items" AS si SET "vat_15" = CASE
	WHEN (SELECT COUNT(*) FROM "sale_items" x WHERE x."sale_id" = si."sale_id") = 1 AND s."vat_15" IS NOT NULL THEN s."vat_15"
	ELSE ROUND(COALESCE(si."amount", 0) * 0.15, 2)
END
FROM "sales" AS s
WHERE s."id" = si."sale_id" AND si."vat_15" IS NULL;

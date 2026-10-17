/**
 * Read-only, local-only Phase 1.2 migration inventory.
 * Works on explicit JSON exports; never reads IndexedDB or writes to a network.
 * The returned manifest deliberately excludes source text, URLs and titles.
 */
import { parseSourceDrafts } from "./source-draft-storage.ts";
import { migrateSourceLibraryEntry, validateSourceLibraryEntry } from "./source-library.ts";
import { SOURCE_LIBRARY_BACKUP_VERSION } from "./source-library-backup.ts";

export const MAX_MIGRATION_BACKUP_BYTES = 16 * 1024 * 1024;
export const MAX_MIGRATION_ITEMS = 1000;

type DraftMaterial = { id: unknown; form?: unknown; status?: unknown };
type WorkbenchExport = {
  materials?: unknown;
  activeMaterialId?: unknown;
  reviewedFingerprint?: unknown;
  approvedFingerprint?: unknown;
  rejectedFingerprint?: unknown;
  form?: unknown;
};

export type CloudMigrationManifest = {
  manifest_version: 1;
  cloud_upload_allowed: false;
  draft_workbenches: number;
  total_materials: number;
  eligible_draft_materials: number;
  duplicate_material_ids: number;
  reusable_library_entries: number;
  quarantined_entries: number;
  manual_review_required: boolean;
  decisions: Array<{
    category: "draft" | "library" | "workbench";
    code: "invalid_backup" | "unsupported_version" | "invalid_item" | "duplicate_id"
      | "global_approval_ambiguous" | "over_limit" | "library_ineligible" | "active_item_missing";
    count: number;
  }>;
};

/** A metadata-only plan: no titles, record IDs, emails, URLs or source text leave memory. */
export function inspectCloudMigrationBackups(inputs: {
  draftBackupJson?: string;
  libraryBackupJson?: string;
}): CloudMigrationManifest {
  const report: CloudMigrationManifest = {
    manifest_version: 1,
    cloud_upload_allowed: false,
    draft_workbenches: 0,
    total_materials: 0,
    eligible_draft_materials: 0,
    duplicate_material_ids: 0,
    reusable_library_entries: 0,
    quarantined_entries: 0,
    manual_review_required: false,
    decisions: [],
  };
  const note = (category: "draft" | "library" | "workbench",
    code: CloudMigrationManifest["decisions"][number]["code"], count = 1) => {
    report.decisions.push({ category, code, count });
    report.manual_review_required = true;
    report.quarantined_entries += count;
  };

  const draftText = inputs.draftBackupJson;
  if (draftText !== undefined) {
    if (new TextEncoder().encode(draftText).length > MAX_MIGRATION_BACKUP_BYTES) {
      note("draft", "over_limit");
    } else {
      try {
        const draftExport = parseSourceDrafts<WorkbenchExport>(draftText);
        if (draftExport.items.length > MAX_MIGRATION_ITEMS) {
          note("draft", "over_limit", draftExport.items.length);
        } else {
          report.draft_workbenches = draftExport.items.length;
          for (const workbench of draftExport.items) {
            if (!workbench || typeof workbench !== "object"
              || !Array.isArray(workbench.materials)
              || workbench.materials.length > MAX_MIGRATION_ITEMS) {
              note("workbench", "invalid_item");
              continue;
            }
            if (workbench.reviewedFingerprint || workbench.approvedFingerprint || workbench.rejectedFingerprint) {
              // These global fingerprints are not reliably attributable to
              // multiple material cards. They NEVER become cloud approvals.
              note("workbench", "global_approval_ambiguous");
            }
            const seen = new Set<string>();
            const materials = workbench.materials as DraftMaterial[];
            if (typeof workbench.activeMaterialId === "string"
              && !materials.some((material) => material.id === workbench.activeMaterialId)) {
              note("workbench", "active_item_missing");
            }
            for (const material of materials) {
              report.total_materials += 1;
              if (!material || typeof material.id !== "string" || !material.id.trim()
                || (material.form !== null && (typeof material.form !== "object" || Array.isArray(material.form)))) {
                note("draft", "invalid_item");
                continue;
              }
              if (seen.has(material.id)) {
                report.duplicate_material_ids += 1;
                note("draft", "duplicate_id");
                continue;
              }
              seen.add(material.id);
              if (!material.form) {
                note("draft", "invalid_item");
                continue;
              }
              report.eligible_draft_materials += 1;
            }
          }
        }
      } catch (error) {
        note("draft", error instanceof Error && error.message.includes("version")
          ? "unsupported_version" : "invalid_backup");
      }
    }
  }

  const libraryText = inputs.libraryBackupJson;
  if (libraryText !== undefined) {
    if (new TextEncoder().encode(libraryText).length > MAX_MIGRATION_BACKUP_BYTES) {
      note("library", "over_limit");
    } else {
      try {
        const parsed: unknown = JSON.parse(libraryText);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          note("library", "invalid_backup");
        } else {
          const backup = parsed as {version?: unknown; exported_at?: unknown; entries?: unknown};
          if (backup.version !== SOURCE_LIBRARY_BACKUP_VERSION) {
            note("library", "unsupported_version");
          } else if (typeof backup.exported_at !== "string" || !Number.isFinite(Date.parse(backup.exported_at))
            || !Array.isArray(backup.entries)) {
            note("library", "invalid_backup");
          } else if (backup.entries.length > MAX_MIGRATION_ITEMS) {
            note("library", "over_limit", backup.entries.length);
          } else {
            const seen = new Set<string>();
            for (const candidate of backup.entries) {
              const entry = migrateSourceLibraryEntry(candidate);
              if (!entry || !validateSourceLibraryEntry(entry)) {
                note("library", "library_ineligible");
                continue;
              }
              // Do not de-duplicate on URL: distinct revisions may legitimately
              // reuse a URL; same source ID requires an explicit conflict audit.
              if (seen.has(entry.source_record.id)) {
                note("library", "duplicate_id");
                continue;
              }
              seen.add(entry.source_record.id);
              report.reusable_library_entries += 1;
            }
          }
        }
      } catch {
        note("library", "invalid_backup");
      }
    }
  }

  // Quarantine is always a warning even if no qualifying records exist;
  // the manifest is NEVER an authorization for an automatic cloud upload.
  return report;
}

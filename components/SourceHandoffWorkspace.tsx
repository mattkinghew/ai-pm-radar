"use client";

import { useState } from "react";

import { useLanguage } from "@/components/LanguageProvider";
import {
  HANDOFF_TYPES,
  createHandoffDraft,
  exportHandoffJson,
  handoffToMarkdown,
  markHandoffReviewed,
  updateHandoff,
  type BaseHandoff,
  type HandoffType,
} from "@/lib/downstream-handoff";
import { appendDownstreamHandoff, type SourceLibraryEntry } from "@/lib/source-library";
import { saveDeliveryPackageRecord, saveDownstreamHandoff, sourceLibraryEntryKey } from "@/lib/source-library-storage";
import {
  confirmDeliveryPackageImported,
  deliveryPackageStatus,
  deliveryPackageToMarkdown,
  markDeliveryPackageExported,
  toContentOpsIntakePackage,
  validateConsumerCompatibility,
  type DeliveryPackageRecord,
} from "@/lib/delivery-package";
import {
  approveHandoffWithSeal,
  assertSealedHandoff,
  assertSealedDeliveryPackage,
  createSealedDeliveryPackage,
} from "@/lib/secure-handoff-delivery";

function download(filename: string, content: string, mimeType: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeFilename(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

function compatibilityIssueLabel(error: string, copy: ReturnType<typeof useLanguage>["messages"]["research"]["delivery"]) {
  if (error.includes("no registered consumer profile")) return copy.errorTarget;
  if (error.includes("does not accept")) return `${copy.errorType}${error.slice(error.lastIndexOf(" ") + 1)}`;
  if (error.includes("does not support contract version")) return `${copy.errorVersion}${error.slice(error.lastIndexOf(" ") + 1)}`;
  if (error.includes("provenance is missing")) return copy.errorProvenance;
  if (error.includes("evidence reference is required")) return copy.errorEvidence;
  if (error.includes("payload is missing")) return copy.errorPayload;
  if (error.includes("identity fields are required")) return copy.errorIdentity;
  return copy.errorInvalid;
}

export function SourceHandoffWorkspace({ entry, onEntryUpdated }: {
  entry: SourceLibraryEntry;
  onEntryUpdated: (entry: SourceLibraryEntry) => void;
}) {
  const { messages } = useLanguage();
  const copy = messages.research.handoff;
  const deliveryCopy = messages.research.delivery;
  const [selectedType, setSelectedType] = useState<HandoffType>(HANDOFF_TYPES[0]);
  const [active, setActive] = useState<BaseHandoff | null>(null);
  const [activePackageId, setActivePackageId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const persist = async (handoff: BaseHandoff) => {
    setSaving(true);
    try {
      const updated = await saveDownstreamHandoff(sourceLibraryEntryKey(entry), handoff);
      onEntryUpdated(updated);
      setActive(handoff);
      setDirty(false);
      setMessage(copy.saved);
      return true;
    } catch {
      setMessage(copy.saveFailed);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const buildDraft = async () => {
    try {
      const draft = createHandoffDraft(entry, selectedType);
      if (selectedType === "content_candidate") {
        const sourceClaims = draft.source_facts.map((fact) => fact.text);
        const initialized = updateHandoff(draft, {
          derived_analysis: { ...draft.derived_analysis, key_source_backed_claims: sourceClaims },
        });
        await persist(initialized);
      } else {
        await persist(draft);
      }
    } catch {
      setMessage(copy.buildFailed);
    }
  };

  const updateField = (key: string, value: string | string[]) => {
    if (!active) return;
    const payload = active.derived_analysis as unknown as Record<string, string | string[]>;
    setActive(updateHandoff(active, {
      derived_analysis: { ...payload, [key]: value } as BaseHandoff["derived_analysis"],
    }));
    setDirty(true);
    setMessage(null);
  };

  const updateNotes = (humanNotes: string) => {
    if (!active) return;
    setActive(updateHandoff(active, { human_notes: humanNotes }));
    setDirty(true);
    setMessage(null);
  };

  const startReview = async () => {
    if (!active) return;
    const reviewed = markHandoffReviewed(active);
    await persist(reviewed);
  };

  const approve = async () => {
    if (!active) return;
    try {
      await persist(await approveHandoffWithSeal(active, entry));
    } catch {
      setMessage(copy.approvalFailed);
    }
  };

  const exportJson = async () => {
    if (!active || active.status !== "approved") return;
    try {
      await assertSealedHandoff(active, entry);
      download(`${safeFilename(active.type)}-${safeFilename(active.id)}.json`, exportHandoffJson(active), "application/json;charset=utf-8");
    } catch { setMessage(copy.exportRequiresApproval); }
  };

  const exportMarkdown = async () => {
    if (!active || active.status !== "approved") return;
    try {
      await assertSealedHandoff(active, entry);
      download(`${safeFilename(active.type)}-${safeFilename(active.id)}.md`, handoffToMarkdown(active), "text/markdown;charset=utf-8");
    } catch { setMessage(copy.exportRequiresApproval); }
  };

  const createPackage = async () => {
    if (!active || active.status !== "approved" || saving) return;
    try {
      const deliveryPackage = await createSealedDeliveryPackage(entry, active);
      if (entry.delivery_packages.some((item) => item.package.package_fingerprint === deliveryPackage.package_fingerprint)) {
        setMessage(deliveryCopy.duplicate);
        return;
      }
      const record: DeliveryPackageRecord = { package: deliveryPackage, state: "packaged", exported_at: null, import_confirmed_at: null };
      setSaving(true);
      const updated = await saveDeliveryPackageRecord(sourceLibraryEntryKey(entry), record);
      onEntryUpdated(updated);
      setActivePackageId(deliveryPackage.package_id);
      setMessage(deliveryCopy.packageCreated);
    } catch {
      setMessage(deliveryCopy.createFailed);
    } finally {
      setSaving(false);
    }
  };

  const exportDelivery = async (record: DeliveryPackageRecord, format: "json" | "markdown" | "content_ops") => {
    if (deliveryPackageStatus(record, entry) === "outdated" || !validateConsumerCompatibility(record.package).compatible) return;
    try {
      setSaving(true);
      await assertSealedDeliveryPackage(record, entry);
      const filename = safeFilename(record.package.package_id);
      if (format === "markdown") download(`${filename}.md`, deliveryPackageToMarkdown(record.package), "text/markdown;charset=utf-8");
      else if (format === "content_ops") download(`${filename}-content-ops-intake.json`, JSON.stringify(toContentOpsIntakePackage(record.package), null, 2), "application/json;charset=utf-8");
      else download(`${filename}.json`, JSON.stringify(record.package, null, 2), "application/json;charset=utf-8");
      const exported = markDeliveryPackageExported(record);
      const updated = await saveDeliveryPackageRecord(sourceLibraryEntryKey(entry), exported);
      onEntryUpdated(updated);
      setMessage(deliveryCopy.exported);
    } catch {
      setMessage(deliveryCopy.exportFailed);
    } finally {
      setSaving(false);
    }
  };

  const confirmImport = async (record: DeliveryPackageRecord) => {
    try {
      setSaving(true);
      await assertSealedDeliveryPackage(record, entry);
      const updated = await saveDeliveryPackageRecord(sourceLibraryEntryKey(entry), confirmDeliveryPackageImported(record));
      onEntryUpdated(updated);
      setMessage(deliveryCopy.importConfirmed);
    } catch {
      setMessage(deliveryCopy.importConfirmFailed);
    } finally {
      setSaving(false);
    }
  };

  const payload = active?.derived_analysis as unknown as Record<string, string | string[]> | undefined;
  const labels = copy.fields as Record<string, string>;

  return <section className="workbench-subsection source-handoff-workspace" aria-labelledby={`handoff-workspace-${entry.source_record.id}`}>
    <div className="workbench-section-heading">
      <h3 id={`handoff-workspace-${entry.source_record.id}`}>{copy.title}</h3>
      <p>{copy.hint}</p>
    </div>
    <div className="handoff-source-boundary">
      <strong>{copy.sourceBoundary}</strong>
      <p>{copy.sourceBoundaryHint}</p>
      <p>{copy.sourceId}：<code>{entry.source_record.id}</code> · {copy.sourceApproval}：{entry.source_record.review_status} / {entry.source_record.approval_status}</p>
    </div>
    <div className="handoff-kind-grid">
      {HANDOFF_TYPES.map((type) => {
        const artifacts = entry.downstream_handoffs.filter((handoff) => handoff.type === type);
        return <article className="handoff-kind-card" key={type}>
          <strong>{copy.types[type]}</strong>
          <span>{artifacts.length ? `${artifacts.length} · ${artifacts.map((handoff) => copy.status[handoff.status]).join(" / ")}` : copy.notCreated}</span>
        </article>;
      })}
    </div>
    <div className="action-row handoff-build-row">
      <label className="field"><span>{copy.chooseTarget}</span><select value={selectedType} disabled={saving} onChange={(event) => setSelectedType(event.target.value as HandoffType)}>
        {HANDOFF_TYPES.map((type) => <option key={type} value={type}>{copy.types[type]}</option>)}
      </select></label>
      <button type="button" className="primary-button" onClick={() => void buildDraft()} disabled={saving}>{saving ? copy.saving : copy.buildDraft}</button>
    </div>
    {entry.downstream_handoffs.length > 0 ? <label className="field"><span>{copy.openExisting}</span><select value={active?.id ?? ""} disabled={saving} onChange={(event) => { setActive(entry.downstream_handoffs.find((handoff) => handoff.id === event.target.value) ?? null); setDirty(false); }}>
      <option value="">{copy.selectHandoff}</option>
      {entry.downstream_handoffs.map((handoff) => <option key={handoff.id} value={handoff.id}>{copy.types[handoff.type]} · {copy.status[handoff.status]} · {handoff.id}</option>)}
    </select></label> : null}
    {active ? <div className="handoff-editor">
      <div className="material-card-heading"><h4>{copy.types[active.type]}</h4><span className={`status-pill status-${active.status === "approved" ? "reviewed" : active.status === "needs_review" ? "pending" : "captured"}`}>{copy.status[active.status]}</span></div>
      {dirty ? <p className="warning-message" role="status">{copy.unsaved}</p> : null}
      <p className="field-hint">{copy.handoffId}：<code>{active.id}</code> · {copy.separateApproval}</p>
      <section className="handoff-source-facts">
        <h5>{copy.sourceFacts}</h5>
        <p className="field-hint">{copy.sourceFactsHint}</p>
        {active.source_facts.map((fact, index) => <article className="handoff-fact" key={`${active.id}-fact-${index}`}>
          <p>{fact.text}</p><p className="field-hint">{copy.evidenceRefs}：{fact.evidence_reference_ids.join(", ") || copy.noEvidenceRef}</p>
        </article>)}
        <h5>{copy.evidenceRefs}</h5>
        {active.evidence_references.map((reference) => <blockquote className="handoff-evidence" key={reference.id}>
          {reference.text_reference}<footer><code>{reference.id}</code> · {reference.source}{reference.timestamp ? ` · ${reference.timestamp}` : ""}</footer>
        </blockquote>)}
      </section>
      <section className="handoff-derived-fields">
        <h5>{copy.derivedAnalysis}</h5>
        <p className="field-hint">{copy.derivedHint}</p>
        {Object.entries(payload ?? {}).map(([key, value]) => <label className="form-field" key={key}>
          <span>{labels[key] ?? key}</span>
          <textarea
            value={Array.isArray(value) ? value.join("\n") : value}
            rows={Array.isArray(value) ? 3 : 2}
            disabled={saving}
            onChange={(event) => updateField(key, Array.isArray(value) ? event.target.value.split("\n") : event.target.value)}
          />
        </label>)}
        <label className="form-field"><span>{copy.humanNotes}</span><textarea value={active.human_notes} rows={3} disabled={saving} onChange={(event) => updateNotes(event.target.value)} /></label>
      </section>
      <div className="action-row handoff-actions">
        <button type="button" className="secondary-button" onClick={() => void persist(active)} disabled={saving}>{saving ? copy.saving : copy.saveDraft}</button>
        <button type="button" className="secondary-button" onClick={() => void startReview()} disabled={saving || active.status === "needs_review" || active.status === "approved"}>{copy.markReviewed}</button>
        <button type="button" className="primary-button" onClick={() => void approve()} disabled={saving || active.status !== "needs_review"}>{copy.approve}</button>
      </div>
      <p className="field-hint">{copy.editInvalidates}</p>
      {active.status === "approved" && !active.approval_seal_sha256 ? <p className="warning-message" role="status">Legacy approval: edit and independently review again to create a SHA-256 seal before export.</p> : null}
      {active.status === "approved" ? <div className="action-row">
        <button type="button" className="secondary-button" onClick={() => void exportJson()}>{copy.exportJson}</button>
        <button type="button" className="secondary-button" onClick={() => void exportMarkdown()}>{copy.exportMarkdown}</button>
      </div> : <p className="field-hint">{copy.exportRequiresApproval}</p>}
    </div> : null}
    <section className="delivery-outbox" aria-label={deliveryCopy.title}>
      <div className="workbench-section-heading"><h4>{deliveryCopy.title}</h4><p>{deliveryCopy.hint}</p></div>
      {active?.status === "approved" ? <div className="action-row">
        {entry.delivery_packages.some((item) => item.package.handoff_id === active.id && item.package.handoff_fingerprint === active.approval_fingerprint)
          ? <p className="field-hint">{deliveryCopy.alreadyPackaged}</p>
          : <button type="button" className="primary-button" onClick={() => void createPackage()} disabled={saving}>{deliveryCopy.create}</button>}
      </div> : <p className="field-hint">{deliveryCopy.empty}</p>}
      {entry.delivery_packages.map((record) => {
        const status = deliveryPackageStatus(record, entry);
        const compatibility = validateConsumerCompatibility(record.package);
        const selected = activePackageId === record.package.package_id;
        const canExport = status !== "outdated" && compatibility.compatible && Boolean(record.package.security_sha256);
        return <article className="delivery-package-card" key={record.package.package_id}>
          <div className="material-card-heading">
            <h5>{copy.types[record.package.handoff_type]} → {record.package.target_product}</h5>
            <span className={`status-pill ${status === "outdated" ? "status-failed" : status === "import_confirmed" ? "status-reviewed" : status === "exported" ? "status-pending" : "status-captured"}`}>{deliveryCopy.state[status]}</span>
          </div>
          <p>{deliveryCopy.compatibility}: <strong>{compatibility.compatible ? deliveryCopy.compatible : deliveryCopy.incompatible}</strong> · {deliveryCopy.packageVersion}: {record.package.package_version} · {deliveryCopy.contractVersion}: {record.package.contract_version}</p>
          <p className="delivery-identity">{deliveryCopy.packageId}: <code>{record.package.package_id}</code><br />{deliveryCopy.fingerprint}: <code>{record.package.package_fingerprint}</code><br />{deliveryCopy.sourceRelationship}: <code>{record.package.source_record_id}</code> → <code>{record.package.handoff_id}</code></p>
          {status === "outdated" ? <p className="warning-message" role="status">{deliveryCopy.outdated}</p> : null}
          {!record.package.security_sha256 ? <p className="warning-message" role="status">Legacy package: recreate after a fresh human approval to enable SHA-256 protected export.</p> : null}
          {!compatibility.compatible ? <ul className="validation-list">{compatibility.errors.map((error) => <li key={error}>{compatibilityIssueLabel(error, deliveryCopy)}</li>)}</ul> : null}
          <div className="action-row">
            {canExport && record.state === "packaged" ? <button type="button" className="primary-button" onClick={() => void exportDelivery(record, "json")} disabled={saving}>{deliveryCopy.exportJson}</button> : null}
            {record.state === "exported" && status !== "outdated" ? <button type="button" className="primary-button" onClick={() => void confirmImport(record)} disabled={saving}>{deliveryCopy.confirmImport}</button> : null}
            <button type="button" className="secondary-button" onClick={() => setActivePackageId(selected ? null : record.package.package_id)} aria-expanded={selected}>{deliveryCopy.preview}</button>
          </div>
          {canExport ? <details className="delivery-export-options">
            <summary>{deliveryCopy.otherExportOptions}</summary>
            <div className="action-row">
              {record.state !== "packaged" ? <button type="button" className="secondary-button" onClick={() => void exportDelivery(record, "json")} disabled={saving}>{deliveryCopy.exportJson}</button> : null}
              <button type="button" className="secondary-button" onClick={() => void exportDelivery(record, "markdown")} disabled={saving}>{deliveryCopy.exportMarkdown}</button>
              {record.package.target_product === "content_ops" ? <button type="button" className="secondary-button" onClick={() => void exportDelivery(record, "content_ops")} disabled={saving}>{deliveryCopy.contentOpsExport}</button> : null}
            </div>
          </details> : null}
          {selected ? <details open className="delivery-package-preview"><summary>{deliveryCopy.preview}</summary><pre>{JSON.stringify(record.package, null, 2)}</pre></details> : null}
          {record.state === "exported" && status !== "outdated" ? <p className="field-hint">{deliveryCopy.exported}</p> : null}
          {record.state === "import_confirmed" ? <p className="field-hint">{deliveryCopy.importConfirmed}</p> : null}
        </article>;
      })}
    </section>
    {message ? <p role="status" className="workbench-notice">{message}</p> : null}
  </section>;
}

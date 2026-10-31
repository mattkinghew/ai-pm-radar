"use client";

import { useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import Link from "next/link";

import { useLanguage } from "@/components/LanguageProvider";
import { MAX_INTAKE_TEXT_BYTES, validateUploadedTextMaterial } from "@/lib/intake-evidence-preview";
import { isVideoOrSocialLink, QUICK_CAPTURE_SESSION_KEY, serializeQuickCapture } from "@/lib/quick-capture";
import { readSourceInboxDraftSummary, renderSourceInboxDraftSummary, type SourceInboxDraftSummary } from "@/lib/source-inbox-draft-summary";

const ACCEPTED_FILES = ".txt,.md,.markdown,.srt,.vtt,text/plain,text/markdown";

export function HomeQuickCapture() {
  const { messages } = useLanguage();
  const copy = messages.home;
  const [value, setValue] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [isOpening, setIsOpening] = useState(false);
  const [savedSummary, setSavedSummary] = useState<SourceInboxDraftSummary | null>(null);
  const [savedSummaryUnavailable, setSavedSummaryUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    void readSourceInboxDraftSummary().then((summary) => {
      if (active) setSavedSummary(summary);
    }).catch(() => {
      if (active) setSavedSummaryUnavailable(true);
    });
    return () => { active = false; };
  }, []);

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
    setError("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const autoAnalyze = submitter?.value === "ai";
    if (isOpening) return;
    setError("");

    try {
      let capturedValue = value;
      let fileName: string | null = null;
      if (file) {
        if (file.size > MAX_INTAKE_TEXT_BYTES) throw new Error("oversized");
        capturedValue = await file.text();
        validateUploadedTextMaterial(capturedValue, file.name);
        fileName = file.name;
      }
      if (!capturedValue.trim()) {
        setError(copy.quickCaptureEmpty);
        return;
      }

      sessionStorage.setItem(QUICK_CAPTURE_SESSION_KEY, serializeQuickCapture(capturedValue, fileName, autoAnalyze));
      setIsOpening(true);
      window.location.assign("/source-inbox/?quickCapture=1");
    } catch {
      setError(copy.quickCaptureInvalid);
    }
  };

  return (
    <section className="container quick-capture" aria-labelledby="quick-capture-title">
      <div className="quick-capture-heading">
        <div>
          <p className="eyebrow">{copy.quickCaptureEyebrow}</p>
          <h2 id="quick-capture-title">{copy.quickCaptureTitle}</h2>
          <p>{copy.quickCaptureHint}</p>
        </div>
        <Link href="/source-inbox/" className="secondary-button">{copy.quickCaptureContinue}</Link>
      </div>

      <p className="quick-capture-saved" role="status">
        {savedSummary ? renderSourceInboxDraftSummary(copy.quickCaptureSavedSummary, savedSummary)
          : savedSummaryUnavailable ? copy.quickCaptureSavedUnavailable : copy.quickCaptureSavedLoading}
      </p>

      <form className="quick-capture-form" onSubmit={(event) => void submit(event)}>
        <label className="quick-capture-label" htmlFor="home-quick-capture">{copy.quickCaptureLabel}</label>
        <textarea
          id="home-quick-capture"
          value={value}
          onChange={(event) => { setValue(event.target.value); setFile(null); setError(""); }}
          placeholder={copy.quickCapturePlaceholder}
          rows={4}
          maxLength={250_000}
          disabled={isOpening}
        />
        <div className="quick-capture-actions">
          <label className="quick-capture-file secondary-button">
            <span>{file ? file.name : copy.quickCaptureFile}</span>
            <input type="file" accept={ACCEPTED_FILES} onChange={selectFile} disabled={isOpening} />
          </label>
          <button className="secondary-button" type="submit" value="draft" disabled={isOpening || (!value.trim() && !file)}>
            {isOpening ? copy.quickCaptureOpening : copy.quickCaptureSubmit}
          </button>
          <button className="primary-button" type="submit" value="ai" disabled={isOpening || (!value.trim() && !file)}>
            {isOpening ? copy.quickCaptureOpening : copy.quickCaptureAiSubmit}
          </button>
        </div>
        <p className="quick-capture-hint" role={error ? "alert" : "note"}>
          {error || copy.quickCapturePrivacy}
        </p>
        {!file && isVideoOrSocialLink(value) ? <p className="quick-capture-hint" role="note">{copy.quickCaptureVideoHint}</p> : null}
      </form>
    </section>
  );
}

# Client-safe AI Workflow

## Purpose

This guide defines privacy and safety rules for using AI in client-facing work, including AI PM research, IP building, digital marketing, campaign planning, landing page planning, documentation, and consulting.

The goal is to use AI as a drafting, structuring, and review-support tool without exposing sensitive data, copying protected material, or treating AI output as final truth.

This is a practical workflow guide, not legal advice. Legal, compliance, procurement, IT security, or data protection confirmation may be needed depending on the client, sector, data type, tool, and jurisdiction.

---

# Core Principle

```text
Use AI for structure and acceleration.
Keep humans responsible for facts, privacy, judgment, approval, and publication.
```

Client-facing AI workflow should follow:

```text
Collect → classify sensitivity → anonymize → AI-assisted draft → human review → client approval → publish / deliver
```

Do not skip sensitivity classification and human review.

---

## 1. What Must Not Be Uploaded

Do not upload the following into AI tools unless the client has explicitly approved the workflow and the relevant policy / legal / compliance position is clear.

```text
Never upload by default:
- API keys
- .env files
- passwords
- private keys
- OAuth tokens
- session cookies
- credentials
- client contracts
- internal financial documents
- unpublished strategy documents
- personal identity documents
- medical, counselling, social-service, HR, legal, or financial records
- student or minor data
- service-user records
- raw client databases
- private customer lists
- private analytics dashboards with identifiable data
- confidential meeting recordings
- raw private Obsidian vault content
- screenshots containing names, emails, phone numbers, account IDs, or private dashboards
```

If a document is necessary for work, create a sanitized excerpt first.

## 2. How to Anonymize Notes

Use this replacement pattern:

| Original | Safer Version |
|---|---|
| Real client name | Client A / SME service team / NGO programme team |
| Person name | Stakeholder A / participant / teacher / parent / customer |
| Email / phone | `[removed contact detail]` |
| Exact address | district-level or `[removed location]` |
| Exact revenue / budget | range or `[commercial detail removed]` |
| Internal project name | generic project label |
| Personal story | generalized scenario |
| Raw quote | paraphrased summary unless approved |

Anonymized note template:

```text
Original context:
[Do not paste raw sensitive content here]

Anonymized summary:

Client type:

Stakeholder roles:

Problem:

Constraints:

Data removed:

Remaining risk:

Can this be used with AI? yes / no / needs approval
```

Minimum anonymization checklist:

```text
Names removed? yes / no
Contact details removed? yes / no
Private identifiers removed? yes / no
Commercial secrets removed? yes / no
Sensitive personal data removed? yes / no
Client can still be identified indirectly? yes / no / unsure
```

If the client can still be identified indirectly, treat the note as sensitive.

## 3. Safe Example Data

Use fake or generic examples for testing prompts, workflows, templates, and prototypes.

Safe example:

```text
A small education team wants to turn workshop notes into social posts and a simple campaign brief. The team currently stores notes across chat messages and documents. They want a repeatable workflow that removes private participant details before AI-assisted drafting.
```

Safer fake dataset:

```text
Client type: NGO education team
Audience: youth participants and parents
Workflow: workshop notes → anonymized source note → AI-assisted summary → human review → IG caption and event recap
Sensitive data: participant names removed, photos not uploaded, private feedback generalized
```

Unsafe example:

```text
A real participant named [name] said [personal story] during a workshop, with school name, contact details, and identifiable health or family context.
```

## 4. Approval Before Publishing

Before publishing or sending any AI-assisted output externally, confirm:

```text
Source approved for use? yes / no
Client identity anonymized or approved? yes / no
Personal data removed? yes / no
Claims supported? yes / no
Tone approved? yes / no
Brand style approved? yes / no
Copyright risk checked? yes / no
CTA approved? yes / no
Final human approval received? yes / no
```

Approval record:

```text
Output name:
Version:
Reviewer:
Review date:
Approved for: internal use / client delivery / public publishing / portfolio use
Required changes:
Final decision:
```

Do not publish portfolio cases from real client work unless permission is clear or the case is fully anonymized and safe.

## 5. Human-in-the-loop Review

AI can assist with:

- summarizing source notes
- drafting outlines
- extracting pain points
- generating content variations
- suggesting risks
- organizing action items
- creating first-draft templates
- checking consistency

Humans must review:

- factual accuracy
- client context
- strategic fit
- privacy handling
- legal / compliance uncertainty
- tone and brand voice
- stakeholder alignment
- final approval

Human review stages:

```text
Stage 1: Input review
Check whether the material can be used with AI.

Stage 2: Draft review
Check whether the AI output is accurate, useful, and safe.

Stage 3: Publishing review
Check whether the final version is approved for the intended audience.
```

## 6. Copyright / Brand Risk

Risk areas:

```text
- copying competitor landing page copy
- copying newsletter or course material too closely
- using copyrighted images without permission
- using brand logos without approval
- reusing client photos without consent
- reproducing paid report content
- using AI-generated claims that sound like verified proof
- imitating another brand's visual identity too closely
```

Safe handling:

```text
Use references for structure learning only.
Rewrite all copy in original words.
Use licensed, owned, or approved visuals.
Track source URLs for factual claims.
Avoid using testimonials or logos without permission.
Mark assumptions and draft content clearly.
```

## 7. Platform Account Risk

AI-assisted workflows may involve tools such as ChatGPT, Gemini, Notion, Google Drive, Canva, Make, Zapier, n8n, Dify, social platforms, or analytics tools.

Check before connecting accounts:

```text
Does the tool need OAuth access? yes / no
What permissions are requested?
Can access be limited?
Can dummy data be used first?
Is the account personal or client-owned?
Who can revoke access?
Does the tool store uploaded content?
Does the client policy allow this tool?
Is there a manual fallback?
```

Avoid:

- connecting client accounts casually
- granting broad Google Drive / Gmail / Notion access without need
- using personal accounts for client-owned operations without agreement
- uploading confidential files to unknown tools
- running unknown scripts from GitHub without review

## 8. AI Hallucination Risk

AI may produce confident but false or unsupported content.

Common hallucination patterns:

```text
- inventing statistics
- inventing source details
- exaggerating client results
- creating fake user quotes
- claiming legal / compliance certainty
- assuming product features that do not exist
- overgeneralizing from one source
- mixing up dates, names, or technical terms
```

Control rules:

```text
No source, no factual claim.
No verified result, no impact claim.
No client approval, no public case claim.
No policy confirmation, no compliance certainty.
```

Review checklist:

```text
Does each factual claim have a source?
Are numbers traceable?
Are examples clearly marked as generic or fake?
Are limitations stated?
Are assumptions marked?
```

## 9. Client Data Handling Checklist

Before using AI:

```text
What data is involved?
Who owns the data?
Is it public, internal, confidential, or sensitive?
Does it include personal data?
Does it include minors, students, service users, medical, counselling, HR, legal, or financial context?
Has the client approved AI-assisted processing?
Can the task be done with fake data or sanitized excerpts?
What tool will be used?
Does the tool store uploaded content?
Who reviews the output?
Who approves external delivery?
```

During AI-assisted work:

```text
Use only necessary excerpts.
Remove identifiers.
Avoid uploading full documents if a section summary is enough.
Keep drafts labeled as drafts.
Track assumptions.
Do not paste secrets or credentials.
```

Before delivery:

```text
Check facts.
Check tone.
Check privacy.
Check copyright.
Check claims.
Check CTA.
Check client approval.
Record limitations.
```

## 10. Red Flags

Stop and review before proceeding if:

```text
- client asks to upload full private database
- document contains student, minor, patient, counselling, HR, legal, or financial data
- client wants guaranteed sales, conversion, or legal compliance claims
- AI output includes invented numbers or fake sources
- workflow requires broad account access without clear need
- competitor material is being copied directly
- client wants to publish a case study without removing identifiable details
- a tool asks for API keys or credentials in an unsafe way
- scope changes from template / prototype into production automation without QA
- there is no human approver
```

Recommended response:

```text
This part needs a safer workflow. We can continue with anonymized excerpts, fake sample data, or a manual review process first. Legal, compliance, or IT confirmation may be needed before using the original material with AI tools.
```

## 11. Safe Fallback Workflow

When data sensitivity or approval is unclear, use this fallback:

```text
Step 1: Do not upload raw material.
Step 2: Manually summarize the issue in generic terms.
Step 3: Remove all names, identifiers, and sensitive details.
Step 4: Use fake or generalized examples for AI-assisted drafting.
Step 5: Apply the output manually to the real context outside the AI tool.
Step 6: Ask client / policy owner for approval before using real data.
Step 7: Keep final human review before delivery or publishing.
```

Example fallback:

```text
Instead of uploading a real workshop transcript, manually write:
"An education team ran a youth workshop. Participants found the activity useful but wanted clearer instructions and more examples. The team needs an event recap and improvement notes."

Use AI to draft the recap structure and improvement checklist.
Then manually fill in approved, non-sensitive details.
```

## 12. Client-safe AI Workflow Summary

```text
1. Define the business task.
2. Classify the data.
3. Remove or replace sensitive details.
4. Use AI only on safe excerpts or fake examples.
5. Review facts, claims, tone, and privacy.
6. Get approval before external use.
7. Document the workflow and limitations.
8. Convert only approved or anonymized work into portfolio evidence.
```

## 13. Portfolio Use Rule

Portfolio cases should use one of these modes:

```text
Public project:
Use normally with source links and limitations.

Anonymized client-style case:
Remove identifying details and describe workflow generically.

Fake sample case:
Clearly mark as sample or demonstration.

Private-only case:
Do not publish; use only for personal learning or interview discussion at a high level.
```

Do not imply that a fake or anonymized sample is a verified real client result.

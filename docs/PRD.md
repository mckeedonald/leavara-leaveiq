# Guildlight Platform — Product Requirements Document
**Version 1.2 | Last Updated: 2026-06-09**

> **Living Document Notice:** This PRD is the authoritative product definition for the Guildlight platform and its products — Guildlight Leave and Guildlight Grow. It is updated as features are designed, built, or changed. Sections marked `[Planned]` describe intended future functionality. Sections marked `[Built]` reflect what is implemented and deployed.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision and Decision Value](#2-product-vision-and-decision-value)
3. [Company and Market Context](#3-company-and-market-context)
4. [Users, Personas, and Jobs to Be Done](#4-users-personas-and-jobs-to-be-done)
5. [Product Scope by Version](#5-product-scope-by-version)
6. [Information Architecture and Navigation](#6-information-architecture-and-navigation)
7. [Guildlight Leave — Functional Requirements](#7-leaveiq--functional-requirements)
8. [Guildlight Grow — Functional Requirements](#8-performiq--functional-requirements)
9. [Platform-Wide Functional Requirements](#9-platform-wide-functional-requirements)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Data Model](#11-data-model)
12. [AI Features](#12-ai-features)
13. [Integration Points](#13-integration-points)
14. [Technical Architecture](#14-technical-architecture)
15. [Security and Compliance](#15-security-and-compliance)
16. [API Design Conventions](#16-api-design-conventions)
17. [Version Roadmap](#17-version-roadmap)
18. [Open Questions](#18-open-questions)
19. [Appendix A — Color Palette and Design System](#appendix-a--color-palette-and-design-system)
20. [Appendix B — Environment Variables](#appendix-b--environment-variables)
21. [Appendix C — CSV Import Specifications](#appendix-c--csv-import-specifications)
22. [Appendix D — Changelog](#appendix-d--changelog)

---

## 1. Executive Summary

Guildlight is a B2B HR software company building AI-augmented tools that help HR professionals manage workforce compliance, leave administration, and employee performance. The Guildlight platform currently consists of two products — **Guildlight Leave** and **Guildlight Grow** — served under a unified multi-tenant SaaS architecture with a shared employee data layer.

**Guildlight Leave** is a leave and accommodation management system that automates the FMLA, ADA, and state leave compliance workflow. It provides an AI assistant (Ave) that drafts notices, analyzes medical certifications, determines eligibility, and generates required employer documentation. Employees submit requests through a conversational portal. HR manages cases in a structured case management interface.

**Guildlight Grow** is a performance management system that helps HR and managers document performance concerns, generate formal documentation, route it through a review-and-sign workflow, and close cases with a complete audit trail. It includes an AI agent that leverages uploaded company policies to draft performance improvement plans, coaching notes, and other formal documents.

Both products are deployed as a single frontend application with a shared Express API backend and a PostgreSQL database managed via Drizzle ORM. The platform is hosted on Railway with Cloudflare R2 for file storage and Resend for transactional email.

---

## 2. Product Vision and Decision Value

### Guildlight Leave

HR administrators spend 40–60% of their time on compliance paperwork for leave cases — drafting FMLA eligibility notices, designation letters, obtaining medical certifications, and managing state leave programs in parallel. Small and mid-sized employers (50–2,000 employees) rarely have dedicated leave specialists. Guildlight Leave eliminates the compliance research burden by embedding legal and regulatory knowledge directly into the workflow via the Ave AI assistant.

**Decision value:**
- HR can process a complete FMLA case in under 15 minutes from intake to notice delivery
- Employers reduce risk of non-compliant notices or missed response deadlines
- Employees receive timely, professional communication rather than ad-hoc emails
- Organizations maintain a complete, searchable audit trail for every case

### Guildlight Grow

Performance documentation is frequently inconsistent, legally risky, and time-consuming. Managers avoid difficult conversations because documenting them correctly feels like legal work. Guildlight Grow gives HR a structured, AI-assisted workflow to produce consistent, policy-aligned performance documentation and route it through a compliant review and signature process.

**Decision value:**
- Managers produce documentation faster with fewer errors
- HR can enforce consistent standards across the organization
- Legal exposure from poorly worded PIPs or coaching notes is reduced
- E-signature workflow creates a defensible record without external services

---

## 3. Company and Market Context

**Company:** Guildlight  
**Stage:** Early-stage SaaS  
**Target market:** SMB and mid-market employers in the United States, 50–2,000 employees  
**Primary buyers:** HR Directors, VP HR, CHRO  
**Primary users:** HR Administrators, HR Generalists, and (for portal) employees  
**Regulatory focus:** FMLA (Federal), ADA (Federal), CFRA/HFWA/PFML (state-level), employer obligations under 29 CFR Part 825

Guildlight is differentiated by its opinionated, compliance-first AI layer. Unlike generic HR platforms that surface forms and checklists, Guildlight Leave's Ave assistant actively generates employer-side documentation with specific regulatory citations. This is the core IP.

---

## 4. Users, Personas, and Jobs to Be Done

### 4.1 HR Administrator (Guildlight Leave)

**Who:** An HR professional with administrative responsibility for leave management at the organization. May be the only HR person at a small company or a specialist at a larger one.

**Primary jobs:**
- Open and manage FMLA/state leave/ADA cases end-to-end
- Generate and send required employer notices within regulatory deadlines
- Request and review medical certifications
- Track intermittent leave usage
- Respond to employee questions via the case messaging thread
- Maintain an audit trail for compliance purposes

**Pain points today:** Googling FMLA notice requirements, drafting letters from scratch, juggling spreadsheets to track deadlines, managing paper or email-based certification returns.

---

### 4.2 HR User (Guildlight Leave)

**Who:** An HR coordinator or generalist without full administrative rights. Can view and work cases but cannot configure the organization.

**Primary jobs:**
- View and update assigned cases
- Send messages to employees
- Review AI recommendations

---

### 4.3 Employee (Guildlight Leave Portal)

**Who:** Any employee submitting a leave or accommodation request.

**Primary jobs:**
- Submit a leave or accommodation request without knowing FMLA/ADA procedural details
- Upload completed medical certifications
- View case status and messages from HR
- Download employer-generated notices

**Key constraint:** Must not be required to create an account or remember a password. Portal access is token-authenticated.

---

### 4.4 HR Administrator (Guildlight Grow)

**Who:** HR professional managing the performance documentation workflow.

**Primary jobs:**
- Create performance cases for employees
- Use the AI agent to draft PIPs, coaching notes, and formal warning letters using company policy
- Route documents to managers for review
- Send documents to employees for e-signature
- Finalize and archive completed cases with a signed PDF

---

### 4.5 Manager / Supervisor (Guildlight Grow)

**Who:** People manager involved in a performance case.

**Primary jobs:**
- Review AI-drafted documentation
- Add context and sign off on documents
- Track the status of their direct reports' performance cases

---

### 4.6 Super Administrator (Platform)

**Who:** Guildlight internal staff managing the SaaS infrastructure.

**Primary jobs:**
- Create and configure organizations
- Enable/disable products (Guildlight Leave, Guildlight Grow) per organization
- Create initial admin users and Guildlight Grow users
- View and export audit logs per organization
- Manage knowledge base documents per organization
- Access this PRD and platform documentation

---

## 5. Product Scope by Version

### 5.1 Guildlight Leave — Built (v1)

- [Built] Multi-tenant case management: FMLA leave cases and ADA accommodation cases
- [Built] Employee portal — conversational intake (chatbot flow, no login required)
- [Built] Ave AI assistant — eligibility analysis, notice drafting, designation letters, certification requests
- [Built] Medical certification generation as PDF, delivery to employee, portal upload return
- [Built] Interactive case messaging between HR and employee
- [Built] Case documents panel — generated docs, employee uploads, accessible via portal
- [Built] Audit log per organization — filterable, exportable CSV
- [Built] AI session history per case — full history of Ave recommendations and feedback
- [Built] Ada ADA assistant — accommodation interactive process, physician certification, interactive log
- [Built] State disability and paid leave program information embedded in notices (CA, NY, NJ, WA, MA, CO, OR, CT, RI, HI, DC)
- [Built] Case status lifecycle (open → in review → designation pending → closed)
- [Built] Calendar invite support for leave start/end
- [Built] HR Admin audit log page at `/leave/audit`

### 5.2 Guildlight Leave — Recently Delivered (v1.1–v1.2)

- [Built] Simplified portal intake — no public lookup endpoint; employee enters their own data directly
- [Built] Unified employee page (Guildlight Leave color palette, shared across products) at `/leave/employees`
- [Built] HRIS integration configuration moved to super admin only
- [Built] Import log and CSV error reporting for employee uploads (`employee_import_log`)
- [Built] Mobile-responsive navigation (hamburger menu on small screens)
- [Built] Run Analysis modal auto-pull employee data from case record

### 5.3 Guildlight Grow — Built (v1)

- [Built] Multi-tenant case management for performance cases
- [Built] PIQ agent — AI assistant using uploaded org policies to generate documents
- [Built] PDF policy upload — policies stored in R2 and passed to Claude as native PDF document blocks
- [Built] Workflow steps — configurable review/approval stages per case
- [Built] Document management — multiple document versions per case
- [Built] Guildlight Grow-specific user authentication (separate from Guildlight Leave auth)
- [Built] Admin settings — document types, workflow templates, policy management
- [Built] Audit log per org via `piq_audit_log`

### 5.4 Guildlight Grow — Recently Delivered (v1.1–v1.2)

- [Built] E-signature workflow (employee signs via secure token link, manager signs in-platform, final signed PDF generated)
- [Built] Employee signing page at `/grow/sign`
- [Built] Manager e-sign panel in case detail
- [Built] Signature status lifecycle (sent → employee_signed → manager_signed → completed; or declined)

### 5.5 Out of Scope (All Versions)

- Automated employment decisions or recommendations to terminate
- Payroll processing or direct HRIS data writes
- Union grievance management
- Workers' compensation claim management (separate product category)
- SSO/SAML (earmarked for enterprise tier)
- Real-time HRIS sync during version 1 (HRIS integration is batch/pull)

---

## 6. Information Architecture and Navigation

### 6.1 Guildlight Leave Navigation (Authenticated HR Users)

```
Dashboard          /leave/dashboard
  Leave Cases      /leave/cases
  Case Detail      /leave/cases/:caseId
  ADA Cases        /leave/ada-cases
  ADA Case Detail  /leave/ada-cases/:caseId
  Employees        /leave/employees   ← unified, shared with Guildlight Grow
  Audit Log        /leave/audit       (HR Admin only)
  Org Settings     /leave/settings    (HR Admin only)
  Knowledge Base   /leave/knowledge   (HR Admin only)
```

### 6.2 Employee Portal (No Login)

```
Portal Entry     /leave/request?org={slug}
Portal Return    /leave/portal?token={accessToken}
Document Sign    (token-based, via email link)
```

### 6.3 Guildlight Grow Navigation (Authenticated Grow Users)

```
Dashboard          /grow/dashboard
  Cases            /grow/cases
  Case Detail      /grow/cases/:caseId
  Employees        /leave/employees   ← same unified page
  Admin Settings   /grow/admin     (admin roles)
  Sign Document    /grow/sign      (public, token-based)
```

### 6.4 Super Admin Panel

```
Super Admin      /leave/superadmin
  Organizations  → per-org: users, products, knowledge base
  Cases          → view/restore deleted cases across all orgs
  Users          → view/manage users across all orgs
  Audit          → per-org filterable audit log + CSV export
  HRIS Setup     → [Built] HRIS connection configuration per org
  Employees      → [Built] Manual employee CSV upload per org
  Docs/PRD       → This document (rendered inline)
```

---

## 7. Guildlight Leave — Functional Requirements

### 7.1 Case Management

**Leave Cases**
- HR can create a case manually or via employee portal submission
- Case fields: employee name, employee ID, employee email, leave type (FMLA/state/personal), leave reason, leave start/end dates (continuous or intermittent), medical details
- Case statuses: `open`, `in_review`, `designation_pending`, `closed`, `deleted`
- Soft delete with reason; cases restorable by super admin
- Cases scoped to organization; HR cannot see other organizations' cases
- Case number auto-generated (format: LV-YYYYMMDD-XXXX)

**ADA Accommodation Cases**
- Separate case type for accommodation requests
- Fields: employee name/ID/email, limitation description, accommodation requested, physician cert status
- Interactive process log — persistent record of all Ada agent interactions
- Case assignable to HR user via "Claim Case"
- Physician certification generated as PDF, sent to employee, returned via portal

### 7.2 Employee Portal

- Conversational chatbot intake (no account required)
- Flow: welcome → branch selection (leave vs accommodation) → employee ID → employee name → email → leave/ADA-specific questions → summary confirmation
- Accessible at `/leave/request?org={slug}`
- Token-based return URL for document uploads at `/leave/portal?token={accessToken}`
- Portal can accept: completed medical certifications, supporting documents
- Access token scoped to a single case; expires on use or after 90 days

### 7.3 Ave AI Assistant

- Available on every leave case via the AI Assistant Panel
- Analyzes case data to produce: eligibility determination, designation recommendation, required notice types
- Generates draft notices as formatted text: FMLA Eligibility Notice, FMLA Designation Notice, Medical Certification Request, Return-to-Work Clearance, FMLA Extension
- HR reviews, edits (via feedback), and approves before sending
- Notices sent to employee email via Resend; stored as case documents
- Medical certification generated as PDF attachment
- AI session history persisted per case; collapsible history section shows all prior recommendations, notice types, feedback, and confidence scores
- State disability program info injected into notices when employee state is known (11 states + DC)

### 7.4 Case Documents

- All HR-generated notices stored as case documents upon sending
- Employee-uploaded documents stored and accessible to HR
- Documents downloadable by HR and (where appropriate) by employee via portal
- Medical certifications stored as base64-encoded PDF (not raw text) with `mimeType: "application/pdf"`
- Document panel in case detail shows: document name, type, date, uploader, download link

### 7.5 Case Messaging

- Threaded message panel on each case (leave and ADA)
- HR and employee can exchange messages
- Enter key sends; Shift+Enter inserts newline
- Messages stored in `case_messages` table, scoped to case ID
- ADA cases use same messaging infrastructure (caseId lookup checks both `leave_cases` and `ada_cases`)

### 7.6 Audit Log

- Every significant case action logged to `audit_log` table
- Logged events: case created, case updated, AI recommendation generated (with metadata: action, confidence score, reasoning, notice types, feedback), notice sent (with recipient email and notice type), document uploaded, case closed, case deleted, case restored
- Per-org audit log viewable by HR Admin at `/leave/audit` (filterable by action, actor, date range)
- Per-org audit exportable as CSV by super admin

### 7.7 Calendar Integration

- Case detail allows HR to create a calendar invite for leave start/end
- Stored in `calendar_invites` table; invite sent via email

---

## 8. Guildlight Grow — Functional Requirements

### 8.1 Case Management

- Cases created by HR Admin; employee and manager linked at creation
- Case fields: employee, manager, case type (PIP, coaching, formal warning, etc.), description, status
- Configurable workflow steps per case type (defined in Admin Settings)
- Case status follows workflow step progression
- Document versions tracked per case

### 8.2 PIQ Agent

- Conversational AI agent accessible on each case
- System prompt includes uploaded org policy documents (text-paste and PDF-backed)
- PDF policies passed to Claude as native `document` blocks (no text extraction)
- Text policies injected into system prompt
- Generates performance documents based on HR/manager prompts
- Document drafts reviewable and editable before committing
- Agent session persisted to `piq_agent_sessions`

### 8.3 Policy Management

- HR Admin can upload policies in two formats:
  - Text paste (stored in `content` column)
  - PDF upload (stored in R2 at `piq-policies/{orgId}/{uuid}.pdf`; `pdf_storage_key` references R2 key)
- Policy categories: Code of Conduct, Attendance, Performance, Compensation, Benefits, Other
- Policies associated with organization; agent loads all active org policies per session
- PDF-backed policies show "PDF" badge in admin list; text preview skipped

### 8.4 Document Workflow

- Documents generated by PIQ agent or uploaded manually
- Each document has: title, type, content, version, status
- Workflow: draft → manager review → HR approval → sent to employee → signed → archived
- E-signature workflow [Built]: employee receives secure link, signs or declines, manager counter-signs, final PDF generated

### 8.5 E-Signature [Built]

- `POST /api/performiq/cases/:caseId/signatures/request` — creates signature record, emails employee
- `GET /api/performiq/cases/:caseId/signatures` — lists signature records for a case
- Public signing page at `/grow/sign?token={employeeAccessToken}`, backed by public token endpoints `GET /api/piq/sign?token=` and `POST /api/piq/sign`
- On sign: signature stored, status → "employee_signed", manager notified
- On decline: comment stored, status → "declined", HR/manager notified
- Manager signs in-platform via `POST /api/performiq/cases/:caseId/signatures/manager-sign` → final signed PDF generated, status → "manager_signed"/"completed"
- `GET /api/performiq/cases/:caseId/signatures/download-pdf` — downloads signed PDF (stored in `signed_pdf_content`)

### 8.6 Admin Settings

- Document type configuration (name, description, workflow template)
- Workflow step templates (step name, order, required signers)
- Policy management (add/edit/delete text and PDF policies)
- Guildlight Grow user management — now part of the unified user model (see §9.3); `piq_users` retained for reference only, with active user data consolidated into the shared `users`/`hr_user` table

---

## 9. Platform-Wide Functional Requirements

### 9.1 Employee Data Management

- Unified `employee` table shared by Guildlight Leave and Guildlight Grow
- Fields: employee_id (HR identifier), full_name, position, location, department, manager_id (self-referential), manager_name, start_date, avg_hours_worked, work_email, personal_email, is_active, linked_user_id, data_source (hris/csv/manual), hris_id
- Employees uploaded via CSV; upsert by employee_id (or full_name if no ID)
- Manager relationships resolved in second pass after all employees inserted
- Required CSV columns: `employee_name`; recommended: `employee_id`, `position`, `location`, `department`, `manager_name`, `start_date`, `avg_hours_worked`, `work_email`, `personal_email`
- [Built] Batch inserts (replaced sequential per-row upserts to fix timeout on large files)
- [Built] Import log table (`employee_import_log`): records each import attempt with timestamp, row count, error count, status (success/partial/failed)
- [Built] CSV error report: generated only when errors occur; lists row number, field, error, and correction guidance; downloadable by HR Admin

### 9.2 Organization Management

- Each organization has: name, slug (URL-safe), is_active, has_leave_iq (bool), has_perform_iq (bool)
- Slug used in portal URL (`?org={slug}`) and routing
- Organizations created and managed by super admin only
- HR Admins manage users within their own organization (invite, deactivate)

### 9.3 User Management

**Unified User Model** (`users`/`hr_user` table):
- [Built] Single login serves both Guildlight Leave and Guildlight Grow. Users authenticate once at `/api/auth/login`; a single JWT (stored client-side as `leavara_token`) carries access to both products based on org product flags and role.
- Roles (`UnifiedRole`): `hr_admin` (HR Admin), `hr_user` (HR User), `manager`. Legacy `admin` role values are normalized to `hr_admin` at read time via `normalizeRole()`.
- Authentication: email + password (bcrypt), JWT with 7-day expiry, signed with `JWT_SECRET`
- Invite flow: super admin or HR Admin creates user → welcome email with temporary password sent via Resend
- The legacy `piq_users` table is retained for reference only; active Guildlight Grow user data is consolidated into the shared table. The legacy `/api/performiq/auth/login` endpoint redirects to the unified `/api/auth/login`.

### 9.4 Notifications and Email

- All transactional email via Resend
- Email types:
  - Welcome email (new user created)
  - Leave case intake confirmation (employee)
  - ADA case acknowledgment (employee) [Built: sent on case creation]
  - Notice delivery (employee) — with case documents attached
  - Medical certification request (employee) — with PDF cert attached
  - Calendar invite (leave start/end)
  - E-signature request (employee, Guildlight Grow) [Built]
  - E-signature completion (HR, Guildlight Grow) [Built]

### 9.5 File Storage

- Cloudflare R2 used for all binary file storage
- Storage key patterns:
  - Medical certifications: `orgs/{orgId}/cases/{caseId}/docs/{uuid}.pdf`
  - Guildlight Grow policies: `piq-policies/{orgId}/{uuid}.pdf`
  - Case documents (employee uploads): `orgs/{orgId}/cases/{caseId}/uploads/{uuid}`
- Files referenced by storage key in DB; signed URLs generated on demand
- 10 MB upload limit enforced server-side

---

## 10. Non-Functional Requirements

### 10.1 Performance

- API response time < 500ms for list/read endpoints under normal load
- CSV upload of up to 2,000 employees completes in < 30 seconds (requires batch insert implementation)
- File upload (PDF, CSV) handled within 60 seconds
- Frontend initial load < 2 seconds on broadband

### 10.2 Availability

- Target: 99.5% uptime (Railway infrastructure)
- Database: PostgreSQL hosted on Railway (single-region); failover not yet configured

### 10.3 Security

- JWT tokens expire in 7 days; no refresh token (re-login required)
- Passwords hashed with bcrypt (cost factor 12)
- All API routes require auth except: portal endpoints (token-based), health check, landing page
- HRIS connection credentials encrypted with AES-256 before storage
- R2 files not publicly accessible; all downloads via signed URLs
- Rate limiting: `generalLimiter` (300 req/min on /api), `authLimiter` (10 req/min on /auth)

### 10.4 Data Isolation

- All DB queries scoped to `organizationId` from JWT; no cross-org data access possible via normal auth
- Super admin routes prefixed `/api/superadmin/` and gated by `isSuperAdmin` claim in JWT

### 10.5 Browser Support

- Modern evergreen browsers (Chrome, Firefox, Safari, Edge latest 2 versions)
- Mobile responsive: core HR workflows accessible on mobile (hamburger nav [Built])
- Employee portal: fully mobile-friendly (primary device for employees)

---

## 11. Data Model

### 11.1 Core Tables

| Table | Description |
|-------|-------------|
| `organizations` | Tenant table; has_leave_iq, has_perform_iq flags |
| `users` | Guildlight Leave HR users (admin/user role) |
| `employee` | Shared employee roster (Guildlight Leave + Guildlight Grow) |
| `leave_cases` | FMLA/state/personal leave cases |
| `ada_cases` | ADA accommodation request cases |
| `case_documents` | Documents per case (generated + uploaded) |
| `case_messages` | HR ↔ employee messaging thread per case |
| `case_notices` | Sent notices per case |
| `case_access_tokens` | Portal access tokens for employee-facing URLs |
| `audit_log` | All significant events; metadata jsonb; org-scoped index |
| `ada_interactive_log` | Ada agent conversation entries per ADA case |

### 11.2 Guildlight Grow Tables

| Table | Description |
|-------|-------------|
| `piq_users` | Guildlight Grow-specific user records |
| `piq_cases` | Performance management cases |
| `piq_documents` | Documents per PIQ case |
| `piq_document_history` | Version history per PIQ document |
| `piq_document_types` | Configurable document type definitions |
| `piq_workflow_steps` | Step definitions per case |
| `piq_policies` | Policy documents (text or PDF-backed) |
| `piq_agent_sessions` | PIQ agent conversation sessions |
| `piq_audit_log` | PIQ-specific audit events |
| `piq_signatures` | E-signature records — statuses (`sent`, `signed`, `employee_signed`, `manager_signed`, `completed`, `declined`); fields include `signed_at`, `employee_signed_at`, `manager_signed_at`, `signed_pdf_content` |
| `piq_integration_logs` | HRIS/integration sync logs |

### 11.3 Supporting Tables

| Table | Description |
|-------|-------------|
| `hris_connections` | HRIS connection config per org (AES-256 encrypted credentials) |
| `hris_employee_cache` | Last-synced employee data from HRIS |
| `leave_knowledge_sources` | RAG document chunks for AI context |
| `rag_documents` | Uploaded knowledge base documents |
| `org_locations` | Office/work locations per org |
| `org_roles` / `org_role_permissions` | Custom role definitions per org |
| `calendar_invites` | Leave start/end calendar events |
| `password_resets` | Password reset tokens |
| `invites` | HR user invite tokens |
| `employee_import_log` | [Built] Record of each CSV import: timestamp, filename, row count, inserted, updated, errors, status |

### 11.4 Planned Tables

_None currently outstanding. (The `employee_import_log` table, previously planned, is now built — see §11.3.)_

### 11.5 Key Relationships

```
organizations (1) → (many) users
organizations (1) → (many) employee
organizations (1) → (many) leave_cases
organizations (1) → (many) ada_cases
leave_cases (1) → (many) case_documents
leave_cases (1) → (many) case_messages
leave_cases (1) → (many) audit_log [via entityId]
leave_cases (1) → (many) case_notices
ada_cases (1) → (many) ada_interactive_log
ada_cases (1) → (many) case_documents
ada_cases (1) → (many) case_messages [via shared caseMessages lookup]
employee (many) → (1) employee [manager_id self-referential]
```

---

## 12. AI Features

### 12.1 Ave — Guildlight Leave Leave Assistant

- **Model:** Claude (Anthropic), accessed via `@anthropic-ai/sdk`
- **System prompt location:** `artifacts/api-server/src/lib/aiRecommendation.ts`
- **Invocation:** `POST /api/cases/:caseId/ai-recommendation`
- **Input context:** Case data, employee info, leave reason, dates, state of employment
- **Output:** Structured JSON: `{ action, confidenceScore, reasoning, noticeTypes[], notices[{ type, content }] }`
- **Notice types generated:** FMLA_ELIGIBILITY_NOTICE, FMLA_DESIGNATION_NOTICE, MEDICAL_CERTIFICATION_REQUEST, RETURN_TO_WORK, EXTENSION_NOTICE
- **State programs:** Ave injects state disability/paid leave program details when employee state is known (CA SDI, NY DBL/PFL, NJ TDI/FLI, WA PFML, MA PFML, CO FAMLI, OR PFMLI, CT PFMLI, RI TDI/TCI, HI TDI, DC PFML)
- **Feedback loop:** HR can provide feedback text; re-submitted to Ave for revision; feedback stored in audit log metadata
- **Session history:** All AI turns and notice sends stored in `audit_log` with full metadata; surfaced in AiAssistantPanel session history

### 12.2 Ada — ADA Accommodation Assistant

- **Model:** Claude (Anthropic)
- **System prompt location:** `artifacts/api-server/src/lib/adaAgent.ts`
- **Invocation:** `POST /api/ada/cases/:caseId/agent-turn`
- **Context:** ADA case data, limitation description, accommodation requested, interactive process history
- **Output:** Narrative response; can trigger physician certification generation
- **Physician cert:** Generated as PDF (`buildMedCertPdf` in `lib/pdfUtils.ts`), sent as email attachment, returned by employee via portal
- **Conversation persistence:** Each agent turn logged to `ada_interactive_log` as two entries: `hr_message` and `ada_response` (with metadata); AdaAgentPanel restores full history on mount

### 12.3 PIQ Agent — Guildlight Grow Assistant

- **Model:** Claude (Anthropic)
- **System prompt location:** `artifacts/api-server/src/lib/piqAgent.ts`
- **Invocation:** `POST /api/piq/cases/:caseId/agent`
- **Policy context:** Text policies injected into system prompt; PDF policies passed as native Claude `document` blocks (base64-encoded from R2)
- **Output:** Document drafts for PIPs, coaching notes, formal warnings, other configurable doc types
- **Sessions:** Stored in `piq_agent_sessions`

---

## 13. Integration Points

### 13.1 HRIS Integration

- **Supported systems:** BambooHR (fully implemented), Workday (stub), ADP (stub), Rippling (stub)
- **Sync mechanism:** Pull-based; HR Admin triggers sync; data written to `hris_employee_cache` then promoted to `employee`
- **Credential storage:** AES-256 encrypted in `hris_connections`; encryption key from `HRIS_ENCRYPTION_KEY` env var
- **Configuration:** [Built] Moved from HR Admin interface to Super Admin panel
- **Routes:** `artifacts/api-server/src/routes/hris.ts` (requireAdmin gated)

### 13.2 Email — Resend

- **Service:** Resend (`resend` npm package)
- **From address:** Configured via `RESEND_FROM_EMAIL` env var
- **Functions:** `sendWelcomeEmail`, `sendNoticeEmail`, `sendAdaAcknowledgmentEmail`, `sendCalendarInvite`, and Guildlight Grow e-signature request/completion emails in `artifacts/api-server/src/lib/email.ts`
- **Attachments:** PDF base64 encoded in Resend `attachments` array

### 13.3 File Storage — Cloudflare R2

- **Functions:** `uploadFile(key, buffer, mimeType)`, `downloadFile(key)`, `getSignedUrl(key)` in `artifacts/api-server/src/lib/storage.ts`
- **Configuration:** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`

### 13.4 Database — PostgreSQL

- **ORM:** Drizzle ORM (`drizzle-orm`)
- **Schema location:** `lib/db/src/schema/`
- **Migrations:** `lib/db/drizzle/` (SQL files), run via `npx drizzle-kit migrate` or raw SQL
- **Connection:** `DATABASE_URL` env var (Railway Postgres)

---

## 14. Technical Architecture

### 14.1 Repository Structure

```
leavara-leaveiq/
  artifacts/
    leaveiq/          # Vite + React frontend
      src/
        pages/        # Route-level page components
        components/   # Shared UI components
        lib/          # Frontend utilities, auth, query
    api-server/       # Express backend
      src/
        routes/       # Route handlers
        lib/          # Services: email, storage, ai, pdf
  lib/
    db/               # Drizzle schema + migrations
      src/schema/     # Table definitions
      drizzle/        # Migration SQL files
  docs/               # Product documentation (this file)
```

### 14.2 Frontend Stack

- **Framework:** React 19 with Vite
- **Routing:** Wouter (lightweight, SPA-friendly)
- **State/Data:** TanStack Query (useQuery, useMutation)
- **UI Components:** shadcn/ui (Radix UI primitives + Tailwind CSS)
- **Styling:** Tailwind CSS + inline styles for brand-specific colors
- **Icons:** Lucide React
- **Auth:** JWT stored in localStorage; `useAuth()` hook; `ProtectedRoute` and `PiqProtectedRoute` wrappers

### 14.3 Backend Stack

- **Runtime:** Node.js 20 (ESM)
- **Framework:** Express with Pino logging (`express-pino-logger`)
- **ORM:** Drizzle ORM with `drizzle-zod` for validation
- **Auth:** JWT (`jsonwebtoken`); `requireAuth`, `requireHrAdmin`, `requireSuperAdmin` middleware
- **Rate limiting:** `express-rate-limit`; `generalLimiter`, `authLimiter`
- **CSV parsing:** `csv-parse/sync`
- **PDF generation:** Pure Node.js PDF 1.4 builder in `lib/pdfUtils.ts` (no external PDF libs)
- **Passwords:** `bcryptjs` (cost factor 12)

### 14.4 Deployment

- **Platform:** Railway (monorepo; api-server and leaveiq deployed as separate services)
- **Config:** `railway.json`, `nixpacks.toml`
- **Frontend:** Served as static build; Vite build output
- **API:** Express server on configured PORT
- **Environment:** Secrets managed via Railway environment variables

---

## 15. Security and Compliance

### 15.1 Authentication and Authorization

- JWT-based; a single unified token (`leavara_token`) serves both Guildlight Leave and Guildlight Grow
- `isSuperAdmin` claim on JWT gates `/api/superadmin/*` endpoints
- `organizationId` claim on JWT; all queries filtered by it server-side
- Employee portal uses case-scoped access tokens (UUID); not JWT

### 15.2 Data Handling

- Medical information (leave reason, medical certification content) stored in the database; not encrypted at rest beyond database-level encryption
- **Note:** HIPAA BAA has not been executed. Medical data in the system should be treated as sensitive; production deployment should evaluate HIPAA compliance requirements and encryption-at-rest before handling PHI
- Employee PII (name, email, hire date) in DB; not masked except in portal lookup (masked email display removed — employee enters their own data directly)

### 15.3 Input Validation

- All request bodies validated with Drizzle-Zod schemas or inline checks
- SQL injection: prevented by Drizzle ORM parameterized queries
- CSV input: sanitized field-by-field; no eval; no shell execution

### 15.4 File Security

- R2 files not publicly accessible; accessed via server-side proxy or signed URLs
- MIME type validation on upload (PDF and CSV only for their respective endpoints)
- 10 MB file size limit

---

## 16. API Design Conventions

- REST conventions; `GET`, `POST`, `PATCH`, `DELETE`
- All API routes prefixed `/api/`
- Guildlight Leave routes: `/api/cases`, `/api/ada/cases`, `/api/employees`, `/api/admin/*`, `/api/org/*`
- Guildlight Grow routes: `/api/piq/*` and `/api/performiq/*`
- Super admin routes: `/api/superadmin/*`
- Public portal routes: `/api/portal/*` (token-authenticated)
- Error responses: `{ error: "Human-readable message" }` with appropriate HTTP status
- Success responses: `{ [resourceName]: data }` or `{ message: "..." }`
- Pagination: `page` query param; `limit` hardcoded per endpoint (100–200 typical)
- Dates: ISO 8601 strings; stored as `timestamp with time zone` in PostgreSQL

---

## 17. Version Roadmap

### v1.0 — Current

All "Built" items from Section 5. Core Guildlight Leave and Guildlight Grow workflows functional end-to-end. AI assistants (Ave, Ada, PIQ Agent) operational. Employee portal live. Super admin panel operational.

### v1.1 — Delivered

- Employee data management overhaul: unified employee page, super admin upload, import log, CSV error report
- HRIS configuration moved to super admin
- Mobile navigation (hamburger menu)
- ADA case email on creation
- ADA messaging 404 fix (support ADA case IDs in caseMessages handler)
- Employee portal simplified (no public lookup endpoint)
- Guildlight Grow e-signature workflow

### v1.2 — Delivered

- Run analysis auto-pull employee data in AnalyzeCaseModal
- Disability pay replacement info in Ave notices (state programs section)
- ADA physician cert as PDF with autofill + portal return instructions
- Med cert timing fix (not in case docs until sent to employee)
- Claim case for ADA accommodation cases
- Unified login across Guildlight Leave and Guildlight Grow (single `leavara_token`)
- Rebrand to Guildlight Leave / Guildlight Grow; browser routes moved to `/leave/*` and `/grow/*`

### v2.0 — Future

- SSO / SAML integration
- Automated HRIS sync (scheduled pull vs manual trigger)
- Reporting and analytics dashboard (leave utilization, case volume trends, time-to-close)
- Multi-product dashboard (single login for Guildlight Leave + Guildlight Grow)
- Custom notice templates per organization
- API access for enterprise integrations
- White-label / branded portal per organization
- SOC 2 Type II certification path
- Mobile app (React Native) for employee portal
- Expanded state leave law coverage (AK, IL, MN, ME in progress)

---

## 18. Open Questions

1. **HIPAA compliance path:** At what employee count / ACV threshold does a BAA become necessary? Should medical certification content be encrypted at the application layer before DB write?

2. **Multi-product auth:** ~~Guildlight Leave and Guildlight Grow currently have separate user tables and JWT flows. Should v1.2 unify them into a single login with product-level permission flags?~~ **Resolved (v1.2):** Unified into a single login with a single `leavara_token`; access governed by org product flags and `UnifiedRole`. `piq_users` retained for reference only.

3. **HRIS sync schedule:** Once HRIS config moves to super admin, should HR admins be able to trigger manual syncs from the employee page, or super admin only?

4. **Import log retention:** How long should employee import logs be retained? 12 months? Indefinitely?

5. **ADA interactive process:** Does the Ada assistant need to explicitly guide HR through the interactive process timeline (e.g., deadline tracking for good-faith interactive process obligations)?

6. **Guildlight Grow e-signature legal validity:** Does the typed-name / canvas signature satisfy e-sign requirements (ESIGN Act / UETA)? Should we add explicit consent capture language?

7. **Intermittent leave tracking:** Guildlight Leave tracks intermittent leave hours per case. Should there be a reporting view that shows running totals against approved hours?

8. **Notification center:** Should there be an in-app notification system (bell icon) for case updates, upcoming deadlines, and certification overdue alerts?

---

## Appendix A — Color Palette and Design System

### Guildlight Brand Palette

Five core brand colors. "The beacon that guides the guild."

```
Midnight Navy:   #1B2430   (primary text, dark surfaces, foreground)
Antique Brass:   #C39A4A   (primary accent — sidebar, buttons, links)
Warm Ivory:      #F4F1EA   (page background)
Slate:           #5A6470   (secondary/muted text, captions)
Sage:            #7C9273   (Guildlight Leave product accent)
```

Accessibility note: Antique Brass is an accent, not a body-text color on light
backgrounds. Use Midnight Navy or Slate for body copy. Primary buttons use Navy
text on Brass (contrast ≈ 5.7:1, WCAG AA).

### Guildlight Leave — Brand Colors

```
brass:        #C39A4A   (primary sidebar, buttons, accents)
brassDk:      #9C7A35   (hover states, active)
slateWarm:    #B39A6A   (secondary text, borders)
slateDeep:    #6E5A2E   (dark text on light backgrounds)
sageAccent:   #D9B87A   (soft accent, avatar gradients)
sageAccentDk: #B58A48   (accent hover)
bgWarm:       #F4F1EA   (page background — Warm Ivory)
bgCard:       #FAF8F3   (card backgrounds)
textDark:     #1B2430   (primary body text — Midnight Navy)
textBody:     #2E3742   (secondary body text)
textMuted:    #5A6470   (placeholder, caption text — Slate)
textOnDark:   #F4F1EA   (text on dark/brass backgrounds)
```

### Guildlight Grow — Accent Colors

```
perf:         #7C9273   (primary — Sage)
perfLight:    #A3B89B   (sage hover)
perfDark:     #54684B   (sage active)
perfBg:       #ECF0E9   (sage light background)
```

### Typography

- Display font: **Plus Jakarta Sans** (headings, weights 600–800)
- Body font: **Inter** (body, weights 400/500/600/700)
- Loaded via Google Fonts in `index.html`
- Heading weights: 600–700
- Body: 400 (regular), 500 (medium emphasis)

---

## Appendix B — Environment Variables

### API Server (`artifacts/api-server/.env`)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing unified platform JWTs (Guildlight Leave + Guildlight Grow) |
| `PIQ_JWT_SECRET` | Deprecated — no longer used after the unified-auth migration; safe to remove |
| `RESEND_API_KEY` | Resend email service API key |
| `RESEND_FROM_EMAIL` | Sender address for all transactional emails |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude (Ave, Ada, PIQ agent) |
| `R2_ACCOUNT_ID` | Cloudflare R2 account ID |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |
| `R2_BUCKET_NAME` | R2 bucket name |
| `HRIS_ENCRYPTION_KEY` | AES-256 key for HRIS credential encryption |
| `PORT` | Express server port (default 3001) |

### Frontend (`artifacts/leaveiq/.env`)

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | Base URL of API server |

---

## Appendix C — CSV Import Specifications

### Employee CSV Template

Required columns: `employee_name`

Recommended columns:

| Column | Format | Notes |
|--------|--------|-------|
| `employee_name` | Text | Full name, required |
| `employee_id` | Text/Number | HR identifier; used as upsert key |
| `position` | Text | Job title |
| `location` | Text | Office or work location |
| `department` | Text | Department name |
| `manager_name` | Text | Must match another row's `employee_name` for hierarchy |
| `start_date` | YYYY-MM-DD | ISO date format preferred |
| `avg_hours_worked` | Number | Weekly average hours |
| `work_email` | Email | Corporate email address |
| `personal_email` | Email | Personal email (used for portal communications) |

**Upsert behavior:**
- If `employee_id` is present, upsert by `(organization_id, employee_id)`
- If no `employee_id`, upsert by `(organization_id, full_name)`
- Manager hierarchy resolved in second pass; unresolved managers logged as warnings (not errors)

**Error types that generate CSV error report:**
- Missing required field (`employee_name`)
- Invalid date format for `start_date`
- Invalid email format
- Duplicate `employee_id` within same upload file

---

## Appendix D — Changelog

> This section records significant PRD updates. Each entry notes the date, version, and what changed.

| Date | Version | Change |
|------|---------|--------|
| 2026-05-21 | 1.0 | Initial PRD created; covers Guildlight Leave v1, Guildlight Grow v1, planned v1.1–v2.0 features, data model, AI architecture, deployment, security |
| 2026-05-21 | 1.1 | Employee management overhaul: unified `/leaveiq/employees` page (Guildlight Leave palette, shared by both products); batch CSV upload (fixes 1789-row timeout); `employee_import_log` table; CSV error report; HRIS configuration moved to Super Admin panel; HRIS removed from HR Admin nav |
| 2026-06-09 | 1.2 | **Feature-status correction:** Guildlight Grow e-signature workflow marked [Built] (was incorrectly [Planned]) — covers signature request, public signing page, employee sign/decline, manager counter-sign, and signed-PDF download; corrected e-signature API paths to `/api/performiq/cases/:caseId/signatures/*` plus public `/api/piq/sign`. Marked [Built]: ADA acknowledgment email on creation, batch CSV insert, import log + error report, HRIS config under Super Admin, mobile hamburger nav, AnalyzeCaseModal auto-pull. **Unified auth:** documented single login / single `leavara_token` across both products; `piq_users` retained for reference; `PIQ_JWT_SECRET` deprecated. **Rebrand:** Leavara/LeaveIQ → Guildlight Leave, PerformIQ → Guildlight Grow; browser routes moved to `/leave/*` and `/grow/*` (API paths `/api/piq/*` and `/api/performiq/*` unchanged). Updated `piq_signatures` and `employee_import_log` data-model entries; roadmap v1.1/v1.2 marked Delivered. |

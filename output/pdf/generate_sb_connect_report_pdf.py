from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
)


OUTPUT = "output/pdf/sb-connect-web-application-report.pdf"


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="CoverKicker",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=9,
    leading=12,
    textColor=colors.HexColor("#dfe6ff"),
    alignment=TA_CENTER,
    spaceAfter=10,
))
styles.add(ParagraphStyle(
    name="CoverTitle",
    parent=styles["Title"],
    fontName="Helvetica-Bold",
    fontSize=34,
    leading=38,
    textColor=colors.white,
    alignment=TA_CENTER,
    spaceAfter=14,
))
styles.add(ParagraphStyle(
    name="CoverSub",
    parent=styles["Normal"],
    fontSize=12,
    leading=18,
    textColor=colors.HexColor("#eef2ff"),
    alignment=TA_CENTER,
))
styles.add(ParagraphStyle(
    name="H1Custom",
    parent=styles["Heading1"],
    fontName="Helvetica-Bold",
    fontSize=18,
    leading=22,
    textColor=colors.HexColor("#172033"),
    spaceBefore=8,
    spaceAfter=10,
))
styles.add(ParagraphStyle(
    name="H2Custom",
    parent=styles["Heading2"],
    fontName="Helvetica-Bold",
    fontSize=13,
    leading=17,
    textColor=colors.HexColor("#172033"),
    spaceBefore=6,
    spaceAfter=6,
))
styles.add(ParagraphStyle(
    name="BodyCustom",
    parent=styles["BodyText"],
    fontSize=9.5,
    leading=14,
    textColor=colors.HexColor("#485366"),
    spaceAfter=7,
))
styles.add(ParagraphStyle(
    name="Lead",
    parent=styles["BodyText"],
    fontSize=11.5,
    leading=17,
    textColor=colors.HexColor("#172033"),
    spaceAfter=10,
))
styles.add(ParagraphStyle(
    name="Small",
    parent=styles["BodyText"],
    fontSize=8,
    leading=11,
    textColor=colors.HexColor("#647084"),
))
styles.add(ParagraphStyle(
    name="TableHead",
    parent=styles["BodyText"],
    fontName="Helvetica-Bold",
    fontSize=7.5,
    leading=9,
    textColor=colors.HexColor("#172033"),
))
styles.add(ParagraphStyle(
    name="TableCell",
    parent=styles["BodyText"],
    fontSize=7.5,
    leading=10,
    textColor=colors.HexColor("#485366"),
))


def P(text, style="BodyCustom"):
    return Paragraph(text, styles[style])


def bullet(items):
    return [P(f"- {item}", "BodyCustom") for item in items]


def section(title):
    return [Spacer(1, 8), P(title, "H1Custom")]


def styled_table(data, widths, header=True):
    rows = []
    for r_i, row in enumerate(data):
        style = "TableHead" if header and r_i == 0 else "TableCell"
        rows.append([P(str(cell), style) for cell in row])
    table = Table(rows, colWidths=widths, repeatRows=1 if header else 0)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef2ff") if header else colors.white),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#dfe5ef")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return table


def card(title, body, color="#2f3fb8"):
    t = Table([[P(title, "H2Custom")], [P(body, "BodyCustom")]], colWidths=[2.25 * inch])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#dfe5ef")),
        ("LINEABOVE", (0, 0), (-1, 0), 4, colors.HexColor(color)),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


def cover(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(colors.HexColor("#2f3fb8"))
    canvas.rect(0, 0, A4[0], A4[1], stroke=0, fill=1)
    canvas.setFillColor(colors.HexColor("#b536c5"))
    canvas.circle(A4[0] * 0.84, A4[1] * 0.22, 180, stroke=0, fill=1)
    canvas.setFillColor(colors.HexColor("#24359a"))
    canvas.circle(A4[0] * 0.10, A4[1] * 0.88, 150, stroke=0, fill=1)
    canvas.restoreState()


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#dfe5ef"))
    canvas.line(0.62 * inch, 0.48 * inch, A4[0] - 0.62 * inch, 0.48 * inch)
    canvas.setFillColor(colors.HexColor("#647084"))
    canvas.setFont("Helvetica", 7)
    canvas.drawString(0.62 * inch, 0.32 * inch, "SB Connect Web Application Report")
    canvas.drawRightString(A4[0] - 0.62 * inch, 0.32 * inch, f"Page {doc.page}")
    canvas.restoreState()


story = []

cover_box = Table(
    [
        [P("APPLICATION ANALYSIS DOCUMENT", "CoverKicker")],
        [P("SB Connect Web Application", "CoverTitle")],
        [P("A business community platform for member profiles, opportunity requests, deal tracking, meetings, attendance, RSVP, admin operations, and future membership payments.", "CoverSub")],
    ],
    colWidths=[6.1 * inch],
)
cover_box.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
]))
story.append(Spacer(1, 2.0 * inch))
story.append(cover_box)
story.append(Spacer(1, 0.7 * inch))
meta = styled_table([
    ["Prepared on", "Stack", "Primary users", "Theme"],
    ["July 9, 2026", "React + Firebase", "Members, Admins", "No Politics Only Business"],
], [1.35 * inch, 1.35 * inch, 1.6 * inch, 1.55 * inch])
meta.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#eef2ff")),
    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#dfe5ef")),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 7),
    ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ("TOPPADDING", (0, 0), (-1, -1), 6),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
]))
story.append(meta)
story.append(PageBreak())

story += section("Executive Summary")
story.append(P("SB Connect is a member-only business networking web application. It helps business owners create profiles, discover other members, post requirements, express interest in opportunities, record business value, manage meetings, mark attendance through QR links, and let administrators verify members and monitor community activity.", "Lead"))
story.append(Table([[
    card("13 routed screens", "Dashboard, directory, profile, requests, attendance, admin, auth, payments, and support screens.", "#2f3fb8"),
    card("9 Firestore domains", "Users, profiles, requests, interests, deals, conversations, meetings, attendance, notifications.", "#16865a"),
], [
    card("3 role levels", "user, admin, and super_admin are represented in the type system and admin logic.", "#c9912e"),
    card("30-day chat cleanup", "Messages are deleted by a client-side cleanup routine when a conversation opens.", "#c3413f"),
]], colWidths=[2.75 * inch, 2.75 * inch], hAlign="LEFT"))

story += section("What This Web Application Is About")
story.append(P("SB Connect is designed for a structured business community or membership organization. It is an operational member portal rather than a public marketing site. After sign-in, the dashboard becomes the main workspace for membership status, requests, directory access, meeting updates, attendance reminders, deal recording, and leaderboard visibility."))
story.append(P("The product promise is simple: make member businesses easier to find, make business opportunities easier to share, and make community participation measurable."))

story += section("Major Features")
features = [
    ["Feature area", "What is implemented", "Business use"],
    ["Authentication", "Email/password registration, email or phone login, password reset, login logging, online/offline status updates.", "Controls member access and supports convenient phone lookup login without SMS cost."],
    ["Business profiles", "Profile creation, completion score, owner/company/contact details, category selection, keywords, photo upload, catalog upload, QR profile link, verification badge, membership status and expiry.", "Creates a searchable business identity for every member."],
    ["Directory", "Search by company name, category, keyword, and location. Cards show membership and verification status.", "Helps members discover suppliers, partners, and service providers."],
    ["Requests", "Categorized requests with title, description, budget, deadline, custom category, status, interest count, delete and close controls.", "Lets members publish requirements and receive pitches."],
    ["Interest and deals", "Members express interest with message and phone contact. Owners/admins can award contracts and close requests. Deals feed value tracking.", "Turns opportunities into measurable outcomes."],
    ["Dashboard", "Membership status, directory count, request metrics, quick actions, profile summary, leaderboard, meeting updates, RSVP, strike warning.", "Gives members a compact operating home screen."],
    ["Chat", "One-to-one realtime conversations, unread counts, read status, auto-scroll, and 30-day cleanup.", "Supports direct member follow-up."],
    ["Meetings and attendance", "Admin-created meetings, RSVP, QR attendance URL, scan endpoint, duplicate prevention, attendance history, six-month compliance check.", "Tracks participation and recurring meeting operations."],
    ["Admin panel", "Profile approvals, CSV exports, meetings, attendance, RSVPs, notifications, request management, deal awarding, login logs, roles, audit and health checks.", "Centralizes membership governance."],
    ["Payments", "Payments screen exists with Razorpay marked as coming soon.", "Future membership fee and renewal workflow."],
]
story.append(styled_table(features, [1.15 * inch, 3.0 * inch, 1.55 * inch]))

story += section("Primary User Workflows")
story.append(P("Member onboarding", "H2Custom"))
story += bullet([
    "Register using name, phone, email, and password.",
    "Sign in with either email or registered phone number.",
    "Create a business profile with business details, categories, keywords, photo, catalog, and contact information.",
    "Wait for admin verification while the profile shows pending status.",
    "Use the portal to browse members, post requests, RSVP, attend meetings, chat, and record deals.",
])
story.append(P("Opportunity workflow", "H2Custom"))
story += bullet([
    "A member creates a requirement with category, budget, and deadline.",
    "Other members browse and filter requests.",
    "Interested members send a pitch and contact number.",
    "The owner or admin awards a contract and the request closes.",
    "The deal record contributes to business value and leaderboard reporting.",
])

story += section("Controls Implemented")
controls = [
    ["Control type", "Examples found in the app"],
    ["Inputs", "Text, phone, email, password, number, date, search, and hidden file inputs."],
    ["Text areas", "Company description, request description, interest message."],
    ["Selection controls", "Dropdowns for business size, membership status, deal receiver, award receiver. Category buttons and filter pills."],
    ["Action controls", "Primary, outline, danger, ghost, icon-style, and loading buttons."],
    ["Navigation", "Responsive sidebar, mobile sidebar, bottom nav, clickable stat cards, profile cards, request cards, chat list rows."],
    ["Feedback controls", "Badges, skeleton loading states, inline validation errors, success messages, unread counters, confirmation dialogs."],
    ["Admin controls", "Collapsible sections, CSV export, meeting creation/deletion, verification approval, role assignment, health check, audit download."],
    ["QR and media", "QR codes for profile and attendance links, image upload, catalog upload with file type and size validation."],
]
story.append(styled_table(controls, [1.55 * inch, 4.25 * inch]))

story += section("Technical Architecture")
arch = [
    ["Layer", "Implementation", "Notes"],
    ["Frontend", "React 19, Vite 8, TypeScript, React Router 7.", "Route-based SPA with public auth routes and protected app layout."],
    ["Styling", "Tailwind CSS v4, shared UI components, Framer Motion helpers.", "Responsive operational UI with cards, badges, skeletons, and motion."],
    ["Data", "Firestore helper layer plus TanStack React Query hooks.", "CRUD, transactions, and realtime snapshots are mixed depending on page."],
    ["Realtime", "Firestore onSnapshot for chat, messages, meetings, notifications.", "Good fit for live updates and messaging."],
    ["Auth", "Firebase Auth plus Firestore user records.", "Phone login resolves phone to email through Firestore."],
    ["Storage", "Firebase Storage for photos and catalogs.", "Client validates file size and type before upload."],
    ["Admin security", "AdminGuard plus requireAdmin checks in helper functions.", "Firebase rules must enforce the same permissions in production."],
    ["Observability", "ErrorBoundary, tracked errors, health check, audit report, login logs.", "Good foundation for operations and troubleshooting."],
]
story.append(styled_table(arch, [1.15 * inch, 2.35 * inch, 2.2 * inch]))

story += section("How The Application Can Be Used")
story.append(Table([[
    card("For members", "Create a profile, find businesses, post needs, respond to opportunities, chat directly, RSVP for meetings, mark attendance, and record business given.", "#2f3fb8"),
    card("For admins", "Approve profiles, manage meetings, review attendance and RSVPs, send notifications, manage requests, assign roles, export data, and run audit or health reports.", "#16865a"),
], [
    card("For leadership", "Measure total business value, identify active contributors, monitor attendance compliance, and prepare membership operations for payment integration.", "#c9912e"),
    card("For future finance workflows", "Use the Payments area for Razorpay order creation, webhook verification, renewals, invoices, and payment reconciliation.", "#b536c5"),
]], colWidths=[2.75 * inch, 2.75 * inch], hAlign="LEFT"))

story += section("Security And Governance Observations")
story.append(P("The app has meaningful client-side role checks and helper-level admin checks. Production safety still depends on Firestore and Storage rules. Admin operations, profile edits, request deletion, attendance writes, and file uploads should be protected in Firebase rules and ideally validated through backend functions.", "Lead"))
story.append(P("Strengths", "H2Custom"))
story += bullet([
    "Role model includes user, admin, and super_admin.",
    "AdminGuard protects the admin route.",
    "Sensitive Firestore helper functions call requireAdmin.",
    "Duplicate pitch and duplicate attendance prevention exist.",
    "File type and size validation exist before upload.",
])
story.append(P("Risks to verify", "H2Custom"))
story += bullet([
    "Client-side admin access code could be abused if rules allow role self-updates.",
    "Attendance marking should verify valid meeting IDs and active state in rules or Cloud Functions.",
    "Deal amounts should be normalized as numeric values, not stored as free-form strings only.",
    "Chat cleanup depends on client activity rather than scheduled backend cleanup.",
])

story += section("Suggestions And Improvements")
recommendations = [
    ("Move sensitive workflows to Cloud Functions", "Admin role changes, attendance scan validation, deal awarding, membership renewal, and payment confirmation should be server-side functions with strict authorization."),
    ("Complete Razorpay membership payments", "Add payment order creation, webhook verification, invoice storage, automatic membership expiry updates, and admin payment reconciliation."),
    ("Normalize money and dates", "Store deal amounts as numeric INR units or paise, use server timestamps, and keep formatting separate from data storage."),
    ("Strengthen attendance compliance", "Bind QR links to active meetings, prevent stale QR usage, optionally add geolocation or admin scan mode, and calculate compliance with scheduled backend jobs."),
    ("Add admin analytics", "Add charts for members, verification backlog, attendance trends, RSVP conversion, request closure rates, deal value, and inactive members."),
    ("Improve messaging readiness", "Store participant names/photos when conversations are created, add backend retention cleanup, reporting, and optional push/email notifications."),
    ("Add test coverage", "Prioritize tests around auth redirects, profile creation, request pitching, duplicate prevention, admin permissions, attendance scan behavior, and membership expiry."),
]
for title, body in recommendations:
    story.append(KeepTogether([P(title, "H2Custom"), P(body, "BodyCustom")]))

story += section("Conclusion")
story.append(P("SB Connect is already a practical MVP for a business membership network. Its strongest areas are member directory, request marketplace, meeting attendance, profile governance, and admin operations. The next major product step should be turning admin-critical and money-related actions into server-validated workflows, then completing payments and analytics.", "Lead"))


doc = SimpleDocTemplate(
    OUTPUT,
    pagesize=A4,
    rightMargin=0.62 * inch,
    leftMargin=0.62 * inch,
    topMargin=0.62 * inch,
    bottomMargin=0.62 * inch,
    title="SB Connect Web Application Report",
    author="Codex",
)
doc.build(story, onFirstPage=cover, onLaterPages=footer)
print(OUTPUT)

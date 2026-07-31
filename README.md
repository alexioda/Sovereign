Sovereign Command Center

High-Performance State Architecture by LiveAdaptiv

The Sovereign Command Center is a lightweight, mobile-first web app designed for elite professionals navigating high-acuity environments. It serves as the digital companion to the Alchemist's Deck and the Sovereign Architecture methodology.

🏛️ Project Philosophy

In the world of high-performance leadership (EY, RPC, Clinical Settings), "Stress Management" is a failure state. We focus on Stress Alchemy—the process of using biological friction as fuel for logical output. This app provides the hardware-level resets and software-level auditing required to maintain an "Architect State."

🛠️ Technical Stack

Architecture: Static frontend (public/index.html) plus two Vercel serverless functions — api/generate-decree.js (Gemini-powered decree generation) and api/capture-lead.js (email delivery via Resend). Not a single-file app and not currently an installable PWA (no manifest or service worker).

Styling: Tailwind CSS (Utility-first design)

Icons: Lucide (Vector-based UI elements)

Typeface: Cormorant Garamond (Identity) & DM Sans (Utility)

Persistence: Session state (timer, friction log) is client-side localStorage only. Anything you submit through "Seal" or the email capture form — your reflections and, if provided, your email address — is sent to our servers to generate your decree and, optionally, email it to you. See Privacy below.

Design System: Stone, Silver, and Gold (Refined Albedo Palette)

🚀 Deployment via Vercel

This project is optimized for a one-click deployment to Vercel:

Repository Setup: - Ensure the main file is named index.html.

Initialize your GitHub repository.

Vercel Connection:

Link your GitHub account to Vercel.

Select the sovereign-app repository.

Click Deploy.

Environment variables required: GEMINI_API_KEY (decree generation), RESEND_API_KEY and NOTIFY_EMAIL (lead capture/email delivery).

🔐 Privacy

Timer state and your local friction log stay in your browser's localStorage and are never sent anywhere. When you seal a journal entry, the text you wrote (and your friction level) is sent to Google Gemini to generate your decree. If you choose to have your decree emailed to you, your email address and decree are sent to Resend to deliver it, and a copy is sent to LiveAdaptiv. See https://liveadaptiv.com/privacy.html for the full policy.

⚖️ Legal

© 2026 LiveAdaptiv. All Rights Reserved.
Methodology by Alex Ioda.

For high-ticket performance cohorts and the Architect's Manual, visit LiveAdaptiv.com.

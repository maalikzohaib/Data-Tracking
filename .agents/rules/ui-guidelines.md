# UI Style Guidelines

## 1. No White Borders / Outlines
- **NEVER** add white borders, border outlines, or harsh divider lines (`border`, `border-border`, `ring-*`, `border-white*`) to UI elements, cards, analysis boxes, pills, or containers.
- The UI uses a sleek, borderless dark theme. Use flat panels (`bg-panel`, `bg-panel2`) and subtle background fills/tints (e.g. `bg-aloe/15` for active/selected items) instead of borders.

## 2. Business Return Ratio Banner Location
- The **"All Orders Business RTO Ratio"** overview banner belongs **strictly inside the RTO Calculation section** (`tab === "rto"`).
- Do **NOT** show this RTO banner on Active, Courier, Attempt, Delivered, or Cancelled tabs. Those sections must display their own specific operational metrics.

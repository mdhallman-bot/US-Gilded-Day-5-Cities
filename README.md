# Gilded Age Day 5 — Lucia’s Diary

Grade 10 lesson: immigration, cities, and political machines. Ten student pages designed for about 100 minutes of independent work: 28 response boxes, six Dear Diary entries, source images, two cartoons, hover vocabulary, sentence frames, and seated analysis. No partner or teacher-led display is required.

## Hosting

Enable **Settings → Pages → Deploy from a branch → main → /(root)**. Open the HTTPS Pages URL; downloading index.html alone will omit images and cloud.js.

## Backend activation

The deployed URL is configured in cloud.js. Before classroom use:

1. Use the corrected Code.gs in this repository to replace the Apps Script code.
2. Run `setupDay5` once and authorize it. The execution log gives the private spreadsheet URL. Reruns reuse the existing spreadsheet.
3. Deploy → Manage deployments → Edit → New version → Deploy, preserving the current /exec URL. Execute as Me; access Anyone.
4. Open the lesson, choose a test alias, type a response, and click Save online. Wait for **Saved online**. Reload and confirm the response returns. Test a second browser using the alias and private resume code.

Live save and server restore were verified on November 1, 2026 using the anonymous alias `audit-nov1-01`. A test row with that alias remains in the spreadsheet. Browser saving, recovery downloads, Print/PDF, and Save answered HTML are available. The answered HTML is a read-only, self-contained submission with responses, embedded images, and completion percentage; it excludes the private resume code.

## Student saving

An alias and random private resume code identify one response record. There is no class-wide shared secret. Keep the response spreadsheet private. Students need their alias and resume code (or recovery download) to resume on another device. Save status only reports online success after a matching server acknowledgement. Conflicting copies require an explicit choice. Browser data is not discarded on network failure.

## Files

- index.html: lesson
- cloud.js: save/resume integration
- assets/: bundled images
- Code.gs: Apps Script backend, including setup instructions

## Validation

Audited November 1, 2026: lesson startup/navigation; ten student pages; image loading; cartoon detail zoom; vocabulary and sentence-frame markup; live save acknowledgement and server restore; downloaded answered HTML checked for response text, 28 response blocks, completion summary, seven embedded images, and absence of scripts/private resume code. Backend and client save/retry/conflict behavior also passed local tests. PDF completion metadata was checked in the implementation; native print-to-PDF output was not generated in this audit.

Completion is the percentage of 28 response boxes containing text (including the ungraded opener); it is not a correctness score. Example: 1/28 = 4%.

Historical clarification: Lucia is born in 1885 and arrives in April 1901, after the reopened Ellis Island station began operating. Her diary now continues through October 1901. The Barge Office detour is removed. The modern aerial image remains labeled as a later geographic view.

## Independent-work revision

- AI-generated Spotify band warm-up; one initial written judgment, then optional deeper reflection.
- Lucia portrait edited with the built-in image tool to resemble a sepia period photograph; caption still identifies it as AI-generated fiction.
- Four numbered Ellis Island annotations with hover, focus, tap, and a full text/print alternative.
- Added nativism and arrival-perspective questions, education/work trade-offs, community resources, sanitation, personal priorities, family agency, and public-service questions.
- Each cartoon has additional detail-to-argument accountability and a shared comparison.
- Broader final synthesis weighs education, sanitation, housing, work and machine power.
- Existing response IDs are preserved. Empty new fields are normalized during save comparison so older work can resume without a false schema conflict.
- Backend still accepts up to 60 answers and ten pages; no Apps Script redeployment is required.

# Gilded Age Day 5 — Lucia’s Diary

Grade 10 lesson: immigration, cities, and political machines. Ten student pages with diary entries, source images, two cartoons, hover vocabulary, sentence frames, and seated analysis.

## Hosting

Enable **Settings → Pages → Deploy from a branch → main → /(root)**. Open the HTTPS Pages URL; downloading index.html alone will omit images and cloud.js.

## Backend activation

The deployed URL is configured in cloud.js. Before classroom use:

1. Use the corrected Code.gs in this repository to replace the Apps Script code.
2. Run `setupDay5` once and authorize it. The execution log gives the private spreadsheet URL. Reruns reuse the existing spreadsheet.
3. Deploy → Manage deployments → Edit → New version → Deploy, preserving the current /exec URL. Execute as Me; access Anyone.
4. Open the lesson, choose a test alias, type a response, and click Save online. Wait for **Saved online**. Reload and confirm the response returns. Test a second browser using the alias and private resume code.

The initial deployment was reachable, but live probing reported that setupDay5 had not run. The corrected script uses window.top.postMessage because Google embeds HTML responses in an extra frame. Until the script is updated and initialized, online saving cannot be confirmed. Browser saving, recovery downloads, and Print/PDF remain available.

## Student saving

An alias and random private resume code identify one response record. There is no class-wide shared secret. Keep the response spreadsheet private. Students need their alias and resume code (or recovery download) to resume on another device. Save status only reports online success after a matching server acknowledgement. Conflicting copies require an explicit choice. Browser data is not discarded on network failure.

## Files

- index.html: lesson
- cloud.js: save/resume integration
- assets/: bundled images
- Code.gs: Apps Script backend, including setup instructions

## Validation

JavaScript syntax checked; backend save/load, retry, conflict, validation and key isolation tested with mocks. Live GET health check passed. Live load returned the missing-setup message. Complete live save/resume verification after the activation steps above.

## 2026-05-31: Asynchronous GitHub PR Mergeability Resolution

* **Title**: GitHub PR Async Mergeability Resolution & Throttling
* **Vulnerability / Issue**: GitHub calculates PR `mergeable` status out-of-band. Querying `POST /update-branch` on a PR before the boolean resolves can trigger undefined behavior or push conflicting commits. Unchecked rapid polling triggers secondary abuse limits.
* **Learning**: When fetching PRs via the GitHub API, the `mergeable` field might return `None` initially. Polling logic must implement retry loops (e.g., max 3 attempts) and micro-delays (e.g., 0.2s) between network requests to allow GitHub backend computation while preventing rate-limiting.
* **Prevention**: Always evaluate `pr_data.get('mergeable')` before executing branch update routines. Implement bounded backoff logic.

## 2024-05-31 - [DOM-based HTML Escaping XSS Vulnerability]
**Vulnerability:** The `escHtml()` function used `textContent` and `innerHTML` for escaping.
**Learning:** This DOM-based method fails to escape single and double quotes, leaving attributes (e.g., `href="${escHtml(...)}"`) vulnerable to XSS attacks.
**Prevention:** Always use explicit regex-based string replacements for `<`, `>`, `&`, `'`, and `"` when implementing HTML escaping functions.

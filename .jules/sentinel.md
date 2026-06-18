## 2024-05-25 - Fix XSS Vulnerability in escHtml
**Vulnerability:** XSS vulnerability found in `frontend/app.js`'s `escHtml` function. It used `document.createElement('div').textContent = s; return d.innerHTML;` which does not escape single or double quotes, making it unsafe for use within HTML attributes like `<a href="${escHtml(...)}">`.
**Learning:** Browser-based textContent escaping is insufficient for rendering variables into HTML attributes. It only escapes characters like `<` and `&` but not quotes, which are crucial for breaking out of attribute contexts.
**Prevention:** Always use a robust HTML escaping utility that explicitly replaces `&`, `<`, `>`, `"`, and `'` with their corresponding HTML entities when dynamically building HTML strings.
## 2026-05-31: Asynchronous GitHub PR Mergeability Resolution

* **Title**: GitHub PR Async Mergeability Resolution & Throttling
* **Vulnerability / Issue**: GitHub calculates PR `mergeable` status out-of-band. Querying `POST /update-branch` on a PR before the boolean resolves can trigger undefined behavior or push conflicting commits. Unchecked rapid polling triggers secondary abuse limits.
* **Learning**: When fetching PRs via the GitHub API, the `mergeable` field might return `None` initially. Polling logic must implement retry loops (e.g., max 3 attempts) and micro-delays (e.g., 0.2s) between network requests to allow GitHub backend computation while preventing rate-limiting.
* **Prevention**: Always evaluate `pr_data.get('mergeable')` before executing branch update routines. Implement bounded backoff logic.

## 2025-02-27 - DOM-based HTML escaping is insufficient for attributes
**Vulnerability:** The `escHtml()` function in `frontend/app.js` used a DOM-based approach (`div.textContent = str; return div.innerHTML;`) to escape HTML. This approach escapes `<`, `>`, and `&`, but fails to escape single (`'`) and double (`"`) quotes. When used inside HTML attributes (e.g., `href="${escHtml(url)}"`), this allows attackers to break out of the attribute context and inject malicious scripts (Cross-Site Scripting, XSS).
**Learning:** Browsers do not escape quotes when reading `.innerHTML` because quotes are not strictly required to be escaped inside standard HTML text nodes. Relying on `.innerHTML` for general-purpose escaping is dangerous when the output might be interpolated into HTML attributes.
**Prevention:** Always use explicit string replacements (or a dedicated security library) for HTML escaping. A secure implementation must escape `&`, `<`, `>`, `"`, and `'` using regex, e.g., `.replace(/"/g, '&quot;')`.
## 2024-05-31 - [DOM-based HTML Escaping XSS Vulnerability]
**Vulnerability:** The `escHtml()` function used `textContent` and `innerHTML` for escaping.
**Learning:** This DOM-based method fails to escape single and double quotes, leaving attributes (e.g., `href="${escHtml(...)}"`) vulnerable to XSS attacks.
**Prevention:** Always use explicit regex-based string replacements for `<`, `>`, `&`, `'`, and `"` when implementing HTML escaping functions.
## 2024-06-02 - [Flask Webhook Signature Validation]
**Vulnerability:** Using `request.data` in Flask for webhook validation. If the payload is accessed via `request.get_json()` earlier in the request lifecycle, `request.data` may be empty, causing signature validation to fail.
**Learning:** `request.data` is a property that calls `request.get_data(parse_form_data=True)`. However, if form data has been parsed, or if JSON has been accessed, `request.data` will often return an empty string. `request.get_data()` accesses the raw stream and returns the exact bytes that were sent, which is crucial for verifying HMAC signatures.
**Prevention:** Always use `request.get_data()` when validating cryptographic signatures in Flask.
## 2026-06-08 - Reverse Tabnabbing Vulnerability
**Vulnerability:** Found multiple anchor tags using `target="_blank"` without `rel="noopener noreferrer"`. This exposes the application to reverse tabnabbing, where the newly opened tab can manipulate the window.opener object of the original page.
**Learning:** Modern browsers have started to implicitly set `noopener` on `target="_blank"` links, but it's not universally guaranteed across all browsers and versions, especially older ones. Explicitly adding `rel="noopener noreferrer"` remains a critical defense-in-depth practice.
**Prevention:** Always add `rel="noopener noreferrer"` when using `target="_blank"` for external links to ensure the new page runs in a separate process and cannot access `window.opener`.

## 2024-05-20 - [Path Traversal in Flask Fallback Route]
**Vulnerability:** A path traversal vulnerability existed in the fallback route of `backend/api_server.py`. The application attempted to prevent directory traversal manually by checking `if asset_path.startswith(frontend_root)`, which is flawed because it allowed access to sibling directories with the same prefix (e.g., `/app/frontend.secret` passes `.startswith('/app/frontend')`).
**Learning:** Manual path prefix validation using `.startswith()` is dangerous because it doesn't account for path separators, making sibling directory traversal possible.
**Prevention:** Always use Flask's native `send_from_directory()` function, which incorporates robust internal checks against directory traversal. Do not attempt to implement custom path traversal protections manually.
## 2024-06-12 - [Authorization Bypass / IDOR in Action Endpoints]
**Vulnerability:** The `action_rebase_contract` and `action_approve_merge_contract` endpoints in `backend/api_server.py` did not verify if the authenticated user possessed the necessary permissions for the requested repository before executing actions or returning payloads.
**Learning:** Relying solely on authentication (e.g., `@login_required`) is insufficient for endpoints interacting with resources (like repositories). Users must also be explicitly authorized (e.g., verifying their `permissions_level` against the target resource).
**Prevention:** Always implement an authorization gate querying the association table (e.g., `UserRepo`) to ensure the user has appropriate roles (like 'push', 'admin', 'owner') before processing sensitive requests.

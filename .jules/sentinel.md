## 2025-02-22 - Fix Cross-Site Scripting (XSS) via Attribute Injection
**Vulnerability:** The frontend used an insecure pattern for HTML escaping (`escHtml`) using DOM manipulation (`d.textContent = s; return d.innerHTML;`). This escaped `<`, `>`, and `&`, but failed to escape quotes (`'` and `"`).
**Learning:** Using `textContent` to encode strings for HTML only partially works. When the encoded string is placed inside an HTML attribute (like `<a href="...">`), an attacker can inject quotes and break out, causing XSS via attributes.
**Prevention:** Always use robust regex replacements to escape all 5 unsafe characters (`&`, `<`, `>`, `"`, `'`) when writing custom HTML escaping functions.

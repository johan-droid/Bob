## 2026-05-20 - Webhook Signature Payload Reading
**Vulnerability:** In Flask, `request.data` was used for computing the HMAC signature in `github_webhook()` to verify GitHub webhooks.
**Learning:** `request.data` is an empty string if Flask has already parsed the request payload or if the mimetype is handled (like application/json). This means the signature validation could fail or, worse, if `request.data` is empty, someone could forge an empty payload signature. `request.get_data()` must be used to guarantee retrieving the raw byte string.
**Prevention:** Always use `request.get_data()` when performing cryptographic signature validation on raw request payloads in Flask.

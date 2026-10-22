# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

Please report security issues via [GitHub private vulnerability reporting](https://github.com/ramach05/3D-WEB-Racing-Platform/security/advisories/new) — do not open a public issue. I aim to respond within a few days; this is a solo portfolio project, so fixes are best-effort rather than SLA-bound.

### In scope

- Authentication and session handling: access JWT, refresh-token rotation/revocation, cookie flags, CSRF protection on `/auth/*`.
- Injection or validation bypass through API inputs (DTOs, query params, leaderboard/registration payloads).
- Anything that lets a request read or modify another user's data.

### Out of scope

- Cheating by a logged-in user through their own client (race times, telemetry) — see Known limitations.
- Denial-of-service attacks and social engineering.
- Findings that require physical access to the machine or already-compromised credentials.

## Known limitations (accepted by design)

This is a portfolio-grade demo, not a production payment system. The security model is documented in [README — Auth & security](README.md#auth--security); these trade-offs are deliberate:

- JWT is signed with a single symmetric HS256 secret.
- Anti-cheat is a server-side floor (results under 8 s are rejected) plus client-side checkpoint-order validation; there is no server-authoritative lap simulation.
- Guest bests live in `localStorage` and are not trustworthy by design.

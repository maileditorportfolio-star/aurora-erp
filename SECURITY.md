# Security policy

## Supported versions

Security fixes land on the `main` branch and in the latest published tag.
Older tags are not maintained.

| Version | Supported |
| ------- | --------- |
| 1.0.x   | Yes       |
| < 1.0   | No        |

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub's
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
flow (**Security → Report a vulnerability** on the repository). Do not open a
public issue, pull request or discussion for a suspected vulnerability.

A useful report includes:

- the affected endpoint, component or dependency and its version;
- the steps needed to reproduce the issue;
- the impact you believe it has (for example, privilege escalation, data
  exposure, denial of service);
- any proof-of-concept request, payload or patch you are comfortable sharing.

## Scope

Areas worth testing include the JWT auth and refresh-token rotation flow,
the RBAC/`requirePermission` guards, tenant isolation, Zod validation at the
API and form boundaries, invoice double-entry journal posting, and the
Docker images. The seeded demo accounts (`admin@aurora.com` etc., password
`Admin@12345`) are development fixtures, not production credentials.

## Handling secrets

Do not include real credentials, tokens or customer data in a report. The API
refuses to start in production with short or identical `JWT_ACCESS_SECRET` /
`JWT_REFRESH_SECRET` values, and `.env` files are git-ignored; treat any
committed secret as a vulnerability and rotate it before reporting.

# Security Reviewer Prompt

Review the current diff for VeyoCast security risks.

Check:

- RLS enabled/default deny.
- Policies use USING and WITH CHECK.
- Cross-tenant writes blocked.
- Storage path spoofing blocked.
- Service-role not imported in client bundles.
- Server-side permissions exist.
- Player device access scoped.
- Secrets not committed.
- Audit events for critical actions.

Return:

- PASS/BLOCK
- findings by severity
- exact files/lines when possible
- required fixes

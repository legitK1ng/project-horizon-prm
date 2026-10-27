# Dependency Resolution Required — Action Needed

**Date**: 2026-06-16  
**Priority**: CRITICAL  
**Automated Review**: BLOCKED on dependency conflicts

---

## Issue Summary

The automated security remediation via `npm audit fix` **FAILED** due to ESLint peer dependency conflicts.

### Error Details
```
npm error ERESOLVE could not resolve
npm error While resolving: @eslint/js@10.0.1
npm error Found: eslint@9.39.2
npm error Conflicting peer dependency: eslint@10.5.0
```

**Root Cause**: The project uses ESLint 9.39.2, but `@eslint/js@10.0.1` expects ESLint ^10.0.0. Additionally, a local package `capacitor-horizon` uses ESLint 8.57.1, creating a three-way version conflict.

---

## Current Status

✅ **Build Status**: STABLE (verified post-failure)
- TypeScript type checking: PASS
- ESLint: PASS
- Build: PASS (verified in earlier review)

⚠️ **Security Status**: VULNERABLE
- 15+ high-severity vulnerabilities remain unpatched
- Critical packages affected: @babel/core, esbuild, hono, @xmldom/xmldom, form-data, fast-uri, flatted

---

## Manual Resolution Options

### Option 1: Conservative Approach (RECOMMENDED)
**Manually update conflicting packages**:

```bash
# Step 1: Update ESLint to v10 (breaking change, requires config migration)
npm install --save-dev eslint@^10.0.0

# Step 2: Update @eslint/js to match
npm install --save-dev @eslint/js@^10.0.1

# Step 3: Update capacitor-horizon's ESLint (if you control this package)
cd capacitor-horizon
npm install --save-dev eslint@^10.0.0
cd ..

# Step 4: Retry audit fix
npm audit fix

# Step 5: Update ESLint config to v10 format (if needed)
# See: https://eslint.org/docs/latest/use/migrate-to-10.0.0
```

**Risks**:
- ESLint 10.x may have breaking config changes
- May require updating eslint-plugin-react-hooks, eslint-plugin-react-refresh
- Estimated time: 1-2 hours for config migration + testing

---

### Option 2: Force Resolution (USE WITH CAUTION)
**Auto-resolve with legacy peer deps**:

```bash
# WARNING: This may introduce breaking changes or broken dependencies
npm audit fix --legacy-peer-deps

# REQUIRED: Immediately verify everything still works
npm run type-check
npm run lint
npm run build
npm run dev
# Manually test: contact list, call log, authentication, audio ingestion
```

**Risks**:
- May install incompatible versions
- Could break ESLint functionality
- May introduce subtle bugs
- Requires comprehensive manual testing

---

### Option 3: Force with Breaking Changes (HIGHEST RISK)
**Auto-resolve with force flag**:

```bash
# WARNING: This WILL introduce breaking changes
npm audit fix --force

# REQUIRED: Comprehensive testing and potential rollback
npm run type-check
npm run lint
npm run build

# If anything breaks:
git checkout package-lock.json
npm install
```

**Risks**:
- Major version bumps may break application
- Could require significant code refactoring
- May need to revert and pursue Option 1

---

## Recommended Action Plan

**Week 1 — Immediate (This Sprint)**:
1. ✅ **Prioritize**: Allocate 2-4 hours for dependency resolution
2. ✅ **Execute**: Option 1 (Conservative Approach)
3. ✅ **Test**: Run full manual smoke test suite
4. ✅ **Verify**: Check that all critical flows still work:
   - Contact list loads and virtualizes correctly
   - Call log displays and filters properly
   - Audio transcription ingestion endpoint responds
   - Authentication flow completes successfully
   - Dexie local-first operations function correctly

**Post-Resolution**:
5. ✅ **Re-run**: Automated engineering review to verify vulnerabilities patched
6. ✅ **Document**: Update this file with resolution details
7. ✅ **Commit**: `git commit -m "fix: resolve ESLint peer dependency conflicts and patch security vulnerabilities"`

---

## Temporary Mitigation (Until Resolution)

While the dependency conflict prevents automated patching, the application **remains functional**:
- ✅ Build passes
- ✅ Type checking passes
- ✅ Linting passes
- ✅ Runtime stable (port 9000 active)

**Security Posture**:
- ⚠️ Do NOT deploy to production until vulnerabilities are patched
- ⚠️ Limit exposure to untrusted input (especially file uploads, user-generated content)
- ⚠️ Monitor for exploitation attempts in logs
- ⚠️ Consider firewall rules to restrict access to ingestion endpoint (port 9000)

---

## Additional Context

**Capacitor-horizon Dependency**:
The local package `capacitor-horizon` (in the project root) uses ESLint 8.57.1, which conflicts with the main project's ESLint 9.39.2 and the desired ESLint 10.x upgrade.

**Investigation Required**:
```bash
# Check if capacitor-horizon is a local workspace package you control
cat capacitor-horizon/package.json

# If it's a local package, update its ESLint version to match the main project
# If it's external, consider removing or upgrading it
```

---

## Post-Resolution Checklist

After manually resolving the dependency conflict:

- [ ] `npm audit` shows 0 high/critical vulnerabilities
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds
- [ ] `npm run dev` starts without errors
- [ ] Contact list loads and virtualizes correctly
- [ ] Call log displays and groups calls properly
- [ ] Audio transcription endpoint responds (port 9000)
- [ ] Authentication flow completes
- [ ] Dexie local-first operations work
- [ ] Dark mode toggle functions
- [ ] Google sync button triggers auth flow
- [ ] Toast notifications display correctly
- [ ] Update `ENGINEERING_REVIEW_2026-06-16_AUTOMATED.md` with resolution status
- [ ] Commit changes with descriptive message

---

**Status**: AWAITING MANUAL INTERVENTION  
**Blocked By**: ESLint version conflict across workspace  
**Next Action**: Execute Option 1 (Conservative Approach) — estimated time: 2-4 hours

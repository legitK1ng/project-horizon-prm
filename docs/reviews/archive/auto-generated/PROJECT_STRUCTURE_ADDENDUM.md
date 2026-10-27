# Project Structure Addendum — 2026-06-19

## Additional Component Discovered

### Custom Capacitor Plugin

**Package**: capacitor-horizon  
**Location**: ./capacitor-horizon/  
**Type**: Native Capacitor plugin (iOS + Android)  
**Version**: 0.0.1 (development)

This is a **custom-built native plugin** for Capacitor, adding native mobile functionality beyond what standard Capacitor provides.

---

## Complete Project Structure

``
horizon/
+-- mcp-backend/              # FastAPI backend (19,573 LOC Python)
¦   +-- main.py
¦   +-- horizon_supervisor.py
¦   +-- routers/              # API endpoints
¦   +-- services/             # Business logic
¦   +-- core/                 # Config, auth, DB
¦   +-- requirements.txt
¦
+-- src/                      # React frontend (13,687 LOC TypeScript)
¦   +-- components/
¦   +-- services/
¦   +-- hooks/
¦   +-- index.css
¦
+-- capacitor-horizon/        # Custom native plugin (NEW)
¦   +-- android/src/          # Android native code (Java/Kotlin)
¦   +-- ios/Sources/          # iOS native code (Swift)
¦   +-- dist/                 # Built plugin
¦   +-- package.json
¦
+-- .venv/                    # Python virtual environment
+-- node_modules/             # Node dependencies
+-- package.json              # Main project deps
+-- capacitor.config.ts       # Capacitor configuration
+-- vite.config.ts            # Vite build config
+-- tailwind.config.js        # Tailwind CSS config
``

---

## Technology Stack (Updated)

### Backend (Python)
- FastAPI, Uvicorn
- Supabase SDK
- google-genai (Gemini 2.0)
- faster-whisper (STT)
- pyannote.audio (speaker diarization)

### Frontend (TypeScript)
- React 18, Vite
- TanStack Query
- Dexie (IndexedDB)
- Tailwind CSS
- Framer Motion

### Mobile (Capacitor 8)
- Standard Capacitor plugins (Android, iOS, Haptics, StatusBar, etc.)
- **Custom capacitor-horizon plugin** (native functionality)
- Android build target
- iOS build target

### Custom Plugin (capacitor-horizon)
- **Native iOS**: Swift sources
- **Native Android**: Java/Kotlin sources
- TypeScript bridge layer
- Rollup-based build system

---

## Build Targets (Updated)

1. **Web** (Vite dev server)
   - npm run dev ? localhost:5173

2. **Backend API** (FastAPI)
   - uvicorn main:app ? localhost:9000

3. **Android APK** (Capacitor)
   - npm run build
   - npx cap sync android
   - npx cap open android (Android Studio)
   - Uses capacitor-horizon plugin

4. **iOS App** (Capacitor)
   - npm run build
   - npx cap sync ios
   - npx cap open ios (Xcode)
   - Uses capacitor-horizon plugin

---

## Lines of Code (Final Count)

| Component | LOC | Language |
|-----------|-----|----------|
| Backend | 19,573 | Python |
| Frontend | 13,687 | TypeScript/TSX |
| Custom Plugin | ~500* | TypeScript + Swift + Java |
| **Total** | **~33,760** | Mixed |

*Estimated - native code not counted in initial scan

---

## Dependency Complexity

**Backend**: 18 packages  
**Frontend**: 40+ packages (prod) + 45+ (dev)  
**Custom Plugin**: 12 devDependencies  

**Total npm packages across project**: ~100 unique  
**Total Python packages**: 18

---

## Build Complexity: HIGH

The project has **4 independent build targets**:
1. Backend Python ? Uvicorn server
2. Frontend TypeScript ? Vite bundle
3. Custom plugin TypeScript ? Rollup bundle
4. Mobile native ? Android/iOS builds (Gradle + Xcode)

This significantly increases the **DevOps complexity** compared to a standard web-only application.

---

## Additional Testing Requirements

### Custom Plugin Testing
- **iOS**: XCTest (Swift unit tests)
- **Android**: JUnit (Java unit tests)  
- **Web fallback**: TypeScript tests
- **Integration**: E2E tests on real devices

**Current Status**: Unknown (not audited in this review)  
**Recommendation**: Add to comprehensive test strategy

---

## Updated Risk Assessment

### MEDIUM RISK (New)
**Custom Native Plugin Maintenance**:
- Requires iOS/Android development expertise
- Must keep up with Capacitor updates
- Platform-specific bugs harder to debug
- Build complexity increases CI/CD overhead

**Mitigation**:
- Document plugin API thoroughly
- Add plugin-specific tests
- Consider using standard Capacitor plugins if possible
- Maintain separate CI pipeline for plugin builds

---

## Production Deployment Checklist (Updated)

Add to original checklist:

### Mobile-Specific
- [ ] Test capacitor-horizon plugin on real devices
- [ ] Verify iOS build (Xcode, signing, provisioning)
- [ ] Verify Android build (Gradle, signing, keystore)
- [ ] Test plugin fallback behavior (web mode)
- [ ] Review App Store / Play Store compliance
- [ ] Configure app icons, splash screens
- [ ] Set up mobile-specific error tracking

### Plugin-Specific
- [ ] Plugin unit tests (iOS Swift, Android Java)
- [ ] Plugin integration tests (with Capacitor)
- [ ] Plugin documentation (API, usage examples)
- [ ] Plugin version compatibility matrix

---

## Conclusion

The Horizon PRM project is **more complex than initially assessed** due to the custom native Capacitor plugin. This adds:

- **Additional codebase**: ~500 LOC native code
- **Additional platforms**: iOS Swift + Android Java
- **Additional build steps**: Xcode + Gradle
- **Additional testing**: Native unit tests + device testing
- **Additional expertise required**: iOS/Android development

**Updated Complexity Rating**: **HIGH** (was MEDIUM-HIGH)

**Recommendation**: Ensure team has mobile development expertise or consider replacing custom plugin with standard Capacitor alternatives if feasible.

---

**Generated**: 2026-06-19 14:05 UTC  
**Part of**: Automated Engineering Audit 2026-06-19

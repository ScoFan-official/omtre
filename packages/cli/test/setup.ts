// Strip host-shell session env vars so the OpenCode / Omtre context
// resolvers under test fall through to platform-input-derived keys
// instead of picking up whatever the dev's terminal happens to export.
delete process.env.OMTRE_CONTEXT_ID;

// Strip CLAUDE_ENV_FILE: session-start.py appends `export OMTRE_CONTEXT_ID=…`
// to it, so a dev running the suite inside a Claude Code session would write
// test fixture keys into their own real shell setup file.
delete process.env.CLAUDE_ENV_FILE;

// Strip *_PROJECT_DIR vars: shared-hooks/session-start.py prefers them over
// JSON cwd / process cwd, so a dev running tests inside a Claude Code /
// Copilot / etc. session would otherwise have the hook read the *real*
// repo's .omtre/ instead of the test tmpDir.
delete process.env.CLAUDE_PROJECT_DIR;
delete process.env.QODER_PROJECT_DIR;
delete process.env.CODEBUDDY_PROJECT_DIR;
delete process.env.FACTORY_PROJECT_DIR;
delete process.env.CURSOR_PROJECT_DIR;
delete process.env.GEMINI_PROJECT_DIR;
delete process.env.KIRO_PROJECT_DIR;
delete process.env.COPILOT_PROJECT_DIR;

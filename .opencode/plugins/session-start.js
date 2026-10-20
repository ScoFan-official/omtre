/* global process */
/**
 * Omtre Session Start Plugin
 *
 * Injects compact SessionStart context into the copy of the latest user
 * message that OpenCode sends to the model. Uses
 * `experimental.chat.messages.transform` so TUI / Web / SQLite history
 * stay untouched (issue #553).
 */

import { OmtreContext, debugLog, isOmtreSubagent } from "../lib/omtre-context.js"
import {
  MESSAGES_TRANSFORM_HOOK,
  platformInputFromMessages,
  prependEphemeralText,
  transcriptHasAssistantMessage,
} from "../lib/context-visibility.js"
import { buildSessionContext } from "../lib/session-utils.js"

const FIRST_REPLY_NOTICE_RE = /<first-reply-notice>[\s\S]*?<\/first-reply-notice>\s*/g

function stripFirstReplyNotice(context) {
  return context.replace(FIRST_REPLY_NOTICE_RE, "")
}

// OpenCode 1.2.x expects plugins to be factory functions (see inject-subagent-context.js comment).
export default async ({ directory }) => {
  const ctx = new OmtreContext(directory)
  debugLog("session", "Plugin loaded, directory:", directory)

  return {
    [MESSAGES_TRANSFORM_HOOK]: async (_input, output) => {
      try {
        const messages = output?.messages
        const platformInput = platformInputFromMessages(messages)
        const agent = platformInput?.agent || "unknown"
        debugLog("session", "messages.transform called, agent:", agent)

        if (isOmtreSubagent(platformInput)) {
          debugLog("session", "Skipping omtre subagent turn:", agent)
          return
        }

        if (process.env.OMTRE_HOOKS === "0" || process.env.OMTRE_DISABLE_HOOKS === "1") {
          debugLog("session", "Skipping - OMTRE_HOOKS disabled")
          return
        }

        if (process.env.OPENCODE_NON_INTERACTIVE === "1") {
          debugLog("session", "Skipping - non-interactive mode")
          return
        }

        let context = buildSessionContext(ctx, platformInput)
        if (transcriptHasAssistantMessage(messages)) {
          context = stripFirstReplyNotice(context)
        }
        debugLog("session", "Built context, length:", context.length)
        prependEphemeralText(messages, context)
      } catch (error) {
        debugLog("session", "Error in messages.transform:", error.message, error.stack)
      }
    },
  }
}

import { AdminForm } from "@/components/admin/form";
import { agentFields, agentToValues } from "@/lib/admin-forms";
import { hasCredentials } from "@/lib/agent";
import { requireAdmin } from "@/lib/auth";
import { readAgentSettings } from "@/lib/store";
import { saveAgentAction } from "../../actions";

// Moving between admin pages is not instant either: each page checks the session first (see the panel layout).
export const instant = false;

export default async function AgentEditor() {
  await requireAdmin();
  const settings = await readAgentSettings();
  return (
    <div className="max-w-[620px]">
      <h1 className="mb-2 text-[24px] font-medium tracking-[-0.015em] text-strong">Agent</h1>
      <p className="mb-6 text-[14.5px]">
        {hasCredentials()
          ? "The agent is connected to the Claude API."
          : "No Claude API key is set on the server, so the agent is answering in demo mode (database search and a template, no model). The API key is set in the server's environment, not here."}
      </p>
      <AdminForm fields={agentFields} initial={agentToValues(settings)} action={saveAgentAction} submitLabel="Save agent settings" />
    </div>
  );
}

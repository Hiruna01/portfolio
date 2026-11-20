import { Chat } from "@/components/chat";
import { getAgentSettings, getProfile } from "@/lib/store";

// The agent is the home page. The classic pages live at /about, /projects, /articles and /content.
export default async function AgentPage() {
  const [profile, settings] = await Promise.all([getProfile(), getAgentSettings()]);
  return (
    <>
      <Chat
        name={profile.name}
        suggestions={settings.suggestions}
        enabled={settings.enabled}
      />
    </>
  );
}

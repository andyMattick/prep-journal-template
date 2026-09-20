import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_CONTACT_EMAIL = Deno.env.get("VAPID_CONTACT_EMAIL") || "mailto:admin@example.com";

webpush.setVapidDetails(VAPID_CONTACT_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async () => {
  const { data: reminders, error } = await supabase.from("reminder_times").select("*");
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const results: unknown[] = [];

  for (const reminder of reminders ?? []) {
    let nowLocal: Date;
    try {
      nowLocal = new Date(new Date().toLocaleString("en-US", { timeZone: reminder.timezone }));
    } catch {
      continue;
    }
    const hh = String(nowLocal.getHours()).padStart(2, "0");
    const mm = String(nowLocal.getMinutes()).padStart(2, "0");
    const currentHM = `${hh}:${mm}`;
    const targetHM = String(reminder.time_of_day).slice(0, 5);
    const todayLocal = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, "0")}-${String(nowLocal.getDate()).padStart(2, "0")}`;

    if (currentHM !== targetHM || reminder.last_sent_on === todayLocal) continue;

    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", reminder.user_id);

    for (const subscriptionRow of subscriptions ?? []) {
      const subscription = {
        endpoint: subscriptionRow.endpoint,
        keys: { p256dh: subscriptionRow.p256dh, auth: subscriptionRow.auth_key },
      };
      try {
        await webpush.sendNotification(
          subscription,
          JSON.stringify({ title: "Prep Journal", body: reminder.label || "Time to prep for tomorrow." })
        );
        results.push({ user_id: reminder.user_id, reminder_id: reminder.id, status: "sent" });
      } catch (error) {
        if (error && typeof error === "object" && "statusCode" in error && (error.statusCode === 404 || error.statusCode === 410)) {
          await supabase.from("push_subscriptions").delete().eq("id", subscriptionRow.id);
        }
        results.push({ user_id: reminder.user_id, reminder_id: reminder.id, status: "failed", error: String(error) });
      }
    }

    await supabase.from("reminder_times").update({ last_sent_on: todayLocal }).eq("id", reminder.id);
  }

  return new Response(JSON.stringify({ ok: true, checked: (reminders ?? []).length, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
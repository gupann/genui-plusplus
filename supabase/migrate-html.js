import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET = "generated-html";

async function migrateHtml() {
  const { data: rows, error } = await supabase
    .from("study_generation_outputs")
    .select("id, participant_id, task_id, change_id, provider_id, generated_html")
    .not("generated_html", "is", null);

  if (error) throw error;

  for (const row of rows) {
    const path = `task-${row.task_id}/${row.participant_id}/${row.provider_id}/change-${row.change_id}.html`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, row.generated_html, {
        contentType: "text/html",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload failed:", row.id, uploadError);
      continue;
    }

    const { error: updateError } = await supabase
      .from("study_generation_outputs")
      .update({ html_storage_path: path })
      .eq("id", row.id);

    if (updateError) {
      console.error("Update failed:", row.id, updateError);
    }
  }
}

migrateHtml();
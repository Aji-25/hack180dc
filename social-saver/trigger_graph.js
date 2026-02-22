const { execSync } = require('child_process');

async function trigger() {
  const url = process.env.SUPABASE_URL || execSync('npx supabase --workdir . url', { encoding: 'utf8' }).trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
    process.exit(1)
  }

  const res = await fetch(`${url}/functions/v1/process-graph-jobs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ batch_size: 100 })
  });

  console.log("Status:", res.status);
  console.log("Body:", await res.text());
}

trigger().catch(err => {
  console.error("Trigger failed:", err.message);
  process.exit(1);
});

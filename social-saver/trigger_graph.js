const { execSync } = require('child_process');

async function trigger() {
  const url = execSync('npx supabase secrets get SUPABASE_URL', { encoding: 'utf8' }).trim();
  const key = execSync('npx supabase secrets get SUPABASE_SERVICE_ROLE_KEY', { encoding: 'utf8' }).trim();
  
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
trigger();

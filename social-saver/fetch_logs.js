const { execSync } = require('child_process');

try {
  // Use supabase CLI to get logs (30s timeout to prevent indefinite hang)
  const output = execSync('npx supabase functions logs whatsapp-webhook', {
    encoding: 'utf-8',
    timeout: 30000,
  });
  console.log(output);
} catch (error) {
  // error.stderr contains the actual CLI error output from execSync failures
  console.error(error.stderr || error.message);
}

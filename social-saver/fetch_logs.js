const { execSync } = require('child_process');

try {
  // Use supabase CLI to get logs
  const output = execSync('npx supabase functions logs whatsapp-webhook', { encoding: 'utf-8' });
  console.log(output);
} catch (error) {
  console.error(error.stdout || error.message);
}

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = required.filter((name) => !process.env[name]);
const port = process.env.PORT === undefined ? 3000 : Number(process.env.PORT);

if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT must be an integer between 1 and 65535');
  process.exit(1);
}

try {
  new URL(process.env.SUPABASE_URL);
} catch {
  console.error('SUPABASE_URL must be a valid URL');
  process.exit(1);
}

module.exports = {
  port,
};

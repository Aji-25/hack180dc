require('dotenv').config();
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

const webhookUrl = 'https://hxiwxeihlobarzphvvqi.supabase.co/functions/v1/whatsapp-webhook';

console.log('Fetching Twilio WhatsApp Sandbox settings...');

// The sandbox API uses a different client namespace
// It's client.messages.sandbox but it's simpler to send a raw request using client.request
client.request({
  method: 'POST',
  uri: `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/Providers/whatsapp`,
  data: {
    InboundUrl: webhookUrl,
    InboundMethod: 'POST',
    StatusCallback: webhookUrl,
    StatusCallbackMethod: 'POST'
  }
})
  .then(response => {
    console.log('✅ SUCCESS! Webhook URL forcefully updated in Twilio.');
    console.log(response.body);
  })
  .catch(err => {
    console.error('❌ FAILED to update Twilio Sandbox:', err.message);
  });

const twilio = require('twilio');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

// Twilio Verify handles generating the code, texting it, rate-limiting
// retries, and expiring old codes — all the fiddly parts of OTP you don't
// want to build yourself. We just call these two functions.
async function sendOtp(phone) {
  return client.verify.v2.services(serviceSid).verifications.create({ to: phone, channel: 'sms' });
}

async function checkOtp(phone, code) {
  const result = await client.verify.v2.services(serviceSid).verificationChecks.create({ to: phone, code });
  return result.status === 'approved';
}

module.exports = { sendOtp, checkOtp };

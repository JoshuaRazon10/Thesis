const db = require('../data/db');

/**
 * Sends an SMS using the HttpSMS API and updates the notification status.
 * @param {number} smsId - The ID of the SMS notification record
 * @param {string} recipientPhone - The recipient's phone number
 * @param {string} message - The SMS message content
 */
const sendHttpSMS = async (smsId, recipientPhone, message) => {
  try {
    const settings = await db.query("SELECT setting_key, setting_value FROM tbl_system_settings WHERE setting_key IN ('httpsms_api_key', 'httpsms_sender_phone')");
    
    let apiKey = '';
    let senderPhone = '';
    settings.forEach(s => {
      if (s.setting_key === 'httpsms_api_key') apiKey = s.setting_value;
      if (s.setting_key === 'httpsms_sender_phone') senderPhone = s.setting_value;
    });

    if (!apiKey) {
      console.warn('HttpSMS API Key is not configured. SMS remaining as pending.');
      return;
    }

    const payload = {
      content: message,
      from: senderPhone || undefined,
      to: recipientPhone
    };

    const response = await fetch('https://api.httpsms.com/v1/messages/send', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      await db.query("UPDATE tbl_sms_notifications SET status = 'sent', sent_at = NOW() WHERE sms_id = ?", [smsId]);
      console.log(`✅ SMS successfully dispatched to ${recipientPhone}`);
    } else {
      const responseData = await response.json();
      console.error('HttpSMS API Error:', responseData);
      await db.query("UPDATE tbl_sms_notifications SET status = 'failed' WHERE sms_id = ?", [smsId]);
    }
  } catch (err) {
    console.error('Failed to send HttpSMS:', err);
    await db.query("UPDATE tbl_sms_notifications SET status = 'failed' WHERE sms_id = ?", [smsId]);
  }
};

module.exports = { sendHttpSMS };

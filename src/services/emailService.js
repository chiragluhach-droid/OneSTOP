const Brevo = require('@getbrevo/brevo');

const apiInstance = new Brevo.TransactionalEmailsApi();
apiInstance.setApiKey(
  Brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

const FROM = {
  email: process.env.BREVO_FROM_EMAIL,
  name: process.env.BREVO_FROM_NAME,
};

const sendEmail = async ({ to, toName, cc = [], subject, htmlContent }) => {
  const sendSmtpEmail = new Brevo.SendSmtpEmail();
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = htmlContent;
  sendSmtpEmail.sender = FROM;

  // to can be a string or array of strings
  const toList = Array.isArray(to) ? to : [to];
  sendSmtpEmail.to = toList.map((email) => ({ email, name: email }));

  if (cc.length > 0) {
    sendSmtpEmail.cc = cc.map((email) => ({ email, name: email }));
  }

  try {
    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    return result;
  } catch (err) {
    console.error('Brevo email error:', err.message || err);
    throw err;
  }
};

module.exports = { sendEmail };

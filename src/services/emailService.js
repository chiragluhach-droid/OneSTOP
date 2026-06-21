const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const sendEmail = async ({ to, cc = [], subject, htmlContent }) => {
  const toList = Array.isArray(to) ? to : [to];

  const mailOptions = {
    from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_USER}>`,
    to: toList.join(', '),
    subject,
    html: htmlContent,
  };

  if (cc.length > 0) {
    mailOptions.cc = cc.join(', ');
  }

  try {
    const result = await transporter.sendMail(mailOptions);
    return result;
  } catch (err) {
    console.error('Nodemailer error:', err.message || err);
    throw err;
  }
};

module.exports = { sendEmail };

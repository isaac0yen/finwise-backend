import nodemailer from 'nodemailer';


const transporter = nodemailer.createTransport({
  service: 'smtp',
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

const Email = {
  sendVerificationEmail: (to: string, code: string) => {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to,
      subject: 'Verify Your Email Address',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4a4a4a;">Verify Your Email Address</h2>
          <p>Thank you for registering with Acad Celestia. Please use the verification code below to complete your registration:</p>
          <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${code}
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you did not request this verification, please ignore this email.</p>
          <p>Best regards,<br>The Acad Celestia Team</p>
        </div>
      `
    };

    return transporter.sendMail(mailOptions);
  },

  // Generic email sending function
  sendMail: (to: string, subject: string, html: string) => {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html
    };

    return transporter.sendMail(mailOptions);
  }
}

export default Email;
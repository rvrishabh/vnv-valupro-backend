import { Resend } from 'resend';

export class AuthService {
  private readonly resend = new Resend(process.env.RESEND_API_KEY);
  private async dispatchEmailOtp(
    email: string,
    purpose: 'registration' | 'login',
  ) {
    const otp = Math.floor(100000 + Math.random() * 900000);
    const emailFrom = process.env.EMAIL_FROM;
    const emailSubject =
      purpose === 'registration' ? 'Welcome to ValuPro' : 'Your ValuPro Login';
    const { error } = await this.resend.emails.send({
      from: emailFrom,
      to: email,
      subject: emailSubject,
      html: `<p>Your OTP is ${otp}</p>`,
    });
    if (error) {
      throw new Error(error.message);
    }
    return { message: 'OTP sent to email' };
  }

  // async registerSendEmailOtp({email, client}: RegisterSendEmailOtpDto) {
  //   const user = await this.userService.findby(email);
  // }

  // async sendEmailOtp({email, client}: SendEmailOtpDto) {
  //   return this.dispatchEmailOtp(email, 'login');
  // }
}

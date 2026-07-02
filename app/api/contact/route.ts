import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(request: Request) {
  try {
    // Instantiated per-request: the constructor throws without an API key,
    // which would otherwise break `next build` in environments missing it.
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'Email is not configured — email me directly instead.' },
        { status: 503 }
      );
    }
    const resend = new Resend(process.env.RESEND_API_KEY);

    const body = await request.json();
    const { name, email, message } = body;

    // Validate input
    if (!name || !email || !message) {
      console.error('Missing required fields:', { name: !!name, email: !!email, message: !!message });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('Sending email from:', name, email);

    // Send email using Resend
    const data = await resend.emails.send({
      from: 'Portfolio Contact <contact@hjhportfolio.com>',
      to: ['harveyhoulahan@outlook.com'],
      replyTo: email,
      subject: `Portfolio Contact from ${name}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
      `,
    });

    console.log('Email sent successfully:', data);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { error: 'Failed to send email', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

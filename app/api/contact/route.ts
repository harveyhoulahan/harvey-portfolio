import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// User-supplied strings are interpolated into the notification email's HTML;
// escape them so a crafted message can't inject markup into the mail client.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const MAX_LEN = { name: 200, email: 320, message: 5000 } as const;

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
    const { name, email, message, company } = body;

    // Honeypot: the visible form never fills this field; bots that scrape the
    // markup do. Answer with a plausible success so they don't retry.
    if (company) {
      return NextResponse.json({ success: true });
    }

    if (
      typeof name !== 'string' || typeof email !== 'string' || typeof message !== 'string' ||
      !name.trim() || !email.trim() || !message.trim()
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    if (name.length > MAX_LEN.name || email.length > MAX_LEN.email || message.length > MAX_LEN.message) {
      return NextResponse.json(
        { error: 'Message too long' },
        { status: 400 }
      );
    }

    const safeName = escapeHtml(name.trim());
    const safeEmail = escapeHtml(email.trim());
    const safeMessage = escapeHtml(message.trim()).replace(/\n/g, '<br>');

    const { error } = await resend.emails.send({
      from: 'Portfolio Contact <contact@hjhportfolio.com>',
      to: ['harveyhoulahan@outlook.com'],
      replyTo: email,
      subject: `Portfolio Contact from ${name.trim().slice(0, 80)}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Message:</strong></p>
        <p>${safeMessage}</p>
      `,
    });
    if (error) throw new Error(error.message ?? 'Send failed');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Contact form send failed:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to send — email me directly instead.' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    const geminiKey = req.headers.get('x-api-key-gemini') || process.env.GEMINI_API_KEY || '';

    if (!geminiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured. Set your Gemini API key in Settings or add GEMINI_API_KEY env var.' },
        { status: 400 }
      );
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      const body = await response.text().catch(() => 'Unknown error');
      return NextResponse.json(
        {
          error: `Gemini API error (HTTP ${response.status})`,
          detail: body,
          url,
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Filter to only models that support generateContent
    const supportedModels = (data.models || []).filter((m: any) =>
      m.supportedGenerationMethods?.includes('generateContent')
    );

    return NextResponse.json({
      success: true,
      total: data.models?.length || 0,
      supported: supportedModels.length,
      models: supportedModels.map((m: any) => ({
        name: m.name,
        displayName: m.displayName,
        description: m.description,
        inputTokenLimit: m.inputTokenLimit,
        outputTokenLimit: m.outputTokenLimit,
        version: m.version,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to list models' },
      { status: 500 }
    );
  }
}

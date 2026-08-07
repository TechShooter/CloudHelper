import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

async function fetchBlockChildren(blockId: string, notionApiKey: string) {
  const res = await fetch(`https://api.notion.com/v1/blocks/${blockId}/children?page_size=100`, {
    headers: {
      Authorization: `Bearer ${notionApiKey}`,
      'Notion-Version': '2026-03-11',
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch blocks for ${blockId}: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.results || [];
}

function blocksToPlainText(blocks: any[]): string {
  const pieces: string[] = [];

  const extractText = (items: any[]): string => {
    if (!Array.isArray(items)) return '';
    return items.map((t: any) => t.plain_text || t.text?.content || '').join('');
  };

  let numberedCounter = 1;

  for (const b of blocks) {
    const type = b.type;
    let line = '';

    try {
      if (type === 'paragraph') {
        line = extractText(b.paragraph?.rich_text || b.paragraph?.text || []);
      } else if (type === 'heading_1') {
        line = '# ' + extractText(b.heading_1?.rich_text || b.heading_1?.text || []);
      } else if (type === 'heading_2') {
        line = '## ' + extractText(b.heading_2?.rich_text || b.heading_2?.text || []);
      } else if (type === 'heading_3') {
        line = '### ' + extractText(b.heading_3?.rich_text || b.heading_3?.text || []);
      } else if (type === 'bulleted_list_item') {
        line = '- ' + extractText(b.bulleted_list_item?.rich_text || b.bulleted_list_item?.text || []);
        numberedCounter = 1;
      } else if (type === 'numbered_list_item') {
        line = `${numberedCounter}. ` + extractText(b.numbered_list_item?.rich_text || b.numbered_list_item?.text || []);
        numberedCounter += 1;
      } else if (type === 'to_do') {
        const text = extractText(b.to_do?.rich_text || b.to_do?.text || []);
        const checked = b.to_do?.checked ? '[x]' : '[ ]';
        line = `${checked} ${text}`;
        numberedCounter = 1;
      } else if (type === 'quote' || type === 'callout' || type === 'toggle') {
        line = '> ' + extractText(b[type]?.rich_text || []);
      } else if (type === 'code') {
        const text = extractText(b.code?.rich_text || []);
        line = `\`\`\`
${text}
\`\`\``;
      } else if (Array.isArray(b.rich_text)) {
        line = extractText(b.rich_text);
      } else if (b.paragraph && Array.isArray(b.paragraph.rich_text)) {
        line = extractText(b.paragraph.rich_text);
      }
    } catch (e) {
      line = '';
    }

    if (line && line.trim()) {
      pieces.push(line.trim());
    }
  }

  return pieces.join('\n');
}

function propertyValueToPlainText(prop: any): string {
  if (!prop || typeof prop !== 'object') return '';
  try {
    switch (prop.type) {
      case 'title':
        return Array.isArray(prop.title) ? prop.title.map((t: any) => t.plain_text || t.text?.content || '').join('') : '';
      case 'rich_text':
        return Array.isArray(prop.rich_text) ? prop.rich_text.map((t: any) => t.plain_text || t.text?.content || '').join('') : '';
      case 'number':
        return prop.number != null ? String(prop.number) : '';
      case 'checkbox':
        return prop.checkbox ? 'Yes' : 'No';
      case 'select':
        return prop.select?.name || '';
      case 'multi_select':
        return Array.isArray(prop.multi_select) ? prop.multi_select.map((item: any) => item.name || '').filter(Boolean).join(', ') : '';
      case 'people':
        return Array.isArray(prop.people) ? prop.people.map((person: any) => person.name || person.id || '').filter(Boolean).join(', ') : '';
      case 'date':
        if (!prop.date) return '';
        return prop.date.start ? `${prop.date.start}${prop.date.end ? ` to ${prop.date.end}` : ''}` : '';
      case 'url':
        return prop.url || '';
      case 'email':
        return prop.email || '';
      case 'phone_number':
        return prop.phone_number || '';
      case 'relation':
        return Array.isArray(prop.relation) ? prop.relation.map((item: any) => item.id).join(', ') : '';
      case 'created_by':
      case 'last_edited_by':
        return prop[prop.type]?.name || prop[prop.type]?.id || '';
      case 'formula':
        if (!prop.formula) return '';
        return propertyValueToPlainText({ type: prop.formula.type, [prop.formula.type]: prop.formula[prop.formula.type] });
      case 'rollup':
        if (!prop.rollup) return '';
        if (prop.rollup.type === 'number') return prop.rollup.number != null ? String(prop.rollup.number) : '';
        if (prop.rollup.type === 'date') return prop.rollup.date?.start ? `${prop.rollup.date.start}${prop.rollup.date.end ? ` to ${prop.rollup.date.end}` : ''}` : '';
        if (prop.rollup.type === 'array' && Array.isArray(prop.rollup.array)) return prop.rollup.array.map((item: any) => propertyValueToPlainText(item)).filter(Boolean).join(', ');
        return '';
      case 'files':
        return Array.isArray(prop.files) ? prop.files.map((file: any) => file.name || file.file?.url || file.external?.url || '').filter(Boolean).join(', ') : '';
      default:
        // If Notion property shape is like { title: [] } or { rich_text: [] }
        if (Array.isArray(prop.title)) {
          return prop.title.map((t: any) => t.plain_text || t.text?.content || '').join('');
        }
        if (Array.isArray(prop.rich_text)) {
          return prop.rich_text.map((t: any) => t.plain_text || t.text?.content || '').join('');
        }
        return '';
    }
  } catch (e) {
    return '';
  }
}

function extractPageTitle(properties: any): string | null {
  if (!properties || typeof properties !== 'object') return null;
  try {
    for (const key of Object.keys(properties)) {
      const prop = properties[key];
      if (prop?.type === 'title' && Array.isArray(prop.title) && prop.title.length > 0) {
        const title = prop.title.map((t: any) => t.plain_text || t.text?.content || '').join('');
        if (title.trim()) return title;
      }
    }
    for (const key of Object.keys(properties)) {
      const prop = properties[key];
      const value = propertyValueToPlainText(prop);
      if (value && value.trim()) return value;
    }
  } catch (e) {
    return null;
  }
  return null;
}

function formatRowProperties(properties: any): string {
  if (!properties || typeof properties !== 'object') return '';
  const lines: string[] = [];
  for (const key of Object.keys(properties)) {
    const value = propertyValueToPlainText(properties[key]);
    if (value && value.trim()) {
      lines.push(`${key}: ${value}`);
    }
  }
  return lines.join(' | ');
}

function formatQueryResults(results: any[]): string {
  if (!Array.isArray(results) || results.length === 0) return '';
  const lines: string[] = [];
  for (const item of results) {
    const title = extractPageTitle(item.properties) || item.id;
    const props = formatRowProperties(item.properties);
    if (props) {
      lines.push(`- ${title}\n  ${props}`);
    } else {
      lines.push(`- ${title}`);
    }
  }
  return lines.join('\n');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pageId } = body;
    if (!pageId) return NextResponse.json({ error: 'Missing pageId' }, { status: 400 });

    const notionApiKey = req.headers.get('x-api-key-notion') || process.env.NOTION_API_KEY || '';
    if (!notionApiKey) return NextResponse.json({ error: 'Notion API key not configured' }, { status: 500 });

    // Try fetching as a page first
    const pageRes = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      headers: {
        Authorization: `Bearer ${notionApiKey}`,
        'Notion-Version': '2026-03-11',
        'Content-Type': 'application/json',
      },
    });

    if (pageRes.ok) {
      const page = await pageRes.json();

      // Fetch top-level blocks and convert to plain text
      const blocks = await fetchBlockChildren(pageId, notionApiKey);
      const content = blocksToPlainText(blocks);

      // Try to extract title
      let title = null;
      try {
        if (page.properties) {
          for (const k of Object.keys(page.properties)) {
            const prop = page.properties[k];
            if (prop?.type === 'title' && Array.isArray(prop.title) && prop.title.length > 0) {
              title = prop.title.map((t: any) => t.plain_text || '').join('');
              break;
            }
          }
        }
      } catch (e) {
        // ignore
      }

      return NextResponse.json({ page, title: title || page?.id, content });
    }

    // If not a page, maybe it's a database: try fetching database metadata
    const dbRes = await fetch(`https://api.notion.com/v1/databases/${pageId}`, {
      headers: {
        Authorization: `Bearer ${notionApiKey}`,
        'Notion-Version': '2026-03-11',
        'Content-Type': 'application/json',
      },
    });

    if (dbRes.ok) {
      const db = await dbRes.json();

      // Get a few items from the database for preview
      const queryRes = await fetch(`https://api.notion.com/v1/databases/${pageId}/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${notionApiKey}`,
          'Notion-Version': '2026-03-11',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ page_size: 10 }),
      });

      let itemsSummary: string[] = [];
      let previewText = '';
      if (queryRes.ok) {
        const qdata = await queryRes.json();
        const results = qdata.results || [];
        previewText = formatQueryResults(results);
        itemsSummary = previewText ? previewText.split('\n') : [];
      }

      const dbTitle = (() => {
        try {
          if (db.title && Array.isArray(db.title) && db.title.length > 0) return db.title.map((t: any) => t.plain_text || '').join('');
        } catch (e) {}
        return db.id;
      })();

      const content = previewText ? `Database items:\n${previewText}` : '(No items preview available)';
      return NextResponse.json({ database: db, title: dbTitle, content, items: itemsSummary });
    }

    // If database fetch also failed, try Notion data_sources (newer API: data_source objects)
    const dsRes = await fetch(`https://api.notion.com/v1/data_sources/${pageId}`, {
      headers: {
        Authorization: `Bearer ${notionApiKey}`,
        'Notion-Version': '2026-03-11',
        'Content-Type': 'application/json',
      },
    });

    if (dsRes.ok) {
      const ds = await dsRes.json();

      // Query a few pages under this data source for preview
      const queryRes = await fetch(`https://api.notion.com/v1/data_sources/${pageId}/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${notionApiKey}`,
          'Notion-Version': '2026-03-11',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ page_size: 10 }),
      });

      let itemsSummary: string[] = [];
      let previewText = '';
      if (queryRes.ok) {
        const qdata = await queryRes.json();
        const results = qdata.results || [];
        previewText = formatQueryResults(results);
        itemsSummary = previewText ? previewText.split('\n') : [];
      }

      const dsTitle = (() => {
        try {
          if (ds.title && Array.isArray(ds.title) && ds.title.length > 0) return ds.title.map((t: any) => t.plain_text || '').join('');
        } catch (e) {}
        return ds.id;
      })();

      const content = previewText ? `Data source items:\n${previewText}` : '(No items preview available)';
      return NextResponse.json({ data_source: ds, title: dsTitle, content, items: itemsSummary });
    }

    // Final fallback: report original page error
    const err = await pageRes.text();
    return NextResponse.json({ error: `Failed to fetch page, database or data_source: ${pageRes.status} ${err}` }, { status: pageRes.status });
  } catch (error: any) {
    console.error('Error in notion-page:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

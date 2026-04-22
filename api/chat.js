const SCHOOL_CTX = `You are the SAIS Timetable Copilot for Santo Antonio International School of Estoril, 2026/27.
Three campuses: Primary (Nursery-A1), Secondary (A2-A6), Senior (A7-A8).
Cross-campus staff: JS, MB, DV, DPB, IR, MF. Max loads: Senior 21/30, Secondary + Upper Primary 28/40, Lower Primary 24/35.
Key gaps: Art-Primary, Music iGCSE, NW overloaded, LM absent Sep-Oct.`;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function supabaseFetch(path, options = {}) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...options.headers,
  };
  const response = await fetch(`${base}/rest/v1/${path}`, { ...options, headers });
  return response;
}

function parseTutorCommand(message) {
  const text = (message || '').trim();
  let m = text.match(/assign\s+([A-Z]{2,4})\s+as\s+tutor\s+for\s+([A-Z]\d|P\d|A\d|Nursery|Reception)\b/i);
  if (m) return { action: 'assign', teacher: m[1].toUpperCase(), yearGroup: normalizeYG(m[2]) };

  m = text.match(/set\s+tutor\s+for\s+([A-Z]\d|P\d|A\d|Nursery|Reception)\s+to\s+([A-Z]{2,4})\b/i);
  if (m) return { action: 'assign', teacher: m[2].toUpperCase(), yearGroup: normalizeYG(m[1]) };

  m = text.match(/remove\s+tutor\s+for\s+([A-Z]\d|P\d|A\d|Nursery|Reception)\b/i);
  if (m) return { action: 'remove', yearGroup: normalizeYG(m[1]) };

  m = text.match(/who\s+is\s+(?:the\s+)?tutor\s+for\s+([A-Z]\d|P\d|A\d|Nursery|Reception)\b/i);
  if (m) return { action: 'lookup', yearGroup: normalizeYG(m[1]) };

  return null;
}

function normalizeYG(v) {
  if (!v) return v;
  const t = v.trim();
  if (/^nursery$/i.test(t)) return 'Nursery';
  if (/^reception$/i.test(t)) return 'Reception';
  return t.toUpperCase();
}

async function getTutorMap() {
  const r = await supabaseFetch('tutor_assignments?select=year_group,teacher_code');
  const rows = await r.json();
  const map = {};
  for (const row of rows) map[row.year_group] = row.teacher_code || '';
  return map;
}

async function upsertTutor(yearGroup, teacher) {
  const r = await supabaseFetch('tutor_assignments?on_conflict=year_group', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify([{ year_group: yearGroup, teacher_code: teacher }]),
  });
  if (!r.ok) throw new Error(`Supabase save failed (${r.status})`);
}

async function clearTutor(yearGroup) {
  const r = await supabaseFetch(`tutor_assignments?year_group=eq.${encodeURIComponent(yearGroup)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' },
  });
  if (!r.ok) throw new Error(`Supabase delete failed (${r.status})`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const { messages = [] } = req.body || {};
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
    const command = parseTutorCommand(lastUser);

    if (command?.action === 'assign') {
      await upsertTutor(command.yearGroup, command.teacher);
      const updatedTutors = await getTutorMap();
      return json(res, 200, {
        reply: `Done — ${command.teacher} is now saved as tutor for ${command.yearGroup}.`,
        updatedTutors,
      });
    }

    if (command?.action === 'remove') {
      await clearTutor(command.yearGroup);
      const updatedTutors = await getTutorMap();
      return json(res, 200, {
        reply: `Done — tutor assignment removed for ${command.yearGroup}.`,
        updatedTutors,
      });
    }

    if (command?.action === 'lookup') {
      const updatedTutors = await getTutorMap();
      const teacher = updatedTutors[command.yearGroup];
      return json(res, 200, {
        reply: teacher
          ? `${command.yearGroup} is currently assigned to ${teacher}.`
          : `${command.yearGroup} is currently unassigned.`,
        updatedTutors,
      });
    }

    const tutorMap = await getTutorMap();
    const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'output_text',
                text:
                  `${SCHOOL_CTX}\nCurrent tutor assignments: ${JSON.stringify(tutorMap)}\n` +
                  `If the user wants a tutor assignment changed, tell them the exact command format to use.`,
              },
            ],
          },
          ...messages.map((m) => ({
            role: m.role,
            content: [{ type: 'output_text', text: String(m.content || '') }],
          })),
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      const message = data?.error?.message || 'OpenAI request failed';
      throw new Error(message);
    }

    const reply =
      data.output_text ||
      data.output?.flatMap((item) => item.content || []).map((c) => c.text || '').join('\n').trim() ||
      'No response.';

    return json(res, 200, { reply, updatedTutors: tutorMap });
  } catch (error) {
    return json(res, 500, { error: error.message || 'Unknown server error' });
  }
}

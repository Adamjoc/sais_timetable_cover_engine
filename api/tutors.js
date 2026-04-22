function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function supabaseFetch(path, options = {}) {
  const baseRaw = process.env.SUPABASE_URL || '';
  const keyRaw = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  const base = baseRaw.trim().replace(/\/+$/, '');
  const key = keyRaw.trim();

  if (!base) throw new Error('SUPABASE_URL missing');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');

  const url = `${base}/rest/v1/${path}`;

  try {
    return await fetch(url, {
      ...options,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        ...options.headers,
      },
    });
  } catch (error) {
    throw new Error(`Supabase fetch failed for ${url}: ${error.message}`);
  }
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const r = await supabaseFetch('tutor_assignments?select=year_group,teacher_code');

      if (!r.ok) {
        const text = await r.text();
        throw new Error(`Supabase GET failed (${r.status}): ${text}`);
      }

      const rows = await r.json();
      const tutors = {};
      for (const row of rows) tutors[row.year_group] = row.teacher_code || '';
      return json(res, 200, { tutors });
    }

    if (req.method === 'POST') {
      const tutors = req.body?.tutors || {};
      const rows = Object.entries(tutors).map(([year_group, teacher_code]) => ({
        year_group,
        teacher_code: teacher_code || null,
      }));

      const r = await supabaseFetch('tutor_assignments?on_conflict=year_group', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(rows),
      });

      if (!r.ok) {
        const text = await r.text();
        throw new Error(`Supabase POST failed (${r.status}): ${text}`);
      }

      const data = await r.json();
      const output = {};
      for (const row of data) output[row.year_group] = row.teacher_code || '';
      return json(res, 200, { tutors: output });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    return json(res, 500, {
      error: error.message || 'Unknown server error',
    });
  }
}

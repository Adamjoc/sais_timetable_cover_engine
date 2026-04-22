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

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const r = await supabaseFetch('tutor_assignments?select=year_group,teacher_code');
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

      const data = await r.json();
      if (!r.ok) throw new Error(data?.message || `Supabase save failed (${r.status})`);

      const output = {};
      for (const row of data) output[row.year_group] = row.teacher_code || '';
      return json(res, 200, { tutors: output });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    return json(res, 500, { error: error.message || 'Unknown server error' });
  }
}

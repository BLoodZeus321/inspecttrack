const router  = require('express').Router();
const { query } = require('../db/pool');
const { authenticate, requireRepresentative } = require('../middleware/auth');
const https   = require('https');
const http    = require('http');

// ── Supabase Storage upload via signed URL ────────────────────
// We use Supabase Storage REST API directly (no extra package needed)
// Files are stored in a public bucket called "certificates"

async function uploadToSupabase(fileBuffer, fileName, mimeType) {
  const supabaseUrl  = process.env.SUPABASE_URL;
  const supabaseKey  = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment variables');
  }

  const bucket   = 'certificates';
  const filePath = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const url      = new URL(`${supabaseUrl}/storage/v1/object/${bucket}/${filePath}`);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      path:     url.pathname + url.search,
      method:   'POST',
      headers:  {
        'Authorization':  `Bearer ${supabaseKey}`,
        'Content-Type':   mimeType || 'application/octet-stream',
        'Content-Length': fileBuffer.length,
        'x-upsert':       'false',
      },
    };

    const protocol = url.protocol === 'https:' ? https : http;
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${filePath}`;
          resolve({ filePath, publicUrl, fileName });
        } else {
          reject(new Error(`Supabase Storage error ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(fileBuffer);
    req.end();
  });
}

// ── Parse multipart form data (no multer needed) ──────────────
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const contentType = req.headers['content-type'] || '';
      const boundary = contentType.split('boundary=')[1];
      if (!boundary) return reject(new Error('No boundary in multipart'));

      const parts = {};
      const boundaryBuf = Buffer.from('--' + boundary);
      let start = 0;

      // Simple multipart parser
      const bodyStr = body.toString('binary');
      const boundaryStr = '--' + boundary;
      const sections = bodyStr.split(boundaryStr).slice(1);

      for (const section of sections) {
        if (section.trim() === '--' || section.trim() === '--\r\n') continue;
        const headerEnd = section.indexOf('\r\n\r\n');
        if (headerEnd === -1) continue;
        const headers = section.slice(0, headerEnd);
        const content = section.slice(headerEnd + 4, section.endsWith('\r\n') ? -2 : undefined);

        const nameMatch = headers.match(/name="([^"]+)"/);
        const fileMatch = headers.match(/filename="([^"]+)"/);
        const ctMatch   = headers.match(/Content-Type: ([^\r\n]+)/);

        if (!nameMatch) continue;
        const name = nameMatch[1];

        if (fileMatch) {
          parts[name] = {
            filename:    fileMatch[1],
            contentType: ctMatch ? ctMatch[1].trim() : 'application/octet-stream',
            data:        Buffer.from(content, 'binary'),
          };
        } else {
          parts[name] = content.replace(/\r\n$/, '');
        }
      }
      resolve(parts);
    });
    req.on('error', reject);
  });
}

// ── GET /api/certificates ─────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT c.*,
        COUNT(ec.equipment_id)::int AS linked_count,
        u.name AS created_by_name
      FROM certificates c
      LEFT JOIN equipment_certificates ec ON ec.certificate_id = c.id
      LEFT JOIN users u ON u.id = c.created_by
      GROUP BY c.id, u.name
      ORDER BY c.created_at DESC
    `);
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/certificates/:id ─────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT c.*, u.name AS created_by_name
      FROM certificates c
      LEFT JOIN users u ON u.id = c.created_by
      WHERE c.id = $1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });

    // Get linked equipment
    const { rows: equipment } = await query(`
      SELECT e.id, e.name, e.asset_tag, e.serial_number, e.rig_number, e.location,
             c2.name AS category, c2.color AS category_color
      FROM equipment_certificates ec
      JOIN equipment e ON e.id = ec.equipment_id
      LEFT JOIN categories c2 ON c2.id = e.category_id
      WHERE ec.certificate_id = $1
      ORDER BY e.name
    `, [req.params.id]);

    res.json({ data: rows[0], equipment });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/certificates/equipment/:equipmentId ──────────────
// Get all certificates for a specific equipment item
router.get('/equipment/:equipmentId', authenticate, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT c.*
      FROM certificates c
      JOIN equipment_certificates ec ON ec.certificate_id = c.id
      WHERE ec.equipment_id = $1
      ORDER BY c.created_at DESC
    `, [req.params.equipmentId]);
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/certificates — create + upload file ─────────────
router.post('/', authenticate, requireRepresentative, async (req, res) => {
  try {
    let fileUrl = null, fileName = null;
    let title, certNumber, issuedBy, issuedDate, expiryDate, notes, equipmentIds;

    const contentType = req.headers['content-type'] || '';

    if (contentType.includes('multipart/form-data')) {
      const parts = await parseMultipart(req);
      title        = parts.title       || '';
      certNumber   = parts.cert_number || null;
      issuedBy     = parts.issued_by   || null;
      issuedDate   = parts.issued_date || null;
      expiryDate   = parts.expiry_date || null;
      notes        = parts.notes       || null;
      equipmentIds = parts.equipment_ids ? JSON.parse(parts.equipment_ids) : [];

      if (parts.file && parts.file.data && parts.file.data.length > 0) {
        const uploaded = await uploadToSupabase(
          parts.file.data, parts.file.filename, parts.file.contentType
        );
        fileUrl  = uploaded.publicUrl;
        fileName = parts.file.filename;
      }
    } else {
      // JSON body (no file)
      ({ title, cert_number: certNumber, issued_by: issuedBy,
         issued_date: issuedDate, expiry_date: expiryDate,
         notes, equipment_ids: equipmentIds = [], file_url: fileUrl, file_name: fileName } = req.body);
    }

    if (!title) return res.status(400).json({ error: 'Certificate title is required' });

    const { rows } = await query(`
      INSERT INTO certificates (title, cert_number, issued_by, issued_date, expiry_date, file_url, file_name, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [title, certNumber, issuedBy, issuedDate || null, expiryDate || null, fileUrl, fileName, notes, req.user.id]);

    const cert = rows[0];

    // Link to equipment
    if (Array.isArray(equipmentIds) && equipmentIds.length > 0) {
      for (const eqId of equipmentIds) {
        await query(`
          INSERT INTO equipment_certificates (certificate_id, equipment_id)
          VALUES ($1,$2) ON CONFLICT DO NOTHING
        `, [cert.id, eqId]);
      }
    }

    res.status(201).json({ data: cert, linked: equipmentIds.length });
  } catch (err) {
    console.error('Certificate upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/certificates/:id — update metadata ───────────────
router.put('/:id', authenticate, requireRepresentative, async (req, res) => {
  try {
    const { title, cert_number, issued_by, issued_date, expiry_date, notes, equipment_ids } = req.body;

    const { rows } = await query(`
      UPDATE certificates SET
        title        = COALESCE($1, title),
        cert_number  = COALESCE($2, cert_number),
        issued_by    = COALESCE($3, issued_by),
        issued_date  = COALESCE($4, issued_date),
        expiry_date  = COALESCE($5, expiry_date),
        notes        = COALESCE($6, notes),
        updated_at   = NOW()
      WHERE id = $7 RETURNING *
    `, [title, cert_number, issued_by, issued_date, expiry_date, notes, req.params.id]);

    if (!rows.length) return res.status(404).json({ error: 'Not found' });

    // Update equipment links if provided
    if (Array.isArray(equipment_ids)) {
      await query('DELETE FROM equipment_certificates WHERE certificate_id=$1', [req.params.id]);
      for (const eqId of equipment_ids) {
        await query(`INSERT INTO equipment_certificates (certificate_id, equipment_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [req.params.id, eqId]);
      }
    }

    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/certificates/:id (admin only) ─────────────────
router.delete('/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  try {
    const { rowCount } = await query('DELETE FROM certificates WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/certificates/:id/link — link more equipment ─────
router.post('/:id/link', authenticate, requireRepresentative, async (req, res) => {
  try {
    const { equipment_ids } = req.body;
    if (!Array.isArray(equipment_ids) || equipment_ids.length === 0)
      return res.status(400).json({ error: 'equipment_ids array required' });

    let linked = 0;
    for (const eqId of equipment_ids) {
      await query(`INSERT INTO equipment_certificates (certificate_id, equipment_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [req.params.id, eqId]);
      linked++;
    }
    res.json({ message: `Linked ${linked} equipment items` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/certificates/:id/link/:equipmentId ────────────
router.delete('/:id/link/:equipmentId', authenticate, requireRepresentative, async (req, res) => {
  try {
    await query('DELETE FROM equipment_certificates WHERE certificate_id=$1 AND equipment_id=$2',
      [req.params.id, req.params.equipmentId]);
    res.json({ message: 'Unlinked' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

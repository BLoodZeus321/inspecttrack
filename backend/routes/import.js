const router  = require('express').Router();
const { query, getClient } = require('../db/pool');
const { authenticate, requireRepresentative } = require('../middleware/auth');

const RIG_LOCATIONS = ['BHDC-67','BHDC-68','BHDC-117','BHDC-118','BHDC-YARD'];

// POST /api/import/preview  — validate rows, return errors before committing
router.post('/preview', authenticate, requireRepresentative, async (req, res) => {
  try {
    const { rows: inputRows } = req.body; // array of row objects from frontend
    if (!Array.isArray(inputRows) || inputRows.length === 0) {
      return res.status(400).json({ error: 'No data rows found in the file.' });
    }
    if (inputRows.length > 1000) {
      return res.status(400).json({ error: 'Maximum 1000 rows per import.' });
    }

    // Load categories for lookup
    const { rows: categories } = await query('SELECT id, name FROM categories');
    const catMap = {}; // name (lowercase) → id
    categories.forEach(c => { catMap[c.name.toLowerCase()] = c.id; });

    const errors   = [];
    const warnings = [];
    const valid    = [];

    // Track duplicates within the file itself
    const fileSerialCatPairs = new Set();

    for (let idx = 0; idx < inputRows.length; idx++) {
      const row   = inputRows[idx];
      const rowNum = idx + 2; // Excel row number (1=header, so data starts at 2)
      const rowErrors = [];

      // ── Required fields ───────────────────────────────────
      const name          = (row['Equipment / Tool Name'] || row['name'] || '').toString().trim();
      const serialNumber  = (row['Serial Number']         || row['serial_number'] || '').toString().trim();
      const categoryName  = (row['Category']              || row['category'] || '').toString().trim();
      const rigNumber     = (row['Rig / Location']        || row['rig_number'] || row['location'] || '').toString().trim();

      // Optional fields
      const assetTag       = (row['Asset Tag']          || row['asset_tag']      || '').toString().trim() || null;
      const manufacturer   = (row['Manufacturer']        || row['manufacturer']   || '').toString().trim() || null;
      const model          = (row['Model']               || row['model']          || '').toString().trim() || null;
      const purchaseDate   = (row['Purchase Date']       || row['purchase_date']  || '').toString().trim() || null;
      const notes          = (row['Notes']               || row['notes']          || '').toString().trim() || null;
      // Inspection fields (optional)
      const inspectedBy    = (row['Inspected By']        || row['inspected_by']   || '').toString().trim() || null;
      const inspectionDate = (row['Inspection Date']     || row['inspection_date']|| '').toString().trim() || null;
      const inspResult     = (row['Inspection Result']   || row['result']         || '').toString().trim().toLowerCase() || null;
      const inspNotes      = (row['Inspection Notes']    || row['inspection_notes']|| '').toString().trim() || null;

      if (!name)         rowErrors.push('Equipment/Tool Name is required');
      if (!serialNumber) rowErrors.push('Serial Number is required');
      if (!categoryName) rowErrors.push('Category is required');
      if (!rigNumber)    rowErrors.push('Rig / Location is required');

      // ── Category must exist ───────────────────────────────
      let categoryId = null;
      if (categoryName) {
        categoryId = catMap[categoryName.toLowerCase()];
        if (!categoryId) {
          rowErrors.push(`Category "${categoryName}" not found. Valid categories: ${Object.keys(catMap).map(k => k).join(', ')}`);
        }
      }

      // ── Rig validation (warn if not standard, allow custom) ──
      if (rigNumber && !RIG_LOCATIONS.includes(rigNumber)) {
        warnings.push(`Row ${rowNum}: "${rigNumber}" is a custom location (not a standard rig name)`);
      }

      // ── Duplicate check within the file ───────────────────
      if (serialNumber && categoryId) {
        const key = `${serialNumber.toLowerCase()}::${categoryId}`;
        if (fileSerialCatPairs.has(key)) {
          rowErrors.push(`Duplicate in file: Serial "${serialNumber}" already appears with category "${categoryName}" in a previous row`);
        } else {
          fileSerialCatPairs.add(key);
        }
      }

      // ── Duplicate check against database ─────────────────
      if (serialNumber && categoryId && rowErrors.length === 0) {
        const { rows: existing } = await query(`
          SELECT e.id, e.name FROM equipment e
          WHERE LOWER(e.serial_number) = LOWER($1) AND e.category_id = $2
        `, [serialNumber, categoryId]);
        if (existing.length > 0) {
          rowErrors.push(`Serial "${serialNumber}" already exists under category "${categoryName}" (existing record: "${existing[0].name}")`);
        }
      }

      // ── Validate inspection result if provided ───────────────
      if (inspResult && !['pass','fail','conditional'].includes(inspResult)) {
        rowErrors.push(`Inspection Result "${inspResult}" is invalid. Use: pass, fail, or conditional`);
      }
      if (inspectionDate && isNaN(new Date(inspectionDate).getTime())) {
        rowErrors.push(`Inspection Date "${inspectionDate}" is invalid. Use format YYYY-MM-DD`);
      }
      if (inspectedBy && !inspectionDate) {
        warnings.push(`Row ${rowNum}: "Inspected By" provided but no "Inspection Date" — inspection will not be logged`);
      }

      // ── Parse purchase date ───────────────────────────────
      let parsedDate = null;
      if (purchaseDate) {
        const d = new Date(purchaseDate);
        if (isNaN(d.getTime())) {
          warnings.push(`Row ${rowNum}: Purchase date "${purchaseDate}" is invalid and will be ignored`);
        } else {
          parsedDate = d.toISOString().split('T')[0];
        }
      }

      if (rowErrors.length > 0) {
        errors.push({ row: rowNum, name: name || '(no name)', errors: rowErrors });
      } else {
        valid.push({
          name, serial_number: serialNumber, category_id: categoryId,
          category_name: categoryName, rig_number: rigNumber,
          location: rigNumber, asset_tag: assetTag,
          manufacturer, model, purchase_date: parsedDate,
          notes, status: 'active',
          inspected_by: inspectedBy || null,
          inspection_date: inspectionDate || null,
          inspection_result: inspResult || null,
          inspection_notes: inspNotes || null,
        });
      }
    }

    res.json({
      total:    inputRows.length,
      valid:    valid.length,
      errors:   errors.length,
      warnings: warnings.length,
      error_details:   errors,
      warning_details: warnings,
      preview:  valid.slice(0, 5), // show first 5 valid rows as preview
      can_import: errors.length === 0,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/import/commit  — actually insert all valid rows
router.post('/commit', authenticate, requireRepresentative, async (req, res) => {
  try {
    const { rows: inputRows } = req.body;
    if (!Array.isArray(inputRows) || inputRows.length === 0) {
      return res.status(400).json({ error: 'No rows to import.' });
    }

    // Load categories
    const { rows: categories } = await query('SELECT id, name FROM categories');
    const catMap = {};
    categories.forEach(c => { catMap[c.name.toLowerCase()] = c.id; });

    // Re-validate (don't trust client)
    const toInsert = [];
    const errors   = [];

    for (let idx = 0; idx < inputRows.length; idx++) {
      const row    = inputRows[idx];
      const rowNum = idx + 2;
      const name         = (row['Equipment / Tool Name'] || '').toString().trim();
      const serialNumber = (row['Serial Number']         || '').toString().trim();
      const categoryName = (row['Category']              || '').toString().trim();
      const rigNumber    = (row['Rig / Location']        || '').toString().trim();
      const categoryId   = catMap[categoryName.toLowerCase()];

      if (!name || !serialNumber || !categoryId || !rigNumber) {
        errors.push(`Row ${rowNum}: missing required field`);
        continue;
      }

      const { rows: existing } = await query(`
        SELECT id FROM equipment
        WHERE LOWER(serial_number) = LOWER($1) AND category_id = $2
      `, [serialNumber, categoryId]);
      if (existing.length > 0) {
        errors.push(`Row ${rowNum}: duplicate serial "${serialNumber}" in category "${categoryName}"`);
        continue;
      }

      const purchaseDate = row['Purchase Date'] ? new Date(row['Purchase Date']) : null;

      const inspBy     = (row['Inspected By']       || '').toString().trim() || null;
      const inspDate   = (row['Inspection Date']    || '').toString().trim() || null;
      const inspResult = (row['Inspection Result']  || '').toString().trim().toLowerCase() || null;
      const inspNotes  = (row['Inspection Notes']   || '').toString().trim() || null;
      const parsedInspDate = inspDate ? new Date(inspDate) : null;

      toInsert.push([
        (row['Equipment / Tool Name'] || '').toString().trim(),
        (row['Asset Tag']    || '').toString().trim() || null,
        serialNumber,
        categoryId,
        rigNumber,
        rigNumber,
        (row['Manufacturer'] || '').toString().trim() || null,
        (row['Model']        || '').toString().trim() || null,
        purchaseDate && !isNaN(purchaseDate) ? purchaseDate.toISOString().split('T')[0] : null,
        (row['Notes']        || '').toString().trim() || null,
        req.user.id,
        // inspection data
        inspBy,
        parsedInspDate && !isNaN(parsedInspDate) ? parsedInspDate.toISOString().split('T')[0] : null,
        ['pass','fail','conditional'].includes(inspResult) ? inspResult : null,
        inspNotes,
      ]);
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed on commit', details: errors });
    }

    // Bulk insert in a transaction
    const client = await getClient();
    try {
      await client.query('BEGIN');
      let inserted = 0;
      let inspectionsLogged = 0;

      for (const vals of toInsert) {
        const equipVals = vals.slice(0, 11);
        const [inspBy, inspDate, inspResult, inspNotes] = vals.slice(11);

        const { rows: eqRows } = await client.query(`
          INSERT INTO equipment
            (name, asset_tag, serial_number, category_id, rig_number, location,
             manufacturer, model, purchase_date, notes, created_by, status)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active')
          RETURNING id, category_id
        `, equipVals);

        inserted++;
        const equipId    = eqRows[0].id;
        const categoryId = eqRows[0].category_id;

        // Log inspection if provided
        if (inspBy && inspDate && inspResult) {
          // Get interval from category to compute next due date
          const { rows: catRows } = await client.query(
            'SELECT inspection_interval_days FROM categories WHERE id=$1', [categoryId]
          );
          const interval = catRows[0]?.inspection_interval_days || 365;
          const nextDue  = new Date(inspDate);
          nextDue.setDate(nextDue.getDate() + interval);

          await client.query(`
            INSERT INTO inspections
              (equipment_id, inspected_by, inspection_date, next_due_date, result, notes, created_by)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
          `, [equipId, inspBy, inspDate, nextDue.toISOString().split('T')[0], inspResult, inspNotes, req.user.id]);
          inspectionsLogged++;
        }
      }

      await client.query('COMMIT');
      res.json({
        success: true, inserted, inspections_logged: inspectionsLogged,
        message: `${inserted} equipment records imported successfully. ${inspectionsLogged > 0 ? `${inspectionsLogged} inspection records also logged.` : ''}`,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

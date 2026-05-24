import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../api';
import { Button, AlertBanner, Spinner } from '../components/UI';
import { useAuth } from '../context/AuthContext';

const TEMPLATE_COLS = [
  'Equipment / Tool Name',
  'Serial Number',
  'Category',
  'Rig / Location',
  'Asset Tag',
  'Manufacturer',
  'Model',
  'Purchase Date',
  'Notes',
  'Inspected By',
  'Inspection Date',
  'Inspection Result',
  'Inspection Notes',
];

const SAMPLE_ROWS = [
  {
    'Equipment / Tool Name': 'Chain Block 3T',
    'Serial Number':         'CB-2024-001',
    'Category':              'Lifting Equipment',
    'Rig / Location':        'BHDC-67',
    'Asset Tag':             'LFT-001',
    'Manufacturer':          'Yale',
    'Model':                 'CT3',
    'Purchase Date':         '2024-01-15',
    'Notes':                 '3 Ton capacity',
    'Inspected By':          'John Smith',
    'Inspection Date':       '2024-01-20',
    'Inspection Result':     'pass',
    'Inspection Notes':      'All components in good condition',
  },
  {
    'Equipment / Tool Name': 'Fire Extinguisher CO2',
    'Serial Number':         'FE-2024-055',
    'Category':              'Fire Extinguisher',
    'Rig / Location':        'BHDC-68',
    'Asset Tag':             'FE-055',
    'Manufacturer':          'Kidde',
    'Model':                 'CO2-5KG',
    'Purchase Date':         '2024-03-10',
    'Notes':                 '5kg CO2',
    'Inspected By':          '',
    'Inspection Date':       '',
    'Inspection Result':     '',
    'Inspection Notes':      '',
  },
];

function downloadTemplate() {
  const wb = XLSX.utils.book_new();

  // Instructions sheet
  const instructions = [
    ['InspectTrack — Equipment Import Template'],
    [''],
    ['INSTRUCTIONS:'],
    ['1. Fill in the "Equipment Data" sheet with your equipment details'],
    ['2. Equipment / Tool Name, Serial Number, Category and Rig / Location are REQUIRED'],
    ['3. Category must exactly match one of your categories in InspectTrack'],
    ['4. Rig / Location: BHDC-67, BHDC-68, BHDC-117, BHDC-118, BHDC-YARD, or custom'],
    ['5. Purchase Date and Inspection Date format: YYYY-MM-DD (e.g. 2024-01-15)'],
    ['6. Inspection Result must be: pass, fail, or conditional (leave blank if no inspection yet)'],
    ['7. To log an inspection, fill Inspected By + Inspection Date + Inspection Result together'],
    ['8. Do not change column headers'],
    ['9. Delete the sample rows before importing your real data'],
    [''],
    ['VALID CATEGORIES (copy exactly):'],
    ['Fire Extinguisher'],
    ['Lifting Equipment'],
    ['Pressure Vessel'],
    ['PPE'],
    ['Electrical Tools'],
    ['Hand Tools'],
    ['Vehicle / Forklift'],
    [''],
    ['VALID RIG LOCATIONS:'],
    ['BHDC-67'],
    ['BHDC-68'],
    ['BHDC-117'],
    ['BHDC-118'],
    ['BHDC-YARD'],
    ['Or any custom location name'],
    [''],
    ['INSPECTION RESULT VALUES:'],
    ['pass'],
    ['fail'],
    ['conditional'],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instructions);
  wsInstr['!cols'] = [{ wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instructions');

  // Data sheet with headers + sample rows
  const wsData = XLSX.utils.json_to_sheet(SAMPLE_ROWS, { header: TEMPLATE_COLS });

  // Column widths
  wsData['!cols'] = [
    { wch: 30 }, // Name
    { wch: 20 }, // Serial
    { wch: 22 }, // Category
    { wch: 16 }, // Rig
    { wch: 14 }, // Asset Tag
    { wch: 18 }, // Manufacturer
    { wch: 14 }, // Model
    { wch: 14 }, // Purchase Date
    { wch: 30 }, // Notes
    { wch: 20 }, // Inspected By
    { wch: 16 }, // Inspection Date
    { wch: 20 }, // Inspection Result
    { wch: 30 }, // Inspection Notes
  ];

  XLSX.utils.book_append_sheet(wb, wsData, 'Equipment Data');
  XLSX.writeFile(wb, 'InspectTrack_Import_Template.xlsx');
}

export default function ImportPage() {
  const { user }  = useAuth();
  const fileRef   = useRef();
  const [step, setStep]         = useState('upload'); // upload | preview | importing | done
  const [fileName, setFileName] = useState('');
  const [rawRows, setRawRows]   = useState([]);
  const [preview, setPreview]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [result, setResult]     = useState(null);

  const canEdit = ['admin','representative'].includes(user?.role);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb    = XLSX.read(evt.target.result, { type: 'binary', cellDates: true });
        // Try "Equipment Data" sheet first, then first sheet
        const sheetName = wb.SheetNames.includes('Equipment Data')
          ? 'Equipment Data' : wb.SheetNames[0];
        const ws   = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (rows.length === 0) { setError('No data rows found in the file.'); return; }

        // Convert date objects to strings
        const cleaned = rows.map(row => {
          const out = {};
          for (const [k, v] of Object.entries(row)) {
            if (v instanceof Date) {
              out[k] = v.toISOString().split('T')[0];
            } else {
              out[k] = v;
            }
          }
          return out;
        });

        setRawRows(cleaned);
        setStep('upload');
      } catch (err) {
        setError('Could not read the file. Make sure it is a valid .xlsx file.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const validate = async () => {
    if (!rawRows.length) { setError('Please select a file first.'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post('/import/preview', { rows: rawRows });
      setPreview(res);
      setStep('preview');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const commitImport = async () => {
    setLoading(true); setError('');
    setStep('importing');
    try {
      const res = await api.post('/import/commit', { rows: rawRows });
      setResult(res);
      setStep('done');
    } catch (err) {
      setError(err.message);
      setStep('preview');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep('upload'); setFileName(''); setRawRows([]);
    setPreview(null); setResult(null); setError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 4px' }}>Import Equipment</h1>
        <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
          Bulk import equipment and tools from an Excel spreadsheet
        </p>
      </div>

      <AlertBanner type="error" message={error} onClose={() => setError('')} />

      {/* ── Step 1: Upload ── */}
      {(step === 'upload') && (
        <>
          {/* Download template */}
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12,
            padding: '20px 24px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#1e40af', marginBottom: 4 }}>
                📥 Step 1 — Download the template
              </div>
              <div style={{ fontSize: 13, color: '#3b82f6' }}>
                Fill in your equipment data using the provided Excel template. Don't change the column headers.
              </div>
            </div>
            <Button onClick={downloadTemplate} variant="secondary" style={{ flexShrink: 0, marginLeft: 16 }}>
              ⬇ Download Template
            </Button>
          </div>

          {/* Upload area */}
          <div style={{ background: '#fff', border: '2px dashed #d1d5db', borderRadius: 12,
            padding: '40px 24px', textAlign: 'center', marginBottom: 20,
            cursor: 'pointer', transition: 'border-color .15s' }}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#3b82f6'; }}
            onDragLeave={e => e.currentTarget.style.borderColor = '#d1d5db'}
            onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#d1d5db';
              const file = e.dataTransfer.files[0]; if (file) { fileRef.current.files = e.dataTransfer.files; handleFile({ target: { files: [file] } }); } }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a', marginBottom: 6 }}>
              {fileName ? `✅ ${fileName}` : 'Click to select or drag & drop your Excel file'}
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>Supports .xlsx and .xls files · Max 1000 rows</div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile}
              style={{ display: 'none' }} />
          </div>

          {rawRows.length > 0 && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
              padding: '12px 16px', marginBottom: 20, fontSize: 14, color: '#166534' }}>
              ✅ <strong>{rawRows.length} rows</strong> loaded from "{fileName}". Click Validate to check for errors.
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <Button onClick={validate} disabled={!rawRows.length || loading}>
              {loading ? <><Spinner size={16} /> Validating…</> : '→ Validate Data'}
            </Button>
            {rawRows.length > 0 && (
              <Button variant="secondary" onClick={reset}>Clear</Button>
            )}
          </div>
        </>
      )}

      {/* ── Step 2: Preview / Errors ── */}
      {step === 'preview' && preview && (
        <>
          {/* Summary bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Rows',  value: preview.total,    color: '#1e293b' },
              { label: 'Valid',       value: preview.valid,    color: '#16a34a' },
              { label: 'Errors',      value: preview.errors,   color: '#dc2626' },
              { label: 'Warnings',    value: preview.warnings, color: '#d97706' },
            ].map(s => (
              <div key={s.label} style={{ background: '#fff', border: '1.5px solid #e2e8f0',
                borderRadius: 10, padding: '14px 18px', borderTop: `4px solid ${s.color}` }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Errors — must fix before importing */}
          {preview.error_details?.length > 0 && (
            <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 12,
              padding: 20, marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#991b1b', margin: '0 0 14px' }}>
                ❌ {preview.error_details.length} Error{preview.error_details.length !== 1 ? 's' : ''} Found — Fix these before importing
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {preview.error_details.map((e, i) => (
                  <div key={i} style={{ background: '#fff', borderRadius: 8, padding: '10px 14px',
                    border: '1px solid #fecaca' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#991b1b', marginBottom: 4 }}>
                      Row {e.row}: {e.name}
                    </div>
                    {e.errors.map((err, j) => (
                      <div key={j} style={{ fontSize: 12, color: '#dc2626', marginLeft: 8 }}>• {err}</div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings — informational only */}
          {preview.warning_details?.length > 0 && (
            <div style={{ background: '#fefce8', border: '1.5px solid #fef08a', borderRadius: 12,
              padding: 20, marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#854d0e', margin: '0 0 12px' }}>
                ⚠ {preview.warning_details.length} Warning{preview.warning_details.length !== 1 ? 's' : ''} — Import will still proceed
              </h3>
              {preview.warning_details.map((w, i) => (
                <div key={i} style={{ fontSize: 13, color: '#92400e', marginBottom: 4 }}>• {w}</div>
              ))}
            </div>
          )}

          {/* Preview of valid rows */}
          {preview.valid > 0 && (
            <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12,
              overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ padding: '12px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
                fontSize: 13, fontWeight: 600, color: '#374151' }}>
                Preview of valid rows (first {Math.min(5, preview.valid)} of {preview.valid})
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead><tr style={{ background: '#f8fafc' }}>
                    {['Name','Serial No.','Category','Rig','Manufacturer','Model'].map(h => (
                      <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600,
                        color: '#64748b', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {preview.preview?.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 14px', fontWeight: 600 }}>{row.name}</td>
                        <td style={{ padding: '8px 14px', fontFamily: 'monospace', color: '#64748b' }}>{row.serial_number}</td>
                        <td style={{ padding: '8px 14px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px',
                            borderRadius: 4, background: '#eff6ff', color: '#1e40af' }}>{row.category_name}</span>
                        </td>
                        <td style={{ padding: '8px 14px', color: '#64748b' }}>{row.rig_number}</td>
                        <td style={{ padding: '8px 14px', color: '#64748b' }}>{row.manufacturer || '—'}</td>
                        <td style={{ padding: '8px 14px', color: '#64748b' }}>{row.model || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Button variant="secondary" onClick={reset}>← Start Over</Button>
            {preview.can_import ? (
              <Button variant="success" onClick={commitImport} disabled={loading}>
                {loading ? 'Importing…' : `✅ Import ${preview.valid} Equipment Records`}
              </Button>
            ) : (
              <div style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>
                Fix the {preview.errors} error{preview.errors !== 1 ? 's' : ''} in your Excel file and re-upload
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Step 3: Importing ── */}
      {step === 'importing' && (
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <Spinner size={48} />
          <div style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginTop: 16 }}>
            Importing equipment records…
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>Please wait, do not close this page</div>
        </div>
      )}

      {/* ── Step 4: Done ── */}
      {step === 'done' && result && (
        <div style={{ background: '#f0fdf4', border: '2px solid #86efac', borderRadius: 16,
          padding: '40px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#166534', margin: '0 0 8px' }}>
            Import Successful!
          </h2>
          <p style={{ fontSize: 16, color: '#374151', margin: '0 0 24px' }}>
            <strong>{result.inserted}</strong> equipment records have been added to InspectTrack.
          {result.inspections_logged > 0 && (
            <span> <strong>{result.inspections_logged}</strong> inspection records also logged.</span>
          )}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Button onClick={() => window.location.href = '/equipment'}>View Equipment List</Button>
            <Button variant="secondary" onClick={reset}>Import More</Button>
          </div>
        </div>
      )}

    </div>
  );
}

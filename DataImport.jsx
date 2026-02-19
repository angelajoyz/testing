import React, { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Alert,
  CircularProgress, Chip, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  InsertDriveFile as FileIcon,
  CloudQueue as CloudIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  HealthAndSafety as HealthAndSafetyIcon,
  CloudDone as CloudDoneIcon,
  Close as CloseIcon,
  InfoOutlined as InfoOutlinedIcon,
} from '@mui/icons-material';
import Sidebar, { T } from './Sidebar';
import { getBarangays } from './api.js';

// ── Shared sub-components ──────────────────────────────────────────────────────
const SCard = ({ children, sx = {} }) => (
  <Card sx={{ borderRadius: '10px', backgroundColor: T.cardBg, border: `1px solid ${T.border}`, boxShadow: 'none', ...sx }}>
    {children}
  </Card>
);

const CardHead = ({ title, icon }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1.5, mb: 1.75, borderBottom: `1px solid ${T.borderSoft}` }}>
    {icon && <Box sx={{ color: T.blue, display: 'flex', alignItems: 'center' }}>{icon}</Box>}
    <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textHead }}>{title}</Typography>
  </Box>
);

// ── DataImport ─────────────────────────────────────────────────────────────────
const DataImport = ({ onNavigate, onLogout, onDataUploaded }) => {
  const [dragActive, setDragActive]             = useState(false);
  const [selectedFile, setSelectedFile]         = useState(null);
  const [validationStatus, setValidationStatus] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [barangays, setBarangays]               = useState([]);
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [diseaseColumns, setDiseaseColumns]     = useState([]);

  const handleDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFileSelection(e.dataTransfer.files[0]);
  };

  const handleFileInput = (e) => {
    if (e.target.files?.[0]) handleFileSelection(e.target.files[0]);
  };

  const handleFileSelection = async (file) => {
    const validTypes = ['.csv', '.xlsx', '.xls'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validTypes.includes(ext)) { alert('Please upload only CSV or Excel files (.xlsx, .xls)'); return; }

    setSelectedFile(file);
    setValidationStatus('loading');
    setBarangays([]); setSelectedBarangay(''); setDiseaseColumns([]); setValidationErrors([]);

    try {
      const response = await getBarangays(file);
      setBarangays(response.barangays);
      if (response.barangays?.length > 0) localStorage.setItem('availableBarangays', JSON.stringify(response.barangays));
      if (response.disease_columns?.length > 0) {
        setDiseaseColumns(response.disease_columns);
        localStorage.setItem('diseaseColumns', JSON.stringify(response.disease_columns));
      }
      setValidationStatus('success');
    } catch (error) {
      setValidationStatus('error');
      setValidationErrors([error.message]);
    }
  };

  const handleProcessData = () => {
    if (!selectedBarangay) { alert('Please select a barangay first'); return; }
    const uploadedData = { file: selectedFile, barangay: selectedBarangay, uploadDate: new Date().toISOString() };
    if (onDataUploaded) onDataUploaded(uploadedData);
    localStorage.setItem('uploadedData', JSON.stringify({
      fileName: selectedFile.name, fileSize: selectedFile.size,
      barangay: selectedBarangay, uploadDate: uploadedData.uploadDate,
    }));
    onNavigate?.('prediction');
  };

  const handleNewUpload = () => {
    setSelectedFile(null); setValidationStatus(null); setValidationErrors([]);
    setBarangays([]); setSelectedBarangay(''); setDiseaseColumns([]);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: T.pageBg }}>
      <Sidebar currentPage="dataimport" onNavigate={onNavigate} onLogout={onLogout} />

      <Box sx={{ flex: 1, overflow: 'auto', p: '28px 24px', minWidth: 0 }}>

        {/* Page header */}
        <Box sx={{ mb: 2.75 }}>
          <Typography sx={{ fontSize: 18, fontWeight: 700, color: T.textHead, letterSpacing: '-0.3px' }}>
            Data Import
          </Typography>
          <Typography sx={{ fontSize: 12, color: T.textMuted, mt: 0.4 }}>
            Upload health data and select barangay for forecasting
          </Typography>
        </Box>

        {/* Step 1 — Upload */}
        <SCard sx={{ mb: '14px' }}>
          <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
            <CardHead title="Step 1: Upload Dataset" icon={<CloudIcon sx={{ fontSize: 16 }} />} />

            {!selectedFile ? (
              <Box
                onDragEnter={handleDrag} onDragOver={handleDrag}
                onDragLeave={handleDrag} onDrop={handleDrop}
                onClick={() => document.getElementById('file-input').click()}
                sx={{
                  border: `2px dashed ${dragActive ? T.blue : T.borderSoft}`,
                  borderRadius: '10px', p: '48px 24px', textAlign: 'center',
                  backgroundColor: dragActive ? T.blueDim : T.rowBg,
                  cursor: 'pointer', transition: 'all 0.2s',
                  '&:hover': { borderColor: T.blue, backgroundColor: T.blueDim },
                }}>
                <CloudUploadIcon sx={{ fontSize: 48, color: dragActive ? T.blue : T.textFaint, mb: 1.5 }} />
                <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: T.textHead, mb: 0.5 }}>
                  Drag and drop your file here
                </Typography>
                <Typography sx={{ fontSize: 12, color: T.textMuted, mb: 0.5 }}>or click to browse</Typography>
                <Typography sx={{ fontSize: 11, color: T.textFaint }}>Supported formats: .xlsx, .xls</Typography>
                <input id="file-input" type="file" accept=".xlsx,.xls" onChange={handleFileInput} style={{ display: 'none' }} />
              </Box>
            ) : (
              <Box>
                {/* File info row */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: '10px 14px', borderRadius: '8px', backgroundColor: T.rowBg, border: `1px solid ${T.borderSoft}`, mb: 1.5 }}>
                  <FileIcon sx={{ fontSize: 20, color: T.blue, flexShrink: 0 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textHead, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {selectedFile.name}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: T.textMuted }}>{(selectedFile.size / 1024).toFixed(2)} KB</Typography>
                  </Box>
                  <Box onClick={handleNewUpload}
                    sx={{ cursor: 'pointer', p: 0.5, borderRadius: '4px', color: T.textMuted, '&:hover': { color: T.danger, backgroundColor: T.dangerBg } }}>
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </Box>
                </Box>

                {validationStatus === 'loading' && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: '10px 14px', borderRadius: '8px', backgroundColor: T.rowBg }}>
                    <CircularProgress size={16} sx={{ color: T.blue }} />
                    <Typography sx={{ fontSize: 12.5, color: T.textMuted }}>Scanning file for barangays and disease data…</Typography>
                  </Box>
                )}

                {validationStatus === 'success' && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: '9px 14px', borderRadius: '8px', backgroundColor: T.okBg, border: `1px solid ${T.okBorder}` }}>
                      <CheckCircleIcon sx={{ fontSize: 15, color: T.ok, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: 12.5, color: T.ok, fontWeight: 500 }}>
                        File validated! {barangays.length} barangay{barangays.length > 1 ? 's' : ''} found.
                      </Typography>
                    </Box>

                    {diseaseColumns.length > 0 && (
                      <Box sx={{ p: '10px 14px', borderRadius: '8px', backgroundColor: T.blueDim, border: `1px solid rgba(27,79,138,0.18)` }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: T.blue, mb: 0.75 }}>
                          Detected {diseaseColumns.length} disease type{diseaseColumns.length > 1 ? 's' : ''}:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                          {diseaseColumns.map(col => (
                            <Chip key={col} size="small"
                              label={col.replace(/_cases$/, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              sx={{ backgroundColor: T.cardBg, color: T.blue, border: `1px solid rgba(27,79,138,0.2)`, fontWeight: 500, fontSize: 10.5, borderRadius: '4px', height: 20 }}
                            />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                )}

                {validationStatus === 'error' && (
                  <Box sx={{ p: '10px 14px', borderRadius: '8px', backgroundColor: T.dangerBg, border: `1px solid ${T.dangerBorder}` }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <ErrorIcon sx={{ fontSize: 15, color: T.danger }} />
                      <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: T.danger }}>Validation Failed</Typography>
                    </Box>
                    {validationErrors.map((err, i) => (
                      <Typography key={i} sx={{ fontSize: 12, color: T.danger, pl: 3 }}>• {err}</Typography>
                    ))}
                  </Box>
                )}
              </Box>
            )}
          </CardContent>
        </SCard>

        {/* Step 2 — Barangay */}
        {validationStatus === 'success' && barangays.length > 0 && (
          <SCard sx={{ mb: '14px' }}>
            <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
              <CardHead title="Step 2: Select Barangay" icon={<HealthAndSafetyIcon sx={{ fontSize: 16 }} />} />

              <FormControl fullWidth size="small">
                <InputLabel sx={{ fontSize: 13 }}>Choose Barangay</InputLabel>
                <Select value={selectedBarangay} label="Choose Barangay"
                  onChange={(e) => setSelectedBarangay(e.target.value)}
                  sx={{
                    borderRadius: '8px', fontSize: 13,
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: T.blue },
                  }}>
                  <MenuItem value="" sx={{ fontSize: 13, color: T.textMuted }}>— Select Barangay —</MenuItem>
                  {barangays.map(b => <MenuItem key={b} value={b} sx={{ fontSize: 13 }}>{b}</MenuItem>)}
                </Select>
              </FormControl>

              {selectedBarangay && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, p: '9px 14px', borderRadius: '8px', backgroundColor: T.blueDim, border: `1px solid rgba(27,79,138,0.18)` }}>
                  <InfoOutlinedIcon sx={{ fontSize: 14, color: T.blue, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: 12.5, color: T.blue }}>
                    Selected: <strong>{selectedBarangay}</strong>
                  </Typography>
                </Box>
              )}
            </CardContent>
          </SCard>
        )}

        {/* Step 3 — Save & Continue */}
        {selectedBarangay && (
          <SCard>
            <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
              <CardHead title="Step 3: Save & Continue" icon={<CloudDoneIcon sx={{ fontSize: 16 }} />} />

              <Button variant="contained" size="large" fullWidth onClick={handleProcessData}
                startIcon={<CloudDoneIcon sx={{ fontSize: 17 }} />}
                sx={{
                  backgroundColor: T.blue, color: '#fff', textTransform: 'none',
                  fontWeight: 600, fontSize: 13.5, borderRadius: '8px', py: 1.25,
                  boxShadow: '0 2px 10px rgba(27,79,138,0.25)',
                  '&:hover': { backgroundColor: T.blueMid, boxShadow: '0 3px 14px rgba(27,79,138,0.32)' },
                }}>
                Save & Go to Prediction
              </Button>

              <Typography sx={{ fontSize: 11.5, color: T.textFaint, textAlign: 'center', mt: 1.5 }}>
                This will save your file and barangay selection for forecasting
              </Typography>
            </CardContent>
          </SCard>
        )}

      </Box>
    </Box>
  );
};


export default DataImport;

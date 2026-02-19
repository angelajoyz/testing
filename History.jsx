import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Button,
  Chip, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Select, MenuItem,
  Switch, FormControlLabel, Alert,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  LocalHospital as MedicalIcon,
  Group as GroupIcon,
  CalendarMonth as CalendarIcon,
  InfoOutlined as InfoOutlinedIcon,
} from '@mui/icons-material';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  BarChart, Bar, ComposedChart,
} from 'recharts';
import Sidebar, { T } from './Sidebar';

// ── Shared sub-components ──────────────────────────────────────────────────────
const SCard = ({ children, sx = {} }) => (
  <Card sx={{ borderRadius: '10px', backgroundColor: T.cardBg, border: `1px solid ${T.border}`, boxShadow: 'none', ...sx }}>
    {children}
  </Card>
);

const CardHead = ({ title, right }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1.5, mb: 1.5, borderBottom: `1px solid ${T.borderSoft}` }}>
    <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textHead }}>{title}</Typography>
    {right}
  </Box>
);

const Tag = ({ label, bg, color, border }) => (
  <Chip label={label} size="small" sx={{
    backgroundColor: bg, color, border: `1px solid ${border}`,
    fontWeight: 500, fontSize: 10.5, borderRadius: '4px', height: 20,
  }} />
);

const tooltipStyle = {
  borderRadius: '8px', border: `1px solid ${T.border}`,
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12, color: T.textBody, background: T.cardBg,
};

const LabelSx = { fontSize: 11, fontWeight: 600, color: T.textMuted, mb: 0.5 };
const SelectSx = {
  minWidth: 150, backgroundColor: T.cardBg, borderRadius: '8px', fontSize: 13,
  '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: T.blue },
};

// ── History ────────────────────────────────────────────────────────────────────
const History = ({ onNavigate, onLogout }) => {
  const [selectedDisease, setSelectedDisease]   = useState('all');
  const [selectedYear, setSelectedYear]         = useState('all');
  const [selectedMonth, setSelectedMonth]       = useState('all');
  const [selectedBarangay, setSelectedBarangay] = useState('all');
  const [climateOverlay, setClimateOverlay]     = useState(false);
  const [climateType, setClimateType]           = useState('temperature');

  const [forecastHistory, setForecastHistory]     = useState([]);
  const [availableDiseases, setAvailableDiseases] = useState([]);
  const [availableBarangays, setAvailableBarangays] = useState([]);
  const [monthlyData, setMonthlyData]             = useState([]);
  const [hasData, setHasData]                     = useState(false);

  useEffect(() => {
    loadDataFromStorage();
    const savedBarangays = localStorage.getItem('availableBarangays');
    if (savedBarangays) {
      try { setAvailableBarangays(JSON.parse(savedBarangays)); } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    if (hasData) processMonthlyData();
  }, [selectedDisease, selectedYear, selectedMonth, selectedBarangay, forecastHistory]);

  const loadDataFromStorage = () => {
    try {
      const historyData = localStorage.getItem('forecastHistory');
      if (historyData) {
        const parsed = JSON.parse(historyData);
        setForecastHistory(parsed);
        setHasData(parsed.length > 0);
        const histBarangays = Array.from(new Set(parsed.map(i => i.barangay).filter(Boolean)));
        const savedBarangays = localStorage.getItem('availableBarangays');
        if (savedBarangays) {
          try { setAvailableBarangays(JSON.parse(savedBarangays)); } catch { setAvailableBarangays(histBarangays); }
        } else { setAvailableBarangays(histBarangays); }
      }
      const diseasesData = localStorage.getItem('diseaseColumns');
      if (diseasesData) setAvailableDiseases(JSON.parse(diseasesData));
    } catch (error) { console.error('Error loading history data:', error); }
  };

  const processMonthlyData = () => {
    if (!forecastHistory?.length) return;
    let filtered = forecastHistory;
    if (selectedDisease !== 'all') filtered = filtered.filter(i => i.disease === selectedDisease);
    if (selectedYear !== 'all') filtered = filtered.filter(i => i.period?.startsWith(selectedYear));
    if (selectedMonth !== 'all') {
      const monthNum = String(parseInt(selectedMonth) + 1).padStart(2, '0');
      filtered = filtered.filter(i => i.period?.endsWith(monthNum));
    }
    if (selectedBarangay !== 'all') filtered = filtered.filter(i => i.barangay === selectedBarangay);

    const monthlyMap = {};
    filtered.forEach(item => {
      const m = item.period;
      if (!monthlyMap[m]) monthlyMap[m] = { month: m, patients: 0, count: 0, temperature: 25 + Math.random() * 5, rainfall: 80 + Math.random() * 60, humidity: 65 + Math.random() * 15 };
      monthlyMap[m].patients += item.predictedValue || 0;
      monthlyMap[m].count += 1;
    });

    setMonthlyData(
      Object.values(monthlyMap)
        .map(i => ({ ...i, patients: Math.round(i.patients / (i.count || 1)) }))
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-9)
    );
  };

  const buildHistoricalRecords = () => {
    if (!forecastHistory?.length) return [];
    let filtered = forecastHistory;
    if (selectedBarangay !== 'all') filtered = filtered.filter(i => i.barangay === selectedBarangay);
    if (selectedDisease !== 'all') filtered = filtered.filter(i => i.disease === selectedDisease);
    if (selectedYear !== 'all') filtered = filtered.filter(i => i.period?.startsWith(selectedYear));
    if (selectedMonth !== 'all') {
      const monthNum = String(parseInt(selectedMonth) + 1).padStart(2, '0');
      filtered = filtered.filter(i => i.period?.endsWith(monthNum));
    }
    const monthlyRecords = {};
    filtered.forEach(item => {
      const m = item.period;
      if (!monthlyRecords[m]) monthlyRecords[m] = { id: m, month: m, totalPatients: 0, diseases: {}, trends: [] };
      monthlyRecords[m].totalPatients += item.predictedValue || 0;
      monthlyRecords[m].diseases[item.label] = (monthlyRecords[m].diseases[item.label] || 0) + 1;
      monthlyRecords[m].trends.push(item.trend);
    });
    return Object.values(monthlyRecords).map(r => ({
      id: r.id, month: r.month,
      totalPatients: Math.round(r.totalPatients),
      topIllness: Object.keys(r.diseases).sort((a, b) => r.diseases[b] - r.diseases[a])[0] || 'N/A',
      trend: r.trends.filter(t => t === 'increasing').length > r.trends.filter(t => t === 'decreasing').length ? 'increase' : 'decrease',
    })).sort((a, b) => b.month.localeCompare(a.month)).slice(0, 10);
  };

  const historicalRecords = buildHistoricalRecords();
  const totalPatients = monthlyData.reduce((s, i) => s + (i.patients || 0), 0);
  const avgMonthly = monthlyData.length > 0 ? Math.round(totalPatients / monthlyData.length) : 0;
  const peakMonthly = monthlyData.length > 0 ? Math.max(...monthlyData.map(i => i.patients || 0)) : 0;

  const diseases = [
    { value: 'all', label: 'All Diseases' },
    ...availableDiseases.map(d => ({
      value: d,
      label: d.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).replace(/ Cases$/i, ''),
    })),
  ];

  const getAvailableYears = () => {
    const years = new Set();
    forecastHistory.forEach(i => { if (i.period) years.add(i.period.substring(0, 4)); });
    return [{ value: 'all', label: 'All Years' }, ...Array.from(years).sort().map(y => ({ value: y, label: y }))];
  };

  const months = [
    { value: 'all', label: 'All Months' },
    ...'January,February,March,April,May,June,July,August,September,October,November,December'
      .split(',').map((label, i) => ({ value: String(i), label })),
  ];

  const climateTypes = [
    { value: 'temperature', label: 'Temperature' },
    { value: 'rainfall', label: 'Rainfall' },
    { value: 'humidity', label: 'Humidity' },
  ];

  const getClimateDataKey = () => climateType;
  const climateLineColor = climateType === 'temperature' ? T.danger : climateType === 'rainfall' ? '#4ECDC4' : '#95E1D3';

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: T.pageBg }}>
      <Sidebar currentPage="history" onNavigate={onNavigate} onLogout={onLogout} />

      <Box sx={{ flex: 1, overflow: 'auto', p: '28px 24px', minWidth: 0 }}>

        {/* Page header */}
        <Box sx={{ mb: 2.75 }}>
          <Typography sx={{ fontSize: 18, fontWeight: 700, color: T.textHead, letterSpacing: '-0.3px' }}>
            History
          </Typography>
          <Typography sx={{ fontSize: 12, color: T.textMuted, mt: 0.4 }}>
            View historical disease data and trends over time
          </Typography>
        </Box>

        {/* No data alert */}
        {!hasData && (
          <Alert severity="info" icon={<InfoOutlinedIcon fontSize="small" />}
            sx={{ mb: 2.5, borderRadius: '10px', backgroundColor: T.blueDim, color: T.textHead, border: `1px solid rgba(27,79,138,0.18)`, fontSize: 13, '& .MuiAlert-icon': { color: T.blue } }}>
            <strong>No forecast history available.</strong>{' '}
            Generate predictions from the{' '}
            <Typography component="span" onClick={() => onNavigate?.('prediction')}
              sx={{ fontSize: 13, fontWeight: 600, cursor: 'pointer', color: T.blue, '&:hover': { opacity: 0.75 } }}>
              Prediction 
            </Typography>{' '}
            page to view historical data here.
          </Alert>
        )}

        {/* Filters */}
        <SCard sx={{ mb: '16px' }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>

              <Box>
                <Typography sx={LabelSx}>Disease</Typography>
                <Select value={selectedDisease} size="small" sx={SelectSx}
                  onChange={(e) => setSelectedDisease(e.target.value)}>
                  {diseases.map(d => <MenuItem key={d.value} value={d.value} sx={{ fontSize: 13 }}>{d.label}</MenuItem>)}
                </Select>
              </Box>

              <Box>
                <Typography sx={LabelSx}>Year</Typography>
                <Select value={selectedYear} size="small" sx={{ ...SelectSx, minWidth: 120 }}
                  onChange={(e) => setSelectedYear(e.target.value)}>
                  {getAvailableYears().map(y => <MenuItem key={y.value} value={y.value} sx={{ fontSize: 13 }}>{y.label}</MenuItem>)}
                </Select>
              </Box>

              <Box>
                <Typography sx={LabelSx}>Month</Typography>
                <Select value={selectedMonth} size="small" sx={{ ...SelectSx, minWidth: 135 }}
                  onChange={(e) => setSelectedMonth(e.target.value)}>
                  {months.map(m => <MenuItem key={m.value} value={m.value} sx={{ fontSize: 13 }}>{m.label}</MenuItem>)}
                </Select>
              </Box>

              <Box>
                <Typography sx={LabelSx}>Barangay</Typography>
                <Select value={selectedBarangay} size="small" sx={SelectSx}
                  onChange={(e) => setSelectedBarangay(e.target.value)}>
                  <MenuItem value="all" sx={{ fontSize: 13 }}>All Barangays</MenuItem>
                  {availableBarangays.map(b => <MenuItem key={b} value={b} sx={{ fontSize: 13 }}>{b}</MenuItem>)}
                </Select>
              </Box>

              {/* Climate Overlay */}
              <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <FormControlLabel
                  control={<Switch checked={climateOverlay} onChange={(e) => setClimateOverlay(e.target.checked)}
                    size="small" sx={{ '& .MuiSwitch-thumb': { width: 14, height: 14 }, '& .MuiSwitch-track': { borderRadius: 7 } }} />}
                  label={<Typography sx={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>Climate Overlay</Typography>}
                  sx={{ m: 0 }}
                />
                {climateOverlay && (
                  <Select value={climateType} size="small" sx={{ ...SelectSx, minWidth: 130 }}
                    onChange={(e) => setClimateType(e.target.value)}>
                    {climateTypes.map(t => <MenuItem key={t.value} value={t.value} sx={{ fontSize: 13 }}>{t.label}</MenuItem>)}
                  </Select>
                )}
              </Box>
            </Box>
          </CardContent>
        </SCard>

        {/* Stat cards */}
        {hasData && (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', mb: '16px' }}>
            <SCard sx={{ borderTop: `3px solid ${T.blue}` }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: T.textMuted }}>Avg Monthly Patients</Typography>
                  <Box sx={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: T.blueDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CalendarIcon sx={{ fontSize: 14, color: T.blue }} />
                  </Box>
                </Box>
                <Typography sx={{ fontSize: 26, fontWeight: 700, color: T.textHead, lineHeight: 1, mb: 0.5, letterSpacing: '-0.5px' }}>{avgMonthly.toLocaleString()}</Typography>
                <Typography sx={{ fontSize: 11, color: T.textMuted }}>Average monthly patients</Typography>
              </CardContent>
            </SCard>

            <SCard sx={{ borderTop: `3px solid ${T.ok}` }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: T.textMuted }}>Peak Monthly</Typography>
                  <Box sx={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: T.okBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrendingUpIcon sx={{ fontSize: 14, color: T.ok }} />
                  </Box>
                </Box>
                <Typography sx={{ fontSize: 26, fontWeight: 700, color: T.textHead, lineHeight: 1, mb: 0.5, letterSpacing: '-0.5px' }}>{peakMonthly.toLocaleString()}</Typography>
                <Typography sx={{ fontSize: 11, color: T.textMuted }}>Highest recorded month</Typography>
              </CardContent>
            </SCard>

            <SCard sx={{ borderTop: `3px solid ${T.neutralBar}` }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: T.textMuted }}>Total (Period)</Typography>
                  <Box sx={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <GroupIcon sx={{ fontSize: 14, color: T.neutralBar }} />
                  </Box>
                </Box>
                <Typography sx={{ fontSize: 26, fontWeight: 700, color: T.textHead, lineHeight: 1, mb: 0.5, letterSpacing: '-0.5px' }}>{totalPatients.toLocaleString()}</Typography>
                <Typography sx={{ fontSize: 11, color: T.textMuted }}>Total patients in period</Typography>
              </CardContent>
            </SCard>
          </Box>
        )}

        {/* Chart */}
        {hasData && monthlyData.length > 0 && (
          <SCard sx={{ mb: '16px' }}>
            <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2 } }}>
              <CardHead title="Historical Patient Count" right={<Typography sx={{ fontSize: 11, color: T.textMuted }}>Last 9 periods</Typography>} />
              <ResponsiveContainer width="100%" height={230}>
                {climateOverlay ? (
                  <ComposedChart data={monthlyData} margin={{ top: 6, right: 30, left: -14, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.borderSoft} vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} style={{ fontSize: 10.5, fill: T.textFaint }} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} style={{ fontSize: 10.5, fill: T.textFaint }} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} style={{ fontSize: 10.5, fill: T.textFaint }} />
                    <RechartsTooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ paddingTop: 10, fontSize: 11 }} iconType="circle" />
                    <Bar yAxisId="left" dataKey="patients" fill={T.blue} name="Patients" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    <Line yAxisId="right" type="monotone" dataKey={getClimateDataKey()}
                      stroke={climateLineColor} name={climateType.charAt(0).toUpperCase() + climateType.slice(1)}
                      strokeWidth={2} dot={{ r: 3.5, fill: climateLineColor, strokeWidth: 0 }} />
                  </ComposedChart>
                ) : (
                  <BarChart data={monthlyData} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.borderSoft} vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} style={{ fontSize: 10.5, fill: T.textFaint }} />
                    <YAxis axisLine={false} tickLine={false} style={{ fontSize: 10.5, fill: T.textFaint }} />
                    <RechartsTooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ paddingTop: 10, fontSize: 11 }} iconType="circle" />
                    <Bar dataKey="patients" fill={T.blue} name="Patients" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </CardContent>
          </SCard>
        )}

        {/* Historical Records Table */}
        <SCard>
          <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2 } }}>
            <CardHead
              title="Historical Records"
              right={hasData && <Tag label={`${historicalRecords.length} records`} bg={T.blueDim} color={T.blue} border="rgba(27,79,138,0.18)" />}
            />

            {!hasData || historicalRecords.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <MedicalIcon sx={{ fontSize: 48, color: T.borderSoft, mb: 1.5 }} />
                <Typography sx={{ fontSize: 13, fontWeight: 500, color: T.textMuted }}>No patient data for this period</Typography>
                <Typography sx={{ fontSize: 12, color: T.textFaint, mt: 0.5 }}>Generate predictions to see historical trends</Typography>
                <Button variant="contained" startIcon={<TrendingUpIcon sx={{ fontSize: 15 }} />}
                  onClick={() => onNavigate?.('prediction')}
                  sx={{ mt: 2.5, textTransform: 'none', fontSize: 13, fontWeight: 600, borderRadius: '8px', backgroundColor: T.blue, '&:hover': { backgroundColor: T.blueMid }, px: 2.5, py: 0.9 }}>
                  Go to Prediction
                </Button>
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['Month', 'Total Patients', 'Top Illness', 'Trend'].map(col => (
                        <TableCell key={col} sx={{ fontSize: 11, fontWeight: 600, color: T.textMuted, borderBottom: `1px solid ${T.borderSoft}`, py: 1.25, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {col}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {historicalRecords.map((record) => (
                      <TableRow key={record.id} sx={{ '&:hover': { backgroundColor: T.rowBg }, '& td': { borderBottom: `1px solid ${T.borderSoft}` } }}>
                        <TableCell sx={{ fontSize: 12.5, fontWeight: 500, color: T.textHead, py: 1.25 }}>{record.month}</TableCell>
                        <TableCell sx={{ fontSize: 12.5, color: T.textBody, py: 1.25 }}>{record.totalPatients.toLocaleString()}</TableCell>
                        <TableCell sx={{ fontSize: 12.5, color: T.textBody, py: 1.25 }}>{record.topIllness}</TableCell>
                        <TableCell sx={{ py: 1.25 }}>
                          <Chip
                            size="small"
                            icon={record.trend === 'increase'
                              ? <TrendingUpIcon sx={{ fontSize: 12, color: `${T.danger} !important` }} />
                              : <TrendingDownIcon sx={{ fontSize: 12, color: `${T.ok} !important` }} />}
                            label={record.trend === 'increase' ? '↑ Increase' : '↓ Decrease'}
                            sx={{
                              backgroundColor: record.trend === 'increase' ? T.dangerBg : T.okBg,
                              color: record.trend === 'increase' ? T.danger : T.ok,
                              border: `1px solid ${record.trend === 'increase' ? T.dangerBorder : T.okBorder}`,
                              fontWeight: 500, fontSize: 11, borderRadius: '4px', height: 22,
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </SCard>

      </Box>
    </Box>
  );
};

export default History;

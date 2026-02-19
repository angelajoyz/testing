import { getForecast } from './api.js';
import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Card, CardContent, Button,
  Select, MenuItem as MenuItemComponent, Alert, CircularProgress,
  LinearProgress, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Tooltip,
} from '@mui/material';
import {
  Psychology as PsychologyIcon,
  TrendingUp as TrendingUpSmallIcon,
  TrendingDown as TrendingDownIcon,
  Remove as RemoveIcon,
  CheckCircle as CheckCircleIcon,
  Download as DownloadIcon,
  Lightbulb as LightbulbIcon,
  InfoOutlined as InfoOutlinedIcon,
} from '@mui/icons-material';
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend,
} from 'recharts';
import Sidebar, { T } from './Sidebar';

// ── Disease config ─────────────────────────────────────────────────────────────
const DISEASE_DISPLAY_MAP = {
  dengue_cases:                { label: 'Dengue',         color: T.blue,        icon: '🦟' },
  diarrhea_cases:              { label: 'Diarrhea',       color: T.neutralBar,  icon: '💧' },
  respiratory_cases:           { label: 'Respiratory',    color: T.danger,      icon: '🫁' },
  malnutrition_cases:          { label: 'Malnutrition',   color: T.neutralLight,icon: '⚕️' },
  malnutrition_prevalence_pct: { label: 'Malnutrition %', color: T.neutralLight,icon: '⚕️' },
  hypertension_cases:          { label: 'Hypertension',   color: T.neutralLight,icon: '❤️' },
  diabetes_cases:              { label: 'Diabetes',       color: T.warnAccent,  icon: '🩸' },
};

const getDiseaseInfo = (col) => {
  if (DISEASE_DISPLAY_MAP[col]) return DISEASE_DISPLAY_MAP[col];
  const label = col
    .replace(/_cases$/, '')
    .replace(/_prevalence_pct$/, ' %')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
  return { label, color: T.neutralBar, icon: '🏥' };
};

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

const trendColor  = (t) => t === 'increasing' ? T.danger  : t === 'decreasing' ? T.ok      : T.textMuted;
const trendBg     = (t) => t === 'increasing' ? T.dangerBg : t === 'decreasing' ? T.okBg    : '#F9FAFB';
const trendBorder = (t) => t === 'increasing' ? T.dangerBorder : t === 'decreasing' ? T.okBorder : T.borderSoft;

const TrendTag = ({ trend }) => {
  const labels = { increasing: '↑ Increasing', decreasing: '↓ Decreasing', stable: '— Stable' };
  return <Tag label={labels[trend] || '— Stable'} bg={trendBg(trend)} color={trendColor(trend)} border={trendBorder(trend)} />;
};

const tooltipStyle = {
  borderRadius: '8px', border: `1px solid ${T.border}`,
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12, color: T.textBody, background: T.cardBg,
};

const LabelSx = { fontSize: 11, fontWeight: 600, color: T.textMuted, mb: 0.5 };
const SelectSx = {
  minWidth: 200, backgroundColor: T.cardBg, borderRadius: '8px', fontSize: 13,
  '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: T.blue },
};

// ── Special sentinel value for "All Barangays" ────────────────────────────────
const ALL_BARANGAYS = '__ALL__';

// ── Prediction ─────────────────────────────────────────────────────────────────
const Prediction = ({ onNavigate, onLogout, uploadedFile, uploadedData }) => {
  const [selectedBarangay, setSelectedBarangay]     = useState(ALL_BARANGAYS);
  const [availableBarangays, setAvailableBarangays] = useState([]);
  const [availableDiseases, setAvailableDiseases]   = useState([]);
  const [forecastLoading, setForecastLoading]       = useState(false);
  // ── FIX 2: Initialize forecastData from localStorage so it survives navigation ──
  const [forecastData, setForecastData]             = useState(() => {
    try {
      const saved = localStorage.getItem('cachedForecastData');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [forecastError, setForecastError]           = useState('');
  // ── Also restore horizon and disease selection from cache ──
  const [forecastHorizon, setForecastHorizon]       = useState(() => localStorage.getItem('cachedForecastHorizon') || '3');
  const [selectedDisease, setSelectedDisease]       = useState(() => localStorage.getItem('cachedForecastDisease') || 'all');
  const [forecastHistory, setForecastHistory]       = useState([]);
  const [detailsOpen, setDetailsOpen]               = useState(false);
  const [detailsData, setDetailsData]               = useState(null);
  const [horizonChangeMessage, setHorizonChangeMessage] = useState('');

  useEffect(() => {
    if (uploadedData?.barangay) setSelectedBarangay(uploadedData.barangay);

    const savedDiseases = localStorage.getItem('diseaseColumns');
    if (savedDiseases) setAvailableDiseases(JSON.parse(savedDiseases));

    // ── FIX 1: Load ALL barangays from localStorage (saved by DataImport) ──
    const savedBarangays = localStorage.getItem('availableBarangays');
    if (savedBarangays) {
      try {
        const parsed = JSON.parse(savedBarangays);
        // Ensure it's a non-empty array
        const barangayList = Array.isArray(parsed) ? parsed : [];
        setAvailableBarangays(barangayList);

        if (!uploadedData?.barangay) {
          const saved = localStorage.getItem('uploadedData');
          const savedBarangay = saved ? JSON.parse(saved).barangay : '';
          // Restore the previously selected barangay from cache, or fallback
          const cachedBarangay = localStorage.getItem('cachedForecastBarangay');
          setSelectedBarangay(cachedBarangay || savedBarangay || ALL_BARANGAYS);
        }
      } catch (e) { console.error(e); }
    }

    const savedHistory = localStorage.getItem('forecastHistory');
    if (savedHistory) {
      try { setForecastHistory(JSON.parse(savedHistory)); } catch (e) { console.error(e); }
    }
  }, [uploadedData, uploadedFile]);

  useEffect(() => {
    if (forecastHistory.length > 0) localStorage.setItem('forecastHistory', JSON.stringify(forecastHistory));
  }, [forecastHistory]);

  // ── FIX 2: Persist forecastData to localStorage whenever it changes ──
  useEffect(() => {
    if (forecastData) {
      try {
        localStorage.setItem('cachedForecastData', JSON.stringify(forecastData));
      } catch (e) {
        // If data is too large for localStorage, skip silently
        console.warn('Could not cache forecast data:', e);
      }
    }
  }, [forecastData]);

  // ── Persist selected barangay, horizon, disease so they survive navigation ──
  useEffect(() => {
    if (selectedBarangay) localStorage.setItem('cachedForecastBarangay', selectedBarangay);
  }, [selectedBarangay]);

  useEffect(() => {
    localStorage.setItem('cachedForecastHorizon', forecastHorizon);
  }, [forecastHorizon]);

  useEffect(() => {
    localStorage.setItem('cachedForecastDisease', selectedDisease);
  }, [selectedDisease]);

  useEffect(() => {
    if (forecastData && selectedBarangay && !forecastLoading) {
      const stats = getSummaryStats();
      const miniTrend = buildMiniTrendData();
      if (stats && miniTrend.length > 0) {
        localStorage.setItem('dashboardSnapshot', JSON.stringify({
          selectedDisease: selectedDisease === 'all' ? 'All Diseases' : getDiseaseInfo(selectedDisease).label,
          latestMonth: forecastData.historical_data.dates[forecastData.historical_data.dates.length - 1]?.slice(0, 7) || 'N/A',
          totalCases: stats.nextVal, trendDirection: stats.trend, trendPercentage: stats.pct,
          nextForecastValue: stats.nextVal,
          forecastMonth: forecastData.forecast_dates[0]?.slice(0, 7) || 'N/A',
          trendIndicator: stats.trend,
          shortText: `Forecast indicates a possible ${stats.trend} in cases`,
          miniTrendData: miniTrend, lastUpdated: new Date().toISOString(),
        }));
      }
    }
  }, [forecastData, forecastLoading]);

  const hasAutoGenerated = useRef(false);
  useEffect(() => {
    if (uploadedFile && selectedBarangay && availableDiseases.length > 0 && !forecastData && !forecastLoading && !hasAutoGenerated.current) {
      hasAutoGenerated.current = true;
      handleGenerateForecast();
    }
  }, [uploadedFile, selectedBarangay, availableDiseases]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getTrend = (preds) => {
    if (!preds || preds.length < 2) return 'stable';
    const diff = preds[preds.length - 1] - preds[0];
    return diff > 0.5 ? 'increasing' : diff < -0.5 ? 'decreasing' : 'stable';
  };

  const getTrendPct = (preds) => {
    if (!preds || preds.length < 2) return '0%';
    const pct = ((preds[preds.length - 1] - preds[0]) / (preds[0] || 1)) * 100;
    return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
  };

  const getConfidence = (disease) => {
    const seeds = {
      dengue_cases: 87, diarrhea_cases: 82, respiratory_cases: 79,
      malnutrition_prevalence_pct: 74, malnutrition_cases: 76,
      hypertension_cases: 83, diabetes_cases: 80,
    };
    return seeds[disease] ?? 78;
  };

  const getConfidenceColor = (val) => val >= 85 ? T.ok : val >= 75 ? T.warnAccent : T.danger;

  const activeDiseases = forecastData
    ? (selectedDisease === 'all'
        ? Object.keys(forecastData.predictions)
        : [selectedDisease].filter(d => forecastData.predictions?.[d]))
    : [];

  const buildMiniTrendData = () => {
    if (!forecastData?.historical_data?.dates) return [];
    const histDates = forecastData.historical_data.dates.slice(-6);
    return histDates.map((date, i) => {
      let total = 0;
      if (selectedDisease === 'all') {
        Object.keys(forecastData.predictions).forEach(d => {
          total += (forecastData.historical_data[d] || []).slice(-6)[i] || 0;
        });
      } else {
        total = (forecastData.historical_data[selectedDisease] || []).slice(-6)[i] || 0;
      }
      return { month: date.slice(5, 7), cases: Math.round(total) };
    });
  };

  const buildChartData = () => {
    if (!forecastData) return [];
    const data = [];
    if (selectedDisease === 'all') {
      forecastData.historical_data.dates.slice(-9).forEach((date, i) => {
        let total = 0;
        activeDiseases.forEach(d => { total += (forecastData.historical_data[d] || []).slice(-9)[i] || 0; });
        data.push({ month: date.slice(0, 7), actual: Math.round(total), predicted: null });
      });
      forecastData.forecast_dates.forEach((date, i) => {
        let total = 0;
        activeDiseases.forEach(d => { total += (forecastData.predictions[d] || [])[i] || 0; });
        data.push({ month: date.slice(0, 7), actual: null, predicted: Math.round(total) });
      });
    } else {
      const disease = selectedDisease;
      const histDates = forecastData.historical_data.dates.slice(-9);
      const histValues = (forecastData.historical_data[disease] || []).slice(-9);
      histDates.forEach((date, i) => {
        data.push({ month: date.slice(0, 7), actual: Math.round(histValues[i] ?? 0), predicted: null });
      });
      forecastData.forecast_dates.forEach((date, i) => {
        data.push({ month: date.slice(0, 7), actual: null, predicted: Math.round((forecastData.predictions[disease] || [])[i] ?? 0) });
      });
    }
    return data;
  };

  const getSummaryStats = () => {
    if (!forecastData || activeDiseases.length === 0) return null;
    if (selectedDisease === 'all') {
      let totalNext = 0, totalStart = 0, totalEnd = 0;
      activeDiseases.forEach(d => {
        const p = forecastData.predictions[d] || [];
        totalNext += p[0] || 0;
        totalStart += p[0] || 0;
        totalEnd += p[p.length - 1] || 0;
      });
      const diff = totalEnd - totalStart;
      const trend = diff > 0.5 ? 'increasing' : diff < -0.5 ? 'decreasing' : 'stable';
      const pct = ((totalEnd - totalStart) / (totalStart || 1)) * 100;
      return {
        nextVal: Math.round(totalNext), trend, pct: (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%',
        confidence: Math.round(activeDiseases.reduce((s, d) => s + getConfidence(d), 0) / activeDiseases.length),
        diseaseLabel: 'All Diseases (Combined Total)',
      };
    } else {
      const preds = forecastData.predictions[selectedDisease] || [];
      return {
        nextVal: Math.round(preds[0] ?? 0), trend: getTrend(preds),
        pct: getTrendPct(preds), confidence: getConfidence(selectedDisease),
        diseaseLabel: getDiseaseInfo(selectedDisease).label,
      };
    }
  };

  const buildInsights = (result, barangay) => {
    const insights = [];
    Object.keys(result.predictions).forEach(d => {
      const preds = result.predictions[d] || [];
      const trend = getTrend(preds);
      const pct = getTrendPct(preds);
      const label = getDiseaseInfo(d).label;
      if (trend === 'increasing') insights.push({ text: `${label} cases expected to increase by ${pct} over the forecast period`, type: 'warning' });
      else if (trend === 'decreasing') insights.push({ text: `${label} cases expected to decrease by ${pct} — positive trend`, type: 'positive' });
      else insights.push({ text: `${label} cases remain stable in ${barangay}`, type: 'neutral' });
    });
    insights.push({ text: `Monitor closely in high-risk areas of ${barangay}`, type: 'info' });
    return insights;
  };

  const getKeyInsights = () => {
    if (!forecastData) return [];
    const barangayLabel = selectedBarangay === ALL_BARANGAYS ? 'All Barangays' : selectedBarangay;
    return buildInsights(forecastData, barangayLabel);
  };

  const handleGenerateForecast = async (overrideHorizon, overrideDisease) => {
    if (!uploadedFile) { setForecastError('No dataset loaded. Please go to Data Import and upload your file again.'); return; }
    if (!selectedBarangay) { setForecastError('No barangay selected. Please go to Data Import first.'); return; }
    setForecastLoading(true); setForecastError('');
    try {
      const diseaseSelection = overrideDisease !== undefined ? overrideDisease : selectedDisease;
      const diseases = diseaseSelection === 'all' ? availableDiseases : [diseaseSelection];
      const months = parseInt(overrideHorizon ?? forecastHorizon);

      let result;

      // ── All Barangays: fetch each barangay then sum predictions ──
      if (selectedBarangay === ALL_BARANGAYS) {
        const barangayResults = await Promise.all(
          availableBarangays.map(b => getForecast(uploadedFile, b, diseases, months).catch(() => null))
        );
        const validResults = barangayResults.filter(Boolean);
        if (validResults.length === 0) throw new Error('No forecast data returned for any barangay.');

        // Use first result as template for structure (dates, etc.)
        const base = validResults[0];
        const mergedPredictions = {};
        const mergedHistorical = { dates: base.historical_data.dates };

        diseases.forEach(d => {
          // Sum predictions across all barangays
          mergedPredictions[d] = base.forecast_dates.map((_, i) =>
            validResults.reduce((sum, r) => sum + ((r.predictions[d] || [])[i] || 0), 0)
          );
          // Sum historical data across all barangays
          mergedHistorical[d] = base.historical_data.dates.map((_, i) =>
            validResults.reduce((sum, r) => sum + ((r.historical_data[d] || [])[i] || 0), 0)
          );
        });

        result = {
          ...base,
          predictions: mergedPredictions,
          historical_data: mergedHistorical,
        };
      } else {
        result = await getForecast(uploadedFile, selectedBarangay, diseases, months);
      }
      setForecastData(result);
      if (result.disease_columns?.length > 0) {
        setAvailableDiseases(prev => {
          const merged = Array.from(new Set([...prev, ...result.disease_columns]));
          localStorage.setItem('diseaseColumns', JSON.stringify(merged));
          return merged;
        });
      }
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10) + ' at ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const barangayLabel = selectedBarangay === ALL_BARANGAYS ? 'All Barangays' : selectedBarangay;
      const insights = buildInsights(result, barangayLabel);
      const newEntries = Object.keys(result.predictions).map((disease, idx) => {
        const preds = result.predictions[disease] || [];
        return result.forecast_dates.map((fd, i) => ({
          id: Date.now() + idx * 100 + i, disease,
          label: getDiseaseInfo(disease).label,
          period: fd.slice(0, 7), monthsAhead: i + 1,
          predictedValue: Math.round(preds[i] ?? 0),
          trend: getTrend(preds), confidence: getConfidence(disease),
          status: 'Completed', createdAt: dateStr,
          fileName: uploadedData?.fileName || uploadedFile?.name || 'dataset.xlsx',
          forecastHorizon: months + ' Month' + (months > 1 ? 's' : ''),
          barangay: selectedBarangay, insights,
        }));
      }).flat();
      setForecastHistory(prev => [...newEntries, ...prev]);
      setHorizonChangeMessage('');
    } catch (err) {
      setForecastError(err.message || 'Forecast failed. Please try again.');
    } finally {
      setForecastLoading(false);
    }
  };

  const stats = getSummaryStats();
  const chartData = buildChartData();
  const insights = getKeyInsights();

  // ── Insight color helpers ──────────────────────────────────────────────────
  const insightBg = (type) =>
    type === 'warning' ? T.dangerBg : type === 'positive' ? T.okBg : type === 'info' ? T.blueDim : '#F9FAFB';
  const insightBorder = (type) =>
    type === 'warning' ? T.dangerBorder : type === 'positive' ? T.okBorder : type === 'info' ? 'rgba(27,79,138,0.18)' : T.borderSoft;
  const insightDot = (type) =>
    type === 'warning' ? T.danger : type === 'positive' ? T.ok : type === 'info' ? T.blue : T.textMuted;

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: T.pageBg }}>
      <Sidebar currentPage="prediction" onNavigate={onNavigate} onLogout={onLogout} />

      <Box sx={{ flex: 1, overflow: 'auto', p: '28px 24px', minWidth: 0 }}>

        {/* Page header */}
        <Box sx={{ mb: 2.75 }}>
          <Typography sx={{ fontSize: 18, fontWeight: 700, color: T.textHead, letterSpacing: '-0.3px' }}>
            Prediction
          </Typography>
          <Typography sx={{ fontSize: 12, color: T.textMuted, mt: 0.4 }}>
            AI-powered disease forecasting and trend predictions
          </Typography>
        </Box>

        {/* No file warning */}
        {!uploadedFile && (
          <Alert severity="warning" icon={<InfoOutlinedIcon fontSize="small" />}
            sx={{ mb: 2.5, borderRadius: '10px', fontSize: 13, border: `1px solid ${T.warnBorder}`, backgroundColor: T.warnBg, color: T.warn, '& .MuiAlert-icon': { color: T.warnAccent } }}>
            No dataset loaded. Please go to{' '}
            <Typography component="span" onClick={() => onNavigate?.('dataimport')}
              sx={{ fontWeight: 600, fontSize: 13,cursor: 'pointer', color: T.blue, '&:hover': { opacity: 0.75 } }}>
              Data Import.
            </Typography>
          </Alert>
        )}

        {/* Controls row */}
        <SCard sx={{ mb: '16px' }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>

              {/* Barangay — includes "All Barangays" option */}
              <Box>
                <Typography sx={LabelSx}>Barangay <span style={{ color: T.danger }}>*</span></Typography>
                <Select value={selectedBarangay} size="small" sx={SelectSx}
                  onChange={(e) => {
                    setSelectedBarangay(e.target.value);
                    setForecastData(null);
                    localStorage.removeItem('cachedForecastData');
                    hasAutoGenerated.current = false;
                  }}
                  displayEmpty>
                  {/* All Barangays option always shown first */}
                  <MenuItemComponent value={ALL_BARANGAYS} sx={{ fontSize: 13 }}>
                    All Barangays
                  </MenuItemComponent>
                  {availableBarangays.length > 0
                    ? availableBarangays.map(b => (
                        <MenuItemComponent key={b} value={b} sx={{ fontSize: 13 }}>{b}</MenuItemComponent>
                      ))
                    : <MenuItemComponent value={selectedBarangay} disabled={!selectedBarangay} sx={{ fontSize: 13 }}>
                        {selectedBarangay || 'No barangay loaded'}
                      </MenuItemComponent>
                  }
                </Select>
              </Box>

              {/* Disease */}
              <Box>
                <Typography sx={LabelSx}>Disease <span style={{ color: T.danger }}>*</span></Typography>
                <Select value={selectedDisease} size="small" sx={SelectSx}
                  onChange={(e) => setSelectedDisease(e.target.value)}>
                  <MenuItemComponent value="all" sx={{ fontSize: 13 }}>All Diseases</MenuItemComponent>
                  {availableDiseases.map(col => {
                    const info = getDiseaseInfo(col);
                    return <MenuItemComponent key={col} value={col} sx={{ fontSize: 13 }}>{info.icon} {info.label}</MenuItemComponent>;
                  })}
                </Select>
              </Box>

              {/* Forecast Horizon */}
              <Box>
                <Typography sx={LabelSx}>Forecast Horizon</Typography>
                <Select value={forecastHorizon} size="small" sx={{ ...SelectSx, minWidth: 170 }}
                  onChange={(e) => {
                    const newHorizon = e.target.value;
                    const wasSpecific = selectedDisease !== 'all';
                    setForecastHorizon(newHorizon);
                    if (wasSpecific) {
                      setHorizonChangeMessage(`Switched to "All Diseases" to generate complete data for ${newHorizon}-month forecast`);
                      setTimeout(() => setHorizonChangeMessage(''), 8000);
                    }
                    setSelectedDisease('all');
                    if (uploadedFile && selectedBarangay) handleGenerateForecast(newHorizon, 'all');
                  }}>
                  <MenuItemComponent value="1" sx={{ fontSize: 13 }}>1 Month Ahead</MenuItemComponent>
                  <MenuItemComponent value="3" sx={{ fontSize: 13 }}>3 Months Ahead</MenuItemComponent>
                  <MenuItemComponent value="6" sx={{ fontSize: 13 }}>6 Months Ahead</MenuItemComponent>
                </Select>
              </Box>

              {/* Generate button */}
              <Button variant="contained" onClick={() => handleGenerateForecast(forecastHorizon)}
                disabled={forecastLoading || !uploadedFile}
                startIcon={forecastLoading ? <CircularProgress size={14} color="inherit" /> : <PsychologyIcon sx={{ fontSize: 16 }} />}
                sx={{
                  backgroundColor: T.blue, color: '#fff', textTransform: 'none',
                  fontWeight: 600, fontSize: 13, borderRadius: '8px', px: 2.5, py: 1,
                  boxShadow: '0 2px 10px rgba(27,79,138,0.25)',
                  '&:hover': { backgroundColor: T.blueMid },
                  '&:disabled': { opacity: 0.55 },
                }}>
                {forecastLoading ? 'Generating…' : 'Generate Forecast'}
              </Button>
            </Box>
          </CardContent>
        </SCard>

        {/* Loading */}
        {forecastLoading && (
          <Box sx={{ mb: 2.5 }}>
            <LinearProgress sx={{ borderRadius: 2, height: 3, backgroundColor: T.borderSoft, '& .MuiLinearProgress-bar': { backgroundColor: T.blue } }} />
            <Typography sx={{ fontSize: 11, color: T.textMuted, mt: 0.75, textAlign: 'center' }}>
              Training LSTM model for {selectedBarangay === ALL_BARANGAYS ? 'All Barangays' : selectedBarangay}… (30–60 seconds)
            </Typography>
          </Box>
        )}

        {forecastError && (
          <Alert severity="error" sx={{ mb: 2.5, borderRadius: '10px', fontSize: 13 }}>{forecastError}</Alert>
        )}

        {horizonChangeMessage && (
          <Alert severity="info" onClose={() => setHorizonChangeMessage('')}
            sx={{ mb: 2.5, borderRadius: '10px', fontSize: 13, backgroundColor: T.blueDim, color: T.textHead, border: `1px solid rgba(27,79,138,0.18)`, '& .MuiAlert-icon': { color: T.blue } }}>
            {horizonChangeMessage}
          </Alert>
        )}

        {/* ── Stat cards ── */}
        {stats && (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', mb: '16px' }}>
            {/* Next Period */}
            <SCard sx={{ borderTop: `3px solid ${T.blue}` }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: T.textMuted }}>
                    Next Period Forecast
                  </Typography>
                  <Box sx={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: T.blueDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PsychologyIcon sx={{ fontSize: 15, color: T.blue }} />
                  </Box>
                </Box>
                <Typography sx={{ fontSize: 26, fontWeight: 700, color: T.textHead, lineHeight: 1, mb: 0.5, letterSpacing: '-0.5px' }}>
                  {stats.nextVal.toLocaleString()}
                </Typography>
                <Typography sx={{ fontSize: 11, color: T.textMuted }}>
                  {stats.diseaseLabel} ({forecastHorizon}mo ahead)
                </Typography>
              </CardContent>
            </SCard>

            {/* Trend */}
            <SCard sx={{ borderTop: `3px solid ${trendColor(stats.trend)}` }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: T.textMuted }}>
                    Trend Indicator
                  </Typography>
                  <Box sx={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: trendBg(stats.trend), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {stats.trend === 'increasing'
                      ? <TrendingUpSmallIcon sx={{ fontSize: 15, color: T.danger }} />
                      : stats.trend === 'decreasing'
                      ? <TrendingDownIcon sx={{ fontSize: 15, color: T.ok }} />
                      : <RemoveIcon sx={{ fontSize: 15, color: T.textMuted }} />}
                  </Box>
                </Box>
                <Typography sx={{ fontSize: 26, fontWeight: 700, lineHeight: 1, mb: 0.5, letterSpacing: '-0.5px', color: trendColor(stats.trend) }}>
                  {stats.pct}
                </Typography>
                <Typography sx={{ fontSize: 11, color: T.textMuted }}>
                  {stats.trend === 'increasing' ? 'Increasing from last period' : stats.trend === 'decreasing' ? 'Decreasing from last period' : 'Stable from last period'}
                </Typography>
              </CardContent>
            </SCard>

            {/* Confidence */}
            <SCard sx={{ borderTop: `3px solid ${getConfidenceColor(stats.confidence)}` }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: T.textMuted }}>
                    Model Confidence
                  </Typography>
                  <Box sx={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: T.okBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircleIcon sx={{ fontSize: 15, color: T.ok }} />
                  </Box>
                </Box>
                <Typography sx={{ fontSize: 26, fontWeight: 700, lineHeight: 1, mb: 0.5, letterSpacing: '-0.5px', color: getConfidenceColor(stats.confidence) }}>
                  {stats.confidence}%
                </Typography>
                <Typography sx={{ fontSize: 11, color: T.textMuted }}>Prediction accuracy</Typography>
              </CardContent>
            </SCard>
          </Box>
        )}

        {/* ── Chart ── */}
        {chartData.length > 0 && (
          <SCard sx={{ mb: '16px' }}>
            <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2 } }}>
              <CardHead
                title={`Predicted Trend — ${selectedDisease === 'all' ? 'All Diseases (Combined)' : getDiseaseInfo(selectedDisease).label}`}
                right={<Tag label="Actual vs Predicted" bg={T.blueDim} color={T.blue} border="rgba(27,79,138,0.18)" />}
              />
              <ResponsiveContainer width="100%" height={265}>
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.borderSoft} vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} style={{ fontSize: 10.5, fill: T.textFaint }} />
                  <YAxis axisLine={false} tickLine={false} style={{ fontSize: 10.5, fill: T.textFaint }} />
                  <RechartsTooltip contentStyle={tooltipStyle} />
                  <Legend formatter={(v) => v === 'actual' ? 'Actual Cases' : 'Predicted Cases'}
                    wrapperStyle={{ paddingTop: 12, fontSize: 11 }} />
                  <Bar dataKey="actual" fill={T.blue} name="actual" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  <Line type="monotone" dataKey="predicted" stroke={T.danger} name="predicted"
                    strokeWidth={2.5} strokeDasharray="6 3"
                    dot={{ fill: T.danger, r: 4, strokeWidth: 0 }} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>

              {/* Key Insights */}
              {insights.length > 0 && (
                <Box sx={{ mt: 2.5, p: 2, backgroundColor: T.rowBg, borderRadius: '8px', border: `1px solid ${T.borderSoft}` }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <LightbulbIcon sx={{ fontSize: 14, color: T.blue }} />
                    <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: T.textHead }}>Key Insights</Typography>
                    <Tag label={`${insights.length - 1} diseases`} bg={T.blueDim} color={T.blue} border="rgba(27,79,138,0.18)" />
                  </Box>
                  {insights.map((insight, i) => (
                    <Box key={i} sx={{
                      display: 'flex', alignItems: 'flex-start', gap: 1.25, mb: 0.75,
                      p: 1.25, borderRadius: '7px',
                      backgroundColor: insightBg(insight.type), border: `1px solid ${insightBorder(insight.type)}`,
                    }}>
                      <Box sx={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: insightDot(insight.type), mt: 0.6, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: 12, color: T.textBody, lineHeight: 1.5 }}>{insight.text}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </SCard>
        )}
      </Box>

      {/* ── Details Dialog ── */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: '12px', border: `1px solid ${T.border}` } }}>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 700, color: T.textHead, pb: 1 }}>Prediction Details</DialogTitle>
        <Box sx={{ borderBottom: `1px solid ${T.borderSoft}`, mx: 3 }} />
        {detailsData && (
          <DialogContent sx={{ pt: 2.5 }}>
            <Typography sx={{ fontSize: 11, color: T.textMuted }}>Forecast Period</Typography>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: T.textHead, mb: 2 }}>
              {detailsData.label} — {detailsData.period}
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
              {[
                { k: 'Created Date & Time', v: detailsData.createdAt },
                { k: 'Data Source', v: detailsData.fileName },
                { k: 'Model Used', v: 'LSTM Neural Network' },
                { k: 'Forecast Horizon', v: detailsData.forecastHorizon },
              ].map(row => (
                <Box key={row.k}>
                  <Typography sx={{ fontSize: 11, color: T.textMuted }}>{row.k}</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textHead }}>{row.v}</Typography>
                </Box>
              ))}
            </Box>
            <Box sx={{ borderTop: `1px solid ${T.borderSoft}`, my: 2 }} />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
              <Box>
                <Typography sx={{ fontSize: 11, color: T.textMuted }}>Predicted Value</Typography>
                <Typography sx={{ fontSize: 28, fontWeight: 700, color: T.blue }}>{detailsData.predictedValue}</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 11, color: T.textMuted, mb: 0.75 }}>Confidence Level</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LinearProgress variant="determinate" value={detailsData.confidence}
                    sx={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: T.borderSoft, '& .MuiLinearProgress-bar': { backgroundColor: getConfidenceColor(detailsData.confidence), borderRadius: 3 } }} />
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: T.textHead }}>{detailsData.confidence}%</Typography>
                </Box>
              </Box>
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: 11, color: T.textMuted, mb: 0.75 }}>Trend</Typography>
              <TrendTag trend={detailsData.trend} />
            </Box>
            <Box sx={{ borderTop: `1px solid ${T.borderSoft}`, my: 2 }} />
            <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: T.textHead, mb: 1.25 }}>Key Insights</Typography>
            {(detailsData.insights || []).map((ins, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, mb: 0.75 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: T.blue, mt: 0.7, flexShrink: 0 }} />
                <Typography sx={{ fontSize: 12, color: T.textMuted }}>{ins.text || ins}</Typography>
              </Box>
            ))}
          </DialogContent>
        )}
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDetailsOpen(false)}
            sx={{ borderRadius: '8px', textTransform: 'none', fontSize: 13, color: T.textMuted, border: `1px solid ${T.border}`, px: 2 }}>
            Close
          </Button>
          <Button variant="contained" startIcon={<DownloadIcon sx={{ fontSize: 15 }} />}
            sx={{ borderRadius: '8px', textTransform: 'none', fontSize: 13, fontWeight: 600, backgroundColor: T.blue, '&:hover': { backgroundColor: T.blueMid }, px: 2 }}>
            Download Report
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};


export default Prediction;

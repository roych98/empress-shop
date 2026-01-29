import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface Player {
  _id: string;
  name: string;
}

interface RunEarning {
  runId: string;
  runNumber: number;
  date: string;
  entryFeeWS: number;
  grossWS: number;
  netWS: number;
  salesCount: number;
  dropsCount: number;
  cumulativeNetWS: number;
}

interface MonthlyEarning {
  month: string;
  grossWS: number;
  netWS: number;
  salesCount: number;
  runsCount: number;
}

interface ProfileStats {
  player?: Player;
  totals: {
    grossWS: number;
    netWS: number;
    totalSales: number;
    totalRuns: number;
  };
  runEarnings: RunEarning[];
  monthlyEarnings: MonthlyEarning[];
}

export function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredRun, setHoveredRun] = useState<RunEarning | null>(null);
  const [selectedRun, setSelectedRun] = useState<RunEarning | null>(null);

  // Load players list
  useEffect(() => {
    const loadPlayers = async () => {
      try {
        const res = await api.get<Player[]>('/players');
        setPlayers(res.data);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
      }
    };
    void loadPlayers();
  }, []);

  // Load stats when selectedPlayerId changes
  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      setError(null);
      setSelectedRun(null);
      setHoveredRun(null);
      try {
        const url = selectedPlayerId
          ? `/stats/profile?playerId=${selectedPlayerId}`
          : '/stats/profile';
        const res = await api.get<ProfileStats>(url);
        setStats(res.data);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        setError('Failed to load profile stats');
      } finally {
        setLoading(false);
      }
    };

    void loadStats();
  }, [selectedPlayerId]);

  const runChartData = useMemo(() => {
    if (!stats || stats.runEarnings.length === 0) return null;

    const data = stats.runEarnings;
    const maxValue = Math.max(...data.map((d) => d.cumulativeNetWS), 1);
    const minValue = Math.min(...data.map((d) => d.cumulativeNetWS), 0);
    const range = maxValue - minValue || 1;

    return {
      runs: data,
      maxValue,
      minValue,
      range,
    };
  }, [stats]);

  const monthlyChartData = useMemo(() => {
    if (!stats || stats.monthlyEarnings.length === 0) return null;

    const data = stats.monthlyEarnings;
    const maxValue = Math.max(...data.map((d) => Math.abs(d.netWS)), 1);

    return {
      months: data,
      maxValue,
    };
  }, [stats]);

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(Number(year), Number(month) - 1);
    return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const handleRunClick = (run: RunEarning) => {
    navigate(`/runs/${run.runId}`);
  };

  const displayedRun = hoveredRun || selectedRun;
  const selectedPlayer = players.find((p) => p._id === selectedPlayerId);
  const displayName = selectedPlayer?.name || 'All Players';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Profile</h1>
          <p className="page-subtitle">
            {user?.email} · Viewing statistics for {displayName}
          </p>
        </div>
      </div>

      {/* Player Selector */}
      <div className="card section">
        <div className="section-title-row">
          <h2 className="section-title">Select Player</h2>
        </div>
        <div className="player-selector">
          <button
            type="button"
            className={`player-selector-btn ${selectedPlayerId === '' ? 'active' : ''}`}
            onClick={() => setSelectedPlayerId('')}
          >
            All Players
          </button>
          {players.map((p) => (
            <button
              key={p._id}
              type="button"
              className={`player-selector-btn ${selectedPlayerId === p._id ? 'active' : ''}`}
              onClick={() => setSelectedPlayerId(p._id)}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="card">
          <p>Loading stats...</p>
        </div>
      )}

      {!loading && error && (
        <div className="card">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && stats && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-4 section">
            <div className="stat-card">
              <div className="stat-label">
                {selectedPlayerId ? 'Share of Earnings' : 'Total Net Earnings'}
              </div>
              <div className={`stat-value ${stats.totals.netWS >= 0 ? 'text-success' : 'text-danger'}`}>
                {stats.totals.netWS.toFixed(2)} WS
              </div>
              <div className="stat-hint">After entry fees</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">
                {selectedPlayerId ? 'Share of Sales' : 'Gross Sales'}
              </div>
              <div className="stat-value">{stats.totals.grossWS.toFixed(2)} WS</div>
              <div className="stat-hint">Before entry fees</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Sales</div>
              <div className="stat-value">{stats.totals.totalSales}</div>
              <div className="stat-hint">{selectedPlayerId ? 'Participated in' : 'Total sold'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Runs</div>
              <div className="stat-value">{stats.totals.totalRuns}</div>
              <div className="stat-hint">{selectedPlayerId ? 'Participated in' : 'Total runs'}</div>
            </div>
          </div>

          {/* Interactive Run-Based Earnings Chart */}
          {runChartData && runChartData.runs.length > 0 && (
            <div className="card section">
              <div className="section-title-row">
                <h2 className="section-title">
                  {selectedPlayerId ? `${displayName}'s Earnings by Run` : 'Earnings by Run'}
                </h2>
                <span className="muted" style={{ fontSize: '0.8rem' }}>
                  Click on a point to view run details
                </span>
              </div>
              
              {/* Run Info Panel */}
              {displayedRun && (
                <div className="run-info-panel">
                  <div className="run-info-header">
                    <span className="badge">Run #{displayedRun.runNumber}</span>
                    <span className="muted">{formatDate(displayedRun.date)}</span>
                  </div>
                  <div className="run-info-stats">
                    <div className="run-info-stat">
                      <span className="run-info-stat-label">Entry Fee</span>
                      <span className="run-info-stat-value">{displayedRun.entryFeeWS.toFixed(2)} WS</span>
                    </div>
                    <div className="run-info-stat">
                      <span className="run-info-stat-label">Drops</span>
                      <span className="run-info-stat-value">{displayedRun.dropsCount}</span>
                    </div>
                    <div className="run-info-stat">
                      <span className="run-info-stat-label">Sales</span>
                      <span className="run-info-stat-value">{displayedRun.salesCount}</span>
                    </div>
                    <div className="run-info-stat">
                      <span className="run-info-stat-label">{selectedPlayerId ? 'Share' : 'Gross'}</span>
                      <span className="run-info-stat-value">{displayedRun.grossWS.toFixed(2)} WS</span>
                    </div>
                    <div className="run-info-stat">
                      <span className="run-info-stat-label">Net</span>
                      <span className={`run-info-stat-value ${displayedRun.netWS >= 0 ? 'text-success' : 'text-danger'}`}>
                        {displayedRun.netWS >= 0 ? '+' : ''}{displayedRun.netWS.toFixed(2)} WS
                      </span>
                    </div>
                    <div className="run-info-stat">
                      <span className="run-info-stat-label">Cumulative</span>
                      <span className={`run-info-stat-value ${displayedRun.cumulativeNetWS >= 0 ? 'text-success' : 'text-danger'}`}>
                        {displayedRun.cumulativeNetWS.toFixed(2)} WS
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="app-button-ghost"
                    style={{ marginTop: '0.5rem' }}
                    onClick={() => handleRunClick(displayedRun)}
                  >
                    View Run Details →
                  </button>
                </div>
              )}

              <div className="chart-container">
                <div className="line-chart">
                  <div className="chart-y-axis">
                    <span>{runChartData.maxValue.toFixed(0)} WS</span>
                    <span>{((runChartData.maxValue + runChartData.minValue) / 2).toFixed(0)} WS</span>
                    <span>{runChartData.minValue.toFixed(0)} WS</span>
                  </div>
                  <div className="chart-area">
                    <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="chart-svg">
                      {/* Zero line if there are negative values */}
                      {runChartData.minValue < 0 && (
                        <line
                          x1="0"
                          y1={50 - ((0 - runChartData.minValue) / runChartData.range) * 50}
                          x2="100"
                          y2={50 - ((0 - runChartData.minValue) / runChartData.range) * 50}
                          stroke="rgba(148, 163, 184, 0.3)"
                          strokeWidth="0.5"
                          strokeDasharray="2,2"
                        />
                      )}
                      {/* Area fill */}
                      <path
                        d={`M 0,50 ${runChartData.runs
                          .map((r, i) => {
                            const x = (i / (runChartData.runs.length - 1 || 1)) * 100;
                            const y = 50 - ((r.cumulativeNetWS - runChartData.minValue) / runChartData.range) * 50;
                            return `L ${x},${y}`;
                          })
                          .join(' ')} L 100,50 Z`}
                        fill="url(#gradient)"
                        opacity="0.3"
                      />
                      {/* Line */}
                      <polyline
                        points={runChartData.runs
                          .map((r, i) => {
                            const x = (i / (runChartData.runs.length - 1 || 1)) * 100;
                            const y = 50 - ((r.cumulativeNetWS - runChartData.minValue) / runChartData.range) * 50;
                            return `${x},${y}`;
                          })
                          .join(' ')}
                        fill="none"
                        stroke="#60a5fa"
                        strokeWidth="1.5"
                        vectorEffect="non-scaling-stroke"
                      />
                      <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#60a5fa" />
                          <stop offset="100%" stopColor="transparent" />
                        </linearGradient>
                      </defs>
                    </svg>
                    {/* Interactive Data points */}
                    <div className="chart-points">
                      {runChartData.runs.map((r, i) => {
                        const left = (i / (runChartData.runs.length - 1 || 1)) * 100;
                        const bottom = ((r.cumulativeNetWS - runChartData.minValue) / runChartData.range) * 100;
                        const isActive = selectedRun?.runId === r.runId;
                        const isHovered = hoveredRun?.runId === r.runId;
                        return (
                          <div
                            key={r.runId}
                            className={`chart-point-interactive ${isActive ? 'active' : ''} ${isHovered ? 'hovered' : ''} ${r.netWS >= 0 ? 'positive' : 'negative'}`}
                            style={{ left: `${left}%`, bottom: `${bottom}%` }}
                            onMouseEnter={() => setHoveredRun(r)}
                            onMouseLeave={() => setHoveredRun(null)}
                            onClick={() => setSelectedRun(selectedRun?.runId === r.runId ? null : r)}
                            title={`Run #${r.runNumber}: ${r.cumulativeNetWS.toFixed(2)} WS`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="chart-x-axis">
                  {runChartData.runs.length > 0 && (
                    <>
                      <span>Run #{runChartData.runs[0].runNumber}</span>
                      <span>Run #{runChartData.runs[runChartData.runs.length - 1].runNumber}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Monthly Breakdown */}
          {monthlyChartData && monthlyChartData.months.length > 0 && (
            <div className="card section">
              <div className="section-title-row">
                <h2 className="section-title">Monthly Breakdown</h2>
              </div>
              <div className="bar-chart">
                {monthlyChartData.months.map((m) => {
                  const heightPercent = Math.abs(m.netWS) / monthlyChartData.maxValue * 100;
                  const isNegative = m.netWS < 0;
                  return (
                    <div key={m.month} className="bar-chart-item">
                      <div className="bar-chart-bar-container">
                        <div
                          className={`bar-chart-bar ${isNegative ? 'bar-negative' : 'bar-positive'}`}
                          style={{ height: `${heightPercent}%` }}
                          title={`${m.netWS.toFixed(2)} WS net`}
                        />
                      </div>
                      <div className="bar-chart-label">{formatMonth(m.month)}</div>
                      <div className={`bar-chart-value ${isNegative ? 'text-danger' : 'text-success'}`}>
                        {m.netWS.toFixed(0)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Per-Run Details Table */}
          {stats.runEarnings.length > 0 && (
            <div className="table-card card section">
              <div className="section-title-row">
                <h2 className="section-title">Run History</h2>
                <span className="pill muted">{stats.runEarnings.length} runs</span>
              </div>
              <div className="table-wrapper">
                <table className="data-table clickable-rows">
                  <thead>
                    <tr>
                      <th>Run #</th>
                      <th>Date</th>
                      <th>Drops</th>
                      <th>Sales</th>
                      <th>Entry Fee</th>
                      <th>{selectedPlayerId ? 'Share' : 'Gross'}</th>
                      <th>Net</th>
                      <th>Cumulative</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...stats.runEarnings].reverse().map((r) => (
                      <tr
                        key={r.runId}
                        className="clickable-row"
                        onClick={() => handleRunClick(r)}
                      >
                        <td>
                          <span className="badge">#{r.runNumber}</span>
                        </td>
                        <td>{formatDate(r.date)}</td>
                        <td>{r.dropsCount}</td>
                        <td>{r.salesCount}</td>
                        <td>{r.entryFeeWS.toFixed(2)}</td>
                        <td>{r.grossWS.toFixed(2)}</td>
                        <td className={r.netWS >= 0 ? 'text-success' : 'text-danger'}>
                          {r.netWS >= 0 ? '+' : ''}{r.netWS.toFixed(2)}
                        </td>
                        <td className={r.cumulativeNetWS >= 0 ? 'text-success' : 'text-danger'}>
                          {r.cumulativeNetWS.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {stats.runEarnings.length === 0 && (
            <div className="card section">
              <p className="muted">
                {selectedPlayerId
                  ? `No runs found for ${displayName}. This player hasn't participated in any runs yet.`
                  : 'No runs yet. Complete some runs to see your earning trends!'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

interface Player {
  _id: string;
  name: string;
}

interface DashboardRun {
  _id: string;
  runNumber?: number;
  date: string;
  host: Player | string;
  totalEntryFeeWS: number;
  status: 'open' | 'settled';
}

interface WeaponDrop {
  _id: string;
  weaponType: string;
  mainRoll: number;
  secondaryRoll: number;
}

interface DashboardSale {
  _id: string;
  run: {
    _id: string;
    runNumber?: number;
    date: string;
    host: Player | string;
  };
  drops: WeaponDrop[];
  totalPriceWS: number;
  netAfterFeesWS: number;
  buyer: string;
  date: string;
}

export function DashboardPage() {
  const [runs, setRuns] = useState<DashboardRun[]>([]);
  const [sales, setSales] = useState<DashboardSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [runsRes, salesRes] = await Promise.all([
          api.get<DashboardRun[]>('/runs'),
          api.get<DashboardSale[]>('/sales'),
        ]);
        setRuns(runsRes.data);
        setSales(salesRes.data);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const totalRuns = runs.length;
  const openRuns = runs.filter((r) => r.status === 'open').length;
  const totalGrossWS = useMemo(
    () => sales.reduce((sum, s) => sum + s.totalPriceWS, 0),
    [sales],
  );
  const totalNetWS = useMemo(
    () => sales.reduce((sum, s) => sum + s.netAfterFeesWS, 0),
    [sales],
  );

  const formatDate = (value: string) => {
    const d = new Date(value);
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            High-level view of runs, sales, and profit across your Empress raids.
          </p>
        </div>
      </div>

      {loading && (
        <div className="card">
          <p>Loading dashboard...</p>
        </div>
      )}

      {!loading && error && (
        <div className="card">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-2 section">
            <div className="stat-card">
              <div className="stat-label">Total runs</div>
              <div className="stat-value">{totalRuns}</div>
              <div className="stat-hint">{openRuns} currently open</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">White Scrolls earned</div>
              <div className="stat-value">{totalNetWS.toFixed(2)} WS</div>
              <div className="stat-hint">
                {totalGrossWS.toFixed(2)} WS gross across all sales
              </div>
            </div>
          </div>

          <div className="table-card card">
            <div className="section-title-row">
              <h2 className="section-title">Recent runs</h2>
              <Link to="/runs" className="app-button-ghost">
                View all runs
              </Link>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Run #</th>
                    <th>Date</th>
                    <th>Host</th>
                    <th>Entry fee (WS)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.slice(0, 5).map((run) => {
                    const hostName =
                      typeof run.host === 'string'
                        ? run.host
                        : run.host?.name ?? 'Unknown';
                    return (
                      <tr key={run._id}>
                        <td>
                          <Link to={`/runs/${run._id}`} className="app-link">
                            #{run.runNumber ?? '-'}
                          </Link>
                        </td>
                        <td>{formatDate(run.date)}</td>
                        <td>{hostName}</td>
                        <td>{run.totalEntryFeeWS.toFixed(2)}</td>
                        <td>
                          <span
                            className={
                              run.status === 'open'
                                ? 'badge badge-warning'
                                : 'badge badge-success'
                            }
                          >
                            {run.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {runs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="muted">
                        No runs yet. Create your first run to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="table-card card section">
            <div className="section-title-row">
              <h2 className="section-title">Recent sales</h2>
              <Link to="/sales" className="app-button-ghost">
                View all sales
              </Link>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Item(s)</th>
                    <th>Run</th>
                    <th>Host</th>
                    <th>Buyer</th>
                    <th>Gross (WS)</th>
                    <th>Net (WS)</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.slice(0, 5).map((sale) => {
                    const hostName =
                      typeof sale.run.host === 'string'
                        ? sale.run.host
                        : sale.run.host?.name ?? 'Unknown';
                    return (
                      <tr key={sale._id}>
                        <td>{formatDate(sale.date)}</td>
                        <td>
                          {sale.drops?.map((drop) => (
                            <span key={drop._id} className="chip">
                              <span className="chip-label">{drop.weaponType}</span>
                              <span className="chip-value">
                                {drop.mainRoll}/{drop.secondaryRoll}
                              </span>
                            </span>
                          ))}
                          {(!sale.drops || sale.drops.length === 0) && '-'}
                        </td>
                        <td>
                          <Link to={`/runs/${sale.run._id}`} className="app-link">
                            #{sale.run.runNumber ?? '-'}
                          </Link>
                        </td>
                        <td>{hostName}</td>
                        <td>{sale.buyer}</td>
                        <td>{sale.totalPriceWS.toFixed(2)}</td>
                        <td>{sale.netAfterFeesWS.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                  {sales.length === 0 && (
                    <tr>
                      <td colSpan={7} className="muted">
                        No sales yet. Record a sale from a run to see it here.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


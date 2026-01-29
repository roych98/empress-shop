import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

interface WeaponDrop {
  _id: string;
  weaponType: string;
  mainRoll: number;
  secondaryRoll: number;
}

interface Sale {
  _id: string;
  run: {
    _id: string;
    runNumber?: number;
    date: string;
  };
  totalPriceWS: number;
  netAfterFeesWS: number;
  buyer: string;
  date: string;
  drops: (string | WeaponDrop)[];
}

export function SalesPage() {
  const navigate = useNavigate();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<Sale[]>('/sales');
        setSales(res.data);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        setError('Failed to load sales');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const formatDate = (value: string) => {
    const d = new Date(value);
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  };

  const formatDrops = (drops: (string | WeaponDrop)[]): string => {
    return drops
      .map((d) => {
        if (typeof d === 'string') return d;
        return `${d.weaponType} ${d.mainRoll}/${d.secondaryRoll}`;
      })
      .join(', ');
  };

  const handleRowClick = (runId: string) => {
    navigate(`/runs/${runId}`);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales</h1>
          <p className="page-subtitle">
            All recorded sales and their white scroll splits. Click a row to view the run.
          </p>
        </div>
      </div>

      {loading && (
        <div className="card">
          <p>Loading sales...</p>
        </div>
      )}

      {!loading && error && (
        <div className="card">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="table-card card">
          <div className="section-title-row">
            <h2 className="section-title">All sales</h2>
            <span className="pill muted">{sales.length} total</span>
          </div>
          <div className="table-wrapper">
            <table className="data-table clickable-rows">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Run</th>
                  <th>Items sold</th>
                  <th>Buyer</th>
                  <th>Gross (WS)</th>
                  <th>Net (WS)</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr
                    key={sale._id}
                    onClick={() => handleRowClick(sale.run._id)}
                    className="clickable-row"
                  >
                    <td>{formatDate(sale.date)}</td>
                    <td>
                      <span className="badge">
                        #{sale.run.runNumber ?? '?'}
                      </span>
                    </td>
                    <td>{formatDrops(sale.drops)}</td>
                    <td>{sale.buyer}</td>
                    <td>{sale.totalPriceWS.toFixed(2)}</td>
                    <td>{sale.netAfterFeesWS.toFixed(2)}</td>
                  </tr>
                ))}
                {sales.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted">
                      No sales recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}


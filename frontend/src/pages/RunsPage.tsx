import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface Player {
  _id: string;
  name: string;
}

interface Run {
  _id: string;
  runNumber?: number;
  date: string;
  host: Player | string;
  participants: {
    player: Player | string;
  }[];
  essenceRequired: number;
  stoneRequired: number;
  essencePriceWS: number;
  stonePriceWS: number;
  totalEntryFeeWS: number;
  status: 'open' | 'settled';
}

interface RunCreateForm {
  date: string;
  hostId: string;
  participantIds: string[];
  essenceRequired: string;
  stoneRequired: string;
  essencePriceWS: string;
  stonePriceWS: string;
}

export function RunsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [runs, setRuns] = useState<Run[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState<RunCreateForm>({
    date: new Date().toISOString().slice(0, 10),
    hostId: '',
    participantIds: [],
    essenceRequired: '2',
    stoneRequired: '2',
    essencePriceWS: '9',
    stonePriceWS: '5',
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const canCreate = user?.role === 'host';

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [runsRes, playersRes] = await Promise.all([
        api.get<Run[]>('/runs'),
        api.get<Player[]>('/players'),
      ]);
      setRuns(runsRes.data);
      setPlayers(playersRes.data);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError('Failed to load runs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleParticipantToggle = (playerId: string) => {
    setCreateForm((prev) => ({
      ...prev,
      participantIds: prev.participantIds.includes(playerId)
        ? prev.participantIds.filter((id) => id !== playerId)
        : [...prev.participantIds, playerId],
    }));
  };

  const handleCreateRun = async (event: FormEvent) => {
    event.preventDefault();
    if (!canCreate) return;
    setCreateError(null);
    setCreating(true);
    try {
      const payload = {
        date: createForm.date,
        hostId: createForm.hostId,
        participants: createForm.participantIds.map((id) => ({
          playerId: id,
        })),
        essenceRequired: Number(createForm.essenceRequired),
        stoneRequired: Number(createForm.stoneRequired),
        essencePriceWS: Number(createForm.essencePriceWS),
        stonePriceWS: Number(createForm.stonePriceWS),
      };
      const res = await api.post<Run>('/runs', payload);
      setCreateForm((prev) => ({
        ...prev,
        date: new Date().toISOString().slice(0, 10),
        essenceRequired: '2',
        stoneRequired: '2',
        essencePriceWS: '9',
        stonePriceWS: '5',
      }));
      await loadData();
      navigate(`/runs/${res.data._id}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setCreateError('Failed to create run');
    } finally {
      setCreating(false);
    }
  };

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
          <h1 className="page-title">Runs</h1>
          <p className="page-subtitle">
            Manage Empress runs, entry fees, and participants.
          </p>
        </div>
      </div>

      {loading && (
        <div className="card">
          <p>Loading runs...</p>
        </div>
      )}

      {!loading && error && (
        <div className="card">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {canCreate && (
            <div className="card section">
              <div className="section-title-row">
                <h2 className="section-title">Create new run</h2>
              </div>
              <form onSubmit={handleCreateRun} className="grid grid-2">
                <div className="stack">
                  <div className="form-field">
                    <span>Date</span>
                    <input
                      type="date"
                      value={createForm.date}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          date: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="form-field">
                    <span>Host</span>
                    <select
                      value={createForm.hostId}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          hostId: e.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">Select host</option>
                      {players.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <span>Essence required</span>
                    <input
                      type="number"
                      min={0}
                      value={createForm.essenceRequired}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          essenceRequired: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="form-field">
                    <span>Stone required</span>
                    <input
                      type="number"
                      min={0}
                      value={createForm.stoneRequired}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          stoneRequired: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="stack">
                  <div className="form-field">
                    <span>Essence price (WS)</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={createForm.essencePriceWS}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          essencePriceWS: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="form-field">
                    <span>Stone price (WS)</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={createForm.stonePriceWS}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          stonePriceWS: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="form-field">
                    <span>Participants</span>
                    <div className="stack" style={{ maxHeight: 160, overflow: 'auto' }}>
                      {players.map((p) => (
                        <label key={p._id}>
                          <input
                            type="checkbox"
                            checked={createForm.participantIds.includes(p._id)}
                            onChange={() => handleParticipantToggle(p._id)}
                          />{' '}
                          {p.name}
                        </label>
                      ))}
                      {players.length === 0 && (
                        <span className="muted">
                          No players yet. Create players first.
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <button
                      type="submit"
                      className="app-button-primary"
                      disabled={creating}
                    >
                      {creating ? 'Creating...' : 'Create run'}
                    </button>
                    {createError && (
                      <p className="form-error" style={{ marginTop: '0.5rem' }}>
                        {createError}
                      </p>
                    )}
                  </div>
                </div>
              </form>
            </div>
          )}

          <div className="table-card card">
            <div className="section-title-row">
              <h2 className="section-title">Recent runs</h2>
              <span className="pill muted">{runs.length} total</span>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Host</th>
                    <th>Participants</th>
                    <th>Entry fee (WS)</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => {
                    const hostName =
                      typeof run.host === 'string'
                        ? run.host
                        : ((run.host as Player)?.name ?? 'Unknown');
                    return (
                      <tr key={run._id}>
                        <td>
                          <span className="badge">#{run.runNumber ?? '?'}</span>
                        </td>
                        <td>{formatDate(run.date)}</td>
                        <td>{hostName}</td>
                        <td>{run.participants.length}</td>
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
                        <td>
                          <Link to={`/runs/${run._id}`} className="app-button-ghost">
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {runs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="muted">
                        No runs yet.
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


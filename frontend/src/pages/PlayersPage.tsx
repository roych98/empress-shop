import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface Player {
  _id: string;
  name: string;
  defaultCutPercent?: number;
  notes?: string;
  owedWS?: number;
}

interface PlayerForm {
  name: string;
  defaultCutPercent: string;
  notes: string;
}

export function PlayersPage() {
  const { user } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canEdit = user?.role === 'host';

  const [form, setForm] = useState<PlayerForm>({
    name: '',
    defaultCutPercent: '',
    notes: '',
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [updatingPlayerIds, setUpdatingPlayerIds] = useState<string[]>([]);

  const loadPlayers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Player[]>('/players');
      setPlayers(res.data);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError('Failed to load players');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkSplitsGiven = async (playerId: string) => {
    if (!canEdit) return;
    setUpdatingPlayerIds((prev) => [...prev, playerId]);
    try {
      await api.post(`/players/${playerId}/splits/paid`, { paid: true });
      await loadPlayers();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setUpdatingPlayerIds((prev) => prev.filter((id) => id !== playerId));
    }
  };

  const handleCopyOwedNames = async () => {
    const owedPlayers = players.filter((p) => (p.owedWS ?? 0) > 0);
    const names = owedPlayers.map((p) => p.name).join(',');
    try {
      await navigator.clipboard.writeText(names);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to copy to clipboard:', err);
    }
  };

  useEffect(() => {
    void loadPlayers();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;
    setCreateError(null);
    setCreating(true);
    try {
      const payload = {
        name: form.name,
        defaultCutPercent: form.defaultCutPercent
          ? Number(form.defaultCutPercent)
          : undefined,
        notes: form.notes || undefined,
      };
      await api.post('/players', payload);
      setForm({
        name: '',
        defaultCutPercent: '',
        notes: '',
      });
      await loadPlayers();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setCreateError('Failed to create player');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Players</h1>
          <p className="page-subtitle">
            Maintain the list of runners and hosts available for your runs.
          </p>
        </div>
      </div>

      {loading && (
        <div className="card">
          <p>Loading players...</p>
        </div>
      )}

      {!loading && error && (
        <div className="card">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {canEdit && (
            <div className="card section">
              <div className="section-title-row">
                <h2 className="section-title">Add player</h2>
              </div>
              <form onSubmit={handleSubmit} className="grid grid-2">
                <div className="stack">
                  <div className="form-field">
                    <span>Name</span>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="form-field">
                    <span>Default cut % (optional)</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={form.defaultCutPercent}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          defaultCutPercent: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="stack">
                  <div className="form-field">
                    <span>Notes</span>
                    <input
                      type="text"
                      value={form.notes}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, notes: e.target.value }))
                      }
                      placeholder="Class, mule info, etc."
                    />
                  </div>
                  <div>
                    <button
                      type="submit"
                      className="app-button-primary"
                      disabled={creating}
                    >
                      {creating ? 'Saving...' : 'Save player'}
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
              <h2 className="section-title">Players</h2>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {players.filter((p) => (p.owedWS ?? 0) > 0).length > 0 && (
                  <button
                    type="button"
                    className="app-button-ghost"
                    onClick={handleCopyOwedNames}
                    title="Copy names of players you owe WS to"
                  >
                    Copy
                  </button>
                )}
                <span className="pill muted">{players.length} total</span>
              </div>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Default cut %</th>
                    <th>Notes</th>
                    <th>Owed (WS)</th>
                    {canEdit && <th />}
                  </tr>
                </thead>
                <tbody>
                  {players.map((p) => {
                    const owed = p.owedWS ?? 0;
                    const updating = updatingPlayerIds.includes(p._id);
                    const owedDisplay =
                      owed > 0
                        ? `+${owed.toFixed(2)}`
                        : owed < 0
                        ? owed.toFixed(2)
                        : '0.00';
                    return (
                      <tr key={p._id}>
                        <td>{p.name}</td>
                        <td>{p.defaultCutPercent ?? '-'}</td>
                        <td className="muted">{p.notes ?? '-'}</td>
                        <td className={owed < 0 ? 'text-negative' : owed > 0 ? 'text-positive' : ''}>
                          {owedDisplay}
                        </td>
                        {canEdit && (
                          <td>
                            {owed > 0 && (
                              <button
                                type="button"
                                className="app-button-ghost"
                                onClick={() => handleMarkSplitsGiven(p._id)}
                                disabled={updating}
                              >
                                {updating ? 'Marking...' : 'Given splits'}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {players.length === 0 && (
                    <tr>
                      <td colSpan={canEdit ? 5 : 4} className="muted">
                        No players yet.
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


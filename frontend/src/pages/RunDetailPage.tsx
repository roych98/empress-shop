import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface Player {
  _id: string;
  name: string;
}

interface RunParticipant {
  player: Player | string;
  shareModifier?: number;
}

interface Run {
  _id: string;
  runNumber?: number;
  date: string;
  host: Player | string;
  participants: RunParticipant[];
  essenceRequired: number;
  stoneRequired: number;
  essencePriceWS: number;
  stonePriceWS: number;
  totalEntryFeeWS: number;
  status: 'open' | 'settled';
}

interface WeaponDrop {
  _id: string;
  run: string;
  ownerPlayer: Player | string;
  weaponType: string;
  mainRoll: number;
  secondaryRoll: number;
  notes?: string;
  status: 'unsold' | 'listed' | 'sold' | 'disenchanted';
  disenchantedInto?: 'essence' | 'stone';
  createdAt: string;
}

interface SaleSplitDetail {
  player: string;
  amountWS: number;
}

interface Sale {
  _id: string;
  run: string | Run;
  drops: (string | WeaponDrop)[];
  totalPriceWS: number;
  buyer: string;
  date: string;
  netAfterFeesWS: number;
  splitDetails: SaleSplitDetail[];
}

interface RunSummaryResponse {
  run: Run;
  drops: WeaponDrop[];
  sales: Sale[];
  totals: {
    totalEntryFeeWS: number;
    totalSalesWS: number;
    totalNetAfterFeesWS: number;
    totalDisenchantedWS?: number;
    unpaidEntryFeeWS: number;
  };
  perParticipant: {
    playerId: string;
    amountWS: number;
    owedWS?: number;
    playerName?: string;
  }[];
  paymentStatus?: {
    totalOwedWS: number;
    splitsFullyPaid: boolean;
  };
}

interface CreateDropFormState {
  weaponType: string;
  mainRoll: string;
  secondaryRoll: string;
  notes: string;
}

interface EditDropFormState {
  weaponType: string;
  mainRoll: string;
  secondaryRoll: string;
  notes: string;
  ownerPlayerId: string;
  status: 'unsold' | 'listed' | 'sold' | 'disenchanted';
}

interface CreateSaleFormState {
  totalPriceWS: string;
  buyer: string;
  remainingUnpaidEntryFeeWS: string;
}

const WEAPON_TYPES = [
  'Knuckle',
  'Gun',
  'Claw',
  'Dagger',
  'Wand',
  'Staff',
  'Bow',
  'Crossbow',
  '1h sword',
  '2h sword',
  '1h bw',
  '2h bw',
  '1h axe',
  '2h axe',
  'Polearm',
  'Spear',
] as const;

export function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [summary, setSummary] = useState<RunSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creatingDrop, setCreatingDrop] = useState(false);
  const [createDropError, setCreateDropError] = useState<string | null>(null);
  const [createDropForm, setCreateDropForm] = useState<CreateDropFormState>({
    weaponType: 'Dagger',
    mainRoll: '0',
    secondaryRoll: '0',
    notes: '',
  });

  const [selectedDropIds, setSelectedDropIds] = useState<string[]>([]);
  const [creatingSale, setCreatingSale] = useState(false);
  const [createSaleError, setCreateSaleError] = useState<string | null>(null);
  const [createSaleForm, setCreateSaleForm] = useState<CreateSaleFormState>({
    totalPriceWS: '',
    buyer: '',
    remainingUnpaidEntryFeeWS: '',
  });

  const [deleting, setDeleting] = useState(false);
  const [disenchantingDropId, setDisenchantingDropId] = useState<string | null>(null);

  // Editing state
  const [players, setPlayers] = useState<Player[]>([]);
  const [editingParticipants, setEditingParticipants] = useState(false);
  const [participantEditForm, setParticipantEditForm] = useState<{ playerId: string; shareModifier: string }[]>([]);
  const [updatingParticipants, setUpdatingParticipants] = useState(false);
  const [editingDropId, setEditingDropId] = useState<string | null>(null);
  const [editDropForm, setEditDropForm] = useState<EditDropFormState | null>(null);
  const [updatingDrop, setUpdatingDrop] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [editSaleForm, setEditSaleForm] = useState<CreateSaleFormState & { dropIds: string[] } | null>(null);
  const [updatingSale, setUpdatingSale] = useState(false);

  const canEdit = user?.role === 'host' || user?.role === 'runner';
  const canDelete = user?.role === 'host';

  const participantNameById = useMemo(() => {
    if (!summary) return {} as Record<string, string>;
    const map: Record<string, string> = {};
    summary.run.participants.forEach((p) => {
      if (typeof p.player === 'string') {
        map[p.player] = p.player;
      } else {
        map[p.player._id] = p.player.name;
      }
    });
    return map;
  }, [summary]);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const summaryRes = await api.get<RunSummaryResponse>(`/runs/${id}/summary`);
      setSummary(summaryRes.data);
      setCreateSaleForm((prev) => ({
        ...prev,
        remainingUnpaidEntryFeeWS: String(
          summaryRes.data.totals.unpaidEntryFeeWS ?? 0,
        ),
      }));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError('Failed to load run details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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

  const unsoldDrops = useMemo(
    () => summary?.drops.filter((d) => d.status === 'unsold' || d.status === 'listed') ?? [],
    [summary],
  );

  const handleCreateDrop = async (event: FormEvent) => {
    event.preventDefault();
    if (!id || !summary) return;
    setCreateDropError(null);
    setCreatingDrop(true);
    try {
      // Owner is always the host
      const hostId =
        typeof summary.run.host === 'string'
          ? summary.run.host
          : summary.run.host._id;
      const payload = {
        ownerPlayerId: hostId,
        weaponType: createDropForm.weaponType,
        mainRoll: Number(createDropForm.mainRoll),
        secondaryRoll: Number(createDropForm.secondaryRoll),
        notes: createDropForm.notes || undefined,
      };
      await api.post(`/drops/runs/${id}/drops`, payload);
      setCreateDropForm((prev) => ({
        ...prev,
        mainRoll: '0',
        secondaryRoll: '0',
        notes: '',
      }));
      await loadData();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setCreateDropError('Failed to create drop');
    } finally {
      setCreatingDrop(false);
    }
  };

  const toggleDropSelected = (dropId: string) => {
    setSelectedDropIds((prev) =>
      prev.includes(dropId)
        ? prev.filter((idItem) => idItem !== dropId)
        : [...prev, dropId],
    );
  };

  const handleCreateSale = async (event: FormEvent) => {
    event.preventDefault();
    if (!id) return;
    if (!selectedDropIds.length) {
      setCreateSaleError('Select at least one unsold drop');
      return;
    }
    setCreateSaleError(null);
    setCreatingSale(true);
    try {
      const payload = {
        runId: id,
        dropIds: selectedDropIds,
        totalPriceWS: Number(createSaleForm.totalPriceWS),
        buyer: createSaleForm.buyer,
        remainingUnpaidEntryFeeWS: Number(
          createSaleForm.remainingUnpaidEntryFeeWS || 0,
        ),
      };
      await api.post('/sales', payload);
      setCreateSaleForm({
        totalPriceWS: '',
        buyer: '',
        remainingUnpaidEntryFeeWS:
          summary?.totals.unpaidEntryFeeWS != null
            ? String(summary.totals.unpaidEntryFeeWS)
            : '0',
      });
      setSelectedDropIds([]);
      await loadData();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setCreateSaleError('Failed to create sale');
    } finally {
      setCreatingSale(false);
    }
  };

  const handleDeleteRun = async () => {
    if (!id) return;
    const confirmed = window.confirm(
      'Are you sure you want to delete this run? This will also delete all drops, sales, and clear any owed WS for this run. This action cannot be undone.',
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      await api.delete(`/runs/${id}`);
      navigate('/runs', { replace: true });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError('Failed to delete run');
      setDeleting(false);
    }
  };

  const handleDisenchant = async (dropId: string, disenchantInto: 'essence' | 'stone') => {
    setDisenchantingDropId(dropId);
    try {
      await api.post(`/drops/${dropId}/disenchant`, { disenchantInto });
      await loadData();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setDisenchantingDropId(null);
    }
  };

  // Participant editing handlers
  const startEditingParticipants = () => {
    if (!summary) return;
    setParticipantEditForm(
      summary.run.participants.map((p) => ({
        playerId: typeof p.player === 'string' ? p.player : p.player._id,
        shareModifier: String(p.shareModifier ?? 1),
      }))
    );
    setEditingParticipants(true);
  };

  const cancelEditingParticipants = () => {
    setEditingParticipants(false);
    setParticipantEditForm([]);
  };

  const handleParticipantToggle = (playerId: string) => {
    setParticipantEditForm((prev) => {
      if (prev.some((p) => p.playerId === playerId)) {
        return prev.filter((p) => p.playerId !== playerId);
      }
      return [...prev, { playerId, shareModifier: '1' }];
    });
  };

  const handleParticipantShareModifierChange = (playerId: string, value: string) => {
    setParticipantEditForm((prev) =>
      prev.map((p) => (p.playerId === playerId ? { ...p, shareModifier: value } : p))
    );
  };

  const handleUpdateParticipants = async () => {
    if (!id) return;
    setUpdatingParticipants(true);
    try {
      await api.put(`/runs/${id}`, {
        participants: participantEditForm.map((p) => ({
          playerId: p.playerId,
          shareModifier: Number(p.shareModifier),
        })),
      });
      await loadData();
      setEditingParticipants(false);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setUpdatingParticipants(false);
    }
  };

  // Drop editing handlers
  const startEditingDrop = (drop: WeaponDrop) => {
    setEditDropForm({
      weaponType: drop.weaponType,
      mainRoll: String(drop.mainRoll),
      secondaryRoll: String(drop.secondaryRoll),
      notes: drop.notes || '',
      ownerPlayerId: typeof drop.ownerPlayer === 'string' ? drop.ownerPlayer : drop.ownerPlayer._id,
      status: drop.status,
    });
    setEditingDropId(drop._id);
  };

  const cancelEditingDrop = () => {
    setEditingDropId(null);
    setEditDropForm(null);
  };

  const handleUpdateDrop = async () => {
    if (!editingDropId || !editDropForm) return;
    setUpdatingDrop(true);
    try {
      await api.put(`/drops/${editingDropId}`, {
        ownerPlayerId: editDropForm.ownerPlayerId,
        weaponType: editDropForm.weaponType,
        mainRoll: Number(editDropForm.mainRoll),
        secondaryRoll: Number(editDropForm.secondaryRoll),
        notes: editDropForm.notes || undefined,
        status: editDropForm.status,
      });
      await loadData();
      setEditingDropId(null);
      setEditDropForm(null);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setUpdatingDrop(false);
    }
  };

  // Sale editing handlers
  const startEditingSale = (sale: Sale) => {
    setEditSaleForm({
      totalPriceWS: String(sale.totalPriceWS),
      buyer: sale.buyer,
      remainingUnpaidEntryFeeWS: summary?.totals.unpaidEntryFeeWS != null ? String(summary.totals.unpaidEntryFeeWS) : '0',
      dropIds: sale.drops.map((d) => (typeof d === 'string' ? d : d._id)),
    });
    setEditingSaleId(sale._id);
  };

  const cancelEditingSale = () => {
    setEditingSaleId(null);
    setEditSaleForm(null);
  };

  const handleUpdateSale = async () => {
    if (!editingSaleId || !editSaleForm) return;
    setUpdatingSale(true);
    try {
      await api.put(`/sales/${editingSaleId}`, {
        totalPriceWS: Number(editSaleForm.totalPriceWS),
        buyer: editSaleForm.buyer,
        remainingUnpaidEntryFeeWS: Number(editSaleForm.remainingUnpaidEntryFeeWS || 0),
        dropIds: editSaleForm.dropIds,
      });
      await loadData();
      setEditingSaleId(null);
      setEditSaleForm(null);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setUpdatingSale(false);
    }
  };

  const formatDate = (value: string | Date | undefined) => {
    if (!value) return '-';
    const d = typeof value === 'string' ? new Date(value) : value;
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="card">
        <p>Loading run...</p>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="card">
        <p>{error ?? 'Run not found'}</p>
        <p>
          <Link to="/runs" className="app-button-ghost">
            Back to runs
          </Link>
        </p>
      </div>
    );
  }

  const { run, drops, sales, totals, perParticipant } = summary;

  const hostName =
    typeof run.host === 'string' ? run.host : (run.host?.name ?? 'Unknown');

  const participantDisplay = run.participants
    .map((p) => {
      const name =
        typeof p.player === 'string'
          ? p.player
          : ((p.player as Player)?.name ?? 'Unknown');
      const modifier = p.shareModifier ?? 1;
      return modifier === 1 ? name : `${name} (x${modifier})`;
    })
    .join(', ');

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Run #{run.runNumber ?? '?'}
          </h1>
          <p className="page-subtitle">
            {formatDate(run.date)} · Host: {hostName}
          </p>
        </div>
        <div className="page-toolbar">
          <Link to="/runs" className="app-button-ghost">
            Back to runs
          </Link>
          {canDelete && (
            <button
              type="button"
              className="app-button-danger"
              onClick={handleDeleteRun}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete run'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="stat-card">
          <div className="stat-label">Entry fee</div>
          <div className="stat-value">{totals.totalEntryFeeWS.toFixed(2)} WS</div>
          <div className="stat-hint">
            {run.essenceRequired} ess @ {run.essencePriceWS} WS,{' '}
            {run.stoneRequired} stone @ {run.stonePriceWS} WS
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Sales & profit</div>
          <div className="stat-value">
            {totals.totalNetAfterFeesWS.toFixed(2)} WS net
          </div>
          <div className="stat-hint">
            {totals.totalSalesWS.toFixed(2)} WS gross
            {(totals.totalDisenchantedWS ?? 0) > 0 && (
              <> · {totals.totalDisenchantedWS?.toFixed(2)} WS disenchanted</>
            )}
            {' '}· {totals.unpaidEntryFeeWS.toFixed(2)} WS entry fee remaining
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title-row">
          <h2 className="section-title">Participants</h2>
          {canEdit && !editingParticipants && (
            <button
              type="button"
              className="app-button-ghost"
              onClick={startEditingParticipants}
            >
              Edit
            </button>
          )}
        </div>
        {!editingParticipants ? (
          <p className="muted">{participantDisplay || 'No participants listed'}</p>
        ) : (
          <div className="card">
            <div className="stack">
              <div className="form-field">
                <span>Select participants</span>
                <div className="stack" style={{ maxHeight: 200, overflow: 'auto' }}>
                  {players.map((p) => {
                    const isSelected = participantEditForm.some((pe) => pe.playerId === p._id);
                    const formEntry = participantEditForm.find((pe) => pe.playerId === p._id);
                    return (
                      <div key={p._id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleParticipantToggle(p._id)}
                          />
                          <span>{p.name}</span>
                        </label>
                        {isSelected && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>Share:</span>
                            <input
                              type="number"
                              min={0.1}
                              step={0.1}
                              value={formEntry?.shareModifier ?? '1'}
                              onChange={(e) => handleParticipantShareModifierChange(p._id, e.target.value)}
                              style={{ width: 60 }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="app-button-primary"
                  onClick={handleUpdateParticipants}
                  disabled={updatingParticipants || participantEditForm.length === 0}
                >
                  {updatingParticipants ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  className="app-button-ghost"
                  onClick={cancelEditingParticipants}
                  disabled={updatingParticipants}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {perParticipant.length > 0 && (
          <div className="table-card card">
            <div className="section-title-row">
              <h3 className="section-title">Per-participant split</h3>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th className="badge-muted">Amount (WS)</th>
                    <th className="badge-muted">Owed (WS)</th>
                  </tr>
                </thead>
                <tbody>
                  {perParticipant.map((p) => {
                    const name =
                      p.playerName ?? participantNameById[p.playerId] ?? p.playerId;
                    const owed = p.owedWS ?? 0;
                    const owedDisplay =
                      owed > 0
                        ? `+${owed.toFixed(2)}`
                        : owed < 0
                        ? owed.toFixed(2)
                        : '0.00';
                    return (
                      <tr key={p.playerId}>
                        <td>{name}</td>
                        <td>{p.amountWS.toFixed(2)}</td>
                        <td className={owed < 0 ? 'text-negative' : owed > 0 ? 'text-positive' : ''}>
                          {owedDisplay}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="section">
        <div className="section-title-row">
          <h2 className="section-title">Drops</h2>
          {canEdit && (
            <span className="pill">
              {unsoldDrops.length} unsold / {drops.length} total
            </span>
          )}
        </div>
        <div className="table-card card">
          <div className="stack">
            {canEdit && (
              <form onSubmit={handleCreateDrop} className="inline-form">
                <div className="form-field">
                  <span>Weapon</span>
                  <select
                    value={createDropForm.weaponType}
                    onChange={(e) =>
                      setCreateDropForm((prev: CreateDropFormState) => ({
                        ...prev,
                        weaponType: e.target.value,
                      }))
                    }
                    required
                  >
                    {WEAPON_TYPES.map((wt) => (
                      <option key={wt} value={wt}>
                        {wt}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <span>Main roll</span>
                  <input
                    type="number"
                    min={-5}
                    max={5}
                    value={createDropForm.mainRoll}
                    onChange={(e) =>
                      setCreateDropForm((prev: CreateDropFormState) => ({
                        ...prev,
                        mainRoll: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="form-field">
                  <span>Secondary roll</span>
                  <input
                    type="number"
                    min={-1}
                    max={1}
                    value={createDropForm.secondaryRoll}
                    onChange={(e) =>
                      setCreateDropForm((prev: CreateDropFormState) => ({
                        ...prev,
                        secondaryRoll: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="form-field" style={{ flex: 1, minWidth: 200 }}>
                  <span>Notes</span>
                  <input
                    type="text"
                    value={createDropForm.notes}
                    onChange={(e) =>
                      setCreateDropForm((prev: CreateDropFormState) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    placeholder="Optional notes"
                  />
                </div>
                <div className="form-field" style={{ alignSelf: 'flex-end' }}>
                  <button
                    type="submit"
                    className="app-button-primary"
                    disabled={creatingDrop}
                  >
                    {creatingDrop ? 'Adding drop...' : 'Add drop'}
                  </button>
                </div>
              </form>
            )}
            {createDropError && <p className="form-error">{createDropError}</p>}
          </div>
          <div className="table-wrapper" style={{ marginTop: '1rem' }}>
            <table className="data-table">
              <thead>
                <tr>
                  {canEdit && <th />}
                  <th>Weapon</th>
                  <th>Owner</th>
                  <th>Roll</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Logged</th>
                  {canEdit && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {drops.map((d) => {
                  const owner =
                    typeof d.ownerPlayer === 'string'
                      ? d.ownerPlayer
                      : ((d.ownerPlayer as Player)?.name ?? 'Unknown');
                  const isSelected = selectedDropIds.includes(d._id);
                  const isDisenchanting = disenchantingDropId === d._id;
                  const canDisenchant = d.status === 'unsold' || d.status === 'listed';
                  const isEditing = editingDropId === d._id;
                  return (
                    <tr key={d._id}>
                      {canEdit && (
                        <td>
                          {d.status === 'unsold' && !isEditing && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleDropSelected(d._id)}
                            />
                          )}
                        </td>
                      )}
                      {isEditing && editDropForm ? (
                        <>
                          {canEdit && <td />}
                          <td>
                            <select
                              value={editDropForm.weaponType}
                              onChange={(e) =>
                                setEditDropForm((prev) => (prev ? { ...prev, weaponType: e.target.value } : null))
                              }
                            >
                              {WEAPON_TYPES.map((wt) => (
                                <option key={wt} value={wt}>
                                  {wt}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              value={editDropForm.ownerPlayerId}
                              onChange={(e) =>
                                setEditDropForm((prev) => (prev ? { ...prev, ownerPlayerId: e.target.value } : null))
                              }
                            >
                              {players.map((p) => (
                                <option key={p._id} value={p._id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              min={-5}
                              max={5}
                              value={editDropForm.mainRoll}
                              onChange={(e) =>
                                setEditDropForm((prev) => (prev ? { ...prev, mainRoll: e.target.value } : null))
                              }
                              style={{ width: 60 }}
                            />
                            /
                            <input
                              type="number"
                              min={-1}
                              max={1}
                              value={editDropForm.secondaryRoll}
                              onChange={(e) =>
                                setEditDropForm((prev) => (prev ? { ...prev, secondaryRoll: e.target.value } : null))
                              }
                              style={{ width: 60 }}
                            />
                          </td>
                          <td>
                            <select
                              value={editDropForm.status}
                              onChange={(e) =>
                                setEditDropForm((prev: EditDropFormState | null) => (prev ? { ...prev, status: e.target.value as 'unsold' | 'listed' | 'sold' | 'disenchanted' } : null))
                              }
                            >
                              <option value="unsold">unsold</option>
                              <option value="listed">listed</option>
                              <option value="sold">sold</option>
                              <option value="disenchanted">disenchanted</option>
                            </select>
                          </td>
                          <td>
                            <input
                              type="text"
                              value={editDropForm.notes}
                              onChange={(e) =>
                                setEditDropForm((prev) => (prev ? { ...prev, notes: e.target.value } : null))
                              }
                              placeholder="Notes"
                              style={{ width: 150 }}
                            />
                          </td>
                          <td className="muted">{formatDate(d.createdAt)}</td>
                          {canEdit && (
                            <td>
                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <button
                                  type="button"
                                  className="app-button-mini"
                                  onClick={handleUpdateDrop}
                                  disabled={updatingDrop}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="app-button-mini"
                                  onClick={cancelEditingDrop}
                                  disabled={updatingDrop}
                                >
                                  Cancel
                                </button>
                              </div>
                            </td>
                          )}
                        </>
                      ) : (
                        <>
                          <td>
                            <span className="chip">
                              <span className="chip-label">{d.weaponType}</span>
                              <span className="chip-value">
                                {d.mainRoll}/{d.secondaryRoll}
                              </span>
                            </span>
                          </td>
                          <td>{owner}</td>
                          <td>
                            {d.mainRoll}/{d.secondaryRoll}
                          </td>
                          <td>
                            <span
                              className={
                                d.status === 'sold'
                                  ? 'badge badge-success'
                                  : d.status === 'disenchanted'
                                  ? 'badge badge-info'
                                  : d.status === 'listed'
                                  ? 'badge badge-warning'
                                  : 'badge badge-muted'
                              }
                            >
                              {d.status === 'disenchanted'
                                ? `→ ${d.disenchantedInto}`
                                : d.status}
                            </span>
                          </td>
                          <td className="muted">{d.notes ?? '-'}</td>
                          <td className="muted">{formatDate(d.createdAt)}</td>
                          {canEdit && (
                            <td>
                              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  className="app-button-mini"
                                  onClick={() => startEditingDrop(d)}
                                >
                                  Edit
                                </button>
                                {canDisenchant && (
                                  <>
                                    <button
                                      type="button"
                                      className="app-button-mini"
                                      onClick={() => handleDisenchant(d._id, 'essence')}
                                      disabled={isDisenchanting}
                                      title={`Disenchant into Essence (${run.essencePriceWS} WS)`}
                                    >
                                      Ess
                                    </button>
                                    <button
                                      type="button"
                                      className="app-button-mini"
                                      onClick={() => handleDisenchant(d._id, 'stone')}
                                      disabled={isDisenchanting}
                                      title={`Disenchant into Stone (${run.stonePriceWS} WS)`}
                                    >
                                      Stone
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                  );
                })}
                {drops.length === 0 && (
                  <tr>
                    <td colSpan={canEdit ? 8 : 6} className="muted">
                      No drops logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title-row">
          <h2 className="section-title">Sales</h2>
        </div>
        <div className="table-card card">
          {canEdit && (
            <div className="stack">
              <form onSubmit={handleCreateSale} className="inline-form">
                <div className="form-field">
                  <span>Buyer</span>
                  <input
                    type="text"
                    value={createSaleForm.buyer}
                    onChange={(e) =>
                      setCreateSaleForm((prev: CreateSaleFormState) => ({
                        ...prev,
                        buyer: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="form-field">
                  <span>Total price (WS)</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={createSaleForm.totalPriceWS}
                    onChange={(e) =>
                      setCreateSaleForm((prev: CreateSaleFormState) => ({
                        ...prev,
                        totalPriceWS: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="form-field">
                  <span>Apply to unpaid entry fee (WS)</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={createSaleForm.remainingUnpaidEntryFeeWS}
                    onChange={(e) =>
                      setCreateSaleForm((prev: CreateSaleFormState) => ({
                        ...prev,
                        remainingUnpaidEntryFeeWS: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="form-field" style={{ alignSelf: 'flex-end' }}>
                  <button
                    type="submit"
                    className="app-button-primary"
                    disabled={creatingSale}
                  >
                    {creatingSale ? 'Recording sale...' : 'Record sale'}
                  </button>
                </div>
              </form>
              {createSaleError && (
                <p className="form-error">{createSaleError}</p>
              )}
              <p className="muted">
                Selected drops:{' '}
                {selectedDropIds.length
                  ? `${selectedDropIds.length} item(s)`
                  : 'none'}
              </p>
            </div>
          )}
          <div className="table-wrapper" style={{ marginTop: '1rem' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Buyer</th>
                  <th>Drops</th>
                  <th>Gross (WS)</th>
                  <th>Net after fees (WS)</th>
                  {canEdit && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => {
                  const isEditing = editingSaleId === s._id;
                  return (
                    <tr key={s._id}>
                      <td>{formatDate(s.date)}</td>
                      {isEditing && editSaleForm ? (
                        <>
                          <td>
                            <input
                              type="text"
                              value={editSaleForm.buyer}
                              onChange={(e) =>
                                setEditSaleForm((prev) => (prev ? { ...prev, buyer: e.target.value } : null))
                              }
                              style={{ width: 120 }}
                            />
                          </td>
                          <td>{s.drops.length}</td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={editSaleForm.totalPriceWS}
                              onChange={(e) =>
                                setEditSaleForm((prev) => (prev ? { ...prev, totalPriceWS: e.target.value } : null))
                              }
                              style={{ width: 100 }}
                            />
                          </td>
                          <td>{s.netAfterFeesWS.toFixed(2)}</td>
                          {canEdit && (
                            <td>
                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <button
                                  type="button"
                                  className="app-button-mini"
                                  onClick={handleUpdateSale}
                                  disabled={updatingSale}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="app-button-mini"
                                  onClick={cancelEditingSale}
                                  disabled={updatingSale}
                                >
                                  Cancel
                                </button>
                              </div>
                            </td>
                          )}
                        </>
                      ) : (
                        <>
                          <td>{s.buyer}</td>
                          <td>{s.drops.length}</td>
                          <td>{s.totalPriceWS.toFixed(2)}</td>
                          <td>{s.netAfterFeesWS.toFixed(2)}</td>
                          {canEdit && (
                            <td>
                              <button
                                type="button"
                                className="app-button-mini"
                                onClick={() => startEditingSale(s)}
                                disabled={updatingSale}
                              >
                                Edit
                              </button>
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                  );
                })}
                {sales.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
                      No sales recorded for this run yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}


import { useState, useEffect } from 'react';
import { Plus, Users, ChevronRight, RefreshCw, X, UserPlus } from 'lucide-react';
import { fetchGroups, createGroup, fetchGroupBalances, addGroupExpense, getStoredUser } from '../services/api';

const EMOJI_OPTIONS = ['🌴', '🏠', '🍽️', '🚗', '🎬', '✈️', '🎮', '💼', '🎓', '🏃', '🎉', '🍕'];

export default function GroupsView() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);
  const [balances, setBalances] = useState<any>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const currentUser = getStoredUser();

  // New group form
  const [newGroup, setNewGroup] = useState({ name: '', description: '', icon: '🌴' });
  const [members, setMembers] = useState<string[]>(['']);

  // Expense form
  const [expense, setExpense] = useState({ description: '', amount: '', paid_by_name: currentUser?.full_name ?? 'You' });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadGroups = async () => {
    setLoading(true);
    try {
      const data = await fetchGroups();
      setGroups(Array.isArray(data) ? data : []);
    } catch { setGroups([]); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadGroups();
    // Listen for global "new group" event from topbar + button
    const handler = () => setShowCreateModal(true);
    document.addEventListener('sw:add-group', handler);
    return () => document.removeEventListener('sw:add-group', handler);
  }, []);

  const handleSelectGroup = async (g: any) => {
    setSelectedGroup(g);
    setBalanceLoading(true);
    try {
      const b = await fetchGroupBalances(g.id);
      setBalances(b);
    } catch { setBalances(null); }
    finally { setBalanceLoading(false); }
  };

  const handleCreate = async () => {
    if (!newGroup.name.trim()) return showToast('Please enter a group name.');
    setSaving(true);
    try {
      const validMembers = members.filter(m => m.trim());
      const g = await createGroup({
        name: newGroup.icon + ' ' + newGroup.name,
        description: newGroup.description,
        member_names: validMembers
      } as any);
      if (g.id) {
        setGroups(prev => [g, ...prev]);
        setShowCreateModal(false);
        setNewGroup({ name: '', description: '', icon: '🌴' });
        setMembers(['']);
        showToast('✅ Group created!');
      } else {
        showToast('❌ ' + (g.detail || 'Could not create group.'));
      }
    } catch { showToast('❌ Failed to connect to backend.'); }
    finally { setSaving(false); }
  };

  const handleAddExpense = async () => {
    if (!selectedGroup) return;
    if (!expense.description.trim() || !expense.amount) return showToast('Please fill all fields.');
    setSaving(true);
    try {
      // Get members for equal split
      const groupMembers = selectedGroup.members ?? [];
      const amt = parseFloat(expense.amount);
      const splitPerPerson = groupMembers.length > 0 ? amt / groupMembers.length : amt;

      await addGroupExpense(selectedGroup.id, {
        description: expense.description,
        amount: amt,
        paid_by_name: expense.paid_by_name,
        paid_by: currentUser?.id ?? 'demo_user_id_123',
        splits: groupMembers.map((m: any) => ({
          user_id: m.user_id,
          user_name: m.member_name,
          amount_owed: splitPerPerson,
        }))
      } as any);
      showToast('✅ Expense added!');
      setShowExpenseModal(false);
      setExpense({ description: '', amount: '', paid_by_name: currentUser?.full_name ?? 'You' });
      // Reload balances
      const b = await fetchGroupBalances(selectedGroup.id);
      setBalances(b);
    } catch { showToast('❌ Failed to add expense.'); }
    finally { setSaving(false); }
  };

  const addMemberField = () => setMembers(m => [...m, '']);
  const removeMember = (i: number) => setMembers(m => m.filter((_, idx) => idx !== i));
  const updateMember = (i: number, v: string) => setMembers(m => m.map((x, idx) => idx === i ? v : x));

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 18px', boxShadow: 'var(--shadow-md)', fontSize: 13.5, fontWeight: 600 }}>
          {toast}
        </div>
      )}

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-greeting">Groups & Splits 👥</h1>
            <p className="page-subtitle">Create groups, add members, split expenses and track who owes what.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={loadGroups}><RefreshCw size={14} /></button>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}><Plus size={15} /> New Group</button>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <span className="spinner" style={{ width: 30, height: 30, borderWidth: 3 }} />
          <div style={{ marginTop: 12, color: 'var(--text-muted)' }}>Loading groups...</div>
        </div>
      ) : groups.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: '60px 20px' }}>
            <div className="empty-state-icon">👥</div>
            <div className="empty-state-title">No groups yet</div>
            <div className="empty-state-sub">Create a group, add members, and start splitting expenses fairly.</div>
            <button className="btn btn-primary" style={{ margin: '16px auto 0', display: 'flex' }} onClick={() => setShowCreateModal(true)}>
              <Plus size={14} /> Create Your First Group
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
            <div className="card" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4 }}>Total Groups</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{groups.length}</div>
            </div>
            <div className="card" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4 }}>Active</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>{groups.length}</div>
            </div>
            <div className="card" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4 }}>Click a group to see balances</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>→ View Details</div>
            </div>
          </div>

          <div className="groups-grid">
            {groups.map(g => (
              <div key={g.id} className="group-card" onClick={() => handleSelectGroup(g)}>
                <div className="group-card-header">
                  <div className="group-avatar" style={{ background: '#d1fae5', fontSize: 24 }}>
                    {g.name?.match(/\p{Emoji}/u)?.[0] ?? '👥'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="group-card-title">{g.name}</div>
                    {g.description && <div className="group-card-member-count">{g.description}</div>}
                    <div className="group-card-member-count">
                      <Users size={11} style={{ display: 'inline', marginRight: 3 }} />
                      {g.members?.length ?? 1} member{(g.members?.length ?? 1) !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <span className="badge" style={{ background: '#d1fae5', color: '#059669' }}>Active</span>
                </div>

                {g.members && g.members.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {g.members.map((m: any) => (
                      <span key={m.user_id} className="badge" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)', fontSize: 11 }}>
                        {m.member_name}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {g.created_at ? new Date(g.created_at).toLocaleDateString('en-IN') : 'Recently created'}
                  </div>
                  <button className="btn btn-secondary" style={{ fontSize: 11.5, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
                    Details <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Group Detail Modal */}
      {selectedGroup && (
        <div className="modal-overlay" onClick={() => { setSelectedGroup(null); setBalances(null); }}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                {selectedGroup.name?.match(/\p{Emoji}/u)?.[0] ?? '👥'}
              </div>
              <div style={{ flex: 1 }}>
                <div className="modal-title" style={{ marginBottom: 2 }}>{selectedGroup.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{selectedGroup.description || 'Group expense tracker'}</div>
              </div>
            </div>

            {/* Members */}
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Members</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {(selectedGroup.members ?? []).map((m: any) => (
                <span key={m.user_id} className="badge" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)', padding: '5px 12px', fontSize: 12 }}>
                  👤 {m.member_name}
                </span>
              ))}
              {(!selectedGroup.members || selectedGroup.members.length === 0) && (
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>No members found</span>
              )}
            </div>

            {/* Balances */}
            {balanceLoading ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <span className="spinner" />
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 8 }}>Computing settlements...</div>
              </div>
            ) : Array.isArray(balances) && balances.length > 0 ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Suggested Settlements</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {balances.map((s: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca' }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{s.payer_name ?? s.from_name} → {s.payee_name ?? s.to_name}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--red)' }}>₹{Number(s.amount).toLocaleString('en-IN')}</span>
                        <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 11 }}>Settle</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--accent)', fontWeight: 600, fontSize: 13, marginBottom: 12 }}>
                ✅ All settled up! No pending balances.
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setSelectedGroup(null); setBalances(null); }}>Close</button>
              <button className="btn btn-primary" onClick={() => setShowExpenseModal(true)}>
                <Plus size={14} /> Add Expense
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showExpenseModal && selectedGroup && (
        <div className="modal-overlay" onClick={() => setShowExpenseModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add Group Expense</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              This expense will be split equally among all {selectedGroup.members?.length ?? 1} member(s).
            </div>
            <div className="form-group">
              <label className="form-label">Description *</label>
              <input className="form-input" placeholder="e.g. Hotel booking, Dinner" value={expense.description}
                onChange={e => setExpense(x => ({ ...x, description: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Total Amount (₹) *</label>
                <input className="form-input" type="number" min="0" step="0.01" placeholder="0.00" value={expense.amount}
                  onChange={e => setExpense(x => ({ ...x, amount: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Paid By</label>
                <select className="form-select" value={expense.paid_by_name}
                  onChange={e => setExpense(x => ({ ...x, paid_by_name: e.target.value }))}>
                  {(selectedGroup.members ?? []).map((m: any) => (
                    <option key={m.user_id} value={m.member_name}>{m.member_name}</option>
                  ))}
                </select>
              </div>
            </div>
            {expense.amount && selectedGroup.members?.length > 0 && (
              <div style={{ padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 8, fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Each person pays: <strong>₹{(parseFloat(expense.amount) / selectedGroup.members.length).toFixed(2)}</strong>
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowExpenseModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddExpense} disabled={saving}>
                {saving ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : null}
                Add Expense
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">Create New Group</div>

            <div className="form-group">
              <label className="form-label">Group Name *</label>
              <input className="form-input" placeholder="e.g. Goa Trip" value={newGroup.name}
                onChange={e => setNewGroup(g => ({ ...g, name: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" placeholder="Optional description" value={newGroup.description}
                onChange={e => setNewGroup(g => ({ ...g, description: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Group Icon</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {EMOJI_OPTIONS.map(em => (
                  <button key={em} onClick={() => setNewGroup(g => ({ ...g, icon: em }))}
                    style={{ width: 36, height: 36, borderRadius: 8, fontSize: 20, border: `2px solid ${newGroup.icon === em ? 'var(--accent)' : 'var(--border)'}`, background: newGroup.icon === em ? 'var(--accent-light)' : 'white', cursor: 'pointer' }}>
                    {em}
                  </button>
                ))}
              </div>
            </div>

            {/* Members */}
            <div className="form-group">
              <label className="form-label" style={{ marginBottom: 8 }}>
                Group Members <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(You are added automatically)</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Current user chip */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--accent-light)', borderRadius: 8, border: '1px solid #a7f3d0' }}>
                  <span style={{ fontSize: 14 }}>👤</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', flex: 1 }}>
                    {currentUser?.full_name ?? 'You'} (You)
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--accent)' }}>Admin</span>
                </div>
                {/* Dynamic member inputs */}
                {members.map((m, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      className="form-input"
                      placeholder={`Member ${i + 1} name (e.g. Rahul Verma)`}
                      value={m}
                      onChange={e => updateMember(i, e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button onClick={() => removeMember(i)}
                      style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button onClick={addMemberField} className="btn btn-secondary" style={{ justifyContent: 'center' }}>
                  <UserPlus size={14} /> Add Another Member
                </button>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                {saving ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Creating...</> : 'Create Group'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

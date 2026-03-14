import React, { useState, useEffect } from 'react';
import { Plus, X, Trash2, Clock } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const TimelinePlanner = ({ isOpen, onClose, originalSequence, onSaveSequence }) => {
    const [sequence, setSequence] = useState(originalSequence || []);

    // Global Capacity (Available Time)
    const [globalHours, setGlobalHours] = useState('8');
    const [globalMins, setGlobalMins] = useState('0');

    // Form State
    const [newTitle, setNewTitle] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newDuration, setNewDuration] = useState('25');
    const [newType, setNewType] = useState('work');

    useEffect(() => {
        if (isOpen) {
            setSequence(originalSequence || []);
        }
    }, [isOpen, originalSequence]);

    if (!isOpen) return null;

    // Calculations
    const totalAllocatedMinutes = sequence.reduce((acc, b) => acc + b.durationMinutes, 0);
    const userGlobalLimitMinutes = (parseInt(globalHours) || 0) * 60 + (parseInt(globalMins) || 0);
    const remainingMinutes = userGlobalLimitMinutes - totalAllocatedMinutes;
    const isOverboard = remainingMinutes < 0;

    const formatHrsMins = (totalMins) => {
        const h = Math.floor(Math.abs(totalMins) / 60);
        const m = Math.abs(totalMins) % 60;
        return `${totalMins < 0 ? '-' : ''}${h}h ${m}m`;
    };

    const addBlock = (e) => {
        e.preventDefault();
        const dur = parseInt(newDuration);
        if (!dur || dur <= 0) return;

        setSequence([...sequence, {
            id: uuidv4(),
            title: newTitle.trim() || (newType === 'work' ? 'Focus Session' : 'Break Time'),
            description: newDescription.trim() || '',
            type: newType,
            durationMinutes: dur,
        }]);

        setNewTitle('');
        setNewDescription('');
        // Auto-toggle type for rapid entry
        if (newType === 'work') {
            setNewType('break');
            setNewDuration('5');
        } else {
            setNewType('work');
            setNewDuration('25');
        }
    };

    const removeBlock = (id) => {
        setSequence(sequence.filter(b => b.id !== id));
    };

    const clearAll = () => setSequence([]);

    const handleSave = () => {
        onSaveSequence({
            blocks: sequence,
            globalLimitMinutes: userGlobalLimitMinutes
        });
        onClose();
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '800px', padding: '0', overflow: 'hidden' }}>
                {/* HEADER */}
                <div style={{ padding: '30px 40px', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 className="panel-header" style={{ margin: 0, marginBottom: '8px' }}>Çalışmanı Planla</h2>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Time-box your day. Set a total duration, and carve out blocks.</div>
                    </div>
                    <button onClick={onClose} style={{ padding: '8px', background: 'transparent', border: 'none' }}><X size={24} /></button>
                </div>

                {/* BODY */}
                <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '30px', maxHeight: '70vh', overflowY: 'auto' }}>

                    {/* Global Time Setting & Capacity Bar */}
                    <div style={{ background: 'var(--bg-primary)', padding: '24px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Clock size={20} color="var(--accent-color)" />
                                <span style={{ fontWeight: 500 }}>Total Available Time:</span>
                                <input type="number" className="input-field" style={{ width: '70px', padding: '8px' }} value={globalHours} onChange={e => setGlobalHours(e.target.value)} /> <span className="config-label-sub">Hr</span>
                                <input type="number" className="input-field" style={{ width: '70px', padding: '8px' }} value={globalMins} onChange={e => setGlobalMins(e.target.value)} /> <span className="config-label-sub">Min</span>
                            </div>

                            <div style={{ display: 'flex', gap: '16px', fontSize: '0.9rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Allocated</span>
                                    <span style={{ fontWeight: 600 }}>{formatHrsMins(totalAllocatedMinutes)}</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', paddingLeft: '16px', borderLeft: '1px solid var(--border-color)' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Remaining</span>
                                    <span style={{ fontWeight: 600, color: isOverboard ? 'var(--danger-color)' : 'var(--text-primary)' }}>{formatHrsMins(remainingMinutes)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Capacity Visualizer */}
                        <div style={{
                            width: '100%', height: '20px', borderRadius: '10px',
                            background: 'var(--bg-secondary)', overflow: 'hidden',
                            display: 'flex', border: '1px solid var(--border-color)'
                        }}>
                            {userGlobalLimitMinutes > 0 ? (
                                <>
                                    {sequence.map((block, i) => {
                                        const perc = (block.durationMinutes / userGlobalLimitMinutes) * 100;
                                        return (
                                            <div
                                                key={block.id}
                                                style={{
                                                    width: `${perc}%`,
                                                    height: '100%',
                                                    background: block.type === 'work' ? 'var(--accent-color)' : 'var(--accent-break)',
                                                    borderRight: i === sequence.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.3)'
                                                }}
                                            />
                                        );
                                    })}
                                    {/* Empty space represented automatically by background */}
                                    {isOverboard && (
                                        <div style={{ width: '100%', height: '100%', background: 'var(--danger-color)', opacity: 0.8 }} title="Over capacity!" />
                                    )}
                                </>
                            ) : (
                                <div style={{ width: '100%', height: '100%', background: 'var(--border-color)' }} />
                            )}
                        </div>
                    </div>

                    {/* Sequence Builder Form */}
                    <div>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', fontWeight: 500 }}>Add to Timeline</h3>
                        <form onSubmit={addBlock} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: '150px', gap: '8px' }}>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={newTitle}
                                    onChange={e => setNewTitle(e.target.value)}
                                    placeholder="What will you do? (Task Name)"
                                />
                                <input
                                    type="text"
                                    className="input-field"
                                    style={{ fontSize: '0.9rem' }}
                                    value={newDescription}
                                    onChange={e => setNewDescription(e.target.value)}
                                    placeholder="Details / Rules during this block..."
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '10px', height: 'fit-content' }}>
                                <select
                                    className="input-field"
                                    value={newType}
                                    onChange={e => setNewType(e.target.value)}
                                    style={{ width: '110px' }}
                                >
                                    <option value="work">Focus</option>
                                    <option value="break">Break</option>
                                </select>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="number"
                                        className="input-field"
                                        style={{ width: '90px', paddingRight: '40px' }}
                                        value={newDuration}
                                        onChange={e => setNewDuration(e.target.value)}
                                    />
                                    <span style={{ position: 'absolute', right: '12px', top: '12px', color: 'var(--text-secondary)', fontSize: '0.9rem', pointerEvents: 'none' }}>min</span>
                                </div>
                                <button type="submit" className="primary" style={{ padding: '12px 20px' }}>
                                    <Plus size={20} />
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Block List */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 500 }}>Planned Blocks</h3>
                            {sequence.length > 0 && <button className="danger" onClick={clearAll} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>Clear All</button>}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {sequence.length === 0 ? (
                                <div className="flex-center" style={{ padding: '40px', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                                    No blocks planned yet. Start adding tasks above!
                                </div>
                            ) : (
                                sequence.map((block, idx) => (
                                    <div key={block.id} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '16px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)',
                                        borderLeft: `6px solid ${block.type === 'work' ? 'var(--accent-color)' : 'var(--accent-break)'}`,
                                        boxShadow: '0 2px 5px rgba(0,0,0,0.02)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                                            <div style={{ fontWeight: 600, color: 'var(--text-secondary)', width: '20px', marginTop: '2px' }}>{idx + 1}.</div>
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{block.title}</div>
                                                {block.description && <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '4px', fontStyle: 'italic' }}>{block.description}</div>}
                                                <div className="config-label-sub" style={{ marginTop: '6px' }}>
                                                    <span style={{
                                                        display: 'inline-block', padding: '2px 8px', borderRadius: '10px',
                                                        background: block.type === 'work' ? 'rgba(138,154,134,0.1)' : 'rgba(214,168,124,0.1)',
                                                        color: block.type === 'work' ? 'var(--accent-color)' : 'var(--accent-break)',
                                                        marginRight: '8px'
                                                    }}>
                                                        {block.type === 'work' ? 'Focus' : 'Break'}
                                                    </span>
                                                    {block.durationMinutes} minutes
                                                </div>
                                            </div>
                                        </div>
                                        <button style={{ padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '50%', color: 'var(--danger-color)' }} onClick={() => removeBlock(block.id)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>

                {/* FOOTER */}
                <div style={{ padding: '24px 40px', background: 'var(--bg-primary)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
                    <button onClick={onClose} style={{ padding: '12px 24px' }}>Cancel</button>
                    <button className="primary" onClick={handleSave} style={{ padding: '12px 32px' }}>Save Plan to Timer</button>
                </div>
            </div>
        </div>
    );
};

export default TimelinePlanner;

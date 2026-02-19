import { Bookmark, TrendingUp, Calendar, Zap, Sparkles } from 'lucide-react'
import SyncModal from './SyncModal'

export default function Header({ totalSaves, stats, userPhone, onLogoClick }) {
    const topCategory = stats?.categories
        ? Object.entries(stats.categories).sort((a, b) => b[1] - a[1])[0]?.[0]
        : null

    const weekCount = stats?.weekCount ?? totalSaves

    return (
        <header>
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', maxWidth: '1152px', margin: '0 auto', padding: '0 28px',
                height: '100%',
            }}>
                {/* Left Section */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    {/* Logo — clickable to landing */}
                    <button
                        onClick={onLogoClick}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '14px',
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: '8px 4px', borderRadius: '14px',
                            transition: 'all 0.25s ease',
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                        title="Back to landing page"
                    >
                        <div style={{
                            width: '38px', height: '38px', borderRadius: '12px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'linear-gradient(135deg, #7c6dfa, #a78bfa)',
                            boxShadow: '0 4px 16px rgba(124,109,250,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                            flexShrink: 0,
                        }}>
                            <Bookmark style={{ width: '18px', height: '18px', color: '#fff' }} strokeWidth={2.5} />
                        </div>
                        <span style={{
                            fontSize: '18px', fontWeight: 800, letterSpacing: '-0.03em',
                            background: 'linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.7) 100%)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                        }}>
                            Social Saver
                        </span>
                    </button>

                    {/* Divider */}
                    <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.08)' }} />

                    {/* Sync */}
                    {userPhone && <SyncModal userPhone={userPhone} />}

                    {/* Stats pills */}
                    {totalSaves > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '7px 14px', borderRadius: '100px',
                                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                                fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)',
                            }}>
                                <Calendar style={{ width: '13px', height: '13px', opacity: 0.5 }} />
                                <span style={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.7)' }}>{weekCount}</span>
                                <span>this week</span>
                            </div>
                            {topCategory && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '7px 14px', borderRadius: '100px',
                                    background: 'rgba(124,109,250,0.08)', border: '1px solid rgba(124,109,250,0.15)',
                                    fontSize: '12px', fontWeight: 600, color: 'rgba(167,139,250,0.8)',
                                }}>
                                    <TrendingUp style={{ width: '13px', height: '13px', opacity: 0.6 }} />
                                    <span>{topCategory}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Section */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {totalSaves > 0 && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '8px 16px', borderRadius: '100px',
                            background: 'rgba(124,109,250,0.06)', border: '1px solid rgba(124,109,250,0.12)',
                        }}>
                            <Sparkles style={{ width: '14px', height: '14px', color: '#7c6dfa' }} />
                            <span style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
                                {totalSaves}
                            </span>
                            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>
                                saves
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </header>
    )
}

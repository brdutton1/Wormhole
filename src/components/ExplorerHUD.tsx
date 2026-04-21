import { useEffect, useState } from 'react'

export type Phase = 'approach' | 'traversal' | 'arrival'

export type TidalLevel = 'nominal' | 'warning' | 'critical'

interface Props {
  phase: Phase
  proximity: number
  onEngage: () => void
  onReturn: () => void
  onStay: () => void
  hudDismissed: boolean
}

function tidalLevel(proximity: number): TidalLevel {
  if (proximity < 0.3) return 'critical'
  if (proximity < 0.6) return 'warning'
  return 'nominal'
}

export default function ExplorerHUD({
  phase,
  proximity,
  onEngage,
  onReturn,
  onStay,
  hudDismissed,
}: Props) {
  const [dots, setDots] = useState('')
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    if (phase !== 'traversal') return
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'))
    }, 300)
    return () => clearInterval(id)
  }, [phase])

  // Reopen the drop-down on a fresh phase so the user sees new flavor + actions.
  useEffect(() => {
    setExpanded(true)
  }, [phase])

  const tidal = tidalLevel(proximity)
  const colorClass =
    phase === 'approach' ? 'hud-amber' : phase === 'traversal' ? 'hud-white' : 'hud-cyan'
  const showDrop = !hudDismissed || phase === 'traversal'

  return (
    <div className="hud-root">
      <div className={`hud-tidal hud-tidal-${tidal}`}>
        TIDAL: {tidal.toUpperCase()}
      </div>

      <div className="hud-phase">
        EXPLORER LOG / PHASE: {phase.toUpperCase()}
      </div>

      {showDrop && (
        <div className={`hud-drop ${colorClass}`}>
          <button
            className="hud-drop-header"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
          >
            <span className="hud-drop-title">
              {phase === 'approach' && 'MISSION BRIEF'}
              {phase === 'traversal' && `TRANSIT ENGAGED${dots}`}
              {phase === 'arrival' && 'SYSTEM SCAN'}
            </span>
            <span className="hud-drop-chevron">{expanded ? '▲' : '▼'}</span>
          </button>

          {expanded && (
            <div className="hud-drop-body">
              {phase === 'approach' && (
                <>
                  <p className="hud-flavor">
                    Station Kryos-III, departure point. Frozen surface,
                    subsurface ocean, minimal atmosphere. Stabilized Kerr transit
                    corridor detected 4.1 Mm ahead — gravitational lensing consistent
                    with ~1 solar-mass singularity, reinforced against tidal collapse.
                  </p>
                  <p className="hud-flavor hud-dim">
                    Destination: unknown. In it to win it.
                  </p>
                  <button className="hud-button hud-engage" onClick={onEngage}>
                    ENGAGE
                  </button>
                </>
              )}

              {phase === 'traversal' && (
                <p className="hud-flavor hud-dim hud-center">
                  tidal forces nominal &middot; relativistic aberration detected
                </p>
              )}

              {phase === 'arrival' && (
                <>
                  <p className="hud-flavor">
                    Emerged. System unclassified. Host: A-class main sequence, ~7500 K.
                    Companion: ringed rocky body, est. 0.9 Earth-mass. No radio signature.
                  </p>
                  <div className="hud-button-row">
                    <button className="hud-button hud-return" onClick={onReturn}>
                      RETURN
                    </button>
                    <button className="hud-button hud-stay" onClick={onStay}>
                      STAY
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

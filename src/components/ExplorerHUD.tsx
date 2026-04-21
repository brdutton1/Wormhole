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

  useEffect(() => {
    if (phase !== 'traversal') return
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'))
    }, 300)
    return () => clearInterval(id)
  }, [phase])

  const tidal = tidalLevel(proximity)

  return (
    <div className="hud-root">
      {/* Top-right tidal readout */}
      <div className={`hud-tidal hud-tidal-${tidal}`}>
        TIDAL: {tidal.toUpperCase()}
      </div>

      {/* Top-left phase indicator */}
      <div className="hud-phase">
        EXPLORER LOG / PHASE: {phase.toUpperCase()}
      </div>

      {/* Bottom content */}
      {!hudDismissed && phase === 'approach' && (
        <div className="hud-bottom hud-amber">
          <p className="hud-flavor">
            Drifting 0.31 AU sunward of Mercury. Stabilized Kerr transit corridor
            detected ahead. Gravitational lensing consistent with ~1 solar-mass
            singularity, reinforced against tidal collapse.
          </p>
          <p className="hud-flavor hud-dim">
            Destination: unknown. In it to win it.
          </p>
          <button className="hud-button hud-engage" onClick={onEngage}>
            ENGAGE
          </button>
        </div>
      )}

      {phase === 'traversal' && (
        <div className="hud-bottom hud-white">
          <p className="hud-flavor hud-center">
            TRANSIT ENGAGED{dots}
          </p>
          <p className="hud-flavor hud-dim hud-center">
            tidal forces nominal &middot; relativistic aberration detected
          </p>
        </div>
      )}

      {!hudDismissed && phase === 'arrival' && (
        <div className="hud-bottom hud-cyan">
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
        </div>
      )}
    </div>
  )
}

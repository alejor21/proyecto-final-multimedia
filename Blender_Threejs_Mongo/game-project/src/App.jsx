import { useEffect, useRef, useState } from 'react'
import Experience from './Experience/Experience'
import './styles/loader.css'

const App = () => {
  const canvasRef = useRef()
  const [progress, setProgress] = useState(0)
  const [loading, setLoading] = useState(true)
  const [coins, setCoins] = useState(0)

  useEffect(() => {
    const experience = new Experience(canvasRef.current)

    const handleProgress = (e) => setProgress(e.detail)
    const handleComplete = () => setLoading(false)
    const handleCoinCollect = (e) => setCoins(e.detail.coins)

    window.addEventListener('resource-progress', handleProgress)
    window.addEventListener('resource-complete', handleComplete)
    window.addEventListener('coin-collected', handleCoinCollect)

    return () => {
      window.removeEventListener('resource-progress', handleProgress)
      window.removeEventListener('resource-complete', handleComplete)
      window.removeEventListener('coin-collected', handleCoinCollect)
    }
  }, [])

  return (
    <>
      {loading && (
        <div id="loader-overlay">
          <div id="loader-bar" style={{ width: `${progress}%` }}></div>
          <div id="loader-text">Cargando... {progress}%</div>
        </div>
      )}
      <div id="game-ui">
        <div id="coins-counter">Monedas: {coins}</div>
      </div>
      <canvas ref={canvasRef} className="webgl" />
    </>
  )
}

export default App

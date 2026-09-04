import { KeyboardControls } from '@react-three/drei'
import { Game } from './game/Game'
import { KEY_MAP } from './game/Player'
import { UI } from './ui/UI'
import { useDebugApi } from './utils/debug'

export default function App() {
  useDebugApi()
  return (
    <KeyboardControls map={KEY_MAP}>
      <Game />
      <UI />
    </KeyboardControls>
  )
}

import { CHAMBERS } from '@/data/resume'
import { Walls } from './world/Walls'
import { Hub } from './world/Hub'
import { AboutRoom } from './world/AboutRoom'
import { ChamberShell } from './world/Chamber'
import { ScotiabankChamber } from './chambers/ScotiabankChamber'
import { ChalkChamber } from './chambers/ChalkChamber'
import { TetraTechChamber } from './chambers/TetraTechChamber'
import { InsightAIChamber } from './chambers/InsightAIChamber'
import { McMasterChamber } from './chambers/McMasterChamber'

export function World() {
  return (
    <group>
      <Walls />
      <Hub />
      <ChamberShell id="scotiabank" accent={CHAMBERS.scotiabank.accent}>
        <ScotiabankChamber />
      </ChamberShell>
      <ChamberShell id="chalk" accent={CHAMBERS.chalk.accent}>
        <ChalkChamber />
      </ChamberShell>
      <ChamberShell id="tetratech" accent={CHAMBERS.tetratech.accent}>
        <TetraTechChamber />
      </ChamberShell>
      <ChamberShell id="insightai" accent={CHAMBERS.insightai.accent}>
        <InsightAIChamber />
      </ChamberShell>
      <ChamberShell id="mcmaster" accent={CHAMBERS.mcmaster.accent}>
        <McMasterChamber />
      </ChamberShell>
      <AboutRoom />
    </group>
  )
}

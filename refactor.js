const fs = require('fs');
let c = fs.readFileSync('src/components/Buildings.tsx', 'utf8');

c = c.replace(/function useBuildingInteractions.*?return \{ isHovered.*?handleClick \};\n\}/s, match => match + '\n\nexport function useBuildingState(buildingId: string | undefined) {\n  return useGameStore(useShallow(state => {\n    if (!buildingId || buildingId.startsWith(\'pending-\') || buildingId === \'preview\') return { isOn: true, isPowered: true, extractionRate: 1, energyLevel: 0 };\n    const b = state.buildings.find(b => b.id === buildingId);\n    if (!b) return { isOn: true, isPowered: true, extractionRate: 1, energyLevel: 0 };\n    return {\n      isOn: b.isOn,\n      isPowered: b.isPowered,\n      extractionRate: b.extractionRate ?? 1,\n      energyLevel: b.energyMax ? b.energyStored / b.energyMax : 0\n    };\n  }));\n}');

c = c.replace(/const buildingsData = useGameStore\(useShallow\(state =>\s+state\.buildings\.map\(b => .*\)\s+\)\);/s, 'const buildingsData = useGameStore(useShallow(state => state.buildings.map(b => `${b.id}:${b.type}:${b.faceIndex}:${b.status}`)));');

const components = ['SolarPanel', 'Battery', 'Junction', 'IceExtractor', 'MineralExtractor', 'Warehouse', 'Core', 'Spaceport', 'Habitation', 'Greenhouse', 'Factory', 'OxygenGenerator'];

for (const comp of components) {
  const regex = new RegExp(`(function ${comp}\\(\\{ building, gameTime \\}: \\{ building: Partial<Building> & \\{ faceIndex: number(.*?)\\}, gameTime: number \\}\\) \\{|function ${comp}\\(\\{ building \\}: \\{ building: Partial<Building> & \\{ faceIndex: number(.*?)\\} \\}\\) \\{)`, 'g');
  c = c.replace(regex, (match) => {
    return match + '\n  const { isOn, isPowered, extractionRate, energyLevel } = useBuildingState(building.id);\n  const isOff = isOn === false || isPowered === false || extractionRate === 0;';
  });
}

c = c.replace(/isOff=\{building\?\.isOn === false \|\| building\?\.isPowered === false \|\| building\?\.extractionRate === 0\}/g, 'isOff={isOff}');

c = c.replace(/const fillRatio = building\.energyLevel \|\| 0;/g, 'const fillRatio = energyLevel;');

fs.writeFileSync('src/components/Buildings.tsx', c);

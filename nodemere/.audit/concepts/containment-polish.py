from pathlib import Path
p=Path('src/pages/concepts/ConceptsPage.jsx');s=p.read_text(encoding='utf-8').replace('r=node.r*scale;','r=node.r*scale*(node!==target&&node.parent!==target?.65:1);').replace('y:isFocus?y-r+29:','y:isFocus?y-r-12:');p.write_text(s,encoding='utf-8')

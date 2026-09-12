from pathlib import Path
p=Path('src/pages/concepts/AdditionalConcepts.jsx');s=p.read_text(encoding='utf-8')
s=s.replace("import './additional-concepts.css';", "import './additional-concepts.css';\nimport Echo from './DropInEcho';")
a=s.index('function Signature(');b=s.index('const baseSites=',a);s=s[:a]+s[b:]
s=s.replace("thesis:'A parent’s influence is visible in every child.', mechanism:'Live inheritance', instruction:'Change the parent. Give one child a variation. Reconnect it.'", "thesis:'A parent controls the availability of its next choices.', mechanism:'Branch availability', instruction:'Disable the parent, then preview which choices remain available.'")
p.write_text(s,encoding='utf-8')
p=Path('src/pages/concepts/DropInConceptContext.jsx');s=p.read_text(encoding='utf-8').replace('setValue(next);select(next);','setValue(next);if(next)select(next);');p.write_text(s,encoding='utf-8')
# Parent removal can invalidate a local drill-down path. Recover to the status root.
p=Path('src/pages/concepts/ConceptsPage.jsx');s=p.read_text(encoding='utf-8')
s=s.replace('nodes.map((node, i)', 'nodes.filter(Boolean).map((node, i)')
s=s.replace('const parent=findNode(tree,active)||tree.children[0];','const parent=findNode(tree,active)||tree.children[0];')
s=s.replace('const [active,setActive]=useCanvasSelection(tree.children[0]?.id||null);','const [active,setActive]=useCanvasSelection(tree.children[0]?.id||null);')
p.write_text(s,encoding='utf-8')

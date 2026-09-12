from pathlib import Path

base=Path('src/pages/concepts')
p=base/'ConceptsPage.jsx'
s=p.read_text(encoding='utf-8')
s=s.replace("import './concepts.css';", "import './concepts.css';\nimport { DropInConceptProvider, useDropInConcept, useCanvasSelection } from './DropInConceptContext';\nimport { DropInStatusBar, DropInTools } from './DropInConceptTools';")
start=s.index('export function useStructure()')
end=s.index('export function AddChild',start)
s=s[:start]+"export function useStructure() { return useDropInConcept(); }\n\n"+s[end:]
s=s.replace("label = 'Add child'", "label = 'Add drop-in'").replace('aria-label="Child name" placeholder="Name your child" maxLength={26}', 'aria-label="Drop In name" placeholder="Name the drop-in" maxLength={64}').replace('aria-label="Create child"','aria-label="Create drop-in"')
s=s.replace('export default function ConceptsPage() {', 'export default function ConceptsPage() { return <DropInConceptProvider><ConceptsLab /></DropInConceptProvider>; }\n\nfunction ConceptsLab() {\n  const {tree,status,add}=useDropInConcept();')
s=s.replace("'Concepts — Relationship studies'", "'Drop Ins — Concept lab'")
s=s.replace('>Concepts<span className="cl-brand-sub">RELATIONSHIP STUDIES', '>Drop Ins<span className="cl-brand-sub">BUILDER CONCEPTS')
s=s.replace('A study in belonging.<br/><span>Form follows relationship.</span>', 'One Drop In draft.<br/><span>Eleven ways to build it.</span>')
s=s.replace('INTERACTIVE STUDY','DROP-IN BUILDER')
start=s.index('      <div className="cl-experiments">')
end=s.index('      <footer className="cl-footer">',start)
s=s[:start]+'''      <DropInStatusBar />
      <div className="cl-experiments"><section key={`${selected}-${status}`} className={`cl-experiment cl-experiment-${selected}`} aria-label={item.name}>{tree.children.length?React.createElement(item.component):<div className="dc-empty"><h2>Start this appointment moment.</h2><p>Add the first Drop In for this status.</p><button onClick={()=>add(tree.id,'New drop-in')}>Add drop-in <Plus size={15}/></button></div>}</section></div>
      <DropInTools />
'''+s[end:]
s=s.replace('PARENT <ArrowRight size={11}/> CHILD', 'DROP-IN <ArrowRight size={11}/> NEXT CHOICE')
s=s.replace("useState('alpha')", "useCanvasSelection(tree.children[0]?.id||null)")
s=s.replace('const [leaf, setLeaf] = useState(null)', 'const [leaf, setLeaf] = useCanvasSelection(null)')
s=s.replace("const [leaf,setLeaf]=useState('a1')", 'const [leaf,setLeaf]=useCanvasSelection(null)')
s=s.replace('const [selectedLeaf,setSelectedLeaf]=useState(null)', 'const [selectedLeaf,setSelectedLeaf]=useCanvasSelection(null)')
s=s.replace('const nodes = path.map(id => findNode(tree,id));','const nodes = path.map(id => findNode(tree,id)).filter(Boolean);')
s=s.replace('const parent=findNode(tree,path[path.length-1]);','const parent=findNode(tree,path[path.length-1])||tree;')
s=s.replace('const { tree, add } = useStructure();','const { tree, add, select } = useStructure();')
s=s.replace('const {tree,add}=useStructure();','const {tree,add,select}=useStructure();')
s=s.replace('if(node.data.id!==focused.id) setPath([...path,node.data.id]);','if(node.data.id!==focused.id) { setPath([...path,node.data.id]); select(node.data.id); }')
s=s.replace('const enter=node=>{setPath([...path,node.id]);','const enter=node=>{select(node.id);setPath([...path,node.id]);')
s=s.replace("const [groups,setGroups]=useState(()=>makeTree().children.slice(0,3));", "const {tree,setTree,select,add}=useStructure();\n  const groups=tree.children;\n  const setGroups=next=>setTree({...tree,children:typeof next==='function'?next(groups):next});")
s=s.replace("if(!dragging)setSelected(selected.includes(node.id)?selected.filter(id=>id!==node.id):[...selected,node.id]);", "if(!dragging){select(node.id);setSelected(selected.includes(node.id)?selected.filter(id=>id!==node.id):[...selected,node.id]);}")
s=s.replace("onAdd={name=>setGroups(previous=>previous.map(g=>g.id===group.id?{...g,children:[...g.children,{id:crypto.randomUUID(),name,children:[]}]}:g))}", "onAdd={name=>{setHistory(null);add(group.id,name);}}")
replacements={
 'ONE COLLECTION · ':'APPOINTMENT ACTIONS · ', ' FOLDS':' DROP-INS', 'label="New fold"':'label="New drop-in"', '<span>Collection</span>':'<span>{tree.name}</span>',
 'COLLECTION / CONTINUOUS STRUCTURE':'DROP-INS / CHOICE ORDER', '<h2>Collection<span>':'<h2>{tree.name}<span>', ' divisions':' choices',
 '<span>PARENT</span><span>100%</span>':'<span>APPOINTMENT LEVEL</span><span>DROP-INS</span>',
 'Every part belongs<br/>to a greater whole.':'Arrange the choices<br/>available after this moment.', 'label="Divide the whole"':'label="Add drop-in"',
 'Structure remains continuous as proportions change.':'Resize the view without changing the actions.',
 'Hierarchy, without the scaffolding.':'Choose an action. Reveal its next choices.', 'ELEMENTS IN THIS PASSAGE':'DROP-INS IN THIS BRANCH',
 'An open-ended index.':'Available next choices.', 'One origin.':'Appointment', '<span>Collection</span>':'<span>{tree.name}</span>',
 'COLLECTION / ':'DROP-INS / ', ' ELEMENTS':' ACTIONS', 'A place for<br/><span>everything.</span>':'The right action.<br/><span>The right parent.</span>',
 'Every element has a place. You decide where.':'Move the next choices beneath the right Drop In.', 'Select a few. Move them together.':'Select actions. Choose their parent.',
 'New fold':'New drop-in', 'Open a fold. Its siblings make room.':'Open a Drop In to build its next choices.',
 'Space opens where your attention goes.':'Open a parent action. Build the next choices.',
 'Belonging is a place, not a connection.':'Enter a Drop In to explore its children.',
 'One whole. As many divisions as you need.':'Keep appointment actions and their choices in order.',
 'Read the structure. Open it between the lines.':'Read, reveal, and edit each action branch.',
 'Depth becomes a dimension you can touch.':'Separate appointment, parent, and child actions.',
 'Relationships take shape around their contents.':'Move next choices between parent Drop Ins.'
}
for a,b in replacements.items():s=s.replace(a,b)
p.write_text(s,encoding='utf-8')

p=base/'AdditionalConcepts.jsx';s=p.read_text(encoding='utf-8')
s=s.replace("import './additional-concepts.css';", "import './additional-concepts.css';\nimport {useDropInConcept,useCanvasSelection} from './DropInConceptContext';")
s=s.replace("const [tree,setTree]=useState(()=>({id:'sequence',name:'Collection',children:makeTree().children.flatMap(g=>g.children).slice(0,7)}));", 'const {tree,setTree,select:selectAction}=useStructure();')
s=s.replace("['sequence']", "['collection']")
s=s.replace("const [active,setActive]=useState('alpha');", 'const [active,setActive]=useCanvasSelection(tree.children[0]?.id||null);')
s=s.replace('const {tree,add}=useStructure();','const {tree,add,select}=useStructure();')
s=s.replace('const parent=findNode(tree,path[path.length-1]);','const parent=findNode(tree,path[path.length-1])||tree;')
s=s.replace('path.map(id=>findNode(tree,id))','path.map(id=>findNode(tree,id)).filter(Boolean)')
s=s.replace('const enter=()=>{if(selected){setPath(', 'const enter=()=>{if(selected){select(selected.id);setPath(')
s=s.replace('const enter=node=>{setPath([...path,node.id]);setSelected([]);};', 'const enter=node=>{selectAction(node.id);setPath([...path,node.id]);setSelected([]);};')
s=s.replace('const select=(index)=>{', 'const select=(index)=>{selectAction(parent.children[index].id);')
s=s.replace('setSelected([]);setNotice(`${group.children.length}', 'setSelected([]);selectAction(group.id);setNotice(`${group.children.length}')
s=s.replace('setDirection(i-position);setPosition(i);','select(node.id);setDirection(i-position);setPosition(i);')
s=s.replace('setPosition((position+delta+children.length)%children.length);','const next=(position+delta+children.length)%children.length;setPosition(next);select(children[next].id);')
s=s.replace("const [groups,setGroups]=useState(()=>makeTree().children);\n  const [items,setItems]=useState(()=>makeTree().children.flatMap(g=>g.children.map(n=>({...n,parent:g.id}))));\n  const [focus,setFocus]=useState('alpha');", "const {tree,add,move,select}=useStructure();\n  const groups=tree.children;\n  const items=groups.flatMap(g=>g.children.map(n=>({...n,parent:g.id})));\n  const [focus,setFocus]=useState(groups[0]?.id);")
s=s.replace('const focused=groups.find(g=>g.id===focus);','const focused=groups.find(g=>g.id===focus)||groups[0];')
s=s.replace("onAdd={name=>{const id=crypto.randomUUID();setGroups([...groups,{id,name}]);setFocus(id);}}", "onAdd={name=>setFocus(add(tree.id,name))}")
s=s.replace('onClick={()=>setFocus(g.id)}', 'onClick={()=>{setFocus(g.id);select(g.id);}}')
s=s.replace('setItems(previous=>previous.map(n=>n.id===item.id?{...n,parent:g.id}:n));setMessage', 'move([item.id],g.id);select(item.id);setMessage')
s=s.replace('onAdd={name=>setItems([...items,{id:crypto.randomUUID(),name,parent:focus}])}', 'onAdd={name=>add(focused.id,name)}')
replacements={
 'COLLECTION / RELATIONSHIP MATRIX':'DROP-INS / PARENT ASSIGNMENT','One element. One parent. A single precise choice.':'Each next choice appears beneath one parent action.',
 'Belonging,<br/><em>made explicit.</em>':'Choose the parent.<br/><em>Place the next action.</em>',
 'BUILD FROM THE INSIDE OUT':'GROUP DROP-INS INTO A PARENT ACTION', 'First the parts.<br/><em>Then the whole.</em>':'Choose the actions.<br/><em>Give them a parent.</em>',
 'Name this group':'Name parent drop-in','label="Add element"':'label="Add drop-in"','Create region':'Add drop-in',
 'Select neighboring elements. Enclose them in a new parent.':'Select neighboring Drop Ins and create their parent action.',
 'A relationship is an intersection.':'Assign next choices to the right parent action.',
 'Make a parent from the things that belong together.':'Group related actions beneath one Drop In.',
 'Bring the next layer into position.':'Turn through actions and enter their next choices.',
 'Divide the space. Keep the whole.':'Shape the view of each Drop In branch.',
 'COLLECTION / SHARED ORIGIN':'DROP-INS / PARENT AVAILABILITY',
 'SELECTED REGION':'SELECTED DROP-IN','Enter region':'Enter drop-in',
 'The handle changes the boundary.':'The handle reshapes the view.', 'The relationship stays intact.':'The Drop In relationship stays intact.',
 'An undivided space. Create its first region.':'Add the first child Drop In.',
 'The next line':'The next action', ' elements, one new parent.':' actions, one parent Drop In.',
 'Choose the elements that should become a family.':'Select actions to group beneath a new parent Drop In.',
}
for a,b in replacements.items():s=s.replace(a,b)
p.write_text(s,encoding='utf-8')

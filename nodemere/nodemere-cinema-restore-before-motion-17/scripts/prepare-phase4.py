from pathlib import Path
import re,json,hashlib,shutil
root=Path(__file__).resolve().parents[1]; product=root.parent; out=root/'src/product/phase4';out.mkdir(parents=True,exist_ok=True)
provenance=[]
def read(rel):
 p=product/rel; s=p.read_text(encoding='utf-8'); provenance.append({'source':rel,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()});return s
def write(name,s): (out/name).write_text(s,encoding='utf-8')
def between(s,a,b):return s[s.index(a):s.index(b)]
lead=read('src/sonar/pages/LeadsTable.jsx')
icons=between(lead,'import {\n  Search,','import {\n  TABLE_COLUMNS')
crmimports='''import React,{useState,useEffect,useRef,useMemo,useCallback} from 'react';
import {motion,AnimatePresence} from '../FrameMotion';
import {createPortal} from 'react-dom';
import {TABLE_COLUMNS,SOURCE_OPTIONS,CONTACT_METHOD_OPTIONS,CALL_STATUS_OPTIONS,PAYMENT_STATUS_OPTIONS,formatTimestamp,formatCurrency,normalizeOptionValue,getFieldDef} from './leadSchema';
const getCustomValue=(fields,key)=>fields?.[key];
const noop=()=>{};
'''+icons
crm=crmimports+between(lead,'const ICONS =','const PEOPLE_TABLE_VIEW_KEY')
color=between(lead,'  const renderColorbar = (lead) => {','  const renderNewRecordEmptyState')
color=color.replace('  const renderColorbar = (lead) => {','export const NativeColorbar = ({rule}) => {').replace('const matchedRule = evaluateColorbar(lead, colorbarRules);','const matchedRule = rule;')
crm+='\n'+color+'\nexport {DraggableHeader,LeadCell,ZoneColorPalette,FIELD_TYPE_ICONS,ICONS};\n'
write('CrmParts.jsx',crm)
write('leadSchema.js',read('src/sonar/lib/leadSchema.js'))
field=read('src/sonar/lib/fieldConfig.js'); defaults=between(field,'export const DEFAULT_FIELD_CONFIG','export const AVAILABLE_ICONS') if 'export const AVAILABLE_ICONS' in field else ''
# Fixture schema is the exact homepage data. It contains no persistent operations.
demo=read('src/sonar/pages/HomepagePeopleCrmDemo.jsx'); demo=between(demo,'export const DEMO_CUSTOM_FIELDS','const HomepagePeopleCrmDemo')
defaults=between(field,'export const DEFAULT_FIELD_CONFIG','export const AVAILABLE_ICONS')
# DEFAULT_FIELD_CONFIG declaration is followed by functions in some revisions. Keep declaration only.
defaults=defaults[:defaults.index('\n};')+3]
write('crmData.js',defaults+'\n'+demo.replace('const createInitialRows','export const createInitialRows').replace('const DEMO_FIELD_CONFIG','export const DEMO_FIELD_CONFIG').replace('const DEMO_COLORBAR_RULES','export const DEMO_COLORBAR_RULES'))
custom=read('src/sonar/lib/customFields.js'); write('columnTypes.js',between(custom,'export const CUSTOM_FIELD_TYPES','const titleCase'))
home=read('src/styles/HomePage.css');write('crm-entrance.native.css',between(home,'.scenario-demo-showcase .homepage-crm-demo.crm-demo-entrance.is-entering',' .impossible') if False else home[home.index('.scenario-demo-showcase .homepage-crm-demo.crm-demo-entrance.is-entering'):home.index('.scenario-demo-showcase .homepage-scenarios-builder .sb-canvas')])
# Keep original field configuration component and replace only drag/context/portal infrastructure.
settings=read('src/sonar/pages/FieldSettingsModal.jsx')
settings=re.sub(r"import \{.*?\} from '@dnd-kit/[^']+';\n",'',settings,flags=re.S) if False else settings
settings='\n'.join(l for l in settings.splitlines() if "from '@dnd-kit/" not in l and "import ResponsiveDialog" not in l and "import { createPortal }" not in l)
settings=settings.replace("from 'framer-motion'","from '../FrameMotion'").replace("from '../lib/fieldConfig'","from './fieldIcons'").replace("from '../lib/leadSchema'","from './leadSchema'")
settings=settings.replace("const FieldSettingsModal = ({", "const FieldSettingsModal = ({")
settings=settings.replace('  const [name, setName] = useState(', '  const [name, setName] = useState(')
# Pure deterministic wrapper remounts per authored configuration value; native markup is unchanged.
settings="const createPortal=(children)=>children; const ResponsiveDialog=({children,phoneOnly,...props})=><div {...props}>{children}</div>; const DndContext=({children})=><>{children}</>; const SortableContext=DndContext; const useSensors=()=>[]; const useSensor=()=>null; const MouseSensor=null,TouchSensor=null,closestCenter=null,verticalListSortingStrategy=null; const arrayMove=(a)=>a; const useSortable=()=>({attributes:{},listeners:{},setNodeRef:()=>{},transform:null,transition:null,isDragging:false}); const CSS={Transform:{toString:()=>undefined}};\n"+settings
settings=settings.replace('fixed inset-0 z-[200]', 'absolute inset-0 z-[200]')
write('FieldSettings.jsx',settings)
iconlist=between(field,'export const AVAILABLE_ICONS','\n];')+'\n];';write('fieldIcons.js',iconlist)
scenario=read('src/sonar/pages/Scenarios/Scenarios.jsx')
allimports=between(scenario,'import {\n  Phone,',"import './Scenarios.css'")
opts=between(scenario,'const OPTION_ICONS','const RECORD_TABLE_KEY_MAP')
# Keep only icon map; preceding/following helpers aren't required by the film.
opts=opts[:opts.index('\n};')+3]
hierarchy=between(scenario,'const AUTOMATION_HIERARCHY','const PANEL_CATEGORY_LABELS')
write('scenarioData.jsx',allimports+'\n'+opts+'\n'+hierarchy+'\nexport {AUTOMATION_HIERARCHY,OPTION_ICONS};')
write('scenarios.native.css',read('src/sonar/pages/Scenarios/Scenarios.css'))
# Node DOM and all its layered surfaces are lifted verbatim; events remain inert.
node=between(scenario,'                  {node.configured ? (','                  ) : (\n                    <div className="sb-node-inner-wrap"')[len('                  {node.configured ? ('):]
node=node.rstrip(); assert node.endswith('</>');
node=node.replace("ref={(el) => { if (el) circleRefs.current[node.id] = el.querySelector('.sb-node-sphere') || el; }}",'')
node=node.replace('canAddChild(node) && !isPaymentLockedNode','!hasOutgoingNode')
node=node.replace('onPointerEnter={() => setPlusHoveredNodeId(node.id)}','').replace("onPointerLeave={() => setPlusHoveredNodeId((current) => (current === node.id ? null : current))}",'').replace('onClick={() => handleAddNode(node.id)}','')
write('ScenarioNode.jsx',allimports+'''\nimport React from 'react';
export default function ScenarioNode({node,selected=false,status=null,active=false,completed=false,future=false,unrelated=false,hasOutgoingNode=false}){
const Icon=node.icon, accent=node.accent, nodeRunState=status,isActive=selected,isRunActiveNode=active,isPaymentLockedNode=false;
return <div className={`sb-builder-node sb-matte-node sb-is-configured ${selected?'sb-active-node':''} ${active?'sb-run-node-active':''} ${completed?'sb-run-node-complete':''} ${future?'sb-run-node-future':''} ${unrelated?'sb-run-node-unrelated':''}`} style={{left:node.x,top:node.y}}>
'''+node+'\n</div>;}')
# Preserve notification data model and exact reel markup; clock is supplied by film.
nest=read('src/sonar/nest/NestStage.jsx')
nestimports=between(nest,'import {\n','const ICONS')
# Includes framer import? Original first lines checked separately.
helpers=between(nest,'const ICONS','const IntroWord')
parts=between(nest,'const ContentIcon','export default function NestStage')
write('NestParts.jsx',"import React from 'react';\n"+nestimports+helpers+parts+'\nexport {ReelPart,contentForEvent,iconForEvent};')
write('nest.native.css',read('src/sonar/nest/nest.css'))
wave=read('src/sonar/nest/IntercomVoiceLine.jsx')
wave=wave[wave.index('const LAYERS'):wave.index('export default function')]
write('voiceGeometry.js',wave+'\nexport {LAYERS,wavePath,FLAT_PATH,MAX_AMPLITUDE};')
vars=read('src/sonar/pages/Scenarios/VariablesPane.jsx')
write('variables.reference.jsx',vars) # source-only reference; not imported, no APIs can run
write('provenance.json',json.dumps(provenance,indent=2))
print('Prepared native UI parts and source provenance.')

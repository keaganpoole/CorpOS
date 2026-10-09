import { ancestry, descendants, ordered, previewGraph, removeNode, STATUSES, validateGraph } from '../../sonar/lib/dropInGraph.js';
export { STATUSES, previewGraph, validateGraph };
export const STATUS_LABELS = {pending:'Pending',confirmed:'Confirmed',completed:'Completed',missed:'Missed',cancelled:'Cancelled'};
export const ROOT_ID = 'collection';
export function newAction(id,name,status,parent_id=null,sort_order=0) {
  const purposes={'Google Review':'Request a Google review','Private Feedback':'Collect private feedback','Resolve Concern':'Discuss their concern','Next Visit':'Arrange their next visit','Thank You':'Thank them for their visit','Invite Referral':'Invite a referral'};
  const purpose=purposes[name]||`Discuss ${name.toLowerCase()}`.slice(0,30);
  return {id,name,purpose,prompt:`Call the customer to ${purpose.toLowerCase()}. Use the appointment context and verified business information. Do not invent details or claim an action has been completed.`,available_on_status:status,parent_id,sort_order,is_active:true,canvas_x:0,canvas_y:0};
}
export function seedDropIns() {
  const sets={
    completed:[['Reviews','Google Review','Private Feedback','Resolve Concern'],['Rebooking','Next Visit','Check Availability'],['Follow-up','Thank You','Care Check','Questions','Share Details'],['Referrals','Invite Referral','Explain Offer']],
    pending:[['Confirmation','Confirm Visit','Check Details'],['Preparation','What to Bring','Answer Questions'],['Changes','Find Another Time','Cancel Request'],['Follow-up','Check Interest']],
    confirmed:[['Reminders','Visit Reminder','Directions'],['Preparation','Before Your Visit','Answer Questions'],['Changes','Reschedule','Cancel Request'],['Follow-up','Check Details']],
    missed:[['Reconnect','Check In','Offer New Time'],['Rebooking','Find Availability','Confirm New Visit'],['Follow-up','Answer Questions'],['Feedback','Understand Reason']],
    cancelled:[['Follow-up','Check In','Understand Reason'],['Rebooking','Find Another Time','Join Waitlist'],['Feedback','Share Feedback'],['Questions','Answer Questions']],
  };
  return STATUSES.flatMap(status=>sets[status].flatMap((names,index)=>{
    const prefix=status==='completed'?'':`${status}-`;
    const id=prefix+['alpha','beta','gamma','delta'][index];
    const parent=newAction(id,names[0],status,null,index);
    parent.purpose=`Discuss ${names[0].toLowerCase()}`;
    return [parent,...names.slice(1).map((name,i)=>newAction(`${prefix}${['a','b','c','d'][index]}${i+1}`,name,status,id,i))];
  }));
}
export function toConceptTree(items,status) {
  const rows=items.filter(n=>n.available_on_status===status).sort(ordered);
  const build=parent=>rows.filter(n=>(n.parent_id||null)===parent).map(n=>({...n,children:build(n.id)}));
  return {id:ROOT_ID,name:`${STATUS_LABELS[status]} appointment`,children:build(null)};
}
export function mergeConceptTree(items,tree,status) {
  const existing=new Map(items.map(n=>[n.id,n]));
  const rows=[];const seen=new Set();
  const walk=(nodes,parent=null)=>nodes.forEach((node,index)=>{
    if(seen.has(node.id))throw new Error('A drop-in cannot appear twice or contain itself.');
    seen.add(node.id);
    const {children,...fields}=node;
    rows.push({...newAction(node.id,node.name,status,parent,index),...existing.get(node.id),...fields,parent_id:parent,available_on_status:status,sort_order:index});
    walk(children||[],node.id);
  });
  walk(tree.children);
  const next=[...items.filter(n=>n.available_on_status!==status),...rows];
  const problem=validateGraph(next);if(problem)throw new Error(problem);
  return next;
}
export function moveActions(items,ids,parentId) {
  const moving=items.filter(n=>ids.includes(n.id));const parent=items.find(n=>n.id===parentId);
  if(!moving.length)return items;
  if(parentId&&!parent)throw new Error('Choose an existing parent.');
  if(moving.some(n=>n.available_on_status!==moving[0].available_on_status)||(parent&&parent.available_on_status!==moving[0].available_on_status))throw new Error('Parents and children must belong to the same status.');
  for(const node of moving)if(node.id===parentId||descendants(items,node.id).has(parentId))throw new Error('A drop-in cannot be nested inside itself.');
  const rootMoves=moving.filter(n=>!ancestry(items,n.id).some(id=>ids.includes(id)));
  const start=Math.max(-1,...items.filter(n=>n.parent_id===parentId).map(n=>n.sort_order))+1;
  return items.map(n=>{const i=rootMoves.findIndex(m=>m.id===n.id);return i<0?n:{...n,parent_id:parentId,sort_order:start+i};});
}
export function deleteAction(items,id){return removeNode(items,id);}
